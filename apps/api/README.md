# Tokito API

Hono on Bun with SQLite (`bun:sqlite`) through Drizzle. See the root [README](../../README.md) for environment variables and the route list.

```sh
bun run dev        # http://localhost:3002 with hot reload
bun test           # service tests against an in-memory database
bun run db:migrate # apply migrations in ./drizzle
bun run db:seed    # insert three draft campaigns if absent
```

## Layout

- `src/index.ts` assembles the app, CORS, and the JSON error handler, and exports `AppType` for the web client.
- `src/routes/*` HTTP handlers with zod validation.
- `src/services/*` database logic; throws `NotFoundError` for unknown ids.
- `src/db/schema.ts` tables: `campaigns`, `questions`, `campaign_events`.

After changing the schema, run `bun run db:generate` and commit the new file in `drizzle/`.
