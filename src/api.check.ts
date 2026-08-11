// node --experimental-strip-types src/api.check.ts
import assert from 'node:assert/strict'
import { createAccount, createPatient, getPatient, signIn } from './api.ts'

assert.equal(signIn('sharma@hospital.com', 'hms1234').role, 'Doctor')
assert.equal((signIn('dr.sharma', 'hms1234') as Record<string, unknown>).password, undefined)
assert.throws(() => signIn('dr.sharma', 'wrong'), /Invalid credentials/)
assert.throws(() => signIn('nobody', 'hms1234'), /Invalid credentials/)

const acct = { name: 'New Doc', username: 'dr.new', email: 'New@Hospital.com', role: 'Doctor' }
assert.throws(() => createAccount({ ...acct, password: 'short' }), /at least 8/)
assert.equal(createAccount({ ...acct, password: 'longenough' }).email, 'new@hospital.com')
assert.equal(signIn('new@hospital.com', 'longenough').name, 'New Doc')
assert.throws(() => createAccount({ ...acct, password: 'longenough' }), /already exists/)

assert.equal(getPatient('p-10234')?.name, 'John Doe')
assert.equal(getPatient('P-99999'), undefined)

const created = createPatient({
  name: 'Test',
  dob: '01/01/2000',
  gender: 'Other',
  phone: '+91 00000 00000',
  email: 't@e.com',
  address: 'X',
})
assert.equal(created.id, 'P-10237')
assert.equal(getPatient('P-10237')?.name, 'Test')

console.log('ok')
