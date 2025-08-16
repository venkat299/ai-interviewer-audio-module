# AI Interviewer MVP

Monorepo providing a minimal end‑to‑end prototype of an AI interviewer. Audio is captured in the browser and streamed to a Node.js gateway which orchestrates ASR, NLP and biometrics micro‑services. Results are persisted in Postgres and returned as live captions and a final JSON report.

## Prerequisites

* Docker & Docker Compose
* Node.js 18+ (for running the e2e test locally)

## Quick start

```bash
docker compose up --build
# open http://localhost:5173
```

## Environment

Copy `.env.example` to `.env` and adjust if necessary. The gateway honours `ASR_ENGINE` to switch between real and mocked ASR. The mock implementation is the default and requires no model downloads.

## Testing

With the stack running, execute:

```bash
npm run e2e
```

This pushes a synthetic audio sample through the system and prints the final interview report.

## Troubleshooting

* Whisper model downloads can be slow. Set `ASR_ENGINE=mock` (default) to use the lightweight mock recogniser.
* Ensure ports 5173 and 8080 are free.
