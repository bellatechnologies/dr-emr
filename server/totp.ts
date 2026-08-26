import { createHmac, randomBytes } from 'node:crypto'

// RFC 6238 TOTP. All server-side — the browser never sees this math, only a QR/secret once
// during enrollment and a yes/no on every sign-in after that.

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const TIME_STEP_SECONDS = 30

function base32Encode(bytes: Buffer): string {
  let bits = 0
  let value = 0
  let out = ''
  for (const byte of bytes) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31]
  return out
}

function base32Decode(secret: string): Buffer {
  let bits = 0
  let value = 0
  const out: number[] = []
  for (const char of secret.toUpperCase().replace(/=+$/, '')) {
    value = (value << 5) | BASE32_ALPHABET.indexOf(char)
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return Buffer.from(out)
}

function hotp(secret: Buffer, counter: number): string {
  const buf = Buffer.alloc(8)
  buf.writeUInt32BE(counter, 4) // top 4 bytes stay 0; counter fits comfortably in 32 bits
  const hmac = createHmac('sha1', secret).update(buf).digest()
  const offset = hmac[hmac.length - 1] & 0xf
  const truncated =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  return String(truncated % 1_000_000).padStart(6, '0')
}

export const generateSecret = () => base32Encode(randomBytes(20))

export const otpauthUri = (email: string, secret: string) =>
  `otpauth://totp/HMS:${encodeURIComponent(email)}?secret=${secret}&issuer=HMS&digits=6&period=${TIME_STEP_SECONDS}`

// Closes the replay window TOTP alone leaves open: a code is good for up to ~90s (the ±1-step
// tolerance below), so without this, a shoulder-surfed or sniffed code is reusable within that
// window. Keyed by account, so one user's history never blocks another's.
const lastAcceptedCounter = new Map<string, number>()

export function verifyTotp(accountKey: string, secretBase32: string, code: string): boolean {
  const secret = base32Decode(secretBase32)
  const now = Math.floor(Date.now() / 1000 / TIME_STEP_SECONDS)
  const last = lastAcceptedCounter.get(accountKey) ?? -1
  const trimmed = code.trim()
  for (const counter of [now - 1, now, now + 1]) {
    if (counter > last && hotp(secret, counter) === trimmed) {
      lastAcceptedCounter.set(accountKey, counter)
      return true
    }
  }
  return false
}
