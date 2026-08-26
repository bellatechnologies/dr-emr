# HMS — Hospital Management System

Clinic EMR. Vite + React 19 + TypeScript + Tailwind v4 front end, Express backend, Supabase (Postgres) storage.

```bash
npm install
```

**One-time Supabase setup:**
1. Create a project at [supabase.com](https://supabase.com) (or use an existing one).
2. Project → SQL Editor → paste in [`server/schema.sql`](server/schema.sql) → Run. Creates the
   `staff`/`patients`/`sessions`/`login_attempts` tables and turns on RLS with no policies — only
   the service-role key below can touch them. Idempotent — safe to re-run whenever the file changes.
3. Project → Settings → API → copy the **Project URL** and the **`service_role` secret** (not `anon`).
4. `cp server/.env.example server/.env` and fill in those two values. `server/.env` is gitignored.

No staff are seeded — use the app's **Sign up** screen once it's running (below) to create the
first account and enroll an authenticator app.

```bash
npm run server   # terminal 1 — API on :3001
npm run dev      # terminal 2 — frontend on :5173, proxies /api to :3001
```

## Screens

- **Login** (`src/Login.tsx`) — a Sign In / Sign Up toggle:
  - **Sign in**: email/username, then a 6-digit TOTP code. Pure lookup — never creates an account,
    never touches a secret.
  - **Sign up**: name, username, email, role → creates the account and immediately shows a QR to
    scan (Google Authenticator, Authy, etc.), then a code field to confirm it and sign in.
- **Dashboard** (`src/Dashboard.tsx`) — static top bar and 9 nav tabs; Home holds patient search, the
  found/not-found states, and the new-patient registration form. The other tabs are placeholders.

Sample patient IDs (seeded, duplicates fine to add more): `P-10234`, `P-10235`, `P-10236`.

## Backend (`server/`)

A real Express API. It owns everything the browser must not, and holds **none of it in server
memory** — staff, patients, sessions, and login-lockout state all live in Supabase:

- **Staff and patient records** (`server/store.ts`) — Postgres via Supabase.
- **TOTP secrets** (`server/totp.ts`, pure/stateless) — generated and verified server-side
  (RFC 6238, HMAC-SHA1), stored in `staff.totp_secret`, unreadable to anything but the service-role
  key thanks to RLS. A secret is shown to the client exactly once, at sign-up; every sign-in after
  that is a yes/no over the network.
- **Sessions** — a session cookie (`httpOnly`, `SameSite=Lax`, `Secure` in production) holds a
  random token; only its SHA-256 hash is stored, in the `sessions` table, so a copy of that table
  can't be replayed as a live session. The dashboard renders because the server found a valid
  session row, not because client-side state says so.
- **Replay + lockout** — a code can't be reused once accepted (`staff.totp_last_counter`), even
  within its ~90s validity window, and five wrong codes in a row lock that account for 60 seconds
  (`login_attempts`).

**Why none of this is in-memory:** this app is meant to run on Vercel, where each request can land
on a different serverless function instance with its own empty memory. An in-memory session Map
works great in one long-running process and breaks unpredictably the moment there's more than one
instance — a user could get randomly signed out mid-session for no reason they can see. Supabase is
the one thing every instance agrees on.

```bash
npm run typecheck:server
npm run server:check
```

`server:check` boots two independent instances of the real Express app on ephemeral ports and hits
them with `fetch` against your actual Supabase project — no mocks. It proves sign-up creates an
account and a secret exactly once, login is a pure lookup, wrong/right codes, replay rejection,
patient-data gating, lockout, logout — and specifically that a session created via one app instance
is honored by the *other* instance, which is the exact property that makes this safe on serverless.
Fixtures are thrown away afterward; it never touches real staff accounts.

```bash
node --experimental-strip-types src/api.check.ts
```

Covers what's still genuinely client-side: date formatting and age calculation.

## Deploying to Vercel

- `api/index.ts` exports the same `createApp()` Express app as a serverless function — an Express
  app is directly callable as `(req, res)`, so no adapter is needed.
- `vercel.json` rewrites every `/api/*` request to that one function; Express's own router then
  matches the full original path against the routes in `server/index.ts`.
- Frontend and API deploy from the same Vercel project to the same domain, so the browser calls
  `/api/...` same-origin automatically — no CORS setup needed.
- Vercel auto-detects the Vite framework preset (`npm run build` → `dist`); nothing extra to
  configure there.
- **Set two environment variables** in the Vercel dashboard (Project → Settings → Environment
  Variables), for both Production and Preview: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — same
  values as `server/.env`. Vercel sets `NODE_ENV=production` for you, which is what turns on
  `Secure` cookies.
- Cold starts are an accepted tradeoff of serverless, not a bug to fix here.

## Known gaps

- No account recovery (lost phone) — losing the authenticator app currently means losing the
  account; would need an admin-triggered `totp_secret` reset.
- `patients.id` uses a Postgres sequence started at 10237 (matching the three seeded IDs) — fine
  for one environment, but re-running `schema.sql` against a project that already has more/different
  patients would need the sequence's start value adjusted.
- Signup has no gate — anyone who can reach the app can create a staff account with any role,
  including "Admin". Fine for a demo; needs an invite/approval step before real use.
- `sessions`/`login_attempts` rows are never swept once expired — they're small and checked against
  `expires_at`/`locked_until` on read, so stale rows are harmless, just not cleaned up. A scheduled
  Supabase cron job deleting expired rows would be the production fix.
