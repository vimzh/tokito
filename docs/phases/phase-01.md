# Phase 1 — Foundation: real campaigns end to end

Status: complete, September 13, 2026. Plan written the same day.

## Why this phase first

Every later phase (question drafting, contacts, calls, reports, Discord, integrations) stores and reads campaign data. Today the dashboard renders three hard-coded sample surveys, the API has one hello-world route, and the SQLite schema is empty. This phase builds the spine: a campaign can be created in the browser, saved through the API into SQLite, and read back on the Home and detail pages. It also sets the conventions the other nine phases follow so they do not each invent their own.

Nothing in this phase involves AI, phones, Excel, or external apps. Those come next; this phase makes sure there is somewhere real for them to put their data.

## Outcome

An organizer logs in, creates a campaign with a name, goal, question source, conversation mode, optional questions, and optional extra topics. The campaign is saved as a draft, appears on Home, and opens on its own page showing what was entered. Sample data is gone from the UI, replaced by real rows (seeded for development) and honest empty states.

## Tasks

### 1. Version control

- Run `git init`, confirm `.gitignore` covers `node_modules`, `dist`, `.next`, `*.db`, `*.db-*`, `.env.local`, `tsconfig.tsbuildinfo`, and commit the current tree as the baseline.
- Commit after each task below so progress is reviewable and recoverable.

### 2. Database schema and migrations (`apps/api`)

Define in `src/db/schema.ts` using Drizzle's SQLite helpers:

- `campaigns`
  - `id` text primary key (generate with `crypto.randomUUID()`)
  - `name` text, not null
  - `goal` text, not null
  - `context` text, nullable (background the assistant may use; edited in Phase 2)
  - `additional_topics` text, nullable
  - `question_source` text: `ai` | `manual`
  - `conversation_mode` text: `dynamic` | `fixed`
  - `status` text: `draft` | `ready` | `running` | `paused` | `completed`, default `draft`
  - `created_at`, `updated_at` integer (unix ms), not null
- `questions`
  - `id` text primary key
  - `campaign_id` text, references `campaigns.id` on delete cascade
  - `position` integer, not null
  - `text` text, not null
  - `type` text: `open` | `rating` | `choice`, default `open` (rating and choice editing arrive in Phase 2, but the column exists now so seeds and types are stable)
  - `options` text JSON, nullable
  - `required` integer boolean, default true
  - unique index on (`campaign_id`, `position`)
- `campaign_events`
  - `id` text primary key
  - `campaign_id` text, references `campaigns.id` on delete cascade
  - `type` text (for example `campaign.created`, `campaign.updated`, `questions.replaced`)
  - `payload` text JSON, nullable
  - `created_at` integer, not null

Then:

- Enable foreign keys on the connection in `src/db/index.ts` (`PRAGMA foreign_keys = ON`) and WAL journal mode.
- `bun run db:generate` to create the first migration; check the SQL in `drizzle/` into git.
- `bun run db:migrate` runs on `bun run setup` (update `scripts/init.sh`).
- Add `src/db/seed.ts` and a `db:seed` script that inserts the three campaigns currently in `apps/web/src/data/surveys.ts` (name, goal, questions) as `draft` campaigns, skipping if they already exist by name. Seeded rows are real rows; the "sample" labels in the UI go away.
- Add `apps/api/.env.example` with `DB_FILE_NAME=local.db` and `PORT=3002`; add `apps/api/local.db*` to `.gitignore`.

### 3. API routes (`apps/api`)

Structure:

```
src/
  index.ts            # builds the app, mounts routes, exports AppType
  routes/campaigns.ts
  services/campaigns.ts
  validation/campaigns.ts
```

- Add `zod` and `@hono/zod-validator` for request validation.
- Routes (all JSON):
  - `GET /api/campaigns` → list ordered by `updated_at` desc, each with `questionCount`.
  - `POST /api/campaigns` → body `{ name, goal, additionalTopics?, questionSource, conversationMode, questions?: string[] }`; when `questionSource` is `manual` require at least one non-empty question; creates campaign, questions, and a `campaign.created` event in one transaction; returns 201 with the campaign.
  - `GET /api/campaigns/:id` → campaign with ordered questions; 404 when unknown.
  - `PATCH /api/campaigns/:id` → partial update of name, goal, additionalTopics, conversationMode; records `campaign.updated`.
  - `PUT /api/campaigns/:id/questions` → replaces the ordered list; records `questions.replaced`.
  - `DELETE /api/campaigns/:id` → deletes campaign and cascades; 204.
  - `GET /api/health` → `{ ok: true }`.
- Validation errors return 400 with `{ error: { message, issues } }`; unknown ids 404 with `{ error: { message } }`. One `onError` handler formats everything else as 500 without leaking stack traces.
- CORS middleware allowing the web origin from `WEB_ORIGIN` (default `http://localhost:3000`).
- Export `type AppType = typeof app` for the RPC client.
- Add a `test` script and a few `bun test` cases for the campaigns service: create with manual questions, reject manual without questions, 404 on unknown id, cascade delete.

### 4. Typed API client for the web app (`apps/web`)

- Add `"api": "workspace:*"` as a dev dependency of `web` so `import type { AppType } from "api/src/index"` works; runtime code is never imported from the API package.
- `src/lib/api.ts`: `export const api = hc<AppType>(process.env.API_URL ?? "http://localhost:3002")`, plus small helpers `listCampaigns`, `getCampaign`, `createCampaign`, `updateCampaign`, `replaceQuestions` that unwrap responses and throw a typed `ApiError` on non-2xx.
- Server components and server actions call these helpers; no fetching from client components in this phase.
- Add `API_URL` to `apps/web/.env.example`.

### 5. Web: create a real campaign

- Convert the review step in `components/surveys/new-survey-form.tsx` into a submit: a server action in `src/actions/campaigns.ts` calls `createCampaign` and redirects to `/survey/[id]`.
- Keep the two-step feel (fill in, review, confirm) but the confirm button now says it saves a draft. Remove the "preview only, nothing is saved" notices from `src/data/new-survey.ts`.
- Show server validation errors inline using the existing error paragraph.
- Disable the submit button while pending (`useActionState` or `useFormStatus`).

### 6. Web: Home reads real campaigns

- `app/(workspace)/home/page.tsx` fetches `listCampaigns()`; pass rows to the existing `home-overview` and `survey-table` components.
- Table columns for this phase: name, created date, status, questions. The people-count columns from the mock (targeted, reached, completed) are removed until Phase 3 and Phase 5 supply real numbers; leaving zeros would be misleading.
- Empty state (shadcn `Empty`) with a single "Create campaign" action when there are no rows.
- Remove the "Demo workspace · sample data" label from `src/data/home.ts`.
- Delete `src/data/surveys.ts` sample rows; keep the `surveyContent` copy object, moved to `src/data/survey.ts` and trimmed to strings still in use.

### 7. Web: campaign detail reads a real campaign

- `app/(workspace)/survey/[id]/page.tsx` calls `getCampaign(id)`; `notFound()` on 404.
- `survey-details.tsx` shows: name, status badge, created date, goal, additional topics, conversation mode, question source, and the ordered question list.
- Replace the Responses and Report tabs with honest placeholders that say those arrive once contacts and calls exist (copy in `src/data/survey.ts`); do not render sample responses or a sample report.
- Add Edit for name, goal, additional topics, and the question list (simple textarea, one question per line) backed by `updateCampaign` and `replaceQuestions` server actions. Reorder and per-question types wait for Phase 2's editor.
- Add Delete with the shadcn `AlertDialog`, redirecting to Home.

### 8. Documentation and scripts

- Root `README.md`: describe the two apps, ports, environment variables, `bun run setup` (installs, copies env files, runs migrations, seeds), and the API routes.
- Replace `apps/api/README.md` boilerplate with the schema and route list; replace `apps/web/README.md` boilerplate with a pointer to the root README.
- Update `docs/phases/README.md` progress table when this phase ends and add the "what changed and what was learned" note at the bottom of this file.

## Files expected to change

| Path | Change |
|---|---|
| `.gitignore` | add `.next`, `*.db`, `*.db-*`, `.env.local`, `tsconfig.tsbuildinfo` |
| `scripts/init.sh` | copy `apps/api/.env.example`, run migrate and seed |
| `apps/api/src/db/schema.ts` | tables above |
| `apps/api/src/db/index.ts` | pragmas |
| `apps/api/src/db/seed.ts` | new |
| `apps/api/drizzle/*.sql`, `meta/*` | first migration |
| `apps/api/src/index.ts` | app assembly, CORS, error handler, `AppType` |
| `apps/api/src/routes/campaigns.ts`, `services/campaigns.ts`, `validation/campaigns.ts` | new |
| `apps/api/src/services/campaigns.test.ts` | new |
| `apps/api/package.json` | zod, `@hono/zod-validator`, `db:seed`, `test` |
| `apps/web/package.json` | `api` workspace dev dependency |
| `apps/web/src/lib/api.ts` | new |
| `apps/web/src/actions/campaigns.ts` | new |
| `apps/web/src/components/surveys/new-survey-form.tsx` | submit to server action |
| `apps/web/src/components/surveys/survey-details.tsx` | real data, edit, delete |
| `apps/web/src/components/home/*` | real rows, empty state |
| `apps/web/src/app/(workspace)/home/page.tsx`, `survey/[id]/page.tsx` | fetch from API |
| `apps/web/src/data/new-survey.ts`, `home.ts`, `survey.ts` | copy updates; remove sample rows |
| `README.md`, `apps/api/README.md`, `apps/web/README.md` | rewrite |

## Acceptance checks

Run all of these before calling the phase done, and record the results at the bottom of this file.

1. Fresh clone: `bun run setup && bun run dev` starts both apps with a migrated, seeded database and no manual steps.
2. In the browser: create a campaign with manual questions, land on its page, reload, see it on Home. Stop and restart the API; the campaign is still there.
3. Create with AI source and no questions succeeds as a draft with zero questions; create with manual source and no questions is rejected with a visible message.
4. Edit the goal and questions on the detail page; reload shows the edits. Delete removes it from Home.
5. `curl -X POST localhost:3002/api/campaigns -d '{}'` returns 400 with issues; `curl localhost:3002/api/campaigns/nope` returns 404.
6. `bun test` in `apps/api` passes; `bun run lint`, `bun run typecheck`, and `bun run build` pass at the root.
7. No screen shows sample data or a "preview only" notice.

## Out of scope for this phase

- AI question drafting (Phase 2), contacts and Excel (Phase 3), calls (Phases 4–5), results and reports (Phases 6–7), Discord (Phase 8), external apps (Phase 9).
- Multi-user accounts. The demo login stays; campaigns are not yet scoped to a user. Add an `owner_id` column when real accounts arrive.
- Rating and choice question editing. The column exists; the editor is Phase 2.

## Notes for whoever picks this up

- Another agent is also working in this repository. Before starting, re-read the file list and this document; if the API or schema already exists, adapt these tasks rather than redoing them.
- Read `node_modules/next/dist/docs/` for the Next.js 16 conventions before touching routes or server actions, as `apps/web/AGENTS.md` asks.
- Keep the copy in `src/data`; the checklist in `AGENTS.md` about fonts, shadcn components, and restraint applies to every new screen.

## Completion note

**What changed.** All eight tasks were done as written, with these adjustments:

- The web app reads API types through Hono RPC (`hc<AppType>`), as planned. Because that type graph reaches the API's `bun:sqlite` client, the web app carries a four-line ambient declaration in `src/types/bun-sqlite.d.ts` instead of adding Bun's globals to a Next.js app.
- The question count on the list route uses a left join and `count()`; a correlated subquery rendered with unqualified column names in Drizzle and always returned 0.
- The other agent added a report mockup (`components/surveys/survey-report.tsx`, `data/survey-report.ts`, `lib/survey-report.ts`) during this phase. Those files still compile because `data/surveys.ts` keeps the `Survey` type and `surveyContent` copy, but the sample rows are gone and the Report tab shows a placeholder until Phase 7 produces real reports. Phase 7 should either adapt that HTML export to the real report model or remove it.
- The web dev server for this project already runs on port 4000 (a different project holds 3000). `.claude/launch.json` lets the web app take an assigned port.

**Checks run.**

| Check | Result |
|---|---|
| `bun run lint`, `bun run typecheck`, `bun run build` | Pass |
| `bun test` in `apps/api` (6 service tests, in-memory database) | Pass |
| `curl` POST `{}` → 400 with issues; GET unknown id → 404; health → ok | Pass |
| Migrate and seed on the real database; second seed run inserts nothing | Pass |
| `scripts/check-demo-auth.py` against the running web app | Pass |
| HTTP session: Home lists the three seeded campaigns with links, no sample or preview text; detail shows goal, all questions, Draft badge, Edit and Delete; unknown id returns 404; create page has no preview notice | Pass |
| Browser-driven create, edit, and delete (server actions) | Not run: the browser session needs the organizer to log in; the actions are covered by typecheck, build, and the API tests only |

**What the next phase should know.** Server actions live in `src/actions/campaigns.ts` and revalidate `/home` and `/survey/[id]`. New copy goes in `src/data/campaign.ts`. Question `type` and `options` columns exist but the editor only handles text; Phase 2 builds the typed editor and should extend `PUT /api/campaigns/:id/questions` to accept type, options, and required.
