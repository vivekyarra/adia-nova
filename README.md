# ADIA - Autonomous Decision Intelligence Agent

## Overview
ADIA is a decision intelligence web app built for the Amazon Nova Hackathon. It turns startup pitches, investment memos, and PDF evidence into a clear venture verdict by running an adversarial debate between a bullish analyst, a bearish analyst, and an Amazon Nova arbiter. The product is optimized for live demos with instant scenario buttons, a terminal-style reasoning loader, and a split-screen verdict workspace.

## What It Does
- Runs three instant demo scenarios for judges: a strong AI SaaS company, a risky crypto pitch, and a hardware company with burn pressure.
- Accepts pasted pitch text and an optional PDF upload for custom analysis.
- Generates a structured verdict: `GO`, `NO-GO`, or `CONDITIONAL`.
- Surfaces the final decision with conviction score, fatal flaw, asymmetric upside, key risks, key assets, and next action.
- Visualizes the result in a Palantir-style interface with a knowledge graph and a focused verdict panel.

## Architecture
```text
Demo Scenario or Custom Pitch + Optional PDF
                  |
                  v
          FastAPI Backend
                  |
                  v
       BlueTeamAgent  -> bullish case
       RedTeamAgent   -> bearish case
                  |
                  v
   Amazon Nova Arbiter (`amazon.nova-lite-v1:0`)
                  |
                  v
 Structured JSON verdict for the frontend
                  |
                  v
Terminal Loader + Knowledge Graph + Verdict Panel
```

## Core Experience
- `BlueTeamAgent`: extracts traction, moat, revenue, team, and market upside.
- `RedTeamAgent`: extracts burn, credibility, execution, and structural downside.
- `Amazon Nova`: reconciles both positions into one investor-ready verdict.
- `Fallback mode`: if Nova is unavailable, ADIA still returns a safe cached structure so the demo flow does not break.

## Tech Stack
- Backend: FastAPI, Python, boto3, python-dotenv, PyPDF2
- Frontend: Next.js (Pages Router), React, Recharts
- Browser automation: `puppeteer-core` for screenshot capture
- Model: Amazon Nova via AWS Bedrock

## Amazon Nova Integration
- Model ID: `amazon.nova-lite-v1:0`
- Runtime client: AWS Bedrock `bedrock-runtime`
- Call pattern: `converse` API with a strict JSON-only adjudication prompt
- Usage in app: Nova acts as the final arbiter after the Blue Team and Red Team generate adversarial context

## API Endpoints
- `GET /` - health check
- `POST /demo/scenario_a` - AI SaaS scenario
- `POST /demo/scenario_b` - crypto risk scenario
- `POST /demo/scenario_c` - hardware burn scenario
- `POST /analyze` - custom text analysis
- `POST /analyze-with-docs` - custom text plus PDF analysis

## Local Setup
### Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

Create `backend/.env`:
```env
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_REGION=us-east-1
AWS_SESSION_TOKEN=optional_if_using_temporary_credentials
```

Run the API:
```bash
uvicorn main:app --reload
```

### Frontend
```bash
cd frontend
npm install
```

Create `frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

Run the UI:
```bash
npm run dev
```

Open `http://127.0.0.1:3000`.

## Demo Flow
See `demo/DEMO_SCRIPT.md` for the timed walkthrough.

## Refresh Screenshots
Install the one screenshot-only dependency if needed:
```bash
cd frontend
npm install --no-save --package-lock=false puppeteer-core
```

Then run:
```bash
node demo/capture_screenshots.js
```

## Screenshots
![Homepage](screenshots/homepage.png)

![Problem Input](screenshots/problem-input.png)

![Document Upload](screenshots/document-upload.png)

![Terminal Loader](screenshots/terminal-loader.png)

![Live Verdict](screenshots/live-verdict.png)

![Knowledge Graph](screenshots/knowledge-graph.png)

![Verdict Panel](screenshots/verdict-panel.png)
