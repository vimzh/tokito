# Tokito — system and reliability brief

Tokito is Google Forms for phone calls. An organizer describes what they want to learn, Tokito drafts the questions, calls a contact list through CALL-E, asks follow-ups, and turns the conversations into a report whose every claim points at the answers behind it. The dashboard and a Discord bot manage the same campaigns.

## What the organizer asks for and what the agent completes

1. **Describe the goal** on the dashboard or in Discord. Tokito creates a draft campaign.
2. **Draft questions.** A Strands agent (OpenAI model) proposes four questions with types (open, rating, choice), including a screening question when the goal assumes an experience. Nothing is saved until the organizer accepts; each proposal can be regenerated or deleted, and the editor allows edits, reordering, and per-question options.
3. **Upload contacts** from Excel, CSV, or a Google Sheet using exactly two columns in this order: `name`, `phone`. Every row is kept with a status (ready, invalid, duplicate, opted out) and a reason.
4. **Review the call script** and calling preferences (language, hours, time zone, attempts, budget, dynamic or fixed conversation, clarifications).
5. **Start calling.** A scheduler dials ready contacts inside calling hours through CALL-E, retries within limits, and handles no-answer, decline, callback, and opt-out.
6. **Read results**: per-contact status, transcripts beside answers, per-question aggregates, exports.
7. **Read the report** and ask it questions.

## How the parts work together

| Part | Role |
|---|---|
| `apps/web` (Next.js) | Dashboard. Server components and actions call the API through a typed Hono RPC client. |
| `apps/api` (Hono on Bun, SQLite) | All state and logic: campaigns, contacts, calls, results, reports, integrations, scheduler. |
| `apps/discord` (discord.js) | Slash commands and a mention-driven Strands agent whose tools call the same API. |
| CALL-E | Places calls and runs the spoken conversation from Tokito's task text; returns a structured result and transcript by webhook. |
| OpenAI via Strands | Question drafting, the text simulator, the report pipeline, ask-the-report, the Discord agent. |
| Google Sheets, Calendar, Notion | Contact source and results sheet; callback events; published reports. |

## Which decisions the agent makes and which the organizer controls

The agent decides wording, follow-ups within the campaign's rules, how to group findings, and what to suggest. The organizer controls the questions, who is called, when, how often, the budget, and every state change: starting, pausing, stopping, replacing questions, deleting data. In Discord those need a confirmation button from the requesting user.

## How progress, answers, and callbacks are saved

Every call is a row with a status; transcripts are stored per turn; answers are stored per question with a status (`answered`, `skipped`, `declined`, `unknown`, `not_asked`) and are never invented. A callback request stores the person's words; the organizer schedules the exact time, which creates a queued call and, if connected, a calendar event. Every state change and integration write is a campaign event.

## How failures, repeats, opt-outs, and incomplete answers are handled

- **Failures**: CALL-E errors such as `unsupported_region` are stored on the call and shown on the contact; integration failures are recorded events with visible status and Discord alerts.
- **Repeats**: webhook events are stored by id and applied once; call creation uses idempotency keys; re-importing a file yields duplicates, not double calls.
- **Opt-outs**: a workspace list keyed by phone; an opt-out during a call adds the number; listed numbers can never reach `ready`.
- **Incomplete answers**: gaps keep their status and appear in results, exports, and the report's Gaps section; the report says how many people were contacted versus answered and that respondents are not automatically representative.
- **AI text** is labeled as AI summary or AI suggestion; counts come from the database; every quote links to its call; a reviewer agent removes unsupported claims before code validation drops any citation that does not resolve.

## What was tested

See [evaluation.md](evaluation.md) for every check from the hackathon checklist with its actual result, and `docs/evaluation/` for end-to-end runs with synthetic transcripts across five scenarios.

## Known limitations

- No live CALL-E call has been placed; the provider path is verified with a fake provider and CALL-E's published API shapes.
- No live Discord session, Google, or Notion account has been connected; those paths are verified against fake networks.
- One shared demo login; no per-organizer accounts.
- Tokens are encrypted at rest only when `TOKEN_ENCRYPTION_KEY` is set.
