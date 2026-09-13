# Phase 9 — External app connections

Status: complete as code, September 13, 2026. Not yet run against real Google or Notion accounts (no client ids).

## Outcome

Google Sheets, Google Calendar, and Notion each do one visible, useful job inside the same campaign workflow: a shared sheet can be the contact source and receives every answer and call status; a requested callback becomes a calendar event that is updated when the callback is made; the report is published as a Notion page. Connections use real OAuth, are configured per campaign, and every write is recorded with success or failure so the dashboard and Discord can show what did not work.

## Design

- **Connections** (`connections` table): one row per provider (`google`, `notion`) for the workspace, holding the access token, refresh token, expiry, scopes, and an account label. OAuth is handled by the API: `GET /api/connections/:provider/start` redirects to the provider with a signed state; `GET /api/connections/:provider/callback` exchanges the code, stores the tokens, and redirects back to the dashboard's Connections page. Google tokens refresh automatically before expiry. `DELETE /api/connections/:provider` disconnects.
- **Per-campaign configuration** (`campaign_connections` table): `sheets` (spreadsheet id from a pasted URL), `notion` (parent page id from a pasted URL), `calendar` (on when Google is connected). Each row keeps the last sync time, status, error, and external URL.
- **Google Sheets**: import contacts from the first tab of the configured sheet through the existing import flow (mapping review included); write back after every terminal call and on demand to two tabs, `Tokito answers` and `Tokito calls`, using the Phase 6 export rows so the sheet and the CSV export never differ.
- **Google Calendar**: scheduling a callback creates an event on the primary calendar at that time for the campaign's maximum call length; when the callback call reaches a terminal state the event title is updated with the outcome. A calendar entry never replaces the scheduler.
- **Notion**: publishing creates a page under the configured parent with the report headline (labeled AI summary), participation, themes with quotes and links back to the dashboard call pages, gaps, and next steps (labeled AI suggestion). Each report version publishes a new page; the page URL is stored on the report.
- **Failure visibility**: every integration write records an `integration.<provider>.<ok|failed>` campaign event and updates the campaign connection row. The Discord notifier posts failures. The campaign page shows status and last error per connection.
- **Hooks**: `src/integrations/hooks.ts` lets the call layer announce `call.terminal` and `callback.scheduled` without importing the integrations; `index.ts` registers the Sheets and Calendar handlers.
- **Out of scope**: HubSpot, Gmail, Linear. Tokens are stored unencrypted in SQLite; Phase 10 records this as a limitation.

## Configuration

`apps/api/.env`: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NOTION_CLIENT_ID`, `NOTION_CLIENT_SECRET`, `API_PUBLIC_URL` (base for redirect URIs, default `http://localhost:3002`). Register `<API_PUBLIC_URL>/api/connections/google/callback` and `<API_PUBLIC_URL>/api/connections/notion/callback` with the providers.

## Acceptance checks

1. Callback requested on a call → calendar event → callback executed by Tokito → event marked done. (Code path tested with a fake Google API.)
2. Completed call → rows in the sheet. (Code path tested; the sheet write uses the export rows.)
3. Report → Notion page whose findings match the dashboard. (Block builder tested against a report fixture.)
4. A failed token or API error produces a recorded failure event and a visible status, never a silent skip.
5. Lint, typecheck, build, and tests pass.

Live checks with real Google and Notion credentials are deferred until client ids are available.

## Completion note

**What changed.** Built as designed. Notes:

- All outbound integration traffic goes through one injectable `fetch` (`src/integrations/http.ts`), so the tests drive every flow, including token refresh and provider errors, against a fake network.
- The call layer never imports the integrations. `persistCallResult` emits `call.terminal` and `scheduleCallback` emits `callback.scheduled`; `registerIntegrations()` in `index.ts` attaches the Sheets sync and the Calendar create and update handlers. A failing handler is logged and cannot break the scheduler.
- The Sheets write uses the Phase 6 export rows, so the sheet, the CSV, and the XLSX always agree.
- Report generation publishes to Notion automatically when a parent page is configured; failures are recorded and the report is still returned.
- The Connections page is real: status per provider, Connect links to the API's OAuth start, Disconnect, and a note when the API has no client id. Slack, HubSpot, Gmail, and Linear are listed as not available.
- Tokens are stored unencrypted in SQLite. Recorded as a limitation for Phase 10.

**Checks run.**

| Check | Result |
|---|---|
| `bun run lint`, `bun run typecheck`, `bun run build` (web, API, Discord) | Pass |
| `bun test` in `apps/api` (58 tests; 10 new: OAuth start URLs and state expiry, Google code exchange with account label, token refresh once, URL parsing for sheets and Notion pages, sheet import through the normal mapping flow, sheet sync writing both tabs with a tolerated "already exists" tab error and a recorded permission failure, calendar event created on callback scheduling and updated on the terminal call through the hooks, calendar failures recorded not thrown, Notion block builder keeping quotes and AI labels, Notion publish storing the page URL and recording a failure, hook isolation) | Pass |
| Running API: connections status; start without a client id → 400 with the reason; callback with a bad state → redirect to the dashboard with the error | Pass |
| HTTP session: Connections page shows both providers, Not connected, the not-configured note, the connect error banner; campaign page shows Connected apps with the three cards and "connect first" notes | Pass |
| Live OAuth, a real sheet write, a real calendar event, a real Notion page | Not run: no Google or Notion client ids. Steps: create a Google OAuth web client with the Sheets and Calendar scopes and a Notion public integration, set the redirect URIs from the README, fill `apps/api/.env`, restart the API, then Connect on the Connections page |

**What the next phase should know.** Phase 10 should encrypt or at least isolate `connections` tokens, add the deletion of campaign connections to campaign deletion checks, and include the integration events in the evaluation record.
