// node --env-file=server/.env --experimental-strip-types server/app.check.ts
//
// Hits real Supabase tables, so this uses a throwaway account (created and deleted here) rather
// than any real staff — those belong to people who might already be enrolled on them.
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { createApp } from './index.ts'
import { supabase } from './supabase.ts'

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

// Independent reference: what a real authenticator app does with the enrollment secret.
function base32Decode(secret: string): Buffer {
  let bits = 0
  let value = 0
  const out: number[] = []
  for (const char of secret.toUpperCase()) {
    value = (value << 5) | BASE32_ALPHABET.indexOf(char)
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return Buffer.from(out)
}

function hotp(secretBase32: string, counter: number): string {
  const buf = Buffer.alloc(8)
  buf.writeUInt32BE(counter, 4)
  const hmac = createHmac('sha1', base32Decode(secretBase32)).update(buf).digest()
  const offset = hmac[hmac.length - 1] & 0xf
  const truncated =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  return String(truncated % 1_000_000).padStart(6, '0')
}

const TEST_USERNAME = 'zz_check_user'
const TEST_EMAIL = 'zz.check@example.com'
const NOT_ENROLLED_USERNAME = 'zz_check_unenrolled' // exists, but signup never ran — no secret

async function post(path: string, body: unknown, cookie?: string) {
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  })
  return { status: res.status, body: await res.json().catch(() => ({})), setCookie: res.headers.getSetCookie() }
}

async function get(path: string, cookie?: string) {
  const res = await fetch(`${base}${path}`, { headers: cookie ? { Cookie: cookie } : {} })
  return { status: res.status, body: await res.json().catch(() => ({})) }
}

await supabase.from('staff').delete().in('username', [TEST_USERNAME, NOT_ENROLLED_USERNAME]) // killed-run leftovers
const { error: seedError } = await supabase
  .from('staff')
  .insert({ username: NOT_ENROLLED_USERNAME, email: 'zz.unenrolled@example.com', name: 'Unenrolled', role: 'Nurse' })
if (seedError) throw seedError

const server = createApp().listen(0)
const { port } = server.address() as { port: number }
const base = `http://localhost:${port}`
let createdPatientId: string | undefined

try {
  // 1. Patient data is gated by session, not by whether the client bothers to ask nicely.
  assert.equal((await get('/api/patients/P-10234')).status, 401)

  // 2. Login never creates an account and never touches a secret — it's a pure lookup.
  assert.equal((await post('/api/auth/begin', { login: 'zz_check_nobody' })).status, 404)
  assert.equal((await post('/api/auth/begin', { login: NOT_ENROLLED_USERNAME })).status, 409) // exists, no secret

  // 3. Signing up creates the account AND hands out a secret exactly once.
  const signup = await post('/api/auth/signup', {
    username: TEST_USERNAME,
    email: TEST_EMAIL,
    name: 'Check User',
    role: 'Doctor',
  })
  assert.equal(signup.status, 201)
  const secret = signup.body.secret
  assert.match(secret, /^[A-Z2-7]{32}$/)

  // Signing up again with the same username/email is a conflict, not a second QR.
  assert.equal(
    (await post('/api/auth/signup', { username: TEST_USERNAME, email: TEST_EMAIL, name: 'X', role: 'Doctor' }))
      .status,
    409,
  )

  // Login now succeeds as a lookup for the newly-signed-up account.
  assert.deepEqual((await post('/api/auth/begin', { login: TEST_USERNAME })).body, { ok: true })

  const counter = Math.floor(Date.now() / 1000 / 30)

  const wrong = await post('/api/auth/verify', { login: TEST_USERNAME, code: '000000' })
  assert.equal(wrong.status, 401)
  assert.equal(wrong.setCookie.length, 0) // no session for a failed attempt

  // 4. A correct code issues an httpOnly/SameSite session cookie, and the secret never comes back.
  const signedIn = await post('/api/auth/verify', { login: TEST_USERNAME, code: hotp(secret, counter) })
  assert.equal(signedIn.status, 200)
  assert.equal(signedIn.body.user.role, 'Doctor')
  assert.equal(signedIn.body.user.totp_secret, undefined)
  assert.equal(signedIn.body.user.totp_last_counter, undefined)
  assert.match(signedIn.setCookie[0], /HttpOnly/i)
  assert.match(signedIn.setCookie[0], /SameSite=Lax/i)
  const cookie = signedIn.setCookie[0].split(';')[0]

  // Replay of the exact same code is rejected even though it's still inside its time window.
  assert.equal((await post('/api/auth/verify', { login: TEST_USERNAME, code: hotp(secret, counter) })).status, 401)

  // 5. The property this check exists to prove: a session created on one Express instance is
  // honored by a completely separate instance with its own empty memory — exactly what happens
  // between two different Vercel function invocations. If session/lockout state still lived in
  // an in-process Map, this would 401.
  const server2 = createApp().listen(0)
  const port2 = (server2.address() as { port: number }).port
  const crossInstance = await fetch(`http://localhost:${port2}/api/patients/P-10234`, {
    headers: { Cookie: cookie },
  })
  assert.equal(crossInstance.status, 200)
  server2.close()

  // The cookie is what gates data now — not client-side React state.
  assert.equal((await get('/api/patients/P-10234', cookie)).status, 200)
  assert.equal((await get('/api/patients/P-10234')).status, 401) // same request, no cookie
  assert.equal((await get('/api/patients/P-99999', cookie)).status, 404)

  // Writes are gated too, and actually land in Supabase.
  const created = await post(
    '/api/patients',
    { name: 'Check Patient', dob: '2000-01-01', gender: 'Other', phone: '+00', email: 'p@check.com', address: 'X' },
    cookie,
  )
  assert.equal(created.status, 201)
  assert.match(created.body.patient.id, /^P-\d+$/)
  createdPatientId = created.body.patient.id
  assert.equal((await get(`/api/patients/${createdPatientId}`, cookie)).body.patient.name, 'Check Patient')

  // Lockout after repeated failures on one account.
  for (let i = 0; i < 5; i++) await post('/api/auth/verify', { login: TEST_USERNAME, code: '000000' })
  assert.equal((await post('/api/auth/verify', { login: TEST_USERNAME, code: '000000' })).status, 429)

  // Logout invalidates the session server-side, immediately — not just client-side.
  await post('/api/auth/logout', {}, cookie)
  assert.equal((await get('/api/patients/P-10234', cookie)).status, 401)

  console.log('ok')
} finally {
  server.close()
  await supabase.from('staff').delete().in('username', [TEST_USERNAME, NOT_ENROLLED_USERNAME])
  await supabase.from('sessions').delete().eq('email', TEST_EMAIL)
  await supabase.from('login_attempts').delete().eq('login_key', TEST_USERNAME.toLowerCase())
  if (createdPatientId) await supabase.from('patients').delete().eq('id', createdPatientId)
}
