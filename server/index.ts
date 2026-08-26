import express, { type Request, type Response, type NextFunction } from 'express'
import { randomBytes } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { toDataURL } from 'qrcode'
import {
  createPatient,
  createStaff,
  findStaff,
  getPatient,
  isUniqueViolation,
  toUser,
  type Patient,
} from './store.ts'
import { generateSecret, otpauthUri, verifyTotp } from './totp.ts'

const SESSION_COOKIE = 'hms_session'
const SESSION_TTL_MS = 12 * 60 * 60 * 1000
const LOCKOUT_AFTER = 5
const LOCKOUT_MS = 60_000

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  for (const part of (header ?? '').split(';')) {
    const i = part.indexOf('=')
    if (i > -1) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim())
  }
  return out
}

// Staff and patient records live in Supabase (server/store.ts) — this file only keeps sessions
// and the lockout counter in memory, since those are short-lived by design either way.
export function createApp() {
  const sessions = new Map<string, { email: string; expires: number }>()
  const failedAttempts = new Map<string, { count: number; lockedUntil: number }>()

  async function currentUser(req: Request) {
    const id = parseCookies(req.headers.cookie)[SESSION_COOKIE]
    const session = id ? sessions.get(id) : undefined
    if (!session || session.expires < Date.now()) return undefined
    const account = await findStaff(session.email)
    return account ? toUser(account) : undefined
  }

  async function requireSession(req: Request, res: Response, next: NextFunction) {
    if (!(await currentUser(req))) return void res.status(401).json({ error: 'Not signed in.' })
    next()
  }

  const app = express()
  app.use(express.json())

  // Login only ever looks up an already-set-up account. It never creates one and never touches
  // totp_secret — that's exclusively /api/auth/signup's job.
  app.post('/api/auth/begin', async (req, res) => {
    const account = await findStaff(String(req.body?.login ?? ''))
    if (!account) {
      return res.status(404).json({ error: 'No account found for that username or email. Sign up first.' })
    }
    if (!account.totp_secret) {
      return res.status(409).json({ error: 'This account has not finished setup. Please sign up.' })
    }
    res.json({ ok: true })
  })

  app.post('/api/auth/signup', async (req, res) => {
    const username = String(req.body?.username ?? '').trim()
    const email = String(req.body?.email ?? '').trim().toLowerCase()
    const name = String(req.body?.name ?? '').trim()
    const role = String(req.body?.role ?? '').trim()
    if (!username || !email || !name || !role) {
      return res.status(400).json({ error: 'Name, username, email, and role are all required.' })
    }

    const secret = generateSecret()
    try {
      await createStaff({ username, email, name, role, totp_secret: secret })
    } catch (err) {
      if (isUniqueViolation(err)) {
        return res.status(409).json({ error: 'An account with that username or email already exists.' })
      }
      throw err
    }

    const qr = await toDataURL(otpauthUri(email, secret))
    res.status(201).json({ secret, qr })
  })

  app.post('/api/auth/verify', async (req, res) => {
    const login = String(req.body?.login ?? '')
    const code = String(req.body?.code ?? '')
    const key = login.trim().toLowerCase()
    const account = await findStaff(login)

    const lock = failedAttempts.get(key)
    if (lock?.lockedUntil && lock.lockedUntil > Date.now()) {
      return res.status(429).json({ error: 'Too many attempts. Try again in a minute.' })
    }

    if (!account?.totp_secret || !verifyTotp(account.email, account.totp_secret, code)) {
      const count = (lock?.count ?? 0) + 1
      failedAttempts.set(
        key,
        count >= LOCKOUT_AFTER ? { count: 0, lockedUntil: Date.now() + LOCKOUT_MS } : { count, lockedUntil: 0 },
      )
      return res.status(401).json({ error: 'Invalid code. Please try again.' })
    }
    failedAttempts.delete(key)

    const sessionId = randomBytes(32).toString('hex')
    sessions.set(sessionId, { email: account.email, expires: Date.now() + SESSION_TTL_MS })
    res.cookie(SESSION_COOKIE, sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_TTL_MS,
    })
    res.json({ user: toUser(account) })
  })

  app.post('/api/auth/logout', (req, res) => {
    const id = parseCookies(req.headers.cookie)[SESSION_COOKIE]
    if (id) sessions.delete(id)
    res.clearCookie(SESSION_COOKIE)
    res.json({ ok: true })
  })

  app.get('/api/auth/me', async (req, res) => {
    const user = await currentUser(req)
    if (!user) return res.status(401).json({ error: 'Not signed in.' })
    res.json({ user })
  })

  app.get('/api/patients/:id', requireSession, async (req, res) => {
    const patient = await getPatient(String(req.params.id))
    if (!patient) return res.status(404).json({ error: 'Patient not found.' })
    res.json({ patient })
  })

  app.post('/api/patients', requireSession, async (req, res) => {
    const patient = await createPatient(req.body as Omit<Patient, 'id'>)
    res.status(201).json({ patient })
  })

  return app
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT) || 3001
  createApp().listen(port, () => console.log(`API listening on http://localhost:${port}`))
}
