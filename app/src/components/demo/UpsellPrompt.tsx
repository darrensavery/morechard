/**
 * UpsellPrompt — shown to demo_parent users inside the demo.
 * Displays a locked feature card with a "Notify me when available" button.
 * Writes to upgrade_interest via POST /auth/demo/notify.
 */

import { useState } from 'react'
import { Lock } from 'lucide-react'
import { apiUrl, authHeaders } from '@/lib/api'

type Feature = 'shield' | 'ai_mentor' | 'learning_lab'

interface Props {
  feature: Feature
  title: string
  description: string
  children?: React.ReactNode
}

const LABELS: Record<Feature, string> = {
  shield:       'Shield AI',
  ai_mentor:    'AI Mentor',
  learning_lab: 'Learning Lab',
}

export function UpsellPrompt({ feature, title, description, children }: Props) {
  const [notified,  setNotified]  = useState(false)
  const [loading,   setLoading]   = useState(false)

  const isDemoParent = localStorage.getItem('mc_demo_user_type') === 'demo_parent'
  if (!isDemoParent) return null

  async function handleNotify() {
    if (loading || notified) return
    setLoading(true)
    try {
      await fetch(apiUrl('/auth/demo/notify'), {
        method: 'POST',
        headers: authHeaders('application/json'),
        body: JSON.stringify({ feature }),
      })
      setNotified(true)
    } catch {
      // best-effort — don't surface errors for this optional action
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative rounded-2xl border border-dashed border-gray-200 bg-gray-50/60 overflow-hidden">
      {/* Blurred preview of children if provided */}
      {children && (
        <div className="pointer-events-none select-none blur-sm opacity-40 p-4">
          {children}
        </div>
      )}

      {/* Lock overlay */}
      <div className={`${children ? 'absolute inset-0' : ''} flex flex-col items-center justify-center gap-3 p-6 text-center`}>
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 border border-gray-200">
          <Lock size={18} className="text-gray-400" />
        </div>

        <div className="space-y-1">
          <p className="text-sm font-semibold text-gray-700">
            Upgrade to {LABELS[feature]} to unlock {title}
          </p>
          <p className="text-xs text-gray-500 leading-relaxed max-w-xs">
            {description}
          </p>
        </div>

        <button
          onClick={handleNotify}
          disabled={loading || notified}
          className={`mt-1 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-150 ${
            notified
              ? 'bg-teal-50 text-teal-700 border border-teal-200 cursor-default'
              : 'bg-white border border-gray-200 text-gray-600 hover:border-teal-400 hover:text-teal-700 active:scale-[0.97] cursor-pointer'
          }`}
        >
          {notified ? '✓ We'll let you know' : 'Notify me when this is available'}
        </button>
      </div>
    </div>
  )
}
