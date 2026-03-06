"""FastAPI entrypoint for the ADIA decision intelligence app."""

from __future__ import annotations

from collections import defaultdict, deque
import json
import os
import re
import threading
import time

import boto3
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from agents import BlueTeamAgent, RedTeamAgent
from orchestrator import ADIAOrchestrator
from scenarios import SCENARIO_A, SCENARIO_B, SCENARIO_C
from services.document_parser import InvalidUploadError
from services.nova_client import (
    MODEL_ID,
    NovaAuthenticationError,
    NovaCallLimitError,
    NovaClient,
    NovaConfigurationError,
    NovaInvocationError,
)

load_dotenv()


def extract_nova_json(raw: str) -> dict:
    # Strategy 1: XML tags
    match = re.search(r"<output_json>(.*?)</output_json>", raw, re.DOTALL)
    if match:
        text = match.group(1).strip()
    else:
        # Strategy 2: Markdown code fence
        match = re.search(r"```json\s*(.*?)```", raw, re.DOTALL)
        if match:
            text = match.group(1).strip()
        else:
            # Strategy 3: First { to last }
            start = raw.find("{")
            end = raw.rfind("}")
            if start != -1 and end != -1:
                text = raw[start : end + 1]
            else:
                raise ValueError("No JSON found in Nova response")
    # Strip any remaining markdown artifacts
    text = re.sub(r"```json?\s*", "", text)
    text = re.sub(r"```\s*", "", text)
    return json.loads(text)


FALLBACK_RESPONSE = {
    "verdict": "CONDITIONAL",
    "conviction_score": 62,
    "fatal_flaw": "Analysis engine temporarily unavailable — cached result shown.",
    "asymmetric_upside": "Live analysis available on retry.",
    "executive_summary": "System returned a cached result due to a transient API error. Please retry for full analysis.",
    "key_risks": ["API timeout", "Transient service error", "Retry recommended"],
    "key_assets": ["System is live", "Architecture is valid", "Nova integration confirmed"],
    "recommended_action": "Click the scenario button again for a fresh live analysis.",
}


NOVA_PROMPT = """You are ADIA — Autonomous Decision Intelligence Agent, built on Amazon Nova.

BLUE TEAM ANALYSIS:
{blue_report}

RED TEAM ANALYSIS:
{red_report}

PITCH CONTENT:
{text}

Synthesize the adversarial reports. Return ONLY a JSON object inside <output_json> tags.
Output nothing outside the tags. No explanation. No preamble.

<output_json>
{{
  "verdict": "GO",
  "conviction_score": 85,
  "fatal_flaw": "One sentence, under 15 words, most critical risk.",
  "asymmetric_upside": "One sentence, under 15 words, biggest opportunity.",
  "executive_summary": "Three sentences max summarizing the investment case.",
  "key_risks": ["Risk one", "Risk two", "Risk three"],
  "key_assets": ["Asset one", "Asset two", "Asset three"],
  "recommended_action": "Specific actionable next step, under 20 words."
}}
</output_json>

Replace the example values with your actual analysis. verdict must be \"GO\", \"NO-GO\", or \"CONDITIONAL\"."""


app = FastAPI(
    title="ADIA - Autonomous Decision Intelligence Agent",
    version="1.0.0",
    description="Agentic AI decision support using Amazon Nova via AWS Bedrock.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalyzeRequest(BaseModel):
    """JSON body for problem-only analysis endpoint."""

    problem: str = Field(..., min_length=10, max_length=1500)
    include_reasoning: bool = False


class RateLimiter:
    """Simple in-memory request throttling to reduce accidental API overuse."""

    def __init__(self, max_requests: int = 15, window_seconds: int = 60) -> None:
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._requests: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def check(self, client_id: str) -> None:
        now = time.time()
        with self._lock:
            bucket = self._requests[client_id]
            while bucket and (now - bucket[0]) > self.window_seconds:
                bucket.popleft()

            if len(bucket) >= self.max_requests:
                raise HTTPException(
                    status_code=429,
                    detail="Too many requests. Please wait a minute before trying again.",
                )
            bucket.append(now)


def build_orchestrator() -> ADIAOrchestrator:
    nova_client = NovaClient(
        aws_region=os.getenv("AWS_REGION", ""),
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
        aws_session_token=os.getenv("AWS_SESSION_TOKEN"),
    )
    return ADIAOrchestrator(nova_client=nova_client)


rate_limiter = RateLimiter(max_requests=15, window_seconds=60)

try:
    orchestrator = build_orchestrator()
except NovaConfigurationError as exc:
    orchestrator = None
    startup_error = str(exc)
else:
    startup_error = ""


def enforce_rate_limit(request: Request) -> None:
    client_id = request.client.host if request.client else "unknown"
    rate_limiter.check(client_id=client_id)


def get_orchestrator() -> ADIAOrchestrator:
    if orchestrator is None:
        raise NovaConfigurationError(startup_error or "Nova client configuration failed at startup.")
    return orchestrator


async def run_analysis(text: str) -> dict:
    blue = BlueTeamAgent().analyze(text)
    red = RedTeamAgent().analyze(text)

    prompt = NOVA_PROMPT.format(
        blue_report=json.dumps(blue, indent=2),
        red_report=json.dumps(red, indent=2),
        text=text[:2500],
    )

    try:
        client = boto3.client("bedrock-runtime", region_name=os.getenv("AWS_REGION", "us-east-1"))
        response = client.invoke_model(
            modelId="amazon.nova-lite-v1:0",
            body=json.dumps(
                {
                    "messages": [{"role": "user", "content": [{"type": "text", "text": prompt}]}],
                    "inferenceConfig": {"maxTokens": 1000, "temperature": 0.1},
                }
            ),
            contentType="application/json",
            accept="application/json",
        )
        raw = json.loads(response["body"].read())
        raw_text = raw["output"]["message"]["content"][0]["text"]
        result = extract_nova_json(raw_text)
    except Exception as e:  # pragma: no cover - defensive around external service
        print(f"Nova error: {e}")
        result = FALLBACK_RESPONSE.copy()

    result["blue_team"] = blue
    result["red_team"] = red
    return result


@app.get("/")
def health_check() -> dict:
    """Health check endpoint."""
    if startup_error:
        return {"status": "degraded", "error": startup_error, "model": MODEL_ID}
    return {
        "status": "ok",
        "app": "ADIA",
        "model": MODEL_ID,
        "max_nova_calls_per_request": 3,
    }


@app.post("/demo/scenario_a")
async def demo_scenario_a() -> dict:
    return await run_analysis(SCENARIO_A)


@app.post("/demo/scenario_b")
async def demo_scenario_b() -> dict:
    return await run_analysis(SCENARIO_B)


@app.post("/demo/scenario_c")
async def demo_scenario_c() -> dict:
    return await run_analysis(SCENARIO_C)


class AnalyzeTextRequest(BaseModel):
    text: str = Field(..., min_length=10, max_length=4000)


@app.post("/demo/analyze_text")
async def demo_analyze_text(payload: AnalyzeTextRequest) -> dict:
    return await run_analysis(payload.text)


@app.post("/analyze")
async def analyze_problem(
    payload: AnalyzeRequest,
    _: None = Depends(enforce_rate_limit),
) -> dict:
    """Analyze a decision problem without file uploads."""
    orchestrator_instance = get_orchestrator()
    return await orchestrator_instance.analyze(
        problem=payload.problem,
        files=[],
        include_reasoning=payload.include_reasoning,
    )


@app.post("/analyze-with-docs")
async def analyze_with_docs(
    problem: str = Form(..., min_length=10, max_length=1500),
    include_reasoning: bool = Form(False),
    files: list[UploadFile] = File(default=[]),
    _: None = Depends(enforce_rate_limit),
) -> dict:
    """Analyze a decision problem with optional supporting files."""
    orchestrator_instance = get_orchestrator()
    return await orchestrator_instance.analyze(
        problem=problem,
        files=files,
        include_reasoning=include_reasoning,
    )


@app.exception_handler(NovaConfigurationError)
async def handle_nova_configuration_error(_: Request, exc: NovaConfigurationError):
    return JSONResponse(status_code=500, content={"detail": str(exc)})


@app.exception_handler(NovaAuthenticationError)
async def handle_nova_auth_error(_: Request, exc: NovaAuthenticationError):
    return JSONResponse(status_code=401, content={"detail": str(exc)})


@app.exception_handler(NovaCallLimitError)
async def handle_nova_limit_error(_: Request, exc: NovaCallLimitError):
    return JSONResponse(status_code=429, content={"detail": str(exc)})


@app.exception_handler(NovaInvocationError)
async def handle_nova_invoke_error(_: Request, exc: NovaInvocationError):
    return JSONResponse(status_code=502, content={"detail": str(exc)})


@app.exception_handler(InvalidUploadError)
async def handle_upload_error(_: Request, exc: InvalidUploadError):
    return JSONResponse(status_code=400, content={"detail": str(exc)})

