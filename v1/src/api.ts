// Talks to the Express API in server/. No auth decision and no patient data live in the browser —
// this file only makes fetch calls and formats what the server sends back.

export type User = { username: string; email: string; name: string; role: string }
export type Patient = {
  id: string
  name: string
  /** ISO yyyy-mm-dd — what <input type="date"> produces. Format for display with formatDob(). */
  dob: string
  gender: string
  phone: string
  email: string
  address: string
}

type Enrollment = { secret: string; qr: string }

let onUnauthorized: (() => void) | null = null
/** Called whenever the server says the session is gone — wire it to clear client-side user state. */
export const setUnauthorizedHandler = (fn: () => void) => {
  onUnauthorized = fn
}

async function throwApiError(res: Response): Promise<never> {
  const body = await res.json().catch(() => ({}))
  throw new Error(body.error ?? 'Something went wrong.')
}

export async function me(): Promise<User | null> {
  const res = await fetch('/api/auth/me')
  if (!res.ok) return null
  return (await res.json()).user
}

/** Confirms an account exists and is already enrolled. Never creates anything, never mutates. */
export async function checkLogin(login: string): Promise<void> {
  const res = await fetch('/api/auth/begin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login }),
  })
  if (!res.ok) await throwApiError(res)
}

export async function signUp(input: {
  username: string
  email: string
  name: string
  role: string
}): Promise<Enrollment> {
  const res = await fetch('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) await throwApiError(res)
  return res.json()
}

export async function verifyCode(login: string, code: string): Promise<User> {
  const res = await fetch('/api/auth/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login, code }),
  })
  if (!res.ok) await throwApiError(res)
  return (await res.json()).user
}

export async function logout(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST' })
}

export async function getPatient(id: string): Promise<Patient | undefined> {
  const res = await fetch(`/api/patients/${encodeURIComponent(id)}`)
  if (res.status === 404) return undefined
  if (res.status === 401) onUnauthorized?.()
  if (!res.ok) await throwApiError(res)
  return (await res.json()).patient
}

export async function createPatient(p: Omit<Patient, 'id'>): Promise<Patient> {
  const res = await fetch('/api/patients', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(p),
  })
  if (res.status === 401) onUnauthorized?.()
  if (!res.ok) await throwApiError(res)
  return (await res.json()).patient
}

/** '1985-03-15' -> '15/03/1985'. String split, not Date, to dodge the UTC-midnight off-by-one-day. */
export const formatDob = (dob: string) => dob.split('-').reverse().join('/')

export function age(dob: string): number {
  const [y, m, d] = dob.split('-').map(Number)
  const now = new Date()
  const month = now.getMonth() + 1
  const before = month < m || (month === m && now.getDate() < d)
  return now.getFullYear() - y - (before ? 1 : 0)
}
