import { useState } from 'react'
import { BriefcaseMedical, Eye, EyeOff, HeartPulse, Lock, Mail, User as UserIcon } from 'lucide-react'
import { createAccount, signIn, type User } from './api'

const FIELD =
  'flex items-center gap-3 rounded-lg border border-slate-300 px-3 focus-within:border-blue-600'
const INPUT = 'w-full py-3 text-sm outline-none'

export default function Login({ onSignIn }: { onSignIn: (u: User) => void }) {
  const [signup, setSignup] = useState(false)
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>
    try {
      onSignIn(
        signup
          ? createAccount({
              name: f.name,
              username: f.username,
              email: f.email,
              role: f.role,
              password: f.password,
            })
          : signIn(f.login, f.password),
      )
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-slate-100 p-4">
      <form
        key={String(signup)}
        onSubmit={submit}
        className="w-full max-w-md rounded-2xl bg-white px-8 py-10 shadow-xl sm:px-10"
      >
        <div className="flex items-center justify-center gap-2 text-blue-800">
          <HeartPulse className="h-8 w-8" />
          <div className="leading-tight">
            <div className="text-xl font-bold">HMS</div>
            <div className="text-[10px] tracking-wide text-slate-500">
              HOSPITAL MANAGEMENT SYSTEM
            </div>
          </div>
        </div>
        <p className="mt-4 text-center text-sm text-slate-500">
          {signup ? 'Create your staff account.' : 'Sign in to your account.'}
        </p>

        <div className="mt-8 space-y-4">
          {signup ? (
            <>
              <label className={FIELD}>
                <UserIcon className="h-4 w-4 shrink-0 text-slate-400" />
                <input name="name" required placeholder="Full Name" className={INPUT} />
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
                <BriefcaseMedical className="h-4 w-4 shrink-0 text-slate-400" />
                <select name="role" required defaultValue="" className={`${INPUT} bg-transparent`}>
                  <option value="" disabled>
                    Select role
                  </option>
                  {['Doctor', 'Nurse', 'Admin', 'Lab Technician', 'Pharmacist'].map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </label>
            </>
          ) : (
            <label className={FIELD}>
              <UserIcon className="h-4 w-4 shrink-0 text-slate-400" />
              <input
                name="login"
                required
                autoComplete="username"
                placeholder="Username / Email"
                className={INPUT}
              />
            </label>
          )}

          <label className={FIELD}>
            <Lock className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              name="password"
              type={show ? 'text' : 'password'}
              required
              minLength={signup ? 8 : undefined}
              autoComplete={signup ? 'new-password' : 'current-password'}
              placeholder={signup ? 'Password (min 8 characters)' : 'Password'}
              className={INPUT}
            />
            <button
              type="button"
              onClick={() => setShow(!show)}
              aria-label={show ? 'Hide password' : 'Show password'}
              className="text-slate-400 hover:text-slate-600"
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </label>
        </div>

        {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

        {!signup && (
          <div className="mt-4 flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 text-slate-600">
              <input type="checkbox" name="remember" className="h-4 w-4 accent-blue-700" />
              Remember me
            </label>
            <button type="button" className="font-medium text-blue-700 hover:underline">
              Forgot password?
            </button>
          </div>
        )}

        <button
          type="submit"
          className="mt-6 w-full rounded-lg bg-blue-700 py-3 text-sm font-semibold text-white hover:bg-blue-800"
        >
          {signup ? 'CREATE ACCOUNT' : 'SIGN IN'}
        </button>

        <p className="mt-6 text-center text-sm text-slate-500">
          {signup ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            type="button"
            onClick={() => {
              setSignup(!signup)
              setError('')
            }}
            className="font-semibold text-blue-700 hover:underline"
          >
            {signup ? 'Sign in' : 'Create one'}
          </button>
        </p>

        <p className="mt-2 text-center text-xs text-slate-400">
          Need help? <span className="font-medium text-blue-700">Contact Admin</span>
        </p>
      </form>
    </div>
  )
}
