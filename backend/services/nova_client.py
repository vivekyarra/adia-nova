"""Amazon Nova Bedrock client with strict per-request call budgeting."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Sequence

import boto3
from botocore.exceptions import BotoCoreError, ClientError, NoCredentialsError, PartialCredentialsError


MODEL_ID = "amazon.nova-lite-v1:0"


class NovaConfigurationError(RuntimeError):
    """Raised when Nova client configuration is missing or invalid."""


class NovaAuthenticationError(RuntimeError):
    """Raised when AWS authentication fails."""


class NovaInvocationError(RuntimeError):
    """Raised when a Bedrock model invocation fails."""


class NovaCallLimitError(RuntimeError):
    """Raised when the request exceeds the Nova call budget."""


@dataclass
class NovaCallBudget:
    """Tracks and limits model calls for a single API request."""

    max_calls: int = 3
    calls_used: int = 0

    def consume(self) -> None:
        if self.calls_used >= self.max_calls:
            raise NovaCallLimitError(
                f"Maximum Nova call budget reached ({self.max_calls} calls per request)."
            )
        self.calls_used += 1


@dataclass
class ImageInput:
    """Represents a single image payload for multimodal prompts."""

    name: str
    image_format: str
    data: bytes


class NovaClient:
    """Wrapper around Bedrock Runtime Converse API for Amazon Nova."""

    def __init__(
        self,
        aws_region: str,
        aws_access_key_id: str | None = None,
        aws_secret_access_key: str | None = None,
        aws_session_token: str | None = None,
        model_id: str = MODEL_ID,
    ) -> None:
        normalized_region = self._normalize_env_value(aws_region)
        normalized_access_key = self._normalize_env_value(aws_access_key_id)
        normalized_secret_key = self._normalize_env_value(aws_secret_access_key)
        normalized_session_token = self._normalize_env_value(aws_session_token)

        if not normalized_region:
            raise NovaConfigurationError("AWS_REGION is missing. Add it to backend/.env.")

        if (normalized_access_key and not normalized_secret_key) or (
            normalized_secret_key and not normalized_access_key
        ):
            raise NovaConfigurationError(
                "AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must both be set when using static credentials."
            )

        if normalized_session_token and not (normalized_access_key and normalized_secret_key):
            raise NovaConfigurationError(
                "AWS_SESSION_TOKEN requires AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY."
            )

        if normalized_access_key and normalized_access_key.upper().startswith("ASIA") and not normalized_session_token:
            raise NovaConfigurationError(
                "Temporary AWS credentials detected (AWS_ACCESS_KEY_ID starts with ASIA). Set AWS_SESSION_TOKEN in backend/.env or Render Environment settings."
            )

        self.model_id = model_id
        self.aws_region = normalized_region
        self._client = self._build_client(
            aws_region=normalized_region,
            aws_access_key_id=normalized_access_key,
            aws_secret_access_key=normalized_secret_key,
            aws_session_token=normalized_session_token,
        )

    @staticmethod
    def _build_client(
        aws_region: str,
        aws_access_key_id: str | None,
        aws_secret_access_key: str | None,
        aws_session_token: str | None,
    ):
        session_kwargs: dict[str, str] = {"region_name": aws_region}
        if aws_access_key_id and aws_secret_access_key:
            session_kwargs["aws_access_key_id"] = aws_access_key_id
            session_kwargs["aws_secret_access_key"] = aws_secret_access_key
            if aws_session_token:
                session_kwargs["aws_session_token"] = aws_session_token

        return boto3.client("bedrock-runtime", **session_kwargs)

    @staticmethod
    def _normalize_env_value(value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip().strip('"').strip("'")
        return stripped or None

    def ask_nova(
        self,
        prompt: str,
        *,
        budget: NovaCallBudget,
        system_prompt: str,
        images: Sequence[ImageInput] | None = None,
        temperature: float = 0.2,
        max_tokens: int = 700,
    ) -> str:
        """Send one prompt to Nova using the remaining call budget."""
        budget.consume()

        user_content: list[dict] = [{"text": prompt}]
        if images:
            for image in images:
                user_content.append(
                    {
                        "image": {
                            "format": image.image_format,
                            "source": {"bytes": image.data},
                        }
                    }
                )

        try:
            # Nova invocation point for both text and multimodal reasoning.
            response = self._client.converse(
                modelId=self.model_id,
                system=[{"text": system_prompt}],
                messages=[{"role": "user", "content": user_content}],
                inferenceConfig={
                    "maxTokens": max_tokens,
                    "temperature": temperature,
                    "topP": 0.9,
                },
            )
        except (NoCredentialsError, PartialCredentialsError) as exc:
            raise NovaAuthenticationError(
                "AWS credentials are invalid or missing. Check AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_SESSION_TOKEN."
            ) from exc
        except ClientError as exc:
            code = exc.response.get("Error", {}).get("Code", "")
            if code == "AccessDeniedException":
                raise NovaAuthenticationError(
                    "Bedrock access denied. Attach IAM permission bedrock:InvokeModel for amazon.nova-lite-v1:0 in AWS_REGION=us-east-1."
                ) from exc
            if code in {"UnrecognizedClientException", "InvalidSignatureException", "ExpiredTokenException"}:
                raise NovaAuthenticationError(
                    f"Bedrock authentication failed ({code}). Verify AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_SESSION_TOKEN (for temporary creds), and AWS_REGION=us-east-1 on Render."
                ) from exc
            raise NovaInvocationError(f"Bedrock invoke_model failed ({code}): {exc}") from exc
        except BotoCoreError as exc:
            raise NovaInvocationError(f"Bedrock runtime error: {exc}") from exc

        return self._extract_text(response.get("output", {}).get("message", {}).get("content", []))

    @staticmethod
    def _extract_text(content: Iterable[dict]) -> str:
        text_chunks: list[str] = []
        for item in content:
            text = item.get("text")
            if text:
                text_chunks.append(text)
        return "\n".join(text_chunks).strip()
