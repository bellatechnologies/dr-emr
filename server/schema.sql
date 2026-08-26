-- Run in the Supabase SQL editor (Project -> SQL Editor -> New query).
-- If anything below errors, run each numbered block as its own query so the line numbers in any
-- error message line up with this file exactly. Safe to re-run in full at any time.

-- 1. Tables
create table if not exists staff (
  username text primary key,
  email text unique not null,
  name text not null,
  role text not null,
  totp_secret text,
  totp_last_counter bigint
);
alter table staff add column if not exists totp_last_counter bigint;

create sequence if not exists patient_seq start 10237;

create table if not exists patients (
  id text primary key default ('P-' || nextval('patient_seq')::text),
  name text not null,
  dob date not null,
  gender text not null,
  phone text not null,
  email text not null,
  address text not null
);

-- Sessions and login lockout live here too — not in server memory — so this works correctly on
-- serverless (Vercel functions), where two requests from the same user can land on two different,
-- independently-memoried instances. token_hash stores sha256(cookie value), never the raw token,
-- so a copy of this table alone can't be replayed as a live session.
create table if not exists sessions (
  token_hash text primary key,
  email text not null,
  expires_at timestamptz not null
);

create table if not exists login_attempts (
  login_key text primary key,
  count int not null default 0,
  locked_until timestamptz
);

-- 2. Sample patients only — duplicates are fine here, this is demo data.
-- No staff are seeded: staff self-register from the app's Sign Up screen, which also walks
-- them through authenticator setup. Nobody needs to be added here by hand.
insert into patients (id, name, dob, gender, phone, email, address) values
  ('P-10234', 'John Doe', '1985-03-15', 'Male', '+91 98765 43210', 'john.doe@email.com', '12, MG Road, Bangalore'),
  ('P-10235', 'Priya Kumari', '1990-07-22', 'Female', '+91 87654 32109', 'priya.k@email.com', '45, Anna Nagar, Chennai'),
  ('P-10236', 'Ravi Shankar', '1978-12-01', 'Male', '+91 76543 21098', 'ravi.s@email.com', '78, Jubilee Hills, Hyderabad')
on conflict (id) do nothing;

-- 3. RLS on, no policies: only the service_role key (used exclusively by the Express backend,
-- never sent to the browser) can read or write these tables. The anon key gets nothing.
alter table staff enable row level security;
alter table patients enable row level security;
alter table sessions enable row level security;
alter table login_attempts enable row level security;
