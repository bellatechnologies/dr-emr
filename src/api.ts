// Mock backend. Swap these three functions for fetch() calls when the Express API exists.

export type User = { username: string; email: string; name: string; role: string }
type Account = User & { password: string }
export type Patient = {
  id: string
  name: string
  dob: string
  gender: string
  phone: string
  email: string
  address: string
}

// ponytail: passwords in plain text because this is a mock. Hash with bcrypt/argon2 server-side.
const users: Account[] = [
  { username: 'dr.sharma', email: 'sharma@hospital.com', name: 'Dr. Sharma', role: 'Doctor', password: 'hms1234' },
  { username: 'nurse.priya', email: 'priya@hospital.com', name: 'Priya', role: 'Nurse', password: 'hms1234' },
  { username: 'admin.raj', email: 'raj@hospital.com', name: 'Raj', role: 'Admin', password: 'hms1234' },
]

const patients: Patient[] = [
  {
    id: 'P-10234',
    name: 'John Doe',
    dob: '15/03/1985',
    gender: 'Male',
    phone: '+91 98765 43210',
    email: 'john.doe@email.com',
    address: '12, MG Road, Bangalore',
  },
  {
    id: 'P-10235',
    name: 'Priya Kumari',
    dob: '22/07/1990',
    gender: 'Female',
    phone: '+91 87654 32109',
    email: 'priya.k@email.com',
    address: '45, Anna Nagar, Chennai',
  },
  {
    id: 'P-10236',
    name: 'Ravi Shankar',
    dob: '01/12/1978',
    gender: 'Male',
    phone: '+91 76543 21098',
    email: 'ravi.s@email.com',
    address: '78, Jubilee Hills, Hyderabad',
  },
]

const find = (login: string) =>
  users.find((u) => u.username === login.trim() || u.email === login.trim().toLowerCase())

const publicUser = ({ password: _, ...u }: Account): User => u

export function signIn(login: string, password: string): User {
  const account = find(login)
  if (!account || account.password !== password) {
    throw new Error('Invalid credentials. Please try again.')
  }
  return publicUser(account)
}

export function createAccount(a: Account): User {
  if (find(a.username) || find(a.email)) {
    throw new Error('An account with that username or email already exists.')
  }
  if (a.password.length < 8) throw new Error('Password must be at least 8 characters.')
  const account = { ...a, username: a.username.trim(), email: a.email.trim().toLowerCase() }
  users.push(account)
  return publicUser(account)
}

export const getPatient = (id: string) =>
  patients.find((p) => p.id.toLowerCase() === id.trim().toLowerCase())

export function createPatient(p: Omit<Patient, 'id'>): Patient {
  const next = { ...p, id: `P-${10234 + patients.length}` }
  patients.push(next)
  return next
}
