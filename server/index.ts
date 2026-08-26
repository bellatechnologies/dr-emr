import express, { type Request, type Response, type NextFunction } from 'express'
import { randomBytes } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { toDataURL } from 'qrcode'
import { seedPatients, seedUsers, type Account, type Patient } from './store.ts'
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

export function createApp() {
  const users = seedUsers()
  const patients = seedPatients()
  const sessions = new Map<string, { email: string; expires: number }>()
  const failedAttempts = new Map<string, { count: number; lockedUntil: number }>()

  const findAccount = (login: string) =>
    users.find((u) => u.username === login.trim() || u.email === login.trim().toLowerCase())

  function currentUser(req: Request): Account | undefined {
    const id = parseCookies(req.headers.cookie)[SESSION_COOKIE]
    const session = id ? sessions.get(id) : undefined
    if (!session || session.expires < Date.now()) return undefined
    return users.find((u) => u.email === session.email)
  }

  function requireSession(req: Request, res: Response, next: NextFunction) {
    if (!currentUser(req)) return void res.status(401).json({ error: 'Not signed in.' })
    next()
  }

  const app = express()
  app.use(express.json())

  app.post('/api/auth/begin', async (req, res) => {
    const account = findAccount(String(req.body?.login ?? ''))
    if (!account) {
      return res.status(404).json({ error: 'No staff account found for that username or email.' })
    }
    if (account.totpSecret) return res.json({ enrolling: false })

    const secret = generateSecret()
    account.totpSecret = secret
    const qr = await toDataURL(otpauthUri(account.email, secret))
    res.json({ enrolling: true, secret, qr })
  })

  app.post('/api/auth/verify', (req, res) => {
    const login = String(req.body?.login ?? '')
    const code = String(req.body?.code ?? '')
    const key = login.trim().toLowerCase()
    const account = findAccount(login)

    const lock = failedAttempts.get(key)
    if (lock?.lockedUntil && lock.lockedUntil > Date.now()) {
      return res.status(429).json({ error: 'Too many attempts. Try again in a minute.' })
    }

    if (!account?.totpSecret || !verifyTotp(account.email, account.totpSecret, code)) {
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
    const { totpSecret: _, ...user } = account
    res.json({ user })
  })

  app.post('/api/auth/logout', (req, res) => {
    const id = parseCookies(req.headers.cookie)[SESSION_COOKIE]
    if (id) sessions.delete(id)
    res.clearCookie(SESSION_COOKIE)
    res.json({ ok: true })
  })

  app.get('/api/auth/me', (req, res) => {
    const account = currentUser(req)
    if (!account) return res.status(401).json({ error: 'Not signed in.' })
    const { totpSecret: _, ...user } = account
    res.json({ user })
  })

  app.get('/api/patients/:id', requireSession, (req, res) => {
    const id = String(req.params.id).trim().toLowerCase()
    const patient = patients.find((p) => p.id.toLowerCase() === id)
    if (!patient) return res.status(404).json({ error: 'Patient not found.' })
    res.json({ patient })
  })

  app.post('/api/patients', requireSession, (req, res) => {
    const p = req.body as Omit<Patient, 'id'>
    const next: Patient = { ...p, id: `P-${10234 + patients.length}` }
    patients.push(next)
    res.status(201).json({ patient: next })
  })

  return app
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT) || 3001
  createApp().listen(port, () => console.log(`API listening on http://localhost:${port}`))
}
