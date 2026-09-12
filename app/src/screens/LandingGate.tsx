/**
 * LandingGate — first screen on a fresh install (no mc_device_identity).
 *
 * Routing is handled by RootGate in App.tsx:
 *   - No identity → this screen
 *   - Has identity → /lock
 */

import { useNavigate }                  from 'react-router-dom'
import { Users }                        from 'lucide-react'
import { track }                        from '@/lib/analytics'
import { FullLogo }                      from '@/components/ui/Logo'
import { BrandTree }                     from '@/components/ui/BrandTree'

// ── Main screen ───────────────────────────────────────────────────────────────

export function LandingGate() {
  const navigate = useNavigate()

  return (
    <div className="h-svh bg-[var(--color-bg)] flex flex-col overflow-hidden">

      {/* Header */}
      <header className="safe-top sticky top-0 bg-[var(--color-surface)]/80 backdrop-blur border-b border-[var(--color-border)] px-4 pt-4 pb-3 flex items-center shrink-0">
        <FullLogo iconSize={28} />
      </header>

      {/* Main — true centre with equal flex space above and below */}
      <main className="flex-1 min-h-0 flex flex-col items-center justify-center px-5 max-w-md mx-auto w-full">

        {/* All content in a single compact column */}
        <div className="flex flex-col items-center gap-4 w-full py-2">

          {/* Orchard illustration */}
          <div className="relative flex items-end justify-center gap-3 h-40">
            <BrandTree size="sm" swayOffset={0}   growDelay={0}   flip />
            <BrandTree size="lg" swayOffset={3}   growDelay={180}      />
            <BrandTree size="md" swayOffset={1.5} growDelay={360}      />
            <div className="absolute bottom-0 left-[-12px] right-[-12px] h-px bg-[var(--color-border)]" />
          </div>

          {/* Text */}
          <div className="text-center space-y-3">
            <p className="text-[0.6875rem] font-semibold text-[var(--brand-primary)] bg-[color-mix(in_srgb,var(--brand-primary)_10%,transparent)] border border-[color-mix(in_srgb,var(--brand-primary)_30%,transparent)] rounded-full px-3 py-1 tracking-widest uppercase inline-block">
              Welcome to the Orchard
            </p>
            <h1 className="text-[2rem] font-extrabold text-[var(--color-text)] tracking-tight leading-[1.1]">
              Grow your family's<br />financial future
            </h1>
            <p className="text-[0.9375rem] text-[var(--color-text-muted)] leading-relaxed max-w-[300px] mx-auto">
              Chores, pocket money, and savings goals — with a transparent record both parents can trust.
            </p>
          </div>

          {/* CTAs */}
          <div className="w-full space-y-3">
            <button
              onClick={() => { track.registrationStarted(); navigate('/register') }}
              className="
                w-full h-14 rounded-2xl bg-[var(--brand-primary)] text-white
                font-semibold text-[0.9375rem] tracking-tight
                flex items-center justify-center gap-2.5
                hover:opacity-90 active:scale-[0.98]
                transition-all duration-150 shadow-md hover:shadow-lg
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-2
              "
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22V12"/>
                <path d="M12 12C12 12 7 10 7 5a5 5 0 0 1 10 0c0 5-5 7-5 7z"/>
              </svg>
              Create Family Account
            </button>

            <button
              onClick={() => { track.joinStarted(); navigate('/join') }}
              className="
                w-full h-14 rounded-2xl bg-[var(--color-surface)] text-[var(--color-text)]
                font-semibold text-[0.9375rem]
                flex items-center justify-center gap-2.5
                border-2 border-[var(--color-border)]
                hover:border-[var(--brand-primary)] hover:bg-[color-mix(in_srgb,var(--brand-primary)_5%,transparent)]
                active:scale-[0.98] transition-all duration-150
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-2
              "
            >
              <Users size={18} strokeWidth={2.5} />
              Join your Family
            </button>

            <div className="space-y-3">
              <p className="text-center text-[0.8125rem] text-[var(--color-text-muted)]">
                Already have an account?{' '}
                <button
                  onClick={() => navigate('/auth/login')}
                  className="tap-target-44 text-[var(--brand-primary)] font-semibold underline underline-offset-2 cursor-pointer"
                >
                  Sign In
                </button>
              </p>

              <p className="text-center text-[0.6875rem] text-[var(--color-text-muted)]">
                A solicitor or mediator?{' '}
                <button
                  onClick={() => navigate('/demo-register')}
                  className="tap-target-44 text-[var(--brand-primary)] underline underline-offset-2 cursor-pointer"
                >
                  Explore our professional demo →
                </button>
              </p>
            </div>

            <p className="text-center text-[0.6875rem] text-[var(--color-text-muted)]">
              🔒 Private by design — your data stays on your device and is never sold.
            </p>
          </div>

        </div>
      </main>
    </div>
  )
}

