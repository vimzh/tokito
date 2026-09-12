# Phase 5 — Telephony and outreach control (CALL-E)

Status: complete as code, September 13, 2026. No live calls were placed; the live checks below stay open until a CALL-E key and a consenting tester are available.

## Outcome

A running campaign dials its ready contacts through CALL-E inside calling hours, retries within the attempt limit, records every outcome, writes answers and transcripts from CALL-E's results, and can be started, paused, resumed, and stopped from the campaign page. Callbacks become scheduled calls only when the organizer sets a time. Nothing dials without a CALL-E key.

## Design

- **Provider adapter** (`src/calls/provider.ts`). One interface, `CallProvider`, with `createCall` and `getCall`. `CalleProvider` talks to `POST /v1/calls` and `GET /v1/calls/{id}` with a bearer key and an `Idempotency-Key` per Tokito call. A fake provider drives the tests. Errors carry CALL-E's error code, so `unsupported_region` is shown on the call and the contact rather than swallowed.
- **Result schema, CALL-E rules.** CALL-E's `recipient_result_schema` accepts only `type`, `properties`, `required`, `enum`, nested objects, simple arrays, `description`, and `additionalProperties: false`, and reserves recipient field names such as `summary` and `status`. The Phase 4 schema was adjusted: `summary` → `person_summary`, per-answer `status` → `answer_status`, booleans → `yes` / `no` enums. A sanitizer strips zod's `$schema` key and a test asserts no unsupported keyword appears.
- **Scheduler** (`src/calls/scheduler.ts`). A tick runs every 30 seconds in the API process and can be triggered by hand. For each running campaign it dials, up to three at a time, contacts that are `ready`, have no active call, have not reached a terminal outcome, have fewer attempts than the campaign allows, and whose last attempt ended at least two hours ago. Dialing only happens inside the campaign's calling hours in its time zone, except explicit callbacks, which go at the time the organizer scheduled. The same tick polls active calls older than two minutes as a fallback for missed webhooks. A per-campaign call budget stops dialing when reached.
- **Webhook** (`POST /api/webhooks/calle`). Stores every event by its id (`provider_events`), so a redelivery is acknowledged without side effects. Matches the call by CALL-E's task id, maps the lifecycle with `statusFromProvider`, stores transcript turns from the last attempt, and persists answers with the same code path as the simulator. An opt-out recorded on a call adds the number to the workspace opt-out list.
- **Controls.** `GET /api/campaigns/:id/outreach` reports readiness with reason codes (no questions, no ready contacts, provider not configured, budget reached, outside calling hours) and counts. Start requires questions, ready contacts, and a configured provider; it may be pressed outside calling hours, and dialing begins when the window opens. Pause stops new dials at once; in-progress calls finish. Stop marks the campaign completed and cancels queued calls.
- **Callbacks.** A call whose outcome is `callback_requested` shows the person's words. The organizer picks a date and time, which creates a queued call for that contact with `scheduled_at`. Tokito never promises a time it has not scheduled.

## Configuration

`apps/api/.env`: `CALLE_API_KEY`, `CALLE_BASE_URL` (default `https://api.heycall-e.com`), `CALLE_WEBHOOK_URL` (public URL of this API plus `/api/webhooks/calle`, needed for terminal events), `OUTREACH_TICK_SECONDS` (default 30).

## Acceptance checks

Code-level, with the fake provider:

1. A running campaign inside calling hours dials ready contacts; outside hours it dials nothing except due callbacks.
2. A `call.completed` webhook writes transcript turns and answers; the same event delivered twice changes nothing.
3. `no_answer` leads to a retry after the delay and, after the attempt limit, no further dials.
4. Pausing stops new dials; opt-out on a call lands on the opt-out list; `unsupported_region` shows as a failed call with that code.
5. Lint, typecheck, build, and API tests pass.

Deferred until a CALL-E key and a consenting tester are available: a real call whose answers match what was said, and a real duplicate webhook delivery.

## Completion note

**What changed.** Built as designed. Notes:

- Simulated time is threaded through the scheduler, the webhook handler, and result persistence (`now` parameters) so the tests run against fixed instants in the campaign's time zone without touching the real clock.
- `persistCallResult` in `src/calls/persist.ts` is the single place that writes answers, summary, flags, timings, and transcript for both the simulator and CALL-E results.
- Contacts now carry a `lastCall` summary (attempts, last status, failure code, next scheduled time) so the Contacts tab shows outreach progress per person, including `unsupported_region`.
- The Outreach panel on the overview shows the local time in the campaign's time zone, whether it is inside calling hours, the blocking reasons, counts, and the budget. Start asks for confirmation and states that each call costs credit; Stop asks for confirmation and is final.
- Callback scheduling uses a local date-time input converted to ISO on the server action; the scheduled call is shown in the calls list until it is dialed.

**Checks run.**

| Check | Result |
|---|---|
| `bun run lint`, `bun run typecheck`, `bun run build` | Pass |
| `bun test` in `apps/api` (37 tests; 10 new: calling-hours math across time zones, readiness reasons, start/pause/resume/stop, dialing inside hours only, never twice while active, pause and budget stop dialing, `unsupported_region` recorded, completed webhook writes transcript and answers, duplicate webhook is inert, unmatched event stored, `no_answer` retry after delay then stop at the attempt limit with `unreachable` counted, opt-out on a call lands on the list, callback dialed at its time outside hours, polling applies a missed terminal event) | Pass |
| Running API: outreach status lists `provider_not_configured` and `outside_calling_hours`; start refused with the reason; the same webhook event twice → second reply `duplicate: true`; tick without a key → 503 | Pass |
| HTTP session: campaign page shows the Outreach panel with counts, the blocking reason, the disabled Start button, and the Schedule callback control on a callback-requested call. The budget field lives in the preferences dialog and is not in server HTML | Pass |
| Live CALL-E call, answers matching a real transcript, real duplicate delivery, region check | Not run: no `CALLE_API_KEY`; deferred by the user |

**Open before the first real call.** Set `CALLE_API_KEY` and `CALLE_WEBHOOK_URL` (a public tunnel to the API), confirm the target region is supported by CALL-E, make one call to a consenting tester, and compare the stored answers with the transcript on the call page. Then record the result here.
