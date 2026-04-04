/**
 * LandingGate — first screen on a fresh install (no account on this device).
 *
 * Two paths:
 *   A) "Start your Family Account" → /register
 *   B) "Join your Family"          → /join  (second parent or child)
 */

import { useNavigate } from 'react-router-dom'
import { Smile, Users } from 'lucide-react'
import { track } from '@/lib/analytics'

export function LandingGate() {
  const navigate = useNavigate()

  return (
    <div className="min-h-svh bg-[#F5F4F0] flex flex-col">

      {/* Header */}
      <header className="sticky top-0 bg-white border-b border-[#D3D1C7] shadow-[0_1px_4px_rgba(0,0,0,.05)] px-4 py-3 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-teal-600 flex items-center justify-center text-white text-sm font-bold">M</div>
        <span className="text-[17px] font-extrabold text-[#1C1C1A] tracking-tight">Morechard</span>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-5 py-12 max-w-md mx-auto w-full">

        {/* Icon */}
        <div className="mb-8 flex flex-col items-center gap-4">
          <div className="w-20 h-20 rounded-3xl bg-teal-600 flex items-center justify-center shadow-lg">
            <span className="text-4xl">👨‍👩‍👧</span>
          </div>
          <p className="text-[12px] font-semibold text-teal-700 bg-teal-50 border border-teal-200 rounded-full px-3 py-1 tracking-wide">
            Pocket money made simple
          </p>
        </div>

        <div className="text-center mb-10">
          <h1 className="text-[28px] font-extrabold text-[#1C1C1A] tracking-tight leading-tight mb-3">
            Welcome to<br />Morechard
          </h1>
          <p className="text-[14px] text-[#6b6a66] leading-relaxed max-w-xs mx-auto">
            Track chores, pocket money, and savings goals — with a fair record
            both parents can trust.
          </p>
        </div>

        <div className="w-full space-y-3">
          <button
            onClick={() => { track.registrationStarted(); navigate('/register') }}
            className="
              w-full h-14 rounded-2xl bg-teal-600 text-white
              font-semibold text-[15px]
              flex items-center justify-center gap-2.5
              hover:bg-teal-700 active:scale-[0.98]
              transition-all duration-150 shadow-md hover:shadow-lg
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2
            "
          >
            <Smile size={18} strokeWidth={2.5} />
            Start your Family Account
          </button>

          <button
            onClick={() => { track.joinStarted(); navigate('/join') }}
            className="
              w-full h-14 rounded-2xl bg-white text-[#1C1C1A]
              font-semibold text-[15px]
              flex items-center justify-center gap-2.5
              border-2 border-[#D3D1C7]
              hover:border-teal-400 hover:bg-teal-50/40
              active:scale-[0.98] transition-all duration-150
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2
            "
          >
            <Users size={18} strokeWidth={2.5} />
            Join your Family
          </button>
        </div>

        <p className="mt-10 text-[11px] text-[#9b9a96] text-center leading-relaxed">
          Your data stays private and secure
        </p>
      </main>
    </div>
  )
}
