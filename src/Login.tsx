import { useState } from 'react'
import { KeyRound, Mail, ShieldCheck, User as UserIcon } from 'lucide-react'
import { checkLogin, signUp, verifyCode, type User } from './api'

const FIELD =
  'flex items-center gap-3 rounded-lg border border-slate-300 px-3 focus-within:border-blue-600'
const INPUT = 'w-full py-3 text-sm outline-none'
const BUTTON = 'mt-6 w-full rounded-lg bg-blue-700 py-3 text-sm font-semibold text-white hover:bg-blue-800'
const ROLES = ['Doctor', 'Nurse', 'Admin', 'Lab Technician', 'Pharmacist']

type Step =
  | { mode: 'signin'; stage: 'email' }
  | { mode: 'signin'; stage: 'code' }
  | { mode: 'signup'; stage: 'form' }
  | { mode: 'signup'; stage: 'code'; enrollment: { secret: string; qr: string } }

export default function Login({ onSignIn }: { onSignIn: (u: User) => void }) {
  const [login, setLogin] = useState('')
  const [step, setStep] = useState<Step>({ mode: 'signin', stage: 'email' })
  const [error, setError] = useState('')

  function switchMode(mode: 'signin' | 'signup') {
    setStep(mode === 'signin' ? { mode: 'signin', stage: 'email' } : { mode: 'signup', stage: 'form' })
    setError('')
  }

  async function submitEmail(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await checkLogin(login)
      setStep({ mode: 'signin', stage: 'code' })
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function submitSignup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>
    try {
      const enrollment = await signUp({ username: f.username, email: f.email, name: f.name, role: f.role })
      setLogin(f.username)
      setStep({ mode: 'signup', stage: 'code', enrollment })
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function submitCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const code = new FormData(e.currentTarget).get('code') as string
    try {
      onSignIn(await verifyCode(login, code))
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white px-8 py-10 shadow-xl sm:px-10">
        <div className="flex items-center justify-center gap-2 text-blue-800">
          <ShieldCheck className="h-8 w-8" />
          <div className="leading-tight">
            <div className="text-xl font-bold">HMS</div>
            <div className="text-[10px] tracking-wide text-slate-500">
              HOSPITAL MANAGEMENT SYSTEM
            </div>
          </div>
        </div>

        {step.mode === 'signin' && step.stage === 'email' && (
          <form onSubmit={submitEmail}>
            <p className="mt-4 text-center text-sm text-slate-500">Sign in to your account.</p>
            <label className={`${FIELD} mt-8`}>
              <Mail className="h-4 w-4 shrink-0 text-slate-400" />
              <input
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                required
                autoFocus
                autoComplete="username"
                placeholder="Username / Email"
                className={INPUT}
              />
            </label>
            <button type="submit" className={BUTTON}>
              CONTINUE
            </button>
          </form>
        )}

        {step.mode === 'signin' && step.stage === 'code' && (
          <form onSubmit={submitCode}>
            <p className="mt-4 text-center text-sm text-slate-500">
              Enter the code from your authenticator app.
            </p>
            <CodeField />
            <button type="submit" className={BUTTON}>
              SIGN IN
            </button>
          </form>
        )}

        {step.mode === 'signup' && step.stage === 'form' && (
          <form onSubmit={submitSignup}>
            <p className="mt-4 text-center text-sm text-slate-500">Create your staff account.</p>
            <div className="mt-8 space-y-4">
              <label className={FIELD}>
                <UserIcon className="h-4 w-4 shrink-0 text-slate-400" />
                <input name="name" required autoFocus placeholder="Full Name" className={INPUT} />
              </label>
              <label className={FIELD}>
                <UserIcon className="h-4 w-4 shrink-0 text-slate-400" />
                <input name="username" required placeholder="Username" className={INPUT} />
              </label>
              <label className={FIELD}>
                <Mail className="h-4 w-4 shrink-0 text-slate-400" />
                <input name="email" type="email" required placeholder="Email" className={INPUT} />
              </label>
              <label className={FIELD}>
                <select name="role" required defaultValue="" className={`${INPUT} bg-transparent`}>
                  <option value="" disabled>
                    Select role
                  </option>
                  {ROLES.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </label>
            </div>
            <button type="submit" className={BUTTON}>
              CONTINUE
            </button>
          </form>
        )}

        {step.mode === 'signup' && step.stage === 'code' && (
          <form onSubmit={submitCode}>
            <p className="mt-4 text-center text-sm text-slate-500">
              Scan this in Google Authenticator (or any authenticator app), then enter the 6-digit
              code it shows.
            </p>
            <img
              src={step.enrollment.qr}
              alt="Authenticator QR code"
              className="mx-auto mt-4 h-44 w-44"
            />
            <p className="mt-2 text-center text-xs text-slate-400">
              Can't scan? Enter this key manually:{' '}
              <span className="font-mono tracking-wider text-slate-600">{step.enrollment.secret}</span>
            </p>
            <CodeField />
            <button type="submit" className={BUTTON}>
              VERIFY & ENABLE
            </button>
          </form>
        )}

        {error && <p className="mt-4 text-center text-xs text-red-600">{error}</p>}

        <p className="mt-6 text-center text-sm text-slate-500">
          {step.mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button
            type="button"
            onClick={() => switchMode(step.mode === 'signin' ? 'signup' : 'signin')}
            className="font-semibold text-blue-700 hover:underline"
          >
            {step.mode === 'signin' ? 'Sign up' : 'Sign in'}
          </button>
        </p>

        <p className="mt-2 text-center text-xs text-slate-400">
          Need help? <span className="font-medium text-blue-700">Contact Admin</span>
        </p>
      </div>
    </div>
  )
}

function CodeField() {
  return (
    <label className={`${FIELD} mt-8`}>
      <KeyRound className="h-4 w-4 shrink-0 text-slate-400" />
      <input
        name="code"
        required
        autoFocus
        inputMode="numeric"
        pattern="[0-9]{6}"
        maxLength={6}
        placeholder="6-digit code"
        className={`${INPUT} tracking-widest`}
      />
    </label>
  )
}
