import express, { type Request, type Response, type NextFunction } from 'express'
import { createHash, randomBytes } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { toDataURL } from 'qrcode'
import {
  clearLoginAttempts,
  createPatient,
  createSession,
  createStaff,
  deleteSession,
  findStaff,
  getLoginAttempt,
  getPatient,
  getSession,
  isUniqueViolation,
  recordFailedAttempt,
  setTotpLastCounter,
  toUser,
  type LoginAttempt,
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

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

async function rejectCode(res: Response, key: string, lock: LoginAttempt | undefined) {
  const count = (lock?.count ?? 0) + 1
  const locked = count >= LOCKOUT_AFTER
  await recordFailedAttempt(key, locked ? 0 : count, locked ? new Date(Date.now() + LOCKOUT_MS) : null)
  res.status(401).json({ error: 'Invalid code. Please try again.' })
}

// Staff, patients, sessions, and login-lockout state all live in Supabase (server/store.ts) — this
// process holds none of it in memory. That's deliberate: on Vercel, requests from the same user can
// land on different, independently-memoried function instances, so anything kept in a local Map
// would randomly appear to "forget" sessions or reset lockout counters. Supabase is the only shared
// state, so any number of instances agree on it.
export function createApp() {
  async function currentUser(req: Request) {
    const token = parseCookies(req.headers.cookie)[SESSION_COOKIE]
    if (!token) return undefined
    const session = await getSession(hashToken(token))
    if (!session || new Date(session.expires_at).getTime() < Date.now()) return undefined
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

    const lock = await getLoginAttempt(key)
    if (lock?.locked_until && new Date(lock.locked_until).getTime() > Date.now()) {
      return res.status(429).json({ error: 'Too many attempts. Try again in a minute.' })
    }

    if (!account?.totp_secret) return rejectCode(res, key, lock)

    const verification = verifyTotp(account.totp_secret, code, account.totp_last_counter)
    if (!verification.ok) return rejectCode(res, key, lock)

    await clearLoginAttempts(key)
    await setTotpLastCounter(account.username, verification.counter)

    const token = randomBytes(32).toString('hex')
    await createSession(hashToken(token), account.email, new Date(Date.now() + SESSION_TTL_MS))
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_TTL_MS,
    })
    res.json({ user: toUser(account) })
  })

  app.post('/api/auth/logout', async (req, res) => {
    const token = parseCookies(req.headers.cookie)[SESSION_COOKIE]
    if (token) await deleteSession(hashToken(token))
    res.clearCookie(SESSION_COOKIE, { path: '/' })
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
