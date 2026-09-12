# Tokito

Google Forms, but people answer your questions over a phone call. Product brief: [docs/idea.md](docs/idea.md). Build plan: [docs/phases/README.md](docs/phases/README.md).

## Development

```bash
bun run setup
bun run dev
```

`bun run setup` installs dependencies, creates the env files, runs database migrations, and seeds three draft campaigns.

- Web (Next.js): http://localhost:3000
- API (Hono): http://localhost:3002

Run checks with `bun run lint`, `bun run typecheck`, and `bun run build`. API tests: `cd apps/api && bun test`.

## Apps

| App | Path | Notes |
|---|---|---|
| Web | `apps/web` | Next.js 16 app with shadcn/ui. Server components and server actions call the API through a typed Hono RPC client in `src/lib/api.ts`. |
| API | `apps/api` | Hono on Bun with SQLite through `bun:sqlite` and Drizzle. Schema in `src/db/schema.ts`, routes in `src/routes`, logic in `src/services`. |

### Environment

`apps/web/.env.local` (copied from `.env.example`):

| Variable | Purpose |
|---|---|
| `AUTH_SECRET` | Auth.js session secret. Generate with `bunx auth secret`. |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | Optional Google OAuth web client. |
| `API_URL` | Base URL of the API, default `http://localhost:3002`. |

`apps/api/.env` (copied from `.env.example`):

| Variable | Purpose |
|---|---|
| `DB_FILE_NAME` | SQLite file, default `local.db`. |
| `PORT` | API port, default `3002`. |
| `WEB_ORIGIN` | Origin allowed by CORS, default `http://localhost:3000`. |
| `OPENAI_API_KEY` | OpenAI key used by the Strands Agents SDK for question drafting. Without it, drafting returns a clear "not configured" error. |
| `OPENAI_MODEL` | OpenAI model id, default `gpt-5.5`. |
| `CALLE_API_KEY` | CALL-E (heycall-e.com) API key for real phone calls. Without it, outreach cannot start. |
| `CALLE_BASE_URL` | CALL-E API base URL, default `https://api.heycall-e.com`. |
| `CALLE_WEBHOOK_URL` | Public URL of this API's `/api/webhooks/calle` endpoint, sent with each call so CALL-E can post terminal events. Polling covers missed events. |
| `OUTREACH_TICK_SECONDS` | How often the scheduler dials and polls, default 30. |

### API routes

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | Liveness check. |
| `GET` | `/api/campaigns` | List campaigns with question counts. |
| `POST` | `/api/campaigns` | Create a draft campaign, optionally with questions. |
| `GET` | `/api/campaigns/:id` | Campaign with ordered questions. |
| `PATCH` | `/api/campaigns/:id` | Update name, goal, context, topics, or conversation mode. |
| `PUT` | `/api/campaigns/:id/questions` | Replace the ordered question list (text, type, options, required). |
| `POST` | `/api/campaigns/:id/questions/draft` | Draft questions with the AI agent; returns a proposal without saving. |
| `GET` | `/api/campaigns/:id/contacts` | Contacts with status, problem, and last-call summary; `POST …/imports`, `POST …/imports/:importId/commit`, `PATCH`/`DELETE …/:contactId`. |
| `GET` | `/api/campaigns/:id/task-preview` | The CALL-E task text and result schema for this campaign. |
| `GET` | `/api/campaigns/:id/calls` | Calls with answers; `GET …/:callId` adds the transcript. `POST …/:callId/callback` schedules a callback. |
| `POST` | `/api/campaigns/:id/simulations` | Start a text simulation; `POST …/:callId/turns` sends the person's line. |
| `GET` | `/api/campaigns/:id/results` | Participation counts and per-question aggregates with every answer linked to its call. |
| `GET` | `/api/campaigns/:id/export` | `kind=answers|calls`, `format=csv|xlsx`; the web app proxies it at `/survey/:id/export` behind the session. |
| `GET` | `/api/campaigns/:id/report` | Latest report and version list (`?version=n`); `POST` generates a new version; `POST …/ask` answers a question with citations; `GET …/questions` lists earlier questions. |
| `GET` | `/api/campaigns/:id/outreach` | Readiness, reasons, and counts; `POST …/start`, `…/pause`, `…/stop`. |
| `POST` | `/api/webhooks/calle` | CALL-E terminal events, idempotent by event id. |
| `POST` | `/api/outreach/tick` | Run one scheduler pass by hand. |
| `GET` | `/api/opt-outs` | Opt-out list; `POST /api/opt-outs`, `POST /api/opt-outs/remove`. |
| `GET` | `/api/settings` | Workspace calling defaults. |
| `PUT` | `/api/settings` | Update workspace calling defaults. |
| `DELETE` | `/api/campaigns/:id` | Delete a campaign and its questions. |

Validation errors return `400` with `{ error: { message, issues } }`; unknown ids return `404`.

Database commands in `apps/api`: `bun run db:generate` (new migration from schema changes), `bun run db:migrate`, `bun run db:seed`, `bun run db:studio`.

## Demo login

Click **Login** on the landing page and use `demo@theategmail.com` / `demo1234`.
The dialog displays these public demo credentials. Auth.js stores the one-day JWT
session in an HTTP-only cookie; workspace routes require a session. This is a shared demo
account, not a private account system. With the frontend running, verify the flow using
`python3 scripts/check-demo-auth.py http://localhost:3000`.

## Optional Google OAuth

Add a Google OAuth web client to `apps/web/.env.local` and register `http://localhost:3000/api/auth/callback/google` as the local authorized redirect URI in Google Cloud.
