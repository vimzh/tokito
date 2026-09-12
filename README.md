# Next.js + Hono monorepo

## Development

```bash
bun run setup
bun run dev
```

- Next.js: http://localhost:3000
- Hono: http://localhost:3002

Run checks with `bun run lint`, `bun run typecheck`, and `bun run build`.

## Demo login

Click **Login** on the landing page and use `demo@theategmail.com` / `demo1234`.
The dialog displays these public demo credentials. Auth.js stores the one-day JWT
session in an HTTP-only cookie; `/home` requires a session. This is a shared demo
account, not a private account system.

Set a unique `AUTH_SECRET` in `apps/web/.env.local` (see `.env.example`).
Google credentials are not required for demo login.
With the frontend running, verify the flow using
`python3 scripts/check-demo-auth.py http://localhost:4000`.

## Optional Google OAuth

Copy `apps/web/.env.example` to `apps/web/.env.local`, then add a unique Auth.js secret and Google OAuth web-client credentials. Register `http://localhost:3000/api/auth/callback/google` as the local authorized redirect URI in Google Cloud.
