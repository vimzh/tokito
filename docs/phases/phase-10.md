# Phase 10 — Reliability, trust, and demo

Status: complete, September 13, 2026.

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

**What changed.** Tasks 1 to 6 as written, plus, at the user's request, an end-to-end evaluation harness (`apps/api/scripts/eval.ts`) that drafts questions with the real model, runs simulated calls with an LLM playing the person in dynamic and fixed modes, generates 80 synthetic responses per scenario through the real result mapper, generates the multi-agent report, asks two questions, and scores questions and reports with an LLM judge next to deterministic checks. Five scenarios: restaurant menu, society event, product onboarding, clinic front-desk team, nonprofit volunteers. Results in `docs/evaluation.md` and `docs/evaluation/`.

**Fixes that came out of the evaluation.** Dynamic mode produced no follow-ups with eight questions until the call script's follow-up rule was strengthened; `no_conversation` outcomes were counted as completed responses; the synthesis agent over-fragmented themes, built themes from screening answers, and could skip a next step for the biggest problem; theme people counts were mislabeled. All fixed and re-verified.

**Checks run.**

| Check | Result |
|---|---|
| `bun run lint`, `bun run typecheck`, `bun run build` (web, API, Discord) | Pass |
| `bun test`: 64 API tests (including app-level auth, validation, purge, retention, encryption) and 9 Discord tests | Pass |
| Evaluation run over five scenarios (`docs/evaluation/run-2026-09-13-09-11.md`) | Pass: all deterministic checks; judge scores 4–5 with one 3 |
| Every checklist item from `hackathon.md` recorded with its outcome | Done in `docs/evaluation.md`; live CALL-E, Discord, Google, and Notion checks remain not run |
| Demo seed and script | `bun run db:demo`, `docs/demo.md` |

**Still open.** Live runs with real credentials (CALL-E, Discord, Google, Notion); per-organizer accounts; the calls-versus-forms comparison the brief asks for.
