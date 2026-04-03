/**
 * App.tsx — MoneySteps React entry point.
 *
 * Routes:
 *   /register (or no token) → 4-stage RegistrationShell
 *   otherwise               → redirect to legacy PWA dashboard at /
 *
 * The legacy index.html PWA remains at the root. This Vite app owns /register.
 */

import { useEffect, useState } from 'react'
import { RegistrationShell }   from './components/registration/RegistrationShell'

type View = 'register' | 'dashboard'

function getInitialView(): View {
  const token = localStorage.getItem('ms_token')
  if (token) return 'dashboard'
  return 'register'
}

export default function App() {
  const [view, setView] = useState<View>(getInitialView)

  useEffect(() => {
    if (window.location.pathname.includes('register')) {
      setView('register')
    }
  }, [])

  function handleRegistrationComplete(_familyId: string, _token: string) {
    window.location.href = '/'
  }

  if (view === 'register') {
    return <RegistrationShell onComplete={handleRegistrationComplete} />
  }

  return (
    <div className="min-h-svh flex items-center justify-center text-muted-foreground">
      <p>Redirecting to dashboard…</p>
    </div>
  )
}
