# Phase 10 — Reliability, trust, and demo

Status: in progress, started September 13, 2026.

## Outcome

The system is safe to run for a real campaign and ready to show: access to the API is limited, stored tokens are encrypted, collected data can be deleted on demand and by a retention rule, every planned check has a recorded result, and the demo and the reliability brief are written from what was verified.

## Tasks

1. **Access**: optional `API_TOKEN`; when set, every `/api/*` route except health, webhooks, and OAuth start/callback requires `Authorization: Bearer`. The web app and the Discord bot send it.
2. **Tokens at rest**: `TOKEN_ENCRYPTION_KEY` encrypts connection access and refresh tokens with AES-256-GCM; rows written before the key was set still read.
3. **Deletion and retention**: `POST /api/campaigns/:id/purge` deletes contacts, imports, calls, transcripts, and answers while keeping the campaign, questions, reports, and event log; `retentionDays` in workspace settings purges completed campaigns automatically. Both record `data.purged`.
4. **Operations**: request logging, scheduler disabled under tests, `bun run start` for each app, deployment notes.
5. **Tests**: HTTP-level tests through `app.fetch` (auth, validation, purge), encryption round trip, retention rule.
6. **Documents**: `docs/evaluation.md` (every check from `hackathon.md` with its actual result), `docs/brief.md` (system and reliability brief), `docs/demo.md` (two-minute script with a demo seed), `docs/decisions.md` (the open decisions from `idea.md` and what was decided).

## Acceptance checks

1. Every checklist item in `hackathon.md` has a recorded outcome in `docs/evaluation.md`, including the ones not run.
2. Deleting a campaign's data removes its contacts, transcripts, and answers, and the deletion is logged.
3. With `API_TOKEN` set, unauthenticated API calls are refused and the web app still works.
4. Lint, typecheck, build, and all tests pass.

## Completion note

_Fill in when the phase ends._
