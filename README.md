# HMS — Hospital Management System

Clinic EMR. Vite + React 19 + TypeScript + Tailwind v4 front end, Express backend.

```bash
npm install
npm run server   # terminal 1 — API on :3001
npm run dev      # terminal 2 — frontend on :5173, proxies /api to :3001
```

## Screens

- **Login** (`src/Login.tsx`) — email/username, then a TOTP code from an authenticator app
  (Google Authenticator, Authy, etc.). First sign-in for an account shows a QR to scan; every
  sign-in after that goes straight to the code.
- **Dashboard** (`src/Dashboard.tsx`) — static top bar and 9 nav tabs; Home holds patient search, the
  found/not-found states, and the new-patient registration form. The other tabs are placeholders.

## Demo staff

`dr.sharma`, `nurse.priya`, `admin.raj` (by username or email, e.g. `sharma@hospital.com`).
No password — enroll an authenticator app on first sign-in.
Sample patient IDs: `P-10234`, `P-10235`, `P-10236`.

## Backend (`server/`)

A real Express API — this is not a mock. It owns everything the browser must not:

- **TOTP secrets** (`server/totp.ts`) — generated and verified server-side (RFC 6238, HMAC-SHA1).
  A secret is shown to the client exactly once, during enrollment; every sign-in after that is a
  yes/no over the network.
- **Sessions** (`server/index.ts`) — on a correct code, the server sets an `httpOnly`, `SameSite=Lax`
  session cookie. The dashboard renders because the server returned data for that session, not
  because client-side state says so — refreshing the page keeps you signed in, and a raw
  `curl`/devtools request with no cookie gets a 401 from every patient endpoint.
- **Patient data** — `GET/POST /api/patients` require a valid session. Nothing patient-related ships
  to the browser until the server has decided the request is authenticated.
- **Replay + lockout** — a code can't be reused once accepted, even within its ~90s validity window,
  and five wrong codes in a row lock that account for 60 seconds.

```bash
npm run typecheck:server
node --experimental-strip-types server/app.check.ts
```

The check boots the real Express app on an ephemeral port and hits it with `fetch` — no mocks. It
proves: patient data 401s with no session, enrollment hands out a secret exactly once, a wrong code
never sets a cookie, a correct code does (and the secret never comes back in the response), replay
of the same code is rejected, and logout invalidates the session immediately.

```bash
node --experimental-strip-types src/api.check.ts
```

Covers what's still genuinely client-side: date formatting and age calculation.

## Known gaps

- In-memory storage — restarting `npm run server` wipes all enrollments and any registered patients.
- No account recovery (lost phone) — losing the authenticator app currently means losing the account.
- Frontend and backend must be same-origin (via the dev proxy, or co-located in production) — a
  cross-origin deployment needs explicit CORS + `SameSite=None` handling, not configured here.
