/**
 * LandingGate — first screen on a fresh install (no mc_device_identity).
 *
 * Routing is handled by RootGate in App.tsx:
 *   - No identity → this screen
 *   - Has identity → /lock
 *
 * Two paths:
 *   A) "Create Family Account" → /register
 *   B) "Join your Family"      → /join  (co-parent or child with invite code)
 */

import { useNavigate } from 'react-router-dom'
import { Users }       from 'lucide-react'
import { track }       from '@/lib/analytics'

export function LandingGate() {
  const navigate = useNavigate()

  return (
    <div className="min-h-svh bg-[#F5F4F0] flex flex-col">

      {/* Header */}
      <header className="sticky top-0 bg-white/80 backdrop-blur border-b border-[#D3D1C7] px-4 py-3 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-teal-600 flex items-center justify-center text-white text-sm font-bold shrink-0">M</div>
        <span className="text-[17px] font-extrabold text-[#1C1C1A] tracking-tight">Morechard</span>
      </header>

      <main className="flex-1 flex flex-col items-center justify-between px-5 py-10 max-w-md mx-auto w-full">

        {/* Hero */}
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-6 pb-4">

          {/* Orchard illustration */}
          <div className="relative flex items-end justify-center gap-2 h-28 mb-2">
            {/* Three trees at different heights */}
            <Tree size="sm" delay="0s" />
            <Tree size="lg" delay="0.15s" />
            <Tree size="md" delay="0.3s" />
            {/* Ground line */}
            <div className="absolute bottom-0 left-0 right-0 h-px bg-[#D3D1C7]" />
          </div>

          {/* Orchard badge — the only metaphor line */}
          <p className="text-[11px] font-semibold text-teal-700 bg-teal-50 border border-teal-200 rounded-full px-3 py-1 tracking-widest uppercase">
            Welcome to the Orchard
          </p>

          {/* Headline — plain language */}
          <div className="space-y-3">
            <h1 className="text-[32px] font-extrabold text-[#1C1C1A] tracking-tight leading-[1.1]">
              Grow your family's<br />financial future
            </h1>
            <p className="text-[15px] text-[#6b6a66] leading-relaxed max-w-[300px] mx-auto">
              Chores, pocket money, and savings goals — with a transparent record both parents can trust.
            </p>
          </div>

          {/* Trust signals */}
          <div className="flex items-center gap-5 mt-1">
            <Pill>🇬🇧 UK &amp; Poland</Pill>
            <Pill>🔒 Private by design</Pill>
          </div>
        </div>

        {/* CTAs */}
        <div className="w-full space-y-3 pt-4">
          <button
            onClick={() => { track.registrationStarted(); navigate('/register') }}
            className="
              w-full h-14 rounded-2xl bg-teal-600 text-white
              font-semibold text-[15px] tracking-tight
              flex items-center justify-center gap-2.5
              hover:bg-teal-700 active:scale-[0.98]
              transition-all duration-150 shadow-md hover:shadow-lg
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2
            "
          >
            {/* Sprout icon */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22V12"/>
              <path d="M12 12C12 12 7 10 7 5a5 5 0 0 1 10 0c0 5-5 7-5 7z"/>
            </svg>
            Create Family Account
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

          <p className="text-center text-[11px] text-[#9b9a96] pt-1">
            Your data stays on your device and is never sold.
          </p>
        </div>

      </main>
    </div>
  )
}

// ── Small components ──────────────────────────────────────────────────────────

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-semibold text-[#6b6a66] flex items-center gap-1">
      {children}
    </span>
  )
}

type TreeSize = 'sm' | 'md' | 'lg'

function Tree({ size, delay }: { size: TreeSize; delay: string }) {
  const heights: Record<TreeSize, string> = { sm: 'h-16', md: 'h-20', lg: 'h-24' }
  const canopies: Record<TreeSize, number> = { sm: 28, md: 34, lg: 40 }
  const trunks: Record<TreeSize, string>   = { sm: 'h-5 w-2', md: 'h-6 w-2.5', lg: 'h-7 w-3' }

  return (
    <div
      className={`flex flex-col items-center justify-end ${heights[size]}`}
      style={{ animation: `treeSway 4s ease-in-out infinite`, animationDelay: delay }}
    >
      {/* Canopy */}
      <svg
        width={canopies[size]}
        height={canopies[size]}
        viewBox="0 0 40 40"
        fill="none"
        className="shrink-0"
      >
        <circle cx="20" cy="20" r="18" fill="#d1fae5" />
        <circle cx="20" cy="20" r="18" fill="none" stroke="#6ee7b7" strokeWidth="1.5" />
        {/* A few dots suggesting fruit */}
        <circle cx="14" cy="18" r="2" fill="#34d399" opacity="0.7" />
        <circle cx="24" cy="14" r="1.5" fill="#34d399" opacity="0.5" />
        <circle cx="26" cy="24" r="2" fill="#34d399" opacity="0.6" />
      </svg>
      {/* Trunk */}
      <div className={`${trunks[size]} rounded-sm bg-[#a78a6e] shrink-0`} />
    </div>
  )
}
