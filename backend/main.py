"""FastAPI entrypoint for the ADIA decision intelligence app."""

from __future__ import annotations

from collections import defaultdict, deque
import os
import threading
import time

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from orchestrator import ADIAOrchestrator
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


def parse_cors_origins() -> list[str]:
    """Build CORS allowlist from defaults and optional environment variable."""
    defaults = ["http://localhost:3000", "http://127.0.0.1:3000"]
    extra = os.getenv("CORS_ALLOW_ORIGINS", "")
    if not extra.strip():
        return defaults

    parsed = [origin.strip() for origin in extra.split(",") if origin.strip()]
    return defaults + parsed


app = FastAPI(
    title="ADIA - Autonomous Decision Intelligence Agent",
    version="1.0.0",
    description="Agentic AI decision support using Amazon Nova via AWS Bedrock.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=parse_cors_origins(),
    # Allow hosted Vercel domains like https://adia-nova.vercel.app and preview URLs.
    allow_origin_regex=r"^https://.*\.vercel\.app$",
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

