# Phase 2 — Question drafting and campaign setup

Status: complete, September 13, 2026.

## Outcome

An organizer describes a goal and some background, asks Tokito to draft questions, reviews them in a typed editor (open, rating, choice), reorders and edits them, and sets the calling preferences for the campaign. Workspace defaults on the Settings page seed every new campaign. Nothing calls anyone yet.

## Tasks

### 1. Schema (migration 0001)

- `campaigns` gains: `language` (`en` | `hi`, default `en`), `max_call_minutes` (default 5), `calling_hours_start` / `calling_hours_end` (`HH:MM`, defaults 10:00 / 18:00), `timezone` (IANA name, default `Asia/Kolkata`), `max_attempts` (default 2), `clarifications_allowed` (boolean, default true), `last_draft_model` and `last_draft_prompt_version` (nullable, record which drafting run produced the current questions).
- `questions` gains `source` (`ai` | `manual`, default `manual`). `type`, `options`, `required` already exist.
- New `workspace_settings` table with a single row (`id = 'default'`) holding the same calling preference columns. New campaigns copy these values at creation.

### 2. API

- `PUT /api/campaigns/:id/questions` accepts `{ questions: [{ text, type, options?, required }] }`. Choice questions must have 2–8 options; other types must not carry options.
- `PATCH /api/campaigns/:id` accepts the new preference fields and `context`, with validation (`HH:MM` times, end after start, 1–20 minutes, 1–5 attempts, valid time zone).
- `GET /api/settings`, `PUT /api/settings` for workspace defaults.
- `POST /api/campaigns/:id/questions/draft` → runs the drafting service and returns `{ questions, model, promptVersion }` without saving. The organizer applies them through the questions endpoint, so a draft never silently overwrites edits. The `questions.drafted` event records the run.
- Drafting service in `src/ai/`: a Strands Agents SDK agent (`@strands-agents/sdk`) using the OpenAI model provider through the OpenAI API, with a zod structured-output schema, model in one config module (`OPENAI_MODEL`, default `gpt-5.5`), and a prompt version constant. The same agent wrapper is reused by later phases. The prompt asks for 4–8 questions, a screening question when the goal assumes an experience, no leading wording, and a mix of types only where a rating or choice is natural. Missing `OPENAI_API_KEY` returns a 503 with a clear message.
- Tests: validation of the questions payload, settings defaults applied on create, drafting service against a fake client, and the "not configured" path.

### 3. Web

- Create form gains a background field (`context`).
- Campaign page: Questions section becomes an editor (edit text, change type, options for choice, required toggle, add, remove, move up or down, save). A "Draft with AI" button runs the draft and shows the proposal for review with Accept / Discard; Accept over existing questions asks for confirmation.
- Campaign page: a Calling preferences dialog for language, max call length, calling hours, time zone, max attempts, follow-up mode, clarifications allowed.
- Edit dialog keeps name, goal, background, and other topics.
- Settings page saves real workspace defaults through the API.

## Acceptance checks

1. With a key configured: the restaurant goal produces 4–8 relevant questions including a screening question, none leading. Recorded in the completion note with the actual output.
2. Without a key: the Draft button shows the "not configured" message and the campaign stays editable.
3. Edits, reorders, type changes, and preferences persist across reload.
4. Accepting a draft over existing questions requires confirmation; Discard leaves questions untouched.
5. Settings saved on the Settings page appear as defaults on the next created campaign.
6. Lint, typecheck, build, and API tests pass.

## Completion note

**What changed.**

- The AI layer was rewritten twice on the user's instruction during this phase: first from the Anthropic SDK to the OpenAI SDK, then to the Strands Agents SDK (`@strands-agents/sdk` 1.17) with its OpenAI model provider. Services depend on one small `StructuredRun` function in `src/ai/agent.ts`; a fresh Strands `Agent` with a zod `structuredOutputSchema` runs each request so nothing accumulates history. Tests fake that function. No code imports the `openai` package directly; it is present only as the SDK's peer dependency.
- The calling provider was decided as CALL-E (heycall-e.com). The Phase 4 and 5 plans in `README.md` were rewritten around its call-task API, result schema, transcript turns, and webhooks.
- Drafting never saves. `POST /api/campaigns/:id/questions/draft` returns a proposal; the Draft panel shows it with each question's type, options, and purpose; Accept over existing questions asks for confirmation; Discard changes nothing.
- The question editor saves the whole ordered list through `PUT /api/campaigns/:id/questions` (text, type, options, required, source). Choice questions require two to eight distinct options.
- The API build uses `--packages external` because bundling the Strands SDK pulls in optional AWS peers.

**Checks run.**

| Check | Result |
|---|---|
| `bun run lint`, `bun run typecheck`, `bun run build` | Pass |
| `bun test` in `apps/api` (12 tests: service, validation, settings defaults, drafter normalization and failure) | Pass |
| Migration 0001 applied to the dev database; hot API server serves `/api/settings` | Pass |
| `curl` draft without a key → 503 "AI drafting is not configured"; PATCH with end before start → 400 with the hours message | Pass |
| HTTP session: detail page shows Background, the question editor with answer types, the Draft button, calling preferences summary; Settings page shows real defaults and no preview notice; create page has the Background field | Pass |
| Acceptance check 1 (real drafting output for the restaurant goal) | Pass, run later the same day with a real key against `gpt-5.5` (13.6 s), `gpt-5.6-sol` (17.9 s), and `gpt-6-astra` (14.6 s). All three returned 8 schema-valid questions, opened with a screening choice question about whether the person had ordered from the new menu, covered prices, portions, vegetarian choices, and missed dishes, and ended with an optional open question. None used leading wording. The `gpt-5.5` output is recorded below. |
| Browser-driven editor, draft accept/discard, preferences dialog, settings save | Not run: needs a logged-in browser session |

**Recorded `gpt-5.5` draft (restaurant goal, 2026-09-13).**

1. Choice (Yes, I ordered from the new menu / I visited but did not order from the new menu / No, I have not visited since then / I'm not sure): Since the new menu launched last month, have you visited our restaurant and ordered from it?
2. Open: Which new dish or dishes did you try, if any?
3. Open: What did you like about the new dish or dishes you tried?
4. Open: What, if anything, would you improve about the new dish or dishes you tried?
5. Rating 1–5: How fair did the new menu prices feel for what you received, where 1 is not fair at all and 5 is very fair?
6. Open: How did the portion sizes feel to you?
7. Open: How do you feel about the vegetarian choices on the new menu?
8. Open, optional: Is there anything else you would like to add about the new menu, including any old dishes you miss?

**What the next phase should know.** Phase 3 adds contacts. The `campaigns` row now carries language, calling hours, time zone, max attempts, and clarifications; Phase 4's CALL-E task builder reads those. `questions.source` tells whether a question came from the drafter. `src/ai/agent.ts` is the place to add tools if a later phase needs an agent that calls the API.
