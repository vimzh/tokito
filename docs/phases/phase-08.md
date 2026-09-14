# Phase 8 — Discord agent

Status: complete as code, September 13, 2026. Not yet run against a real Discord server (no bot token).

## Outcome

The same campaigns can be managed from Discord. An organizer can create a campaign from a message, ask for drafted questions and review them, upload a contact spreadsheet as an attachment, check readiness and progress, start, pause, resume, or stop calling, ask what people said, and request the report. Anything that changes state is confirmed with a button before it happens. A linked channel receives notifications when outreach starts, pauses, stops, or completes, when a call cannot be created, when someone asks for a callback, and when a report is ready. Every Discord action is logged with the Discord user who asked for it.

## Design

- **App** `apps/discord`: a Bun process using `discord.js` (gateway) with slash commands and a mention handler. It talks only to the API through the same typed Hono client the web app uses, so Discord and the dashboard always see the same state.
- **Slash commands** (`/tokito …`): `help`, `campaigns`, `status <campaign>`, `start|pause|resume|stop <campaign>` (each posts a confirmation button), `report <campaign>`, `ask <campaign> <question>`, `link` (make this channel the notification channel).
- **Natural language**: mentioning the bot (or a DM) runs a Strands agent (OpenAI model) with tools over the API: list and read campaigns, create a campaign, draft and set questions, import a spreadsheet attachment, show contacts and outreach status, read results, generate or read the report, ask the report. State-changing tools (`start`, `pause`, `stop`, replace questions, delete) do not execute; they register a pending action and the bot posts Confirm / Cancel buttons. The agent keeps a short per-channel conversation memory.
- **Confirmations**: pending actions live in the bot process with the requesting user id; only that user can confirm; they expire after ten minutes.
- **Notifications**: the bot polls `GET /api/events?after=` every 30 seconds and posts selected event types to the linked channel (`workspace_settings.discord_channel_id`). Events made from the dashboard therefore appear in Discord, and Discord actions appear on the dashboard's campaign events.
- **Attribution**: `POST /api/events` records `discord.action` events with the Discord user and what they did.
- **Campaign completion**: the scheduler marks a running campaign `completed` when nothing is left to dial and no call is active, emitting `outreach.completed`.

## Configuration

`apps/discord/.env`: `DISCORD_TOKEN`, `DISCORD_APP_ID`, optional `DISCORD_GUILD_ID` (instant command registration in one server), `API_URL`, `DASHBOARD_URL`, `OPENAI_API_KEY`, `OPENAI_MODEL`. Register commands once with `bun run register`.

## Acceptance checks

1. A campaign created in Discord appears on the dashboard; pausing from the dashboard is reported in the linked channel.
2. Uploading the Phase 3 sample file in Discord yields the same counts as the web upload.
3. The bot never starts calls without an explicit confirmation click by the requesting user.
4. Lint, typecheck, build, and tests pass.

Deferred until a Discord bot token is available: the live checks above in a real server; the tool layer, formatting, confirmation registry, and command handlers are covered by tests against a fake API.

## Completion note

**What changed.** Built as designed. Notes:

- `apps/discord` is a third workspace. Its `dev:bot` script is deliberately not named `dev`, so the root `bun run dev` does not try to start it; without a token it exits immediately with a message.
- The bot's API client is the same Hono RPC client as the web app (`createApi`), with an injectable `fetch` so the tests run against a fake Tokito API that records every request.
- Nothing state-changing runs from a tool or a slash command directly: `change_outreach`, `set_questions`, and the `start|pause|stop` commands create a pending action and the bot posts Confirm / Cancel buttons; only the requesting user can confirm, within ten minutes. `create_campaign`, imports, report generation, and `link` run directly because they were explicitly asked for and place no calls.
- Attribution: confirmed actions, campaign creation, and imports post `discord.action` events with the Discord user; these show in the API event log next to dashboard actions.
- Notifications: the poller keeps a cursor from the time the bot started, so a restart never replays old events.
- The API gained `GET/POST /api/events`, a `discord_channel_id` setting (migration 0006), and campaign auto-completion in the scheduler (`outreach.completed`).

**Checks run.**

| Check | Result |
|---|---|
| `bun run typecheck` and `bun run build` at the root (web, API, Discord); `bun run lint` (web) | Pass |
| `bun test` in `apps/api` (48) and `apps/discord` (9: campaign resolution by id, name, fragment, and ambiguity; confirmation ownership and expiry; `start` proposes without calling the API and executes with attribution after confirmation; `link` and `campaigns`; `import_contacts` downloads and imports the fixed `name`, `phone` attachment and reports the same counts as the web import; `change_outreach` and `set_questions` create only pending actions; `create_campaign` records the actor; the notifier posts only notable events and advances its cursor; long replies split under the Discord limit) | Pass |
| Live Discord: commands in a real server, buttons, attachment upload, notifications on a dashboard pause | Not run: no `DISCORD_TOKEN` / `DISCORD_APP_ID`. Steps: create a bot in the developer portal with the Message Content intent, fill `apps/discord/.env`, run `bun run register`, then `bun run dev:bot`, invite the bot, and run `/tokito link` in the channel |

**What the next phase should know.** Phase 9's Notion publish can reuse `reportMessage`'s structure; Sheets write-back should hook the same event types the notifier uses (`webhook.call.completed`, `call.polled`).
