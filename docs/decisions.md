# Decisions

The open questions from [idea.md](idea.md), with what was decided during the build (September 13, 2026) and what is still open.

| Question | Decision | Where |
|---|---|---|
| What background should organizers provide? | A free-text **Background** field per campaign (who you are, what changed, anything the assistant may use to clarify a question). It is the only material the caller may use for clarifications, and only when the campaign allows clarifications. | Campaign page, `context` column |
| Which languages and calling regions first? | English and Hindi as conversation languages; a **default country** per workspace and campaign (India by default) for phone-number parsing. CALL-E's region support must be checked before the first real call. | Settings, calling preferences |
| Which calling provider? | **CALL-E** (heycall-e.com): it runs the spoken conversation and returns a structured result plus transcript. Tokito builds the task and result schema and maps results back. Twilio and Vapi were dropped. | `docs/phases/README.md` Phase 5 |
| Which AI stack? | **Strands Agents SDK with OpenAI models** through the OpenAI API (default `gpt-5.5`). No Anthropic SDK, no direct OpenAI SDK calls. Reports use a multi-agent pipeline (per-question analysts, synthesis, reviewer). | `apps/api/src/ai`, `src/reports/pipeline.ts` |
| Which external app connections belong in the build? | **Discord** (manage campaigns, confirmations, notifications), **Google Sheets** (contact source, results write-back), **Google Calendar** (callback events), **Notion** (published report). HubSpot, Gmail, Linear, and Slack are not built. | Phases 8 and 9 |
| How should callers request and confirm callback times? | The caller records the person's words ("tomorrow after 6"); the organizer picks the exact time on the dashboard. The call is placed at that time even outside calling hours, and a calendar event is created only after the callback is scheduled. Tokito never promises a time it has not scheduled. | Calls list, `scheduleCallback` |
| Which answer and report export formats? | CSV and XLSX for answers (one column set per question) and calls; Notion pages for reports; Google Sheets tabs kept in sync. | Responses tab |
| What access, retention, and recording choices? | One shared demo login on the dashboard; an optional `API_TOKEN` gates the API; Google and Notion tokens are encrypted at rest with `TOKEN_ENCRYPTION_KEY`; a workspace **retention** rule deletes collected data from completed campaigns after N days; **Delete collected data** does it on demand; no audio recordings are stored (CALL-E transcripts only). Real accounts per organizer are still open. | Settings, campaign page |
| What calling cost and contact-list size should the first version support? | Imports are capped at 5,000 rows; a per-campaign **maximum calls** budget caps spend (CALL-E's early price is $0.05 per billable call); at most three concurrent calls per campaign and two attempts per person by default. | Calling preferences |

## Still open

- Per-organizer accounts and workspaces (the demo login is shared).
- Whether calls outperform forms for this society: the comparison the brief asks for needs a real campaign.
- Real-region and consent requirements for the countries where calls will be placed.
