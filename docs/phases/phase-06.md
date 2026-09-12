# Phase 6 — Progress and results dashboard

Status: complete, September 13, 2026.

## Outcome

The campaign page is where an organizer follows outreach and reads what people said. Counts are people-based and computed from the database. Every answer links to the call it came from. Answers and call statuses can be exported as CSV or XLSX.

## Design

- **Results service** (`src/calls/results.ts`). One function computes, for a campaign: participation (people in list, ready, called, reached, completed, callbacks requested, unreachable, opted out, declined) and per-question aggregates. A person's response is their latest completed call; simulated calls without a contact each count as one response and are counted separately so the page can say how many of the responses are text simulations. Rating questions get an average and a 1–5 distribution; choice questions get totals per option plus "other"; open questions list every answer with the person and the call id. Each question also reports how many were skipped, declined, unknown, or not asked.
- **Exports** (`src/calls/export.ts`). Two sheets built with SheetJS: answers (one row per response, one value and status column per question, plus notes) and calls (one row per call with kind, status, attempt, timings, summary, callback, opt-out, failure code). Served as CSV or XLSX by `GET /api/campaigns/:id/export?kind=answers|calls&format=csv|xlsx`, proxied through a session-checked Next route.
- **Home**: the campaign list gains contacts and responses per campaign; running campaigns show progress.
- **Campaign page**: a metrics row with the participation counts at the top; an Answers tab with the per-question view; export buttons on the Responses tab; the Outreach panel keeps only what is call-related (active, queued, budget). A small client component refreshes the page every 15 seconds while the campaign is running or a call is active.
- **Contacts tab**: the Calls column links to the person's latest call.

## Acceptance checks

1. Every count on the page equals a count computed directly from the database (covered by tests on the results service against known fixtures).
2. Every answer shown links to the call whose transcript produced it.
3. The answers export re-imports cleanly through Tokito's own spreadsheet parser with the expected columns.
4. Lint, typecheck, build, and API tests pass.

## Completion note

**What changed.** Built as designed. Notes:

- Counts are people-based (`participation`) on the metrics row and call-based on the Outreach panel, which now shows only what it controls: still to reach, on a call, queued, failed, and the budget line.
- The rule "a person's response is their latest completed call" is implemented once in `responseCalls` and shared by the results view and the answers export, so the two can never disagree.
- Exports use the same SheetJS library as imports; the test re-imports the CSV and XLSX through Tokito's own parser and checks a known cell.
- The Next route at `/survey/[id]/export` proxies the API file behind the session check so the browser never needs the API's address.
- Live refresh is a 15-second `router.refresh()` while the campaign is running or a call is active or queued; no sockets.

**Checks run.**

| Check | Result |
|---|---|
| `bun run lint`, `bun run typecheck`, `bun run build` | Pass |
| `bun test` in `apps/api` (43 tests; 6 new: participation against a fixture with a callback re-call, a declined person, an unreachable person after two no-answers, and a text simulation; latest-call rule; rating average and distribution; choice totals; open answers linked to calls; Home counts; latest-call link; CSV and XLSX exports re-imported) | Pass |
| HTTP session: metrics row, responses note counting simulations, Answers tab content with quotes linked to calls, export buttons; Home shows Contacts and Responses columns; export route returns 401 without a session and a CSV with one column set per question with it; XLSX export returns a spreadsheet | Pass |
| Browser click-through of tabs, export downloads, live refresh | Not run: needs a logged-in browser session |

**What the next phase should know.** Phase 7 reads `campaignResults` for counts and `responseCalls` plus `answers` rows for quotes; every quote must carry its `answerId` and `callId` so the report can cite it. Counts in the report must come from `participation` and `statusCounts`, never from the model.
