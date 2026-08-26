# HMS — Hospital Management System

Clinic EMR. Vite + React 19 + TypeScript + Tailwind v4 front end, Express backend, Supabase (Postgres) storage.

```bash
npm install
```

**One-time Supabase setup:**
1. Create a project at [supabase.com](https://supabase.com) (or use an existing one).
2. Project → SQL Editor → paste in [`server/schema.sql`](server/schema.sql) → Run. Creates the
   `staff`/`patients` tables, seeds sample patients, and turns on RLS with no policies — only the
   service-role key below can touch these tables. **No staff are seeded** — see step 5.
3. Project → Settings → API → copy the **Project URL** and the **`service_role` secret** (not `anon`).
4. `cp server/.env.example server/.env` and fill in those two values. `server/.env` is gitignored.
5. Add at least one real staff row — the app has no sign-up screen, only TOTP enrollment for an
   *existing* staff record, so an empty `staff` table means nobody can sign in yet. In the SQL
   editor:
   ```sql
   insert into staff (username, email, name, role)
   values ('jane.doe', 'jane@yourclinic.com', 'Jane Doe', 'Doctor');
   ```
   Repeat per person. `username` and `email` must each be unique.

```bash
npm run server   # terminal 1 — API on :3001
npm run dev      # terminal 2 — frontend on :5173, proxies /api to :3001
```

## Screens

- **Login** (`src/Login.tsx`) — email/username, then a TOTP code from an authenticator app
  (Google Authenticator, Authy, etc.). First sign-in for an account shows a QR to scan; every
  sign-in after that goes straight to the code.
- **Dashboard** (`src/Dashboard.tsx`) — static top bar and 9 nav tabs; Home holds patient search, the
  found/not-found states, and the new-patient registration form. The other tabs are placeholders.

## Staff and patients

No staff are seeded — see step 5 above to add the people who should be able to sign in, by
username or email. No password — enroll an authenticator app on first sign-in.
Sample patient IDs (seeded, duplicates fine to add more): `P-10234`, `P-10235`, `P-10236`.

## Backend (`server/`)

A real Express API. It owns everything the browser must not, and now persists everything it owns:

- **Staff and patient records** (`server/store.ts`) — live in Supabase/Postgres, not in memory.
  Restarting `npm run server` no longer loses anyone's enrollment or any registered patient.
- **TOTP secrets** (`server/totp.ts`) — generated and verified server-side (RFC 6238, HMAC-SHA1),
  stored in the `staff.totp_secret` column, which RLS makes unreadable to anything but the
  service-role key. A secret is shown to the client exactly once, during enrollment; every sign-in
  after that is a yes/no over the network.
- **Sessions** — still in-memory (`server/index.ts`), on purpose: they're short-lived (12h) by
  design either way, so persisting them to the database would add a table and a cleanup job for a
  problem restarting the server already solves by just signing everyone out. On a correct code, the
  server sets an `httpOnly`, `SameSite=Lax` session cookie; refreshing the page keeps you signed in
  because the cookie is real, and a raw `curl`/devtools request with no cookie gets a 401 from every
  patient endpoint.
- **Replay + lockout** — a code can't be reused once accepted, even within its ~90s validity window,
  and five wrong codes in a row lock that account for 60 seconds. Both still in-memory per server
  process — see Known gaps.

```bash
npm run typecheck:server
npm run server:check
```

`server:check` boots the real Express app on an ephemeral port and hits it with `fetch` against
your actual Supabase project — no mocks. It creates a throwaway staff account and patient, runs
through enrollment, wrong/right codes, replay, session gating, lockout, and logout, then deletes
its fixtures in a `finally` block. It never touches the staff accounts you add in step 5, since
those belong to real people who might already be enrolled on them.

```bash
node --experimental-strip-types src/api.check.ts
```

Covers what's still genuinely client-side: date formatting and age calculation.

## Known gaps

- Sessions and the lockout counter reset on server restart (by design — see above). Staff and
  patient data do not.
- No account recovery (lost phone) — losing the authenticator app currently means losing the
  account; would need an admin-triggered `totp_secret` reset.
- Frontend and backend must be same-origin (via the dev proxy, or co-located in production) — a
  cross-origin deployment needs explicit CORS + `SameSite=None` handling, not configured here.
- `patients.id` uses a Postgres sequence started at 10237 (matching the three seeded IDs) — fine
  for one environment, but re-running `schema.sql` against a project that already has more/different
  patients would need the sequence's start value adjusted.
