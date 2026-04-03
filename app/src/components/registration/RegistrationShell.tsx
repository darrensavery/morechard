/**
 * RegistrationShell — top-level orchestrator for the 4-stage registration flow.
 *
 * Responsibilities:
 *   - Shadcn Progress bar with "N/4: Stage Label" header
 *   - Accumulated state shared between all stages
 *   - POST /auth/create-family at end of Stage 1 (creates family + issues JWT)
 *   - POST /auth/registration/save-step after each stage for D1 persistence
 *   - Skip Stage 4 if parenting_mode === 'single'
 *   - WelcomeNudge shown after final stage
 *   - Redirect to dashboard after nudge is dismissed
 */

import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { Stage1ParentIdentity }     from './Stage1ParentIdentity'
import { Stage2FamilyConstitution } from './Stage2FamilyConstitution'
import { Stage3ChildOnboarding }    from './Stage3ChildOnboarding'
import { Stage4CoParentBridge }     from './Stage4CoParentBridge'
import { WelcomeNudge }             from './WelcomeNudge'
import { createFamily, login, saveRegistrationStep } from '@/lib/api'

// ── Shared state type ────────────────────────────────────────────────────────

export interface ChildRecord {
  child_id:     string
  display_name: string
  invite_code:  string
  expires_at:   number
}

export interface RegistrationState {
  // Stage 1
  display_name?:    string
  email?:           string
  password?:        string
  parenting_mode?:  'single' | 'co-parenting'
  governance_mode?: 'amicable' | 'standard'

  // Stage 2
  base_currency?: 'GBP' | 'PLN'

  // Stage 3
  children?: ChildRecord[]

  // Stage 4
  coparent_invite_code?: string
  coparent_expires_at?:  number
  coparent_skipped?:     boolean

  // Internal
  family_id?: string
  user_id?:   string
}

// ── Stage metadata ────────────────────────────────────────────────────────────

const STAGE_LABELS: Record<number, string> = {
  1: 'Your Identity',
  2: 'Family Constitution',
  3: 'Child Onboarding',
  4: 'Co-Parent Bridge',
}

// ── Shell ─────────────────────────────────────────────────────────────────────

interface Props {
  /** Called when the user dismisses the WelcomeNudge — navigate to dashboard. */
  onComplete: (familyId: string, token: string) => void
}

export function RegistrationShell({ onComplete }: Props) {
  const [step,    setStep]    = useState(1)
  const [done,    setDone]    = useState(false)
  const [state,   setState]   = useState<RegistrationState>({})
  const [error,   setError]   = useState('')
  const [saving,  setSaving]  = useState(false)

  // Co-parenting flow has 4 stages; single-parent has 3
  const totalSteps = state.parenting_mode === 'co-parenting' ? 4 : 3
  const progress   = Math.round((step / totalSteps) * 100)

  // ── Merge incoming patch into accumulated state ────────────────────────────

  async function advanceStep(patch: Partial<RegistrationState>, nextStep?: number) {
    setError('')
    setSaving(true)

    const merged: RegistrationState = { ...state, ...patch }
    setState(merged)

    try {
      // Stage 1 completion: create family + log the user in
      if (step === 1) {
        const familyResult = await createFamily({
          display_name:    merged.display_name!,
          email:           merged.email!,
          password:        merged.password!,
          locale:          merged.base_currency === 'PLN' ? 'pl' : 'en',
          parenting_mode:  merged.parenting_mode!,
          governance_mode: merged.governance_mode!,
          base_currency:   merged.base_currency ?? 'GBP',
        })

        const loginResult = await login(merged.email!, merged.password!)
        localStorage.setItem('ms_token', loginResult.token)

        const withIds = { ...merged, family_id: familyResult.family_id, user_id: familyResult.user_id }
        setState(withIds)

        await saveRegistrationStep(1, {
          parenting_mode:  withIds.parenting_mode,
          governance_mode: withIds.governance_mode,
          base_currency:   withIds.base_currency,
        })

        const ns = nextStep ?? 2
        setStep(ns)
        setSaving(false)
        return
      }

      // Stages 2–4: just persist progress
      await saveRegistrationStep(step, buildStepPayload(step, merged))

      // Single-parent flow: skip Stage 4
      const ns = nextStep ?? (
        step === 3 && merged.parenting_mode === 'single' ? 99 : step + 1
      )

      if (ns > 4 || (ns === 4 && merged.parenting_mode === 'single')) {
        setDone(true)
      } else {
        setStep(ns)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  function goBack() {
    setStep(s => Math.max(1, s - 1))
    setError('')
  }

  function handleNudgeDismiss() {
    onComplete(state.family_id!, localStorage.getItem('ms_token')!)
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (done) {
    return (
      <RegistrationLayout step={null} totalSteps={totalSteps} progress={100}>
        <WelcomeNudge data={state} onFinish={handleNudgeDismiss} />
      </RegistrationLayout>
    )
  }

  return (
    <RegistrationLayout step={step} totalSteps={totalSteps} progress={progress}>
      {error && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive mb-5">
          {error}
        </div>
      )}

      {saving && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-card border p-8 shadow-lg">
            <span className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm font-medium text-muted-foreground">Securing your record…</p>
          </div>
        </div>
      )}

      {step === 1 && (
        <Stage1ParentIdentity
          data={state}
          onNext={patch => advanceStep(patch)}
        />
      )}
      {step === 2 && (
        <Stage2FamilyConstitution
          data={state}
          onNext={patch => advanceStep(patch)}
          onBack={goBack}
        />
      )}
      {step === 3 && (
        <Stage3ChildOnboarding
          data={state}
          onNext={patch => advanceStep(patch)}
          onBack={goBack}
        />
      )}
      {step === 4 && (
        <Stage4CoParentBridge
          data={state}
          onNext={patch => advanceStep(patch)}
          onBack={goBack}
        />
      )}
    </RegistrationLayout>
  )
}

// ── Layout wrapper ────────────────────────────────────────────────────────────

function RegistrationLayout({
  step, totalSteps, progress, children,
}: {
  step: number | null
  totalSteps: number
  progress: number
  children: React.ReactNode
}) {
  return (
    <div className="min-h-svh bg-white flex flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
        <div className="max-w-md mx-auto px-5 pt-4 pb-3 space-y-3">
          {/* Brand row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="rounded-xl bg-teal-600 p-1.5">
                <ShieldCheck size={15} className="text-white" strokeWidth={2.5} />
              </div>
              <span className="font-extrabold text-sm text-gray-900 tracking-tight">
                MoneySteps
              </span>
            </div>
            {step !== null && (
              <div className="text-right">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  Step {step} of {totalSteps}
                </span>
                <p className="text-xs font-semibold text-gray-700 leading-none mt-0.5">
                  {STAGE_LABELS[step]}
                </p>
              </div>
            )}
          </div>

          {/* Progress bar — teal, chunky */}
          <div className="relative h-2 w-full rounded-full bg-gray-100 overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-teal-500 transition-all duration-500 ease-in-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-5 py-8 max-w-md mx-auto w-full">
        {children}
      </main>

      {/* Footer */}
      <footer className="px-5 py-4 text-center border-t border-gray-100">
        <p className="text-[11px] text-gray-400 tracking-wide">
          🔒 256-bit encrypted &nbsp;·&nbsp; Cloudflare D1 &nbsp;·&nbsp; Immutable audit trail
        </p>
      </footer>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildStepPayload(step: number, s: RegistrationState): Record<string, unknown> {
  if (step === 2) return { base_currency: s.base_currency, governance_mode: s.governance_mode }
  if (step === 3) return { children_count: s.children?.length ?? 0 }
  if (step === 4) return { coparent_invited: !s.coparent_skipped }
  return {}
}
