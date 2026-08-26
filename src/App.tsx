import { useEffect, useState } from 'react'
import Login from './Login'
import Dashboard from './Dashboard'
import { me, setUnauthorizedHandler, type User } from './api'

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null))
    me()
      .then(setUser)
      .finally(() => setChecking(false))
  }, [])

  if (checking) {
    return <div className="flex min-h-full items-center justify-center text-sm text-slate-400">Loading…</div>
  }

  return user ? <Dashboard user={user} onLogout={() => setUser(null)} /> : <Login onSignIn={setUser} />
}
