/**
 * DemoUpsellCard — shown on the parent dashboard to Core users whose 14-day
 * trial has expired and who don't have AI Mentor or Shield.
 * Tapping enters the Thomson demo as demo_parent.
 */

import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { apiUrl, authHeaders, setToken } from '@/lib/api'
import type { TrialStatus } from '@/lib/api'

interface Props {
  trialStatus: TrialStatus | null
}

export function DemoUpsellCard({ trialStatus }: Props) {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  // Only show for expired Core users who aren't already in the demo
  const isDemoFamily = localStorage.getItem('mc_family_id') === 'demo-family-thomson'
  if (isDemoFamily) return null
  if (!trialStatus) return null
  if (!trialStatus.is_expired) return null
  if (trialStatus.has_ai_mentor || trialStatus.has_shield) return null

  async function handleEnterDemo() {
    if (loading) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(apiUrl('/auth/demo/enter'), {
        method: 'POST',
        headers: authHeaders('application/json'),
        body: JSON.stringify({}),
      })
      const data = await res.json() as { token?: string; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Could not enter demo')

      setToken(data.token!)
      localStorage.setItem('mc_family_id', 'demo-family-thomson')
      localStorage.setItem('mc_role', 'parent')
      localStorage.setItem('mc_demo_user_type', 'demo_parent')
      window.location.href = '/parent'
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-4 my-3 rounded-2xl border border-teal-200 bg-gradient-to-br from-teal-50 to-emerald-50 p-4">
      <div className="flex items-start gap-3">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-teal-100 border border-teal-200 shrink-0">
          <Sparkles size={16} className="text-teal-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 leading-snug">
            Explore AI Mentor and Shield
          </p>
          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
            Try the full experience using our demo family, the Thomsons. You can add and edit chores to get a feel for the app. The demo resets every night at midnight.
          </p>

          {error && (
            <p className="text-xs text-red-500 mt-1.5 font-medium">{error}</p>
          )}

          <button
            onClick={handleEnterDemo}
            disabled={loading}
            className="mt-3 w-full h-9 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold transition-all duration-150 active:scale-[0.98] cursor-pointer disabled:opacity-70"
          >
            {loading ? 'Entering demo…' : 'Try the Thomson family demo'}
          </button>
        </div>
      </div>
    </div>
  )
}
