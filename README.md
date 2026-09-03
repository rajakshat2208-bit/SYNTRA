# SYNTRA

"From scattered signals to coordinated action."

## Problem

Operational signals (resident reports, sensor readings, system alerts) arrive
scattered and disconnected. Humans struggle to correlate them fast enough to
prevent incidents from escalating.

## Solution

SYNTRA is a human-centered operational intelligence platform. AI agents
normalize, correlate, and assess incoming signals and propose a response —
but humans approve every critical action.

## How SYNTRA works

```
SCATTERED SIGNALS -> SYNTRA -> CORRELATION -> RISK ASSESSMENT
   -> RECOMMENDED RESPONSE -> HUMAN APPROVAL -> COORDINATED ACTION -> OUTCOME
```

## Architecture

```
Signal sources -> FastAPI -> Intake Agent -> Correlation Agent -> Risk Agent
   -> Response Agent -> Supervisor Agent -> Human Approval -> Coordinated Response
```

- **Frontend**: React + Vite, Tailwind (design tokens ported from Stitch reference)
- **Backend**: Python + FastAPI
- **Database**: SQLite (persists across restarts)
- **Agents**: AWS Strands Agents SDK

## AWS Strands Agents

Five agents are implemented with real Strands `Agent` objects and structured
Pydantic output contracts (`backend/agents/`):

- **Intake** — normalizes a raw signal
- **Correlation** — links related signals
- **Risk** — assesses severity/confidence/evidence
- **Response** — proposes a prioritized action plan (never executes)
- **Supervisor** — agent registry + human-approval gate

Each agent runs in one of two explicit modes, always labeled in agent events
and via `/api/health`:

- `anthropic` — real AI execution via Claude, when `SYNTRA_MODEL_PROVIDER=anthropic`
  and `ANTHROPIC_API_KEY` is set
- `fixture` — deterministic local logic, for development without burning API
  tokens. Never claims to be an AI result.

If a real AI call fails, the system reports `AI ASSESSMENT UNAVAILABLE` — it
never silently substitutes a fake result.

## Local setup

```bash
# Backend
cd syntra
pip install -r backend/requirements.txt
cp .env.example .env   # edit if using SYNTRA_MODEL_PROVIDER=anthropic
python3 -m uvicorn backend.main:app --reload

# Frontend
cd frontend
npm install
cp .env.example .env
npm run dev
```

## Environment variables

See `.env.example`. Key ones:

- `SYNTRA_MODEL_PROVIDER`: `fixture` (default) or `anthropic`
- `ANTHROPIC_API_KEY`: required only for `anthropic` mode
- `SYNTRA_DB_PATH`: SQLite file path (default `syntra.db`)

## Database

SQLite, created automatically on first run. Tables: `signals`, `incidents`,
`agent_events`, `assessments`, `approvals`, `incident_timeline`.

## Running the application

```bash
python3 -m uvicorn backend.main:app --reload   # http://localhost:8000
npm run dev                                     # http://localhost:5173 (in frontend/)
```

## Tests

```bash
python3 -m pytest tests/ -v
```

## Demo scenario

Incident #1842 — Possible Electrical Fire, Block B Electrical Room. Signals:
resident report, power fluctuation, temperature anomaly. A guided "Run
Demonstration Scenario" flow that creates these as real records and drives
them through the full agent pipeline is planned for a later phase — not yet
implemented.

## Status (Phase 1)

Foundation only: FastAPI + SQLite + data models + configuration + all five
agent modules + signal intake wired end-to-end + tests. Full correlation ->
risk -> response -> approval pipeline, and all UI pages beyond the connection
check, are not yet built.
