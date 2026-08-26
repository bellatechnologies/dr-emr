// node --experimental-strip-types src/api.check.ts
// Auth and patient-data logic now live in server/ (see server/app.check.ts) — this only covers
// the display formatting that's still genuinely client-side.
import assert from 'node:assert/strict'
import { age, formatDob } from './api.ts'

assert.equal(formatDob('1985-03-15'), '15/03/1985')

// Age is relative to today, so build the fixtures from today.
const t = new Date()
const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
assert.equal(age(iso(t.getFullYear() - 30, t.getMonth() + 1, t.getDate())), 30) // birthday today
assert.equal(age(iso(t.getFullYear() - 30, 1, 1)), 30) // birthday passed
const dec31 = t.getMonth() === 11 && t.getDate() === 31
assert.equal(age(iso(t.getFullYear() - 30, 12, 31)), dec31 ? 30 : 29) // birthday still to come

console.log('ok')
