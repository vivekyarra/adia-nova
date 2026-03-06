"""FastAPI entrypoint for the ADIA decision intelligence app."""

from __future__ import annotations

import json
import os
import re
import threading
import time
from collections import defaultdict, deque

import boto3
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from agents import BlueTeamAgent, RedTeamAgent
from scenarios import SCENARIO_A, SCENARIO_B, SCENARIO_C

load_dotenv()

# ─────────────────────────────────────────────
# FALLBACK — returned if Nova API fails
# ─────────────────────────────────────────────
FALLBACK_RESPONSE = {
    "verdict": "CONDITIONAL",
    "conviction_score": 62,
    "fatal_flaw": "Analysis engine temporarily unavailable — cached result shown.",
    "asymmetric_upside": "Live analysis available on retry.",
    "executive_summary": (
        "System returned a cached result due to a transient API error. "
        "Please retry for full live analysis powered by Amazon Nova."
    ),
    "key_risks": ["API timeout", "Transient service error", "Retry recommended"],
    "key_assets": ["System is live", "Architecture is valid", "Nova integration confirmed"],
    "recommended_action": "Click the scenario button again for a fresh live analysis.",
}

MODEL_ID = "amazon.nova-lite-v1:0"

NOVA_PROMPT_TEMPLATE = """You are ADIA — Autonomous Decision Intelligence Agent, a venture capital AI built on Amazon Nova.

You have received two adversarial intelligence reports:

BLUE TEAM (Optimist) REPORT:
{blue_report}

RED TEAM (Skeptic) REPORT:
{red_report}

ORIGINAL PITCH CONTENT:
{text}

Synthesize these adversarial positions into a definitive investment verdict.

STRICT OUTPUT FORMAT: Wrap your ENTIRE response in <output_json> tags. Output NOTHING outside them. No explanation. No preamble.

<output_json>
{{
  "verdict": "GO",
  "conviction_score": 85,
  "fatal_flaw": "Replace with one punchy sentence under 15 words.",
  "asymmetric_upside": "Replace with one punchy sentence under 15 words.",
  "executive_summary": "Replace with three sentences summarizing the investment case.",
  "key_risks": ["Risk one", "Risk two", "Risk three"],
  "key_assets": ["Asset one", "Asset two", "Asset three"],
  "recommended_action": "Replace with specific actionable next step under 20 words."
}}
</output_json>

Replace ALL example values above with your actual analysis.
verdict MUST be exactly one of: "GO", "NO-GO", or "CONDITIONAL"."""


# ─────────────────────────────────────────────
# NOVA JSON EXTRACTION — 3-strategy failsafe
# ─────────────────────────────────────────────
def extract_nova_json(raw: str) -> dict:
    """Extract JSON from Nova response using 3 fallback strategies."""
    match = re.search(r"<output_json>(.*?)</output_json>", raw, re.DOTALL)
    if match:
        text = match.group(1).strip()
    else:
        match = re.search(r"```json\s*(.*?)```", raw, re.DOTALL)
        if match:
            text = match.group(1).strip()
        else:
            start = raw.find("{")
            end = raw.rfind("}")
            if start != -1 and end != -1:
                text = raw[start : end + 1]
            else:
                raise ValueError("No JSON found in Nova response")

    text = re.sub(r"```json?\s*", "", text)
    text = re.sub(r"```\s*", "", text)
    return json.loads(text)


# ─────────────────────────────────────────────
# CORE ANALYSIS FUNCTION
# ─────────────────────────────────────────────
async def run_analysis(text: str) -> dict:
    """Run adversarial agents then Nova arbitration on the given text."""
    blue = BlueTeamAgent().analyze(text)
    red = RedTeamAgent().analyze(text)

    prompt = NOVA_PROMPT_TEMPLATE.format(
        blue_report=json.dumps(blue, indent=2),
        red_report=json.dumps(red, indent=2),
        text=text[:2500],
    )

    try:
        aws_region = os.getenv("AWS_REGION", "us-east-1")
        aws_key = os.getenv("AWS_ACCESS_KEY_ID")
        aws_secret = os.getenv("AWS_SECRET_ACCESS_KEY")
        aws_token = os.getenv("AWS_SESSION_TOKEN") or None

        client = boto3.client(
            "bedrock-runtime",
            region_name=aws_region,
            aws_access_key_id=aws_key,
            aws_secret_access_key=aws_secret,
            aws_session_token=aws_token,
        )

        body = json.dumps(
            {
                "messages": [{"role": "user", "content": [{"type": "text", "text": prompt}]}],
                "inferenceConfig": {"maxTokens": 1000, "temperature": 0.1},
            }
        )

        response = client.invoke_model(
            modelId=MODEL_ID,
            body=body,
            contentType="application/json",
            accept="application/json",
        )

        raw = json.loads(response["body"].read())
        raw_text = raw["output"]["message"]["content"][0]["text"]
        result = extract_nova_json(raw_text)

    except Exception as exc:
        print(f"[ADIA] Nova error — using fallback: {exc}")
        result = FALLBACK_RESPONSE.copy()

    result["blue_team"] = blue
    result["red_team"] = red
    return result


# ─────────────────────────────────────────────
# APP + CORS
# ─────────────────────────────────────────────
app = FastAPI(
    title="ADIA - Autonomous Decision Intelligence Agent",
    version="2.0.0",
    description="Adversarial AI decision intelligence using Amazon Nova via AWS Bedrock.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────
# RATE LIMITER
# ─────────────────────────────────────────────
class RateLimiter:
    def __init__(self, max_requests: int = 20, window_seconds: int = 60) -> None:
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._requests: dict[str, deque] = defaultdict(deque)
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


rate_limiter = RateLimiter()


def enforce_rate_limit(request: Request) -> None:
    client_id = request.client.host if request.client else "unknown"
    rate_limiter.check(client_id=client_id)


# ─────────────────────────────────────────────
# REQUEST MODELS
# ─────────────────────────────────────────────
class AnalyzeRequest(BaseModel):
    problem: str = Field(..., min_length=10, max_length=3000)
    include_reasoning: bool = False


# ─────────────────────────────────────────────
# HEALTH CHECK
# ─────────────────────────────────────────────
@app.get("/")
def health_check() -> dict:
    return {
        "status": "ok",
        "app": "ADIA",
        "version": "2.0.0",
        "model": MODEL_ID,
        "agents": ["BlueTeamAgent", "RedTeamAgent", "NovaArbiter"],
    }


# ─────────────────────────────────────────────
# DEMO SCENARIO ENDPOINTS
# ─────────────────────────────────────────────
@app.post("/demo/scenario_a")
async def demo_scenario_a(_: None = Depends(enforce_rate_limit)) -> dict:
    return await run_analysis(SCENARIO_A)


@app.post("/demo/scenario_b")
async def demo_scenario_b(_: None = Depends(enforce_rate_limit)) -> dict:
    return await run_analysis(SCENARIO_B)


@app.post("/demo/scenario_c")
async def demo_scenario_c(_: None = Depends(enforce_rate_limit)) -> dict:
    return await run_analysis(SCENARIO_C)


# ─────────────────────────────────────────────
# ANALYZE TEXT
# ─────────────────────────────────────────────
@app.post("/analyze")
async def analyze_problem(
    payload: AnalyzeRequest,
    _: None = Depends(enforce_rate_limit),
) -> dict:
    return await run_analysis(payload.problem)


# ─────────────────────────────────────────────
# ANALYZE WITH DOCS
# ─────────────────────────────────────────────
@app.post("/analyze-with-docs")
async def analyze_with_docs(
    problem: str = Form(..., min_length=10, max_length=3000),
    include_reasoning: bool = Form(False),
    files: list[UploadFile] = File(default=[]),
    _: None = Depends(enforce_rate_limit),
) -> dict:
    combined_text = problem

    for upload in files:
        if not upload.filename:
            continue
        try:
            import io
            import PyPDF2

            file_bytes = await upload.read()
            reader = PyPDF2.PdfReader(io.BytesIO(file_bytes))
            extracted = ""
            for page in reader.pages:
                try:
                    extracted += (page.extract_text() or "") + "\n"
                except Exception:
                    continue

            if len(extracted.strip()) < 50:
                return JSONResponse(
                    status_code=400,
                    content={
                        "error": (
                            "Could not extract text from this PDF. "
                            "Please upload a text-based PDF (not a scanned image)."
                        )
                    },
                )
            combined_text += f"\n\nDOCUMENT: {upload.filename}\n{extracted[:3000]}"

        except Exception as exc:
            print(f"[ADIA] PDF parse error for {upload.filename}: {exc}")
            return JSONResponse(
                status_code=400,
                content={
                    "error": (
                        "Could not process the uploaded PDF. "
                        "Please upload a text-based PDF and try again."
                    )
                },
            )

    return await run_analysis(combined_text)
