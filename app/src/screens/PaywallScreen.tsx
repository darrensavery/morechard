/**
 * PaywallScreen — shown when the trial has expired.
 * Reuses the same PlanPurchaseCards component as BillingSettings so there
 * is exactly one checkout path in the app — no separate Stripe-hosted
 * widget with its own catalogue/config to keep in sync.
 */

import { useEffect, useState } from 'react'
import { FullLogo } from '../components/ui/Logo'
import { getDeviceIdentity } from '../lib/deviceIdentity'
import { PlanPurchaseCards } from '../components/billing/PlanPurchaseCards'
import { getTrialStatus, type TrialStatus } from '../lib/api'

export function PaywallScreen() {
  const identity = getDeviceIdentity()
  const [trial, setTrial] = useState<TrialStatus | null>(null)
  const [errorToast, setErrorToast] = useState<string | null>(null)

  useEffect(() => {
    getTrialStatus().then(setTrial).catch(() => setTrial(null))
  }, [])

  return (
    <div className="min-h-svh bg-[var(--color-bg)] flex flex-col">
      {/* Header */}
      <header className="safe-top sticky top-0 z-40 bg-[var(--color-surface)] border-b border-[var(--color-border)] shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
        <div className="max-w-2xl mx-auto px-5 pt-4 pb-3 flex items-center justify-between">
          <FullLogo iconSize={26} />
          {identity && (
            <a
              href="/parent"
              className="text-[0.8125rem] font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
            >
              Back to app
            </a>
          )}
        </div>
      </header>

      {/* Hero */}
      <div className="px-5 pt-10 pb-6 text-center max-w-lg mx-auto w-full">
        <p className="text-[0.6875rem] font-bold uppercase tracking-widest text-[var(--brand-primary)] mb-2">
          Your trial has ended
        </p>
        <h1 className="text-[1.625rem] font-bold text-[var(--color-text)] leading-tight">
          Choose your plan
        </h1>
        <p className="text-[0.875rem] text-[var(--color-text-muted)] mt-2 leading-relaxed">
          One-time purchase. No subscriptions. Your data stays safe forever.
        </p>
      </div>

      {/* Purchase cards */}
      <div className="flex-1 w-full max-w-lg mx-auto px-5 pb-12">
        {errorToast && (
          <div className="mb-3 rounded-xl bg-red-50 text-red-700 text-[0.8125rem] font-semibold px-3 py-2 text-center">
            {errorToast}
          </div>
        )}
        <PlanPurchaseCards
          trial={trial}
          shieldUpgradePrice={null}
          onBuyError={setErrorToast}
        />
      </div>

      {/* Footer */}
      <footer className="px-5 py-5 text-center border-t border-[var(--color-border)]">
        <p className="text-[0.75rem] text-[var(--color-text-muted)] leading-relaxed">
          Payments processed securely by Stripe. Your card details are never stored by Morechard.
          <br />
          Questions? <a href="mailto:support@morechard.com" className="underline hover:text-[var(--color-text)] transition-colors">Contact support</a>
        </p>
      </footer>
    </div>
  )
}
