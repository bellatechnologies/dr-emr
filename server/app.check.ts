// node --experimental-strip-types server/app.check.ts
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { createApp } from './index.ts'

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

const server = createApp().listen(0)
const { port } = server.address() as { port: number }
const base = `http://localhost:${port}`

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

// 1. Patient data is gated by session, not by whether the client bothers to ask nicely.
assert.equal((await get('/api/patients/P-10234')).status, 401)

assert.equal((await post('/api/auth/begin', { login: 'nobody' })).status, 404)

// 2. Enrollment hands out a secret exactly once; asking again after enrollment reveals nothing.
const begin = await post('/api/auth/begin', { login: 'dr.sharma' })
assert.equal(begin.body.enrolling, true)
const secret = begin.body.secret
const again = await post('/api/auth/begin', { login: 'dr.sharma' })
assert.deepEqual(again.body, { enrolling: false })

const counter = Math.floor(Date.now() / 1000 / 30)

const wrong = await post('/api/auth/verify', { login: 'dr.sharma', code: '000000' })
assert.equal(wrong.status, 401)
assert.equal(wrong.setCookie.length, 0) // no session for a failed attempt

// 3. A correct code issues an httpOnly/SameSite session cookie, and the secret never comes back.
const signedIn = await post('/api/auth/verify', { login: 'dr.sharma', code: hotp(secret, counter) })
assert.equal(signedIn.status, 200)
assert.equal(signedIn.body.user.role, 'Doctor')
assert.equal(signedIn.body.user.totpSecret, undefined)
assert.match(signedIn.setCookie[0], /HttpOnly/i)
assert.match(signedIn.setCookie[0], /SameSite=Lax/i)
const cookie = signedIn.setCookie[0].split(';')[0]

// Replay of the exact same code is rejected even though it's still inside its time window.
assert.equal((await post('/api/auth/verify', { login: 'dr.sharma', code: hotp(secret, counter) })).status, 401)

// The cookie is what gates data now — not client-side React state.
assert.equal((await get('/api/patients/P-10234', cookie)).status, 200)
assert.equal((await get('/api/patients/P-10234')).status, 401) // same request, no cookie
assert.equal((await get('/api/patients/P-99999', cookie)).status, 404)

// Lockout after repeated failures on one account.
for (let i = 0; i < 5; i++) await post('/api/auth/verify', { login: 'nurse.priya', code: '000000' })
assert.equal((await post('/api/auth/verify', { login: 'nurse.priya', code: '000000' })).status, 429)

// Logout invalidates the session server-side, immediately — not just client-side.
await post('/api/auth/logout', {}, cookie)
assert.equal((await get('/api/patients/P-10234', cookie)).status, 401)

server.close()
console.log('ok')
