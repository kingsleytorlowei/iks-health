# Agentic Workflow Management System

A simulation of multi-stage agent processing for healthcare workflow automation, with a concierge-driven exception queue UI. The full design is in [Agentic Workflow Management System.md](./Agentic%20Workflow%20Management%20System.md).

- **Backend** — Node + Express, two-worker pool with in-flight locks, five stage agents with calibrated confidence ranges, decision engine (retry → escalate), concierge resolution as typed artifacts, REST + SSE.
- **Frontend** — React 19 + Vite + Tailwind v4, Zustand store hydrated from REST and patched live by SSE, dark theme.

## Quick start with Docker

```bash
docker compose up --build
```

Open <http://localhost:8080>. The container runs the backend on port 4000 and serves the built frontend from the same origin, so there's nothing else to wire up.

To rebuild after code changes:

```bash
docker compose up --build --force-recreate
```

## Local development (without Docker)

Two terminals, hot reload on both sides:

```bash
# Terminal 1 — backend on :4000
cd backend
npm install
npm run dev

# Terminal 2 — frontend on :5173 (proxies /api and /sse to backend)
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173>.

## Running the tests

```bash
cd backend
npm test
```

## Layout

```
backend/   Node + Express service
  src/
    agents/        Five stage agents with stage-tuned confidence ranges
    api/           REST routes + SSE endpoint
    ingestion/     Synthetic appointment generator
    orchestrator/  Worker pool, decision engine, concierge service
    queue/         Priority queue with in-flight locks
    store/         In-memory state
    workflows/     Specialty → stage definitions
  tests/           Vitest

frontend/  React + Vite SPA
  src/
    components/    Dashboard, MetricsBar, AppointmentCard,
                   ExceptionQueue, NotificationBell, ConciergePanel,
                   WorkflowTimeline
    services/      api.ts (REST), sse.ts (EventSource)
    store/         Zustand workflow store
```

## Tuning knobs

The system's runtime feel is controlled by two files:

- `backend/src/ingestion/appointmentIngestionService.ts` — burst size and idle gap.
- `backend/src/agents/baseAgent.ts` — per-stage delay and confidence ranges.

With the defaults the queue oscillates and `prior_authorization` dominates escalations.

## Environment variables

| Variable | Default | Where | Purpose |
| --- | --- | --- | --- |
| `PORT` | `4000` | backend | TCP port to listen on |
| `SERVE_FRONTEND` | unset | backend | When `1`, the backend also serves `frontend/dist` and an SPA fallback. Used inside the Docker image. |
| `FRONTEND_DIST` | `../frontend/dist` (relative to backend `dist/`) | backend | Override the served static dir. |

## Deployment

The single-container build (`docker compose up`) is also what most managed platforms expect. Common one-shot options:

- **Fly.io** — `fly launch` from the repo root, accept the Dockerfile detection, deploy. Free allowance covers a small machine.
- **Railway** — new project from the repo, Railway auto-detects the Dockerfile. Set the public port to 4000.
- **Render** — new Web Service, Docker runtime, port 4000.

There's no database; the simulation is in-memory and resets on container restart.
