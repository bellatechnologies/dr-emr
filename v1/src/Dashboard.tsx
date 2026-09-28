import { useState } from 'react'
import { AlertTriangle, ChevronDown, HeartPulse, Search, UserPlus, X } from 'lucide-react'
import { age, createPatient, formatDob, getPatient, logout, type Patient, type User } from './api'

const TABS = ['Home', 'OP', 'Lab', 'IP', 'D/S', 'Pharmacy', 'Growth', 'Billing', 'Radiology']

export default function Dashboard({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [tab, setTab] = useState('Home')
  const [menu, setMenu] = useState(false)
  const [patient, setPatient] = useState<Patient | null>(null)

  return (
    <div className="min-h-full bg-slate-100">
      <header className="flex items-center justify-between bg-blue-800 px-4 py-3 text-white">
        <div className="flex items-center gap-2">
          <HeartPulse className="h-6 w-6" />
          <span className="text-sm font-semibold">HMS — Hospital Management System</span>
        </div>
        <div className="relative">
          <button
            onClick={() => setMenu(!menu)}
            className="flex items-center gap-1 rounded px-2 py-1 text-sm hover:bg-blue-700"
          >
            {user.name} <span className="text-blue-200">({user.role})</span>
            <ChevronDown className="h-4 w-4" />
          </button>
          {menu && (
            <div className="absolute right-0 z-10 mt-1 w-36 overflow-hidden rounded-md bg-white text-sm text-slate-700 shadow-lg">
              <button className="block w-full px-4 py-2 text-left hover:bg-slate-100">Profile</button>
              <button
                onClick={() => logout().then(onLogout)}
                className="block w-full px-4 py-2 text-left text-red-600 hover:bg-slate-100"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="flex items-center border-b border-slate-200 bg-white pr-2">
        <nav className="flex flex-1 gap-1 overflow-x-auto px-2">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`shrink-0 border-b-2 px-4 py-3 text-sm font-medium ${
                tab === t
                  ? 'border-blue-700 text-blue-800'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {t}
            </button>
          ))}
        </nav>
        {patient && <PatientChip patient={patient} onClear={() => setPatient(null)} />}
      </div>

      <main className="mx-auto max-w-4xl p-4 sm:p-6">
        {tab === 'Home' ? (
          patient ? (
            <PatientCard patient={patient} onChange={() => setPatient(null)} />
          ) : (
            <PatientSearch onSelect={setPatient} />
          )
        ) : (
          <div className="rounded-xl bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
            {patient ? (
              `${tab} records for ${patient.name} (${patient.id}) — coming soon.`
            ) : (
              <>
                <p>No patient selected.</p>
                <button
                  onClick={() => setTab('Home')}
                  className="mt-4 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
                >
                  GO TO PATIENT SEARCH
                </button>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

function PatientChip({ patient, onClear }: { patient: Patient; onClear: () => void }) {
  const initials = patient.name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')

  return (
    <div className="ml-2 flex shrink-0 items-center gap-2 rounded-full border border-blue-200 bg-blue-50 py-1 pr-2 pl-1">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-700 text-[10px] font-bold text-white">
        {initials}
      </span>
      <div className="leading-tight">
        <div className="text-xs font-semibold text-slate-800">{patient.name}</div>
        <div className="text-[10px] text-slate-500">
          {patient.id} · {patient.gender[0]} · {age(patient.dob)}y
        </div>
      </div>
      <button
        onClick={onClear}
        aria-label="Clear patient"
        className="text-slate-400 hover:text-slate-700"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

function PatientSearch({ onSelect }: { onSelect: (p: Patient) => void }) {
  const [query, setQuery] = useState('')
  const [notFound, setNotFound] = useState(false)
  const [adding, setAdding] = useState(false)

  async function search(e: React.FormEvent) {
    e.preventDefault()
    setAdding(false)
    try {
      const found = await getPatient(query)
      setNotFound(!found)
      if (found) onSelect(found)
    } catch {
      setNotFound(false) // session expired mid-search — App swaps back to Login momentarily
    }
  }

  function register() {
    setNotFound(false)
    setAdding(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-sm sm:flex-row sm:items-center">
        <form onSubmit={search} className="flex flex-1 gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-slate-300 px-3 focus-within:border-blue-600">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              required
              placeholder="Enter Patient ID (e.g. P-10234)"
              className="w-full py-2.5 text-sm outline-none"
            />
          </div>
          <button className="rounded-lg bg-blue-700 px-5 text-sm font-semibold text-white hover:bg-blue-800">
            SEARCH
          </button>
        </form>
        <button
          onClick={register}
          className="flex items-center justify-center gap-2 rounded-lg border border-blue-700 px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-50"
        >
          <UserPlus className="h-4 w-4" /> NEW PATIENT
        </button>
      </div>

      {notFound && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-6 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-amber-500" />
          <h3 className="mt-2 font-semibold text-amber-900">No Patient ID Found</h3>
          <p className="mt-1 text-sm text-amber-800">
            The entered Patient ID does not exist. Please verify and try again.
          </p>
          <button
            onClick={register}
            className="mt-4 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
          >
            REGISTER NEW PATIENT
          </button>
        </div>
      )}

      {adding && (
        <RegisterForm onCancel={() => setAdding(false)} onCreated={onSelect} />
      )}
    </div>
  )
}

const FIELDS = [
  ['name', 'Full Name', 'text'],
  ['dob', 'Date of Birth', 'date'],
  ['gender', 'Gender', 'text'],
  ['phone', 'Phone / Mobile', 'tel'],
  ['email', 'Email', 'email'],
  ['address', 'Address', 'text'],
] as const

const INPUT =
  'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-600'

function RegisterForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void
  onCreated: (p: Patient) => void
}) {
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = Object.fromEntries(new FormData(e.currentTarget)) as Omit<Patient, 'id'>
    try {
      onCreated(await createPatient(data))
    } catch {
      // session expired mid-registration — App swaps back to Login momentarily
    }
  }

  return (
    <form onSubmit={submit} className="rounded-xl bg-white p-6 shadow-sm">
      <h3 className="font-semibold text-slate-800">Register New Patient</h3>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {FIELDS.map(([name, label, type]) => (
          <label key={name} className="text-sm">
            <span className="text-slate-600">{label}</span>
            {name === 'gender' ? (
              <select name={name} required className={INPUT}>
                <option value="">Select…</option>
                {['Male', 'Female', 'Other'].map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
            ) : (
              <input name={name} type={type} required className={INPUT} />
            )}
          </label>
        ))}
      </div>
      <div className="mt-6 flex gap-3">
        <button className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800">
          SAVE PATIENT
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
        >
          CANCEL
        </button>
      </div>
    </form>
  )
}

function PatientCard({ patient, onChange }: { patient: Patient; onChange: () => void }) {
  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">{patient.name}</h3>
          <span className="text-sm text-blue-700">
            {patient.id} · {patient.gender} · {age(patient.dob)}y
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
            Active
          </span>
          <button
            onClick={onChange}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            CHANGE PATIENT
          </button>
        </div>
      </div>
      <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
        {[
          ['Date of Birth', formatDob(patient.dob)],
          ['Gender', patient.gender],
          ['Phone', patient.phone],
          ['Email', patient.email],
          ['Address', patient.address],
        ].map(([k, v]) => (
          <div key={k}>
            <dt className="text-slate-500">{k}</dt>
            <dd className="text-slate-800">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
