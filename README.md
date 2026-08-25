# Rumbl

Rumbl turns a student roster into balanced, role-aware groups. An administrator
defines the seats required in each group, shares a QR code, and shuffles the
registered students once enrollment is ready.

## Stack

- React, TypeScript, and Vite
- Express and TypeScript
- PostgreSQL with Prisma (Supabase in production)
- Cookie-based authentication

## Requirements

- Node.js 20 or newer
- A Postgres database: local Docker, or the same Supabase project you will use in production

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `server/.env.example` to `server/.env`. Set a long random `JWT_SECRET`
   and the admin seed credentials.

3. Point the app at Postgres — pick one:

   **Supabase (simplest if you already created a project)** — paste the
   transaction pooler URL into `DATABASE_URL` (port `6543`, with
   `?pgbouncer=true&connection_limit=1`) and the session/direct URL into
   `DIRECT_URL` (port `5432`).

   **Local Docker** — run `docker compose up -d` and keep the example URLs
   (`postgresql://rumbl:rumbl@localhost:5432/rumbl` for both).

4. Create the schema and seed the first admin:

   ```bash
   npm run db:migrate
   npm run db:seed
   ```

   If this database is Supabase / production, use `npm run db:deploy` instead
   of `db:migrate`.

5. Start the API and web app:

   ```bash
   npm run dev
   ```

The web app runs at `http://localhost:5173` and proxies `/api` to the API at
`http://localhost:4000`.

## Host on Vercel + Supabase

Rumbl uses Supabase as a hosted Postgres database. Auth, grouping, and cookies
stay in this app — you do not need Supabase Auth.

### 1. Create the database

1. Create a project at [supabase.com](https://supabase.com).
2. Open **Project Settings → Database**.
3. Copy two connection strings:
   - **Transaction pooler** (port `6543`) → `DATABASE_URL`. Add
     `?pgbouncer=true&connection_limit=1`.
   - **Session pooler or direct** (port `5432`) → `DIRECT_URL` (used only for
     migrations).
4. From this repo, temporarily put those URLs in `server/.env`, then apply the
   schema and seed an admin:

   ```bash
   npm run db:deploy
   npm run db:seed
   ```

   You can keep those Supabase URLs in `server/.env` for local `npm run dev`,
   or switch back to Docker URLs afterward.

### 2. Deploy on Vercel

1. Push the repo to GitHub and import it in Vercel.
2. Keep **Root Directory** as the repository root (not `client`).
3. Add environment variables (Production and Preview):

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | Supabase transaction pooler URL |
   | `DIRECT_URL` | Supabase session/direct URL |
   | `JWT_SECRET` | New secret, at least 32 characters |
   | `CLIENT_ORIGIN` | `https://your-app.vercel.app` (add a custom domain later, comma-separated) |
   | `NODE_ENV` | `production` |
   | `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Only needed if you seed from a machine with these set |
   | `GOOGLE_CLIENT_ID` | Optional, same Google OAuth client as local |
   | `SMTP_*` | Optional, for password-reset email |

4. Deploy. The Vite app is served as static files; `/api/*` is rewritten to the
   Express serverless function so the browser stays same-origin and login
   cookies work.

5. In Google Cloud Console, add `https://your-app.vercel.app` (and any custom
   domain) under **Authorized JavaScript origins**.

6. Confirm `https://your-app.vercel.app/api/health` returns `{"status":"ok"}`,
   then sign in with the seeded admin.

Later schema changes: run `npm run db:migrate` locally (or `npm run db:deploy`
against Supabase), then redeploy Vercel. Do not run `migrate dev` against
production.

## Workflow

1. Sign in as the seeded administrator.
2. Create a session with an expected student count and the roles needed in
   every group.
3. Open enrollment and share the generated link or QR code.
4. Students submit their name and select any role with available capacity.
5. Close enrollment and shuffle. Rumbl fills every required role seat first,
   then distributes remainder students evenly between groups.
6. Reshuffle when a fresh randomized result is needed.

For 40 students with one coder, one UI/UX designer, and one researcher per
group, Rumbl creates 14 groups and keeps every group at a maximum of three
students. The final group may be incomplete.

## Commands

```bash
npm run dev          # client and API
npm run build        # production builds
npm test             # all tests
npm run typecheck    # TypeScript checks
npm run db:generate  # regenerate Prisma client
npm run db:migrate   # apply a development migration
npm run db:deploy    # apply migrations (Supabase / production)
npm run db:seed      # seed/update the admin account
```

`DESIGN.md` is the visual source of truth for the interface.
