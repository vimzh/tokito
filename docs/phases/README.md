# Tokito build plan — 10 phases

Written September 13, 2026 from [idea.md](../idea.md), [hackathon.md](../hackathon.md), and the code as it stands. Each phase ends with something an organizer can use and a check that proves it works. Phases build on each other; do not start a phase until the previous one's acceptance checks pass.

Detailed phase documents live next to this file (`phase-01.md`, `phase-02.md`, …). Only Phase 1 is written in detail so far; write the next phase's document when the current one is accepted, using what was learned.

## Where the project is today

| Area | State |
|---|---|
| Monorepo | Bun workspaces with `apps/web` (Next.js 16, shadcn/ui, Tailwind 4) and `apps/api` (Hono). `bun run typecheck` passes for both. |
| Landing page | Done: hero, use cases, features, planned connections. Copy lives in `apps/web/src/data`. |
| Auth | Done for demo purposes: Auth.js with a shared demo credential login and optional Google OAuth. `/home` and other workspace routes require a session. |
| Workspace shell | Done: sidebar, navigation, profile card, Home / Connections / Settings pages. |
| Home page | Done (Phases 1 and 6): real campaigns with contacts, responses, and progress for running campaigns. |
| Create campaign | Done (Phase 1): the review step saves a draft through a server action and redirects to the campaign page. |
| Campaign detail | Done (Phases 1–3): goal, background, topics, a typed question editor with AI drafting, calling preferences, edit and delete, a Contacts tab with upload, mapping, validation, and per-row fixes, a Call script preview, a Test a call dialog, a metrics row with live refresh, an Answers tab with per-question aggregates and quotes linked to calls, a Responses tab with the calls list and CSV/XLSX exports, a transcript page, and a Report tab with a versioned AI report (themes, disagreements, requests, gaps, labeled suggestions, every quote linked to its call) and a question box with citations. |
| Connections page | Done in code (Phase 9): real OAuth status and Connect/Disconnect for Google and Notion; per-campaign sheet, calendar, and Notion settings on the campaign page with sync status and visible failures. |
| Settings page | Done (Phases 2–3): workspace calling defaults, default country, and the opt-out list. |
| API | Done (Phase 1): campaigns CRUD and question replacement with zod validation, CORS, JSON errors, and service tests. |
| Database | Done (Phase 1): `campaigns`, `questions`, `campaign_events` tables, first migration, seed script. |
| Version control | Done (Phase 1): git initialized with a baseline commit. |
| AI | Done (Phases 2, 4, 7): Strands Agents SDK with the OpenAI provider drafts questions, runs the text call simulator, writes the report through a multi-agent pipeline (analysts per question, synthesis, reviewer), and answers questions over the evidence; needs `OPENAI_API_KEY`. |
| Calling | Done in code (Phase 5): CALL-E adapter, scheduler with calling hours, attempts, budget, webhooks, polling, callbacks, start/pause/stop. Needs `CALLE_API_KEY` and a public webhook URL; no live call yet. |
| Discord | Done in code (Phase 8): `/tokito` commands, mention-driven agent with API tools, confirmation buttons, notifications, attribution. Needs a bot token to run. |
| External apps | Done in code (Phase 9): Sheets contact import and results write-back, Calendar callback events, Notion report pages. Needs Google and Notion client ids. |

Phases 1 to 5 are complete in code: campaigns, questions, drafting, preferences, contact lists, the CALL-E task builder, result mapping, a text simulator, and the outreach scheduler with CALL-E adapter, webhooks, and callbacks. Phases 6 and 7 add the results dashboard, exports, and the versioned report with ask-the-report. Phases 8 and 9 add the Discord bot and the Google Sheets, Calendar, and Notion connections in code. Phase 10 adds access control, encrypted tokens, deletion and retention, app-level tests, the evaluation record with a five-scenario end-to-end run, and the demo materials. Live runs of calls, Discord, and the connections still wait on a CALL-E key, a bot token, and OAuth client ids. The phases below start by making the existing screens real and then add the parts the brief calls for, roughly in the order an organizer experiences them.

## Phase overview

| # | Phase | What exists at the end | Depends on |
|---|---|---|---|
| 1 | Foundation: real campaigns end to end (done 2026-09-13) | Campaigns and questions are saved in SQLite through the API and shown on the dashboard. Git history begins. | — |
| 2 | Question drafting and campaign setup (done 2026-09-13) | An OpenAI model, run through the Strands Agents SDK, drafts a questionnaire from the goal; organizer edits, reorders, and sets question types and calling preferences. | 1 |
| 3 | Contact lists (done 2026-09-13) | Excel upload, column mapping, validation of numbers and duplicates, extra context columns, opt-out list. | 1 |
| 4 | Conversation layer (done 2026-09-13) | The layer that turns a campaign into CALL-E's task and result schema, plus a text simulator to exercise it, and the mapping from results and transcripts into answers. | 2, 3 |
| 5 | Telephony and outreach control (code done 2026-09-13; live call pending) | Real outbound calls through CALL-E (heycall-e.com), webhook handling, call outcomes, retries, calling hours, callbacks, start/pause. | 4 |
| 6 | Progress and results dashboard (done 2026-09-13) | Live per-contact status, transcripts, summaries, per-question answers, callback list, exports. | 5 |
| 7 | Reports and asking questions of the data (done 2026-09-13; multi-agent pipeline added the same day) | Campaign-level report written by per-question analyst agents, a synthesis agent, and a reviewer agent; campaign-level report with counts, themes, supporting quotes, disagreements, gaps, labeled suggestions, and a Q&A box over the answers. | 6 |
| 8 | Discord agent (code done 2026-09-13; live server pending) | Manage the same campaigns from Discord: create, review questions, upload contacts, start/pause, progress, answers, reports, notifications. | 7 |
| 9 | External app connections (code done 2026-09-13; live accounts pending) | Google Sheets (contacts in, results out), Google Calendar (callbacks), Notion (published report), with real OAuth and visible failures. | 8 |
| 10 | Reliability, trust, and demo (done 2026-09-13) | Test and evaluation checklist from `hackathon.md` executed and recorded, consent and retention controls, reliability brief, demo script, deployment. | 9 |

## Phase details

### Phase 1 — Foundation: real campaigns end to end

**Goal.** Replace the mocked survey data with a real data path: web → Hono API → SQLite. Establish the shared conventions every later phase will use (schema, migrations, API shape, typed client, environment, git).

**Scope.**
- Initialize git and commit the current state so later work is reviewable.
- Define the first tables: `campaigns`, `questions`, `campaign_events`. Generate and run the first Drizzle migration. Add a seed script that recreates today's three sample campaigns as real rows so the dashboard is not empty.
- Hono API: list, create, read, update campaigns; replace and reorder a campaign's questions; record events. JSON validation on every write. CORS for the web app.
- Typed client for the web app using Hono RPC (`hc<AppType>`) so route changes surface as type errors.
- Web: the create form saves a campaign (draft status) and redirects to its page; Home lists real campaigns; the detail page reads a real campaign and shows its questions. Empty states replace sample-data notices. Keep the current visual design.
- Environment: `API_URL`, `DB_FILE_NAME`, documented in `.env.example` files and the README. `bun run setup` runs migrations.

**Acceptance checks.**
- Create a campaign in the browser, reload, and see it in the list and on its page; restart the API and it is still there.
- `bun run lint`, `bun run typecheck`, and `bun run build` pass.
- `curl` against the API shows validation errors for bad input and 404 for unknown ids.

See [phase-01.md](phase-01.md) for the task-level breakdown.

### Phase 2 — Question drafting and campaign setup

**Goal.** Make the "describe the goal, review the questions" step real.

**Scope.**
- Add the Strands Agents SDK to `apps/api` with OpenAI as the model provider (model id and settings in one config module). A `draftQuestions` service takes goal, background context, and extra topics and returns 4–8 questions with a type each: open, rating (1–5), or single choice with options. Store the prompt version alongside generated questions.
- Campaign background: a "context" field organizers fill in (who they are, what changed, anything the assistant may use to clarify a question). This is the only material the call agent may use later to explain a question.
- Question editor on the campaign page: edit text, change type and options, add, remove, reorder, mark a question required or optional, toggle whether clarification is allowed. Manual mode skips drafting.
- Calling preferences move from the mock Settings page into per-campaign settings with workspace defaults: language, max call length, calling hours and time zone, max attempts per contact, follow-up mode (dynamic or fixed).
- Regenerate questions after editing the goal, without losing hand-edited questions unless the organizer confirms.

**Acceptance checks.**
- A restaurant goal produces relevant, non-leading questions that skip "have you tried it" assumptions (it should include a screening question).
- Edits persist; the review screen shows the final questions and settings.
- Model failures show an error and keep the campaign editable; no partially saved questionnaires.

### Phase 3 — Contact lists

**Goal.** Organizers bring an Excel file and leave with a clean, reviewed call list.

**Scope.**
- Upload `.xlsx` / `.csv` (parsed server-side with a SheetJS-style library). Show the first rows and let the organizer pick the name column, the phone column, and which extra columns to keep as per-contact context.
- Normalize numbers to E.164 with a default country chosen on the campaign. Flag missing numbers, unparseable numbers, and duplicates within the file and against contacts already in the campaign.
- `contacts` table with status (`ready`, `invalid`, `duplicate`, `opted_out`, `excluded`) and a JSON context column. An organizer can exclude or fix individual rows before calling.
- Workspace-level `opt_outs` table keyed by normalized phone; uploads are checked against it and matches are shown.
- Contact list page on the campaign: counts by status, filters, search, per-row edit and remove.

**Acceptance checks.**
- A sample file with blanks, malformed numbers, and repeated rows is imported and every problem is visible before calling.
- Re-uploading the same file creates no duplicates.
- Numbers on the opt-out list can never reach `ready` status.

### Phase 4 — Conversation engine

**Goal.** The part of Tokito that talks to a person, built so it can be tested in text before any phone call is placed.

**Scope.**
- A per-call state machine: introduction (identify the assistant, the organization, the reason, and recording/transcription notice), consent, questions in order, follow-ups, wrap-up. Explicit states for skip, decline, "don't know", ask to stop, callback request, and opt-out.
- An OpenAI model, run through the Strands Agents SDK, drives each turn with a prompt built from the campaign goal, approved context, question list, question types, follow-up mode, and the transcript so far. The model returns both the next utterance and structured events (answer captured, follow-up asked, question skipped, callback requested, stop requested).
- Follow-up rules from the brief: explore reasons and examples, stay within the campaign goal, never lead, never re-ask something already answered, stop when the person wants to stop, respect the maximum call length.
- Rating and choice questions are captured as values, open questions as text; gaps stay gaps (`skipped`, `declined`, `unknown`), never invented.
- Tables: `calls`, `call_turns` (transcript), `answers`. Post-call summarization writes a short summary and a list of unanswered questions per call.
- A text simulator: a CLI or dev page where a tester plays the participant by typing, so the whole flow can be exercised and unit-tested with recorded conversations.

**Acceptance checks.**
- Recorded text sessions show: a vague answer produces a relevant follow-up; "I'd rather not say" is stored as declined; "call me tomorrow" produces a callback request and ends politely; "stop calling me" produces an opt-out.
- A person who has not tried the menu is not asked about dishes they ordered.
- Answer records line up with the transcript in a manual check.

### Phase 5 — Telephony and outreach control

**Goal.** Real calls, safely, through CALL-E.

**Provider decision (September 13, 2026).** The calling provider is [CALL-E](https://www.heycall-e.com/) ([docs](https://docs.heycall-e.com/)). It is a hosted AI voice agent: Tokito creates a call task with a natural-language `task`, `recipients` (E.164 phones plus locale and region), a `recipient_result_schema` (JSON Schema for the per-person structured answers), `metadata`, and a `webhook_url`; CALL-E places the call, runs the spoken conversation, and returns `status`, `summary`, `structured_result`, `task_completed`, `completion_confidence`, `evidence`, and per-attempt `transcript_turns` (`speaker`, `text`, `offset_seconds`). Auth is a bearer API key; SDKs exist for TypeScript (`@call-e/calle`) and Python; early pricing is $0.05 per billable call with 20 free calls. Outbound calling is limited to supported regions and a valid number can still be rejected with `unsupported_region`, so region support must be checked before the demo.

This changes the shape of Phase 4: because CALL-E runs the spoken conversation itself, Tokito's conversation engine becomes the layer that turns a campaign into a CALL-E task (introduction, consent notice, questions in order, follow-up rules, skip and stop handling, callback capture) and a result schema, and that maps CALL-E's structured result and transcript back into answers. The text simulator in Phase 4 stays, so the task and schema can be exercised without spending calls.

**Scope.**
- CALL-E adapter with one interface: create call task, fetch task, handle webhook events. Store `call_id`, recipient and attempt ids, and `provider_call_id` on `calls`.
- Task builder: campaign goal, approved context, questions, and rules → the `task` text and `recipient_result_schema` (one property per question with the right type: string, integer 1–5, or enum; plus `skipped`, `declined`, `callback_requested`, `callback_time`, `opted_out`, `stop_requested`).
- Webhook endpoint that is idempotent (dedupe by the `CALL-E-Event-Id` header and event `id`), stores raw events for debugging, and handles `call.completed`, `call.failed`, and `call.result_validation_failed`. Polling `GET /v1/calls/{call_id}` as a fallback when a webhook is missed.
- Outcomes mapped to call status: completed, no answer, busy, failed, declined, callback requested, opted out, using recipient and attempt `status` and `failure_code`.
- Scheduler: a queue that respects calling hours and time zone, max attempts, spacing between retries, one active task per contact, and campaign `running` / `paused` state. Callbacks are scheduled as future queue items and shown as such.
- Start, pause, resume, and stop controls on the campaign page with confirmation and a visible reason when nothing can be dialed (outside hours, no ready contacts, no CALL-E key, unsupported region).
- Budget guard: per-campaign cap on calls for the first version, using the per-call price.

**Acceptance checks.**
- A consenting tester receives a call, answers, and their answers appear in the database matching what they said and the transcript.
- Duplicate webhook deliveries create no duplicate calls or answers.
- No-answer leads to a retry within limits and then a final "unreachable" status.
- Pausing stops new dials immediately; in-progress calls finish.
- An `unsupported_region` rejection is shown on the contact, not swallowed.

### Phase 6 — Progress and results dashboard

**Goal.** Make the campaign page the place to follow outreach and read what people said.

**Scope.**
- Campaign header with live counts: in list, ready, called, reached, completed, callbacks, unreachable, opted out. Polling or server-sent events for updates.
- Contacts tab: one row per person with attempt count, latest outcome, next scheduled attempt, and a link to the call.
- Call page: transcript, summary, answers by question, unanswered questions, callback details, provider outcome, duration.
- Answers tab: per-question view with counts, rating averages and distributions, choice totals, and open answers listed with the person and a link back to the transcript.
- Exports: CSV and XLSX of answers and call statuses. Formats stay simple until Phase 9 adds Sheets.
- Home page becomes the real campaign list with status and progress.

**Acceptance checks.**
- Counts on the page equal counts computed directly from the database for a test campaign.
- Every answer shown links to the exact transcript turn that produced it.
- Export re-imports cleanly into a spreadsheet with correct columns.

### Phase 7 — Reports and asking questions of the data

**Goal.** Turn conversations into the detailed report the brief describes, with every claim traceable.

**Scope.**
- Report generation service: input is all answers and summaries for a campaign; output is a structured report stored in a `reports` table with a version. Sections: participation numbers, per-question results, themes with counts of people and supporting quotes, positive feedback, problems, suggestions, disagreements with participant context, callback and help requests, gaps and who did not answer, and suggested next steps clearly labeled as AI suggestions.
- Traceability: every theme stores the answer ids behind it; the UI shows quotes as quotes and summaries as summaries, visually distinct.
- Guardrails: counts come from the database, not the model; the model only labels and groups. The report states how many people were contacted versus answered and warns against treating respondents as representative.
- "Ask the report": a question box that answers from the stored answers with citations, for questions such as "Are price complaints about price or portion size?"
- Regenerate when new calls complete; keep prior versions.

**Acceptance checks.**
- Every count in a report can be reproduced with a query.
- Every quote in a report is a verbatim participant turn.
- Skipped questions appear in the gaps section rather than being smoothed over.

### Phase 8 — Discord agent

**Goal.** Manage the same campaigns from Discord with shared state.

**Scope.**
- Discord bot in `apps/discord` (or inside the API process) using slash commands plus a natural-language channel handler backed by a Strands agent (OpenAI model) with tools over the same API the dashboard uses.
- Capabilities: create a campaign from a message, show and edit drafted questions, upload an Excel attachment as the contact list, review readiness, start / pause / resume, ask progress, look up what people said about a topic, request the report, and receive notifications for completion and problems needing attention.
- Link a Discord server to a workspace; every action is attributed to a Discord user.
- Messages that change state confirm before acting (start calling, pause).

**Acceptance checks.**
- A campaign created in Discord appears in the dashboard immediately, and a pause from the dashboard is reported in Discord.
- Uploading the Phase 3 sample file in Discord produces the same validation summary as the web upload.
- The bot never starts calls without an explicit confirmation.

### Phase 9 — External app connections

**Goal.** The connections the hackathon needs, each doing visible useful work in one workflow.

**Scope.**
- Connections page becomes real: OAuth for Google (Sheets and Calendar) and Notion, with connect / disconnect and the last sync status per campaign.
- Google Sheets: read a shared sheet as a contact source (through the Phase 3 mapping flow) and write answers and call statuses back to a results tab after each completed call.
- Google Calendar: when a callback is scheduled, create a calendar event; when the callback is executed, update the event. A calendar entry never replaces the scheduler.
- Notion: publish the Phase 7 report as a page with quotes, counts, and suggested next steps; republish on regenerate.
- Every integration write is recorded in `campaign_events` with success or failure so the dashboard and Discord can show failed updates.
- HubSpot, Gmail, Linear remain out of scope unless the chosen demo use case needs them.

**Acceptance checks.**
- Callback requested on a call → Calendar event → callback executed by Tokito → event marked done.
- Completed call → row in the Sheet within a minute.
- Report → Notion page whose findings match the dashboard.
- Revoking a token produces a visible failure, not a silent skip.

### Phase 10 — Reliability, trust, and demo

**Goal.** Prove it works, make it safe to run, and be ready to show it.

**Scope.**
- Automated tests: conversation engine with recorded sessions, contact validation, scheduler rules, webhook idempotency, report counts.
- Execute the evidence checklist in `hackathon.md` and record actual results in `docs/evaluation.md`, including failures and limits.
- Trust and control: consent script reviewed for the target region, opt-out honored everywhere, retention setting and deletion of a campaign's contacts and transcripts, access limited to the workspace, recordings off by default.
- Operations: deployment for the API and web app, provider credentials handled through environment variables, health endpoint, error logging.
- Documentation: system and reliability brief, updated README, two-minute demo script with prepared data, and the list of open decisions from `idea.md` with what was decided.

**Acceptance checks.**
- Every checklist item in `hackathon.md` has a recorded outcome.
- A full dry run of the demo script completes in under two minutes with the real system.
- Deleting a campaign removes its contacts, transcripts, and answers, and the deletion is logged.

## Working agreements across phases

- Each phase gets a `phase-NN.md` with tasks, files touched, and acceptance checks before work starts, and a short "what changed and what was learned" note when it ends.
- Keep the design rules in `AGENTS.md`: minimal interface, shadcn components first, copy in `src/data`, Geist Pixel Square for headings and Manrope elsewhere.
- SQLite through `bun:sqlite` stays the database unless a phase hits a concrete limit.
- Never present sample data as results. When a screen shows sample rows, label it; when it shows real rows, drop the label.
- Commit at the end of each task, not each phase.
