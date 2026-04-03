import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { RegistrationShell } from './components/registration/RegistrationShell'
import { LandingScreen } from './screens/LandingScreen'
import { PinScreen } from './screens/PinScreen'
import { ParentDashboard } from './screens/ParentDashboard'
import { ChildDashboard } from './screens/ChildDashboard'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('ms_token')
  if (!token) return <Navigate to="/" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingScreen />} />
        <Route path="/pin" element={<PinScreen />} />
        <Route path="/register" element={<RegistrationShell onComplete={() => { window.location.href = '/pin' }} />} />
        <Route path="/parent" element={<RequireAuth><ParentDashboard /></RequireAuth>} />
        <Route path="/child" element={<RequireAuth><ChildDashboard /></RequireAuth>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
