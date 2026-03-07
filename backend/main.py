"""FastAPI entrypoint for the latency-optimized ADIA backend."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import threading
import time
from collections import defaultdict, deque
from typing import AsyncIterator

import requests
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from orchestrator import ADIAOrchestrator
from scenarios import SCENARIO_A, SCENARIO_B, SCENARIO_C
from services.document_parser import InvalidUploadError
from services.nova_client import NovaClient


load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("adia")

APP_TITLE = "ADIA - Autonomous Decision Intelligence Agent"
APP_VERSION = "3.0.0"
MODEL_ID = "amazon.nova-lite-v1:0"
KEEP_WARM_INTERVAL_SECONDS = 240


class RateLimiter:
    def __init__(self, max_requests: int = 20, window_seconds: int = 60) -> None:
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
                    detail="Too many requests. Please wait before trying again.",
                )
            bucket.append(now)


class AnalyzeRequest(BaseModel):
    problem: str = Field(..., min_length=10, max_length=3000)
    include_reasoning: bool = False



app = FastAPI(
    title=APP_TITLE,
    version=APP_VERSION,
    description="Fast two-call Bedrock pipeline for venture decision intelligence.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://adia-nova.vercel.app",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

rate_limiter = RateLimiter()
_init_lock = threading.Lock()
_keep_warm_started = False


def enforce_rate_limit(request: Request) -> None:
    client_id = request.client.host if request.client else "unknown"
    rate_limiter.check(client_id)


def _build_nova_client() -> NovaClient:
    return NovaClient(
        aws_region=os.getenv("AWS_REGION", "us-east-1"),
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
        aws_session_token=os.getenv("AWS_SESSION_TOKEN"),
        model_id=MODEL_ID,
    )


def _build_orchestrator() -> ADIAOrchestrator:
    return ADIAOrchestrator(_build_nova_client())


def _service_fallback(reason: str, include_reasoning: bool) -> dict:
    response = {
        "verdict": "CONDITIONAL",
        "conviction_score": 58,
        "fatal_flaw": "Live Nova analysis is temporarily unavailable.",
        "asymmetric_upside": "The app is still serving structured fallback output.",
        "executive_summary": (
            "ADIA could not reach the live Bedrock path, so a safe fallback verdict was returned. "
            "The UI remains operational while the service recovers."
        ),
        "key_risks": [
            "Live Bedrock path unavailable.",
            "Decision is based on fallback content.",
            "Retry for a fresh real-time verdict.",
        ],
        "key_assets": [
            "The API is online.",
            "The UI can still render a decision payload.",
            "The backend preserved a non-breaking response shape.",
        ],
        "recommended_action": "Retry after checking Bedrock credentials and deployment health.",
        "metadata": {
            "analysis_mode": "two_call_fast_path",
            "latency_mode": "optimized",
            "fallback_reason": reason,
            "nova_ready": False,
        },
    }
    if include_reasoning:
        response["reasoning_steps"] = [
            "Validated the request payload.",
            "Attempted to initialize the Bedrock pipeline.",
            "Returned a safe fallback verdict after the live path failed.",
        ]
    return response


def _ensure_orchestrator() -> ADIAOrchestrator | None:
    orchestrator = getattr(app.state, "orchestrator", None)
    if orchestrator is not None:
        return orchestrator

    with _init_lock:
        orchestrator = getattr(app.state, "orchestrator", None)
        if orchestrator is not None:
            return orchestrator
        try:
            orchestrator = _build_orchestrator()
        except Exception as exc:
            app.state.startup_error = str(exc)
            logger.exception("Failed to initialize ADIA orchestrator")
            return None

        app.state.orchestrator = orchestrator
        app.state.startup_error = None
        return orchestrator


def _warmup_once(orchestrator: ADIAOrchestrator) -> None:
    try:
        orchestrator.warmup()
        logger.info("Nova warmup completed")
    except Exception:
        logger.exception("Nova warmup failed")


def _resolve_public_base_url() -> str | None:
    for key in ("APP_BASE_URL", "RENDER_EXTERNAL_URL", "PUBLIC_BASE_URL"):
        value = os.getenv(key, "").strip().rstrip("/")
        if value:
            return value
    return None


def _keep_warm_loop(base_url: str) -> None:
    ping_url = f"{base_url}/ping"
    while True:
        time.sleep(KEEP_WARM_INTERVAL_SECONDS)
        try:
            requests.get(ping_url, timeout=5)
        except Exception:
            logger.debug("Self-ping failed for %s", ping_url)


def _start_keep_warm_thread() -> None:
    global _keep_warm_started
    if _keep_warm_started or os.getenv("DISABLE_SELF_PING") == "1":
        return

    base_url = _resolve_public_base_url()
    if not base_url:
        return

    thread = threading.Thread(target=_keep_warm_loop, args=(base_url,), daemon=True)
    thread.start()
    _keep_warm_started = True
    logger.info("Started keep-warm thread for %s", base_url)


@app.on_event("startup")
def startup_event() -> None:
    app.state.orchestrator = None
    app.state.startup_error = None
    orchestrator = _ensure_orchestrator()

    if orchestrator is not None and os.getenv("DISABLE_STARTUP_WARMUP") != "1":
        threading.Thread(target=_warmup_once, args=(orchestrator,), daemon=True).start()

    _start_keep_warm_thread()


@app.get("/")
def health_check() -> dict:
    return {
        "status": "ok",
        "app": "ADIA",
        "version": APP_VERSION,
        "model": MODEL_ID,
        "latency_mode": "optimized",
        "pipeline": "two_call_fast_path",
        "nova_ready": getattr(app.state, "orchestrator", None) is not None,
        "startup_error": getattr(app.state, "startup_error", None),
    }


@app.get("/ping")
def ping() -> dict:
    return {"status": "ok"}


async def _analyze_request(
    problem: str,
    *,
    files: list[UploadFile] | None = None,
    include_reasoning: bool = False,
) -> dict:
    orchestrator = _ensure_orchestrator()
    if orchestrator is None:
        reason = getattr(app.state, "startup_error", None) or "Orchestrator unavailable."
        return _service_fallback(reason, include_reasoning)

    try:
        return await orchestrator.analyze(
            problem,
            files=files or [],
            include_reasoning=include_reasoning,
        )
    except InvalidUploadError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Analysis failed")
        return _service_fallback(str(exc), include_reasoning)


@app.post("/demo/scenario_a")
async def demo_scenario_a(_: None = Depends(enforce_rate_limit)) -> dict:
    return await _analyze_request(SCENARIO_A)


@app.post("/demo/scenario_b")
async def demo_scenario_b(_: None = Depends(enforce_rate_limit)) -> dict:
    return await _analyze_request(SCENARIO_B)


@app.post("/demo/scenario_c")
async def demo_scenario_c(_: None = Depends(enforce_rate_limit)) -> dict:
    return await _analyze_request(SCENARIO_C)


@app.post("/analyze")
async def analyze_problem(
    payload: AnalyzeRequest,
    _: None = Depends(enforce_rate_limit),
) -> dict:
    return await _analyze_request(
        payload.problem,
        include_reasoning=payload.include_reasoning,
    )


@app.post("/analyze-with-docs")
async def analyze_with_docs(
    problem: str = Form(..., min_length=10, max_length=3000),
    include_reasoning: bool = Form(False),
    files: list[UploadFile] = File(default=[]),
    _: None = Depends(enforce_rate_limit),
) -> dict:
    return await _analyze_request(
        problem,
        files=files,
        include_reasoning=include_reasoning,
    )


@app.post("/analyze-stream")
async def analyze_stream(
    payload: AnalyzeRequest,
    _: None = Depends(enforce_rate_limit),
) -> StreamingResponse:
    async def event_stream() -> AsyncIterator[str]:
        yield f"data: {json.dumps({'type': 'agent', 'agent': 'analysis', 'status': 'running'})}\n\n"
        result = await _analyze_request(
            payload.problem,
            include_reasoning=payload.include_reasoning,
        )
        yield f"data: {json.dumps({'type': 'agent', 'agent': 'analysis', 'status': 'complete'})}\n\n"
        yield f"data: {json.dumps({'type': 'agent', 'agent': 'verdict', 'status': 'complete'})}\n\n"

        teaser = result.get("executive_summary", "")
        for token in teaser.split():
            yield f"data: {json.dumps({'type': 'token', 'text': token + ' '})}\n\n"
            await asyncio.sleep(0.01)

        yield f"data: {json.dumps({'type': 'result', 'data': result})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")

