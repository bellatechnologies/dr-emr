# HMS — Hospital Management System

Clinic EMR front end. Vite + React 19 + TypeScript + Tailwind v4.

```bash
npm install
npm run dev
```

## Screens

- **Login** (`src/Login.tsx`) — username/email + password, with a "Create one" toggle for staff signup.
- **Dashboard** (`src/Dashboard.tsx`) — static top bar and 9 nav tabs; Home holds patient search, the
  found/not-found states, and the new-patient registration form. The other tabs are placeholders.

## Demo credentials

`dr.sharma`, `nurse.priya`, `admin.raj` — password `hms1234`.
Sample patient IDs: `P-10234`, `P-10235`, `P-10236`.

## Backend

There isn't one yet. `src/api.ts` is an in-memory mock whose function signatures are the intended API
contract — replace its bodies with `fetch()` calls and nothing else changes. Passwords are stored in
plain text there; hash them server-side before this touches real data.

```bash
node --experimental-strip-types src/api.check.ts
```

Covers auth, signup validation, patient lookup, and patient ID assignment.
