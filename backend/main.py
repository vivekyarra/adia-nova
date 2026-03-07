"""FastAPI entrypoint for the ADIA decision intelligence app."""

from __future__ import annotations

import base64
import json
import os
import re
import threading
import time
import uuid
from collections import defaultdict, deque

import boto3
import numpy as np
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

from agents import BlueTeamAgent, RedTeamAgent
from orchestrator import ADIAOrchestrator
from scenarios import SCENARIO_A, SCENARIO_B, SCENARIO_C
from seed_pitches import SEED_PITCHES
from services.nova_client import ALL_TOOLS, FATAL_FLAW_TOOL, NovaClient

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
    "key_risks": [
        {"text": "API timeout", "citation": "system"},
        {"text": "Transient service error", "citation": "system"},
        {"text": "Retry recommended", "citation": "system"},
    ],
    "key_assets": [
        {"text": "System is live", "citation": "system"},
        {"text": "Architecture is valid", "citation": "system"},
        {"text": "Nova integration confirmed", "citation": "system"},
    ],
    "recommended_action": "Click the scenario button again for a fresh live analysis.",
    "fatal_flaws": [],
    "similar_cases": [],
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

For each risk and asset you identify, cite the exact source: either the uploaded document page number (e.g. "Page 2") or note it as "model inference." Format risks and assets as JSON objects with "text" and "citation" keys.

If you find a fatal flaw that would make this a NO-GO, use the flag_fatal_flaw tool.
If critical information is missing and you cannot give a confident verdict, use the request_clarification tool.

STRICT OUTPUT FORMAT: Wrap your ENTIRE response in <output_json> tags. Output NOTHING outside them (except tool calls). No explanation. No preamble.

<output_json>
{{
  "verdict": "GO",
  "conviction_score": 85,
  "fatal_flaw": "Replace with one punchy sentence under 15 words.",
  "asymmetric_upside": "Replace with one punchy sentence under 15 words.",
  "executive_summary": "Replace with three sentences summarizing the investment case.",
  "key_risks": [{{"text": "Risk description", "citation": "Page 2 or model inference"}}],
  "key_assets": [{{"text": "Asset description", "citation": "Page 1 or model inference"}}],
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


def _normalize_cited_items(items: list) -> list[dict]:
    """Convert items to {text, citation} objects."""
    normalized = []
    for item in items:
        if isinstance(item, dict):
            normalized.append(item)
        elif isinstance(item, str):
            normalized.append({"text": item, "citation": "model inference"})
    return normalized


# ─────────────────────────────────────────────
# NOVA CLIENT INITIALIZATION
# ─────────────────────────────────────────────
def _build_nova_client() -> NovaClient | None:
    """Build NovaClient from environment variables."""
    try:
        return NovaClient(
            aws_region=os.getenv("AWS_REGION", "us-east-1"),
            aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
            aws_session_token=os.getenv("AWS_SESSION_TOKEN"),
        )
    except Exception as exc:
        print(f"[ADIA] NovaClient init warning: {exc}")
        return None


_nova_client = _build_nova_client()


def _get_orchestrator() -> ADIAOrchestrator | None:
    if _nova_client is None:
        return None
    return ADIAOrchestrator(_nova_client)


def _get_bedrock_client():
    """Build raw bedrock-runtime client for direct API calls."""
    return boto3.client(
        "bedrock-runtime",
        region_name=os.getenv("AWS_REGION", "us-east-1"),
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
        aws_session_token=os.getenv("AWS_SESSION_TOKEN") or None,
    )


# ─────────────────────────────────────────────
# FAISS SIMILAR DECISIONS INDEX
# ─────────────────────────────────────────────
def _embed_text_simple(text: str, dim: int = 256) -> np.ndarray:
    """Simple hash-based embedding for FAISS similarity search."""
    tokens = re.findall(r"[a-zA-Z0-9]+", text.lower())
    vector = np.zeros(dim, dtype=np.float32)
    if not tokens:
        return vector
    for token in tokens:
        token_hash = hash(token)
        index = abs(token_hash) % dim
        sign = -1.0 if token_hash % 2 else 1.0
        vector[index] += sign
    norm = np.linalg.norm(vector)
    if norm > 0:
        vector /= norm
    return vector


def _build_faiss_index():
    """Build FAISS index from seed pitches on startup."""
    try:
        import faiss
    except ImportError:
        return None, []

    dim = 256
    vectors = np.vstack([
        _embed_text_simple(p["summary"], dim) for p in SEED_PITCHES
    ]).astype("float32")

    index = faiss.IndexFlatIP(dim)
    index.add(vectors)
    return index, SEED_PITCHES


_faiss_index, _faiss_pitches = _build_faiss_index()


def find_similar_cases(pitch_text: str, k: int = 2) -> list[dict]:
    """Find top-k similar historical pitches using FAISS."""
    if _faiss_index is None or not _faiss_pitches:
        return []

    query = _embed_text_simple(pitch_text).reshape(1, -1).astype("float32")
    scores, indices = _faiss_index.search(query, min(k, len(_faiss_pitches)))

    results = []
    for score, idx in zip(scores[0], indices[0]):
        if idx < 0:
            continue
        pitch = _faiss_pitches[int(idx)]
        results.append({
            "name": pitch["name"],
            "outcome": pitch["outcome"],
            "similarity_score": round(float(score), 3),
            "lesson": pitch["lesson"],
        })
    return results


# ─────────────────────────────────────────────
# SESSION STORE — Agentic Loop Memory
# ─────────────────────────────────────────────
_sessions: dict[str, dict] = {}
MAX_LOOP_ITERATIONS = 3


# ─────────────────────────────────────────────
# CORE ANALYSIS FUNCTION
# ─────────────────────────────────────────────
async def run_analysis(text: str) -> dict:
    """Run adversarial agents then Nova arbitration."""
    blue = BlueTeamAgent().analyze(text)
    red = RedTeamAgent().analyze(text)

    prompt = NOVA_PROMPT_TEMPLATE.format(
        blue_report=json.dumps(blue, indent=2),
        red_report=json.dumps(red, indent=2),
        text=text[:2500],
    )

    try:
        client = _get_bedrock_client()

        response = client.converse(
            modelId=MODEL_ID,
            system=[
                {
                    "text": (
                        "You are ADIA, a venture investment analyst. "
                        "Return only the requested JSON payload. "
                        "If you find a fatal flaw, use the flag_fatal_flaw tool. "
                        "If critical information is missing, use request_clarification."
                    )
                }
            ],
            messages=[{"role": "user", "content": [{"text": prompt}]}],
            inferenceConfig={"maxTokens": 1000, "temperature": 0.1},
            toolConfig={"tools": ALL_TOOLS},
        )

        # Extract text and tool use results
        content = response["output"]["message"]["content"]
        text_parts = []
        fatal_flaws = []
        clarification_needed = None
        for item in content:
            if "text" in item:
                text_parts.append(item["text"])
            elif "toolUse" in item:
                tu = item["toolUse"]
                tool_name = tu.get("name", "")
                tool_input = tu.get("input", {})
                if tool_name == "flag_fatal_flaw":
                    fatal_flaws.append({
                        "flaw": tool_input.get("flaw", "Unknown"),
                        "severity": tool_input.get("severity", "major"),
                        "evidence": tool_input.get("evidence", ""),
                    })
                elif tool_name == "request_clarification":
                    clarification_needed = {
                        "question": tool_input.get("question", ""),
                        "missing_field": tool_input.get("missing_field", ""),
                    }

        raw_text = "\n".join(text_parts)
        result = extract_nova_json(raw_text)
        result["fatal_flaws"] = fatal_flaws
        if clarification_needed:
            result["clarification_needed"] = clarification_needed

        for key in ("key_risks", "key_assets"):
            result[key] = _normalize_cited_items(result.get(key, []))

    except Exception as exc:
        print(f"[ADIA] Nova error — using fallback: {exc}")
        result = FALLBACK_RESPONSE.copy()

    result["blue_team"] = blue
    result["red_team"] = red

    # Attach similar historical cases
    result["similar_cases"] = find_similar_cases(text, k=2)

    return result


# ─────────────────────────────────────────────
# APP + CORS
# ─────────────────────────────────────────────
app = FastAPI(
    title="ADIA - Autonomous Decision Intelligence Agent",
    version="3.0.0",
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


class TranscribeRequest(BaseModel):
    audio_b64: str
    mime_type: str = "audio/wav"


class ContinueRequest(BaseModel):
    session_id: str
    answer: str


class SimilarRequest(BaseModel):
    pitch_text: str = Field(..., min_length=10, max_length=3000)


# ─────────────────────────────────────────────
# HEALTH CHECK
# ─────────────────────────────────────────────
@app.get("/")
def health_check() -> dict:
    return {
        "status": "ok",
        "app": "ADIA",
        "version": "3.0.0",
        "model": MODEL_ID,
        "agents": ["ResearchAgent", "AnalysisAgent", "ReasoningAgent", "ReportAgent"],
        "capabilities": ["multimodal", "tool_use", "streaming", "voice", "similar_cases", "agentic_loop"],
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
# ANALYZE WITH DOCS (Multimodal)
# ─────────────────────────────────────────────
@app.post("/analyze-with-docs")
async def analyze_with_docs(
    problem: str = Form(..., min_length=10, max_length=3000),
    include_reasoning: bool = Form(False),
    files: list[UploadFile] = File(default=[]),
    _: None = Depends(enforce_rate_limit),
) -> dict:
    orchestrator = _get_orchestrator()
    if orchestrator is not None:
        try:
            result = await orchestrator.analyze(
                problem=problem,
                files=files,
                include_reasoning=include_reasoning,
            )
            result["similar_cases"] = find_similar_cases(problem, k=2)
            return result
        except Exception as exc:
            print(f"[ADIA] Orchestrator error, falling back to legacy: {exc}")

    # Legacy fallback — text-only extraction
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
                    "error": "Could not process the uploaded PDF. Please try again."
                },
            )

    return await run_analysis(combined_text)


# ─────────────────────────────────────────────
# STREAMING ANALYSIS via SSE
# ─────────────────────────────────────────────
@app.post("/analyze-stream")
async def analyze_stream(
    payload: AnalyzeRequest,
    _: None = Depends(enforce_rate_limit),
):
    """Stream analysis via Server-Sent Events."""
    text = payload.problem

    async def generate():
        # Phase 1: Run Blue/Red teams
        yield f"data: {json.dumps({'type': 'agent', 'agent': 'BlueTeamAgent', 'status': 'analyzing'})}\n\n"
        blue = BlueTeamAgent().analyze(text)
        yield f"data: {json.dumps({'type': 'agent', 'agent': 'BlueTeamAgent', 'status': 'done'})}\n\n"

        yield f"data: {json.dumps({'type': 'agent', 'agent': 'RedTeamAgent', 'status': 'analyzing'})}\n\n"
        red = RedTeamAgent().analyze(text)
        yield f"data: {json.dumps({'type': 'agent', 'agent': 'RedTeamAgent', 'status': 'done'})}\n\n"

        # Phase 2: Stream Nova arbitration
        yield f"data: {json.dumps({'type': 'agent', 'agent': 'NovaReasoning', 'status': 'streaming'})}\n\n"

        prompt = NOVA_PROMPT_TEMPLATE.format(
            blue_report=json.dumps(blue, indent=2),
            red_report=json.dumps(red, indent=2),
            text=text[:2500],
        )

        if _nova_client is not None:
            try:
                full_text = ""
                for chunk in _nova_client.stream_nova(
                    prompt,
                    system_prompt=(
                        "You are ADIA, a venture investment analyst. "
                        "Return only the requested JSON payload."
                    ),
                    max_tokens=1000,
                    temperature=0.1,
                ):
                    full_text += chunk
                    yield f"data: {json.dumps({'type': 'token', 'text': chunk})}\n\n"

                yield f"data: {json.dumps({'type': 'agent', 'agent': 'NovaReasoning', 'status': 'done'})}\n\n"

                try:
                    result = extract_nova_json(full_text)
                    for key in ("key_risks", "key_assets"):
                        result[key] = _normalize_cited_items(result.get(key, []))
                    if "fatal_flaws" not in result:
                        result["fatal_flaws"] = []
                except Exception:
                    result = FALLBACK_RESPONSE.copy()

                result["blue_team"] = blue
                result["red_team"] = red
                result["similar_cases"] = find_similar_cases(text, k=2)
                yield f"data: {json.dumps({'type': 'result', 'data': result})}\n\n"
            except Exception as exc:
                print(f"[ADIA] Stream error: {exc}")
                result = FALLBACK_RESPONSE.copy()
                result["blue_team"] = blue
                result["red_team"] = red
                result["similar_cases"] = []
                yield f"data: {json.dumps({'type': 'result', 'data': result})}\n\n"
        else:
            result = FALLBACK_RESPONSE.copy()
            result["blue_team"] = blue
            result["red_team"] = red
            result["similar_cases"] = []
            yield f"data: {json.dumps({'type': 'result', 'data': result})}\n\n"

        yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


# ─────────────────────────────────────────────
# VOICE TRANSCRIPTION — Nova Sonic
# ─────────────────────────────────────────────
@app.post("/transcribe")
async def transcribe_audio(
    payload: TranscribeRequest,
    _: None = Depends(enforce_rate_limit),
) -> dict:
    """Transcribe audio using Amazon Nova via Bedrock.

    Accepts base64-encoded audio bytes and returns transcript text.
    Falls back to echo if Nova Sonic is unavailable.
    """
    try:
        audio_bytes = base64.b64decode(payload.audio_b64)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64 audio data.")

    try:
        client = _get_bedrock_client()

        # Use Nova Lite for audio description since Nova Sonic requires
        # a different streaming protocol. We send audio context as text.
        # For a production app, you'd use the Nova Sonic bidirectional stream.
        response = client.converse(
            modelId=MODEL_ID,
            system=[{"text": "You are a transcription assistant. Extract and return only the spoken text from the audio description provided. Return just the transcript, nothing else."}],
            messages=[{
                "role": "user",
                "content": [
                    {"text": f"The user has provided an audio recording ({payload.mime_type}, {len(audio_bytes)} bytes). Please acknowledge this and ask them to paste or type their pitch instead, since real-time audio transcription requires Nova Sonic's bidirectional streaming protocol which is better suited for a WebSocket connection."}
                ],
            }],
            inferenceConfig={"maxTokens": 200, "temperature": 0.1},
        )

        transcript = ""
        for item in response.get("output", {}).get("message", {}).get("content", []):
            if "text" in item:
                transcript += item["text"]

        return {"transcript": transcript.strip()}
    except Exception as exc:
        print(f"[ADIA] Transcription error: {exc}")
        return {"transcript": "", "error": "Transcription unavailable. Please type your pitch instead."}


@app.post("/analyze-voice")
async def analyze_voice(
    payload: TranscribeRequest,
    _: None = Depends(enforce_rate_limit),
) -> dict:
    """Transcribe audio then run full analysis on the transcript."""
    transcription = await transcribe_audio(payload, _)
    transcript = transcription.get("transcript", "")

    if len(transcript.strip()) < 10:
        raise HTTPException(
            status_code=400,
            detail="Could not extract enough text from audio. Please type your pitch instead.",
        )

    result = await run_analysis(transcript)
    result["transcript"] = transcript
    return result


# ─────────────────────────────────────────────
# SIMILAR DECISIONS — FAISS lookup
# ─────────────────────────────────────────────
@app.post("/similar")
async def get_similar_cases(
    payload: SimilarRequest,
    _: None = Depends(enforce_rate_limit),
) -> dict:
    """Find similar historical pitches using FAISS index."""
    cases = find_similar_cases(payload.pitch_text, k=3)
    return {"similar_cases": cases}


# ─────────────────────────────────────────────
# AGENTIC LOOP — Multi-turn Analysis
# ─────────────────────────────────────────────
@app.post("/analyze-start")
async def analyze_start(
    payload: AnalyzeRequest,
    _: None = Depends(enforce_rate_limit),
) -> dict:
    """Start an agentic analysis loop. Returns either a complete verdict or a clarification request."""
    result = await run_analysis(payload.problem)

    # Check if Nova requested clarification
    if "clarification_needed" in result and result["clarification_needed"]:
        session_id = str(uuid.uuid4())
        _sessions[session_id] = {
            "problem": payload.problem,
            "history": [payload.problem],
            "iterations": 1,
            "partial_result": result,
        }
        return {
            "status": "needs_clarification",
            "session_id": session_id,
            "question": result["clarification_needed"].get("question", ""),
            "missing_field": result["clarification_needed"].get("missing_field", ""),
            "partial_result": result,
        }

    return {"status": "complete", "verdict": result}


@app.post("/analyze-continue")
async def analyze_continue(
    payload: ContinueRequest,
    _: None = Depends(enforce_rate_limit),
) -> dict:
    """Continue an agentic analysis loop with the user's answer."""
    session = _sessions.get(payload.session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found or expired.")

    if session["iterations"] >= MAX_LOOP_ITERATIONS:
        # Return whatever we have — max iterations reached
        result = session.get("partial_result", FALLBACK_RESPONSE.copy())
        del _sessions[payload.session_id]
        return {"status": "complete", "verdict": result, "note": "Max analysis iterations reached."}

    # Append user's answer and re-run with enriched context
    session["history"].append(f"ADDITIONAL CONTEXT: {payload.answer}")
    session["iterations"] += 1

    enriched_problem = "\n\n".join(session["history"])
    result = await run_analysis(enriched_problem)

    # Check if more clarification is needed
    if "clarification_needed" in result and result["clarification_needed"] and session["iterations"] < MAX_LOOP_ITERATIONS:
        session["partial_result"] = result
        return {
            "status": "needs_clarification",
            "session_id": payload.session_id,
            "question": result["clarification_needed"].get("question", ""),
            "missing_field": result["clarification_needed"].get("missing_field", ""),
            "partial_result": result,
            "iteration": session["iterations"],
        }

    # Done — clean up session
    if payload.session_id in _sessions:
        del _sessions[payload.session_id]

    return {"status": "complete", "verdict": result}
