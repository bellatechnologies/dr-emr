import { useState } from 'react'
import Login from './Login'
import Dashboard from './Dashboard'
import type { User } from './api'

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  return user ? (
    <Dashboard user={user} onLogout={() => setUser(null)} />
  ) : (
    <Login onSignIn={setUser} />
  )
}
