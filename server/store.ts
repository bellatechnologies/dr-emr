import { supabase } from './supabase.ts'

export type User = { username: string; email: string; name: string; role: string }
export type Patient = {
  id: string
  name: string
  dob: string
  gender: string
  phone: string
  email: string
  address: string
}

export type StaffRow = User & { totp_secret: string | null; totp_last_counter: number | null }

export const toUser = ({ totp_secret: _s, totp_last_counter: _c, ...user }: StaffRow): User => user

const STAFF_COLUMNS = 'username, email, name, role, totp_secret, totp_last_counter'

/** Two lookups, not one .or() filter — avoids feeding user input into a PostgREST filter string. */
export async function findStaff(login: string): Promise<StaffRow | undefined> {
  const value = login.trim()

  const byUsername = await supabase.from('staff').select(STAFF_COLUMNS).eq('username', value).maybeSingle()
  if (byUsername.error) throw byUsername.error
  if (byUsername.data) return byUsername.data as StaffRow

  const byEmail = await supabase.from('staff').select(STAFF_COLUMNS).eq('email', value.toLowerCase()).maybeSingle()
  if (byEmail.error) throw byEmail.error
  return (byEmail.data as StaffRow) ?? undefined
}

export async function setTotpLastCounter(username: string, counter: number): Promise<void> {
  const { error } = await supabase.from('staff').update({ totp_last_counter: counter }).eq('username', username)
  if (error) throw error
}

export type NewStaff = { username: string; email: string; name: string; role: string; totp_secret: string }

/** The secret is included in the same insert as the account — no window where the row exists
 *  with no secret, which would otherwise be an inconsistent half-created state. */
export async function createStaff(staff: NewStaff): Promise<void> {
  const { error } = await supabase.from('staff').insert(staff)
  if (error) throw error
}

export const isUniqueViolation = (err: unknown) => (err as { code?: string } | null)?.code === '23505'

export async function getPatient(id: string): Promise<Patient | undefined> {
  const { data, error } = await supabase.from('patients').select('*').ilike('id', id.trim()).maybeSingle()
  if (error) throw error
  return data ?? undefined
}

export async function createPatient(p: Omit<Patient, 'id'>): Promise<Patient> {
  const { data, error } = await supabase.from('patients').insert(p).select().single()
  if (error) throw error
  return data
}

// --- Sessions --- stored by sha256(token), not the raw cookie value (server/index.ts hashes it).

export async function createSession(tokenHash: string, email: string, expiresAt: Date): Promise<void> {
  const { error } = await supabase
    .from('sessions')
    .insert({ token_hash: tokenHash, email, expires_at: expiresAt.toISOString() })
  if (error) throw error
}

export async function getSession(tokenHash: string): Promise<{ email: string; expires_at: string } | undefined> {
  const { data, error } = await supabase
    .from('sessions')
    .select('email, expires_at')
    .eq('token_hash', tokenHash)
    .maybeSingle()
  if (error) throw error
  return data ?? undefined
}

export async function deleteSession(tokenHash: string): Promise<void> {
  const { error } = await supabase.from('sessions').delete().eq('token_hash', tokenHash)
  if (error) throw error
}

// --- Login lockout ---

export type LoginAttempt = { count: number; locked_until: string | null }

export async function getLoginAttempt(loginKey: string): Promise<LoginAttempt | undefined> {
  const { data, error } = await supabase
    .from('login_attempts')
    .select('count, locked_until')
    .eq('login_key', loginKey)
    .maybeSingle()
  if (error) throw error
  return data ?? undefined
}

export async function recordFailedAttempt(loginKey: string, count: number, lockedUntil: Date | null): Promise<void> {
  const { error } = await supabase
    .from('login_attempts')
    .upsert({ login_key: loginKey, count, locked_until: lockedUntil?.toISOString() ?? null })
  if (error) throw error
}

export async function clearLoginAttempts(loginKey: string): Promise<void> {
  const { error } = await supabase.from('login_attempts').delete().eq('login_key', loginKey)
  if (error) throw error
}
