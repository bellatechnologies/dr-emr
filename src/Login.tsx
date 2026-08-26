import { useState } from 'react'
import { KeyRound, Mail, ShieldCheck } from 'lucide-react'
import { beginLogin, verifyCode, type User } from './api'

const FIELD =
  'flex items-center gap-3 rounded-lg border border-slate-300 px-3 focus-within:border-blue-600'
const INPUT = 'w-full py-3 text-sm outline-none'
const BUTTON = 'mt-6 w-full rounded-lg bg-blue-700 py-3 text-sm font-semibold text-white hover:bg-blue-800'

export default function Login({ onSignIn }: { onSignIn: (u: User) => void }) {
  const [login, setLogin] = useState('')
  const [enrollment, setEnrollment] = useState<{ secret: string; qr: string } | null>(null)
  const [step, setStep] = useState<'email' | 'enroll' | 'code'>('email')
  const [error, setError] = useState('')

  async function continueWithEmail(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      const result = await beginLogin(login)
      if (result.enrolling) {
        setEnrollment({ secret: result.secret, qr: result.qr })
        setStep('enroll')
      } else {
        setStep('code')
      }
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

        {step === 'email' && (
          <form onSubmit={continueWithEmail}>
            <p className="mt-4 text-center text-sm text-slate-500">
              Sign in with your staff email and authenticator code.
            </p>
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

        {step === 'enroll' && enrollment && (
          <form onSubmit={submitCode}>
            <p className="mt-4 text-center text-sm text-slate-500">
              Scan this in Google Authenticator (or any authenticator app), then enter the 6-digit
              code it shows.
            </p>
            <img src={enrollment.qr} alt="Authenticator QR code" className="mx-auto mt-4 h-44 w-44" />
            <p className="mt-2 text-center text-xs text-slate-400">
              Can't scan? Enter this key manually:{' '}
              <span className="font-mono tracking-wider text-slate-600">{enrollment.secret}</span>
            </p>
            <label className={`${FIELD} mt-6`}>
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
            <button type="submit" className={BUTTON}>
              VERIFY & ENABLE
            </button>
          </form>
        )}

        {step === 'code' && (
          <form onSubmit={submitCode}>
            <p className="mt-4 text-center text-sm text-slate-500">
              Enter the code from your authenticator app.
            </p>
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
            <button type="submit" className={BUTTON}>
              SIGN IN
            </button>
          </form>
        )}

        {error && <p className="mt-4 text-center text-xs text-red-600">{error}</p>}

        {step !== 'email' && (
          <button
            type="button"
            onClick={() => {
              setStep('email')
              setError('')
            }}
            className="mt-4 w-full text-center text-xs font-medium text-blue-700 hover:underline"
          >
            Use a different account
          </button>
        )}

        <p className="mt-8 text-center text-xs text-slate-400">
          Need help? <span className="font-medium text-blue-700">Contact Admin</span>
        </p>
      </div>
    </div>
  )
}
