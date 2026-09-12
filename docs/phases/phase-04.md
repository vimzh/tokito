# Phase 4 — Conversation layer

Status: complete, September 13, 2026.

## Outcome

Tokito can turn a campaign into exactly what CALL-E needs for one call: a natural-language task and a JSON result schema. It can read CALL-E's structured result and transcript back into per-question answers that keep gaps visible. And an organizer can run the whole thing as a text conversation, without a phone or a CALL-E key, to check that the script, follow-ups, skips, and extraction behave.

## Design

- **Task builder** (`src/calls/task-builder.ts`). From the campaign (goal, background, questions, language, conversation mode, clarifications, max minutes) and one contact (name, context) it writes the `task` text CALL-E's voice agent follows: who is calling and why, consent and recording notice, the questions in order with how to ask each type, follow-up rules for dynamic mode, clarification rules limited to the background, respect for skip, decline, stop, callback, and opt-out, and the closing. The same module builds the result schema with zod and exports it as JSON Schema (`z.toJSONSchema`) for CALL-E's `recipient_result_schema`. Questions are keyed `q1…qN` and a `questionMap` on the call links keys to question ids, so later edits to the questionnaire cannot shift answers.
- **Result mapper** (`src/calls/result-mapper.ts`). Pure function from a structured result plus the question map to answers (`answered`, `skipped`, `declined`, `unknown`, `not_asked`), call outcome, callback request, opt-out, summary, and requests for the organizer. Rating values are parsed to numbers; choice values are matched against options. An unparseable result yields `unknown` answers rather than invented ones. A second function maps CALL-E task, recipient, and attempt statuses to Tokito call statuses for Phase 5.
- **Tables** (migration 0003): `calls`, `call_turns`, `answers`. Calls store the task, result schema, question map, provider (`calle` or `simulator`), structured result, summary, callback and opt-out flags, failure code and message, timings.
- **Simulator** (`src/calls/simulator.ts`). A Strands agent (OpenAI model) plays the voice agent under the same task text, one turn at a time, with structured output `{ say, end_call }`. The tester plays the person by typing. When the agent ends the call, a second structured run extracts the result using the same zod schema, and the result mapper writes answers. Simulated calls are real rows with `provider = 'simulator'` so the Responses tab and later reports can show them, clearly labeled.

## API

- `GET /api/campaigns/:id/task-preview?contactId=` → `{ task, resultSchema }` so the organizer can review what the caller will be told.
- `POST /api/campaigns/:id/simulations` `{ contactId?, personName? }` → creates a simulated call and returns the opening line.
- `POST /api/campaigns/:id/simulations/:callId/turns` `{ text }` → the reply, whether the call ended, and the mapped result when it did.
- `GET /api/campaigns/:id/calls`, `GET /api/campaigns/:id/calls/:callId` → calls with answers and transcript.

## Web

- Overview: a "Call script" section showing the task preview.
- A "Test call" dialog: pick a contact or type a name, chat as the person, see the extracted answers and summary when the call ends.
- Responses tab: a first list of calls (contact, provider, status, summary, answers), replacing the placeholder. Phase 6 expands it.

## Acceptance checks

1. Recorded text sessions show: a vague answer produces a relevant follow-up; "I'd rather not say" is stored as declined; "call me tomorrow" produces a callback request and ends politely; "stop calling me" produces an opt-out.
2. A person who has not tried the menu is not asked about dishes they ordered.
3. Answer records line up with the transcript in a manual check.
4. Lint, typecheck, build, and API tests pass.

## Completion note

**What changed.** Everything in the design above was built as described. Notes:

- The simulator's per-turn structured output is `{ say, end_call }`; the agent is rebuilt each turn from the stored transcript (`call_turns`) so requests stay stateless. Extraction runs as a second structured call over the transcript with the same zod schema CALL-E will get as JSON Schema.
- Answers store a `questionText` snapshot and no foreign key to `questions`, so editing or deleting questions later never deletes or shifts recorded answers.
- `statusFromProvider` in `result-mapper.ts` already maps CALL-E task, recipient, and attempt statuses plus failure codes to Tokito call statuses for Phase 5.
- The call detail page at `/survey/[id]/calls/[callId]` shows the transcript beside the answers so acceptance check 3 can be done by eye.

**Recorded live sessions (2026-09-13, `gpt-5.5`, seeded "New menu feedback" campaign, three open questions).**

| Script | What happened | Recorded result |
|---|---|---|
| Vague answer, then refusal, then hang-up | "It felt expensive." → assistant asked "What made it feel expensive to you?" (acceptance check 1a). "I'd rather not say how I'd rate it." → "That's okay, you don't have to rate it." then moved on. | outcome `partial`; q1 answered "The pasta and the paneer thing."; q2 answered "It felt expensive." with the refusal kept in notes; q3 `skipped`. 28 s. |
| Callback | "Can you call me tomorrow after 6?" → "I've noted a callback request for tomorrow after 6. Thank you, and goodbye." | outcome `callback_requested`, callback time "tomorrow after 6", all questions `not_asked`. 5 s. |
| Opt-out | "Please stop calling me…" → "I've noted that you do not want to be called again. Thank you, and goodbye." | outcome `opted_out`, `opt_out` true, all questions `not_asked`. 5 s. |
| Has not tried the menu | "No, I haven't been since the new menu came out." → one follow-up on why, then a polite close; the dish questions were not asked (acceptance check 2). | outcome `completed`; q1 answered with their words; q2 and q3 `not_asked`. 14 s. |

One extraction judgment to watch: in the first session the refusal ("I'd rather not say how I'd rate it") landed in the notes of the price question rather than as a `declined` status, because the seeded campaign has no rating question to attach it to. With a rating question present the schema gives it a home; keep an eye on this in Phase 6 when reviewing real answers.

**Checks run.**

| Check | Result |
|---|---|
| `bun run lint`, `bun run typecheck`, `bun run build` | Pass |
| `bun test` in `apps/api` (26 tests: task text and rules, JSON Schema shape, mapper for ratings, choices, gaps, callback, opt-out, unparseable input, provider status mapping, simulator end to end with a fake model) | Pass |
| Four live simulations through the real Strands + OpenAI path (table above) | Pass |
| HTTP session: campaign page shows Call script with the task text, Test a call, Responses (4); call detail page shows the transcript, the follow-up question, answers, and Skipped; unknown call → 404 | Pass |
| Browser-driven test-call dialog | Not run: needs a logged-in browser session |

**What the next phase should know.** Phase 5 creates CALL-E tasks from `buildCallSpec` (`task` + `resultSchema` as `recipient_result_schema`), stores the returned ids on `calls`, and on webhook maps `structured_result` with `mapResult` and the lifecycle with `statusFromProvider`, then writes `answers` exactly as `finalizeSimulation` does. Consider extracting that persistence step into a shared function first.
