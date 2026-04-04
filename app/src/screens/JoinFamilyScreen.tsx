/**
 * JoinFamilyScreen — invite-code entry for co-parents and children.
 * Placeholder: full implementation is Phase 2 (co-parent bridge) / Phase 3 (child onboarding).
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { setDeviceIdentity, toInitials } from '@/lib/deviceIdentity'

export function JoinFamilyScreen() {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleJoin() {
    const trimmed = code.trim().toUpperCase()
    if (trimmed.length < 6) {
      setError('Enter your 6-character invite code.')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const res = await fetch('/auth/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invite_code: trimmed }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError((body as { error?: string }).error ?? 'Invalid or expired invite code.')
        setSubmitting(false)
        return
      }

      const data = await res.json() as {
        token: string
        user_id: string
        family_id: string
        display_name: string
        role: 'custodian' | 'maker'
      }

      localStorage.setItem('ms_token', data.token)

      setDeviceIdentity({
        user_id:       data.user_id,
        family_id:     data.family_id,
        display_name:  data.display_name,
        role:          data.role,
        initials:      toInitials(data.display_name),
        registered_at: new Date().toISOString(),
      })

      window.location.href = '/lock'
    } catch {
      setError('Something went wrong. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-svh bg-[#F5F4F0] flex flex-col">

      <header className="sticky top-0 bg-white border-b border-[#D3D1C7] shadow-[0_1px_4px_rgba(0,0,0,.05)] px-4 py-3 flex items-center gap-2.5">
        <div className="rounded-xl bg-teal-600 p-1.5">
          <ShieldCheck size={15} className="text-white" strokeWidth={2.5} />
        </div>
        <span className="text-[17px] font-extrabold text-[#1C1C1A] tracking-tight">MoneySteps</span>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-5 py-12 max-w-md mx-auto w-full">
        <div className="text-center mb-8">
          <h1 className="text-[26px] font-extrabold text-[#1C1C1A] tracking-tight mb-2">Join a Family</h1>
          <p className="text-[14px] text-[#6b6a66] leading-relaxed">
            Enter the invite code shared by your family's Lead Custodian.
          </p>
        </div>

        <div className="w-full space-y-3">
          <input
            type="text"
            value={code}
            onChange={e => { setCode(e.target.value.toUpperCase()); setError('') }}
            placeholder="e.g. A3F7K2"
            maxLength={8}
            className={`
              w-full h-14 rounded-xl border-2 px-4 text-center text-[20px] font-extrabold tracking-widest
              bg-white outline-none transition-colors
              ${error ? 'border-red-400' : 'border-[#D3D1C7] focus:border-teal-500'}
            `}
          />

          {error && (
            <p className="text-[13px] font-semibold text-red-600 text-center">{error}</p>
          )}

          <button
            onClick={handleJoin}
            disabled={submitting}
            className="
              w-full h-14 rounded-2xl bg-teal-600 text-white
              font-semibold text-[15px] tracking-tight
              hover:bg-teal-700 active:scale-[0.98] disabled:opacity-60
              transition-all duration-150 shadow-md cursor-pointer
            "
          >
            {submitting ? 'Verifying…' : 'Join Family'}
          </button>

          <button
            onClick={() => navigate('/')}
            className="w-full text-center text-[13px] text-[#6b6a66] underline underline-offset-2 cursor-pointer hover:text-[#1C1C1A] transition-colors py-1"
          >
            Back
          </button>
        </div>
      </main>
    </div>
  )
}
