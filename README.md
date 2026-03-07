# ADIA — Autonomous Decision Intelligence Agent

![Python](https://img.shields.io/badge/Python-3.11+-blue?logo=python) ![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-green?logo=fastapi) ![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js) ![AWS Bedrock](https://img.shields.io/badge/AWS-Bedrock-orange?logo=amazon-aws) ![Amazon Nova](https://img.shields.io/badge/Amazon-Nova_Lite-purple?logo=amazon-aws)

> AI-powered investment decision intelligence built on **Amazon Nova** via AWS Bedrock.
> ADIA runs a **4-agent pipeline** — Research → Analysis → Reasoning → Report — with **multimodal understanding**, **agentic tool use**, **streaming responses**, and **citation grounding**.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER INPUT                                  │
│       Text Pitch  │  PDF Upload  │  Voice Audio  │  Dual Docs      │
└────────┬──────────┴──────┬───────┴───────┬───────┴──────┬──────────┘
         │                 │               │              │
         ▼                 ▼               ▼              ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     FastAPI Backend (Python)                         │
│                                                                      │
│  ┌──────────────┐  ┌──────────────────┐  ┌────────────────────────┐ │
│  │ ResearchAgent │  │  AnalysisAgent   │  │    ReasoningAgent      │ │
│  │              │  │  (Multimodal)    │  │  (Tool Use + Stream)   │ │
│  │ Amazon Nova  │  │  Amazon Nova     │  │  Amazon Nova           │ │
│  │ text gen     │  │  image+text      │  │  flag_fatal_flaw tool  │ │
│  │              │  │  PDF→PNG→Nova    │  │  request_clarification │ │
│  └──────┬───────┘  └───────┬──────────┘  └───────┬────────────────┘ │
│         │                  │                     │                   │
│         └──────────────────┴─────────────────────┘                   │
│                            │                                         │
│                   ┌────────▼─────────┐                               │
│                   │   ReportAgent    │                               │
│                   │  Citations +     │                               │
│                   │  Fatal Flaws +   │                               │
│                   │  FAISS Similar   │                               │
│                   │  Cases           │                               │
│                   └────────┬─────────┘                               │
│                            │                                         │
│         ┌──────────────────┴──────────────────────┐                  │
│         │         SSE Streaming Response           │                  │
│         │     converse_stream → token deltas       │                  │
│         └──────────────────┬──────────────────────┘                  │
└────────────────────────────┼─────────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    Next.js Frontend                                  │
│                                                                      │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌──────────────┐  │
│  │Terminal Loader│ │ Verdict     │ │ Knowledge   │ │ Citations +  │  │
│  │+ Live Stream │ │ Panel       │ │ Graph       │ │ Similar Cases│  │
│  └─────────────┘ └─────────────┘ └─────────────┘ └──────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

## Amazon Nova Integration Deep Dive

| # | API Call | Model ID | Purpose | What Makes It Non-Trivial |
|---|---------|----------|---------|--------------------------|
| 1 | `converse` | `amazon.nova-lite-v1:0` | **ResearchAgent** — decompose pitch into key factors & assumptions | Structured JSON extraction with fallback parsing |
| 2 | `converse` (multimodal) | `amazon.nova-lite-v1:0` | **AnalysisAgent** — extract evidence from PDF page images + text | PDF pages converted to PNG at 150 DPI and sent as raw image bytes alongside text — true **Amazon Nova multimodal understanding**, not just text parsing |
| 3 | `converse` + `toolConfig` | `amazon.nova-lite-v1:0` | **ReasoningAgent** — fuse research + evidence with tool use | Uses **Amazon Nova tool use** with `flag_fatal_flaw` and `request_clarification` tools. Nova decides autonomously when to invoke tools — real agentic behavior |
| 4 | `converse_stream` | `amazon.nova-lite-v1:0` | **Streaming Verdict** — real-time token delivery via SSE | **Amazon Nova streaming** via `converse_stream` piped to FastAPI `StreamingResponse` → frontend `ReadableStream`. Tokens appear live in the UI |
| 5 | `converse` | `amazon.nova-lite-v1:0` | **Voice Transcription** — process audio input for hands-free pitch entry | **Amazon Nova** processes audio context descriptions for voice-to-analysis workflow |
| 6 | `converse` + `toolConfig` | `amazon.nova-lite-v1:0` | **Agentic Loop** — multi-turn clarification with session memory | **Amazon Nova** calls `request_clarification` tool when info is missing, creating a genuine multi-turn agentic loop (max 3 iterations) |
| 7 | FAISS + hash embeddings | Local | **Similar Cases** — find historical pitch matches | 5 seed pitches (Airbnb, Uber, WeWork, Theranos, Stripe) indexed in FAISS; each new pitch is compared for pattern matching |

> **Total Amazon Nova calls per analysis: 3** (budgeted). Every call leverages a different Amazon Nova capability — text generation, multimodal image understanding, tool use, or streaming.

## Key Capabilities

- **🖼️ Multimodal PDF Processing** — PDF pages rendered to PNG via `pdf2image` and sent to **Amazon Nova** as actual image bytes. Charts, tables, and visual layouts are understood natively.
- **🔧 Agentic Tool Use** — **Amazon Nova** autonomously invokes `flag_fatal_flaw` and `request_clarification` tools. This is real tool-calling, not prompt chaining.
- **⚡ Streaming Responses** — Verdicts stream token-by-token via `converse_stream` + SSE. The UI shows Nova thinking in real-time.
- **📝 Citation Grounding** — Every risk and opportunity cites its source: `[Page 2]`, `[uploaded document]`, or `[AI inference]`.
- **🎤 Voice Input** — Record audio via browser microphone, transcribe, and analyze in one flow.
- **🔄 Agentic Loop** — Nova can ask follow-up questions when information is missing, then update its verdict with new context (max 3 turns).
- **📊 Similar Past Decisions** — FAISS-indexed historical pitches surface pattern matches (Airbnb ↔ your SaaS, Theranos ↔ your deep-tech).

## Community Impact

ADIA was built for **student founders in emerging markets** who lack access to experienced venture investors. In regions where:

- 🌍 Expert VC feedback costs $500+/hour
- 📊 First-time founders don't know what questions to ask
- 🏫 University accelerators serve hundreds but have limited mentor bandwidth

**ADIA provides investor-grade due diligence for free**, powered by Amazon Nova. A student in Lagos, Hyderabad, or São Paulo can paste their pitch and receive structured, cited, adversarial analysis — the same rigor a Sand Hill Road partner would apply.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Intelligence | **Amazon Nova Lite** via AWS Bedrock (`boto3`) |
| Backend | FastAPI, Python, pdf2image, Pillow, PyPDF2, FAISS, numpy |
| Frontend | Next.js 14 (Pages Router), React 18, Recharts |
| Deployment | Vercel (frontend) + Render (backend) |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Health check — reports all capabilities |
| `POST` | `/demo/scenario_a` | AI SaaS demo (GO candidate) |
| `POST` | `/demo/scenario_b` | Crypto risk demo (NO-GO candidate) |
| `POST` | `/demo/scenario_c` | Hardware burn demo (CONDITIONAL) |
| `POST` | `/analyze` | Analyze custom text |
| `POST` | `/analyze-with-docs` | Analyze text + uploaded PDFs (multimodal) |
| `POST` | `/analyze-stream` | Streaming analysis via SSE |
| `POST` | `/transcribe` | Voice audio → text transcription |
| `POST` | `/analyze-voice` | Voice → transcribe → full analysis |
| `POST` | `/similar` | Find similar historical pitches |
| `POST` | `/analyze-start` | Begin agentic loop (may request clarification) |
| `POST` | `/analyze-continue` | Continue agentic loop with user's answer |

## Local Setup

### Backend

Create `backend/.env`:
```env
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
```

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

> **Multimodal PDF support** requires [Poppler](https://poppler.freedesktop.org/). Ubuntu: `apt install poppler-utils`. macOS: `brew install poppler`. If unavailable, falls back to text-only extraction.

### Frontend

Create `frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

```bash
cd frontend
npm install
npm run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000).

## Screenshots

![Homepage](screenshots/homepage.png)
![Problem Input](screenshots/problem-input.png)
![Document Upload](screenshots/document-upload.png)
![Terminal Loader](screenshots/terminal-loader.png)
![Live Verdict](screenshots/live-verdict.png)
![Knowledge Graph](screenshots/knowledge-graph.png)
![Verdict Panel](screenshots/verdict-panel.png)

## Demo

For the 3-minute timed judge walkthrough, see [demo/DEMO_SCRIPT.md](demo/DEMO_SCRIPT.md).

---

**Built with Amazon Nova** for the AWS Hackathon.
