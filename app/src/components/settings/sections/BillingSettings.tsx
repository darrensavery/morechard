/**
 * BillingSettings — Billing & Subscriptions section.
 * Lead-parent only (enforced by menu, not here).
 *
 * Sub-views:
 *   menu         — three rows (Trial Status / Plan Management / Payment History)
 *   trial        — visual trial tracker
 *   plan         — current plan + upgrade options
 *   history      — payment audit log
 */

import { useState, useEffect } from 'react'
import { CreditCard, Clock, Receipt, Zap, Shield, ChevronRight } from 'lucide-react'
import { Toast, SettingsRow, SectionCard, SectionHeader } from '../shared'
import {
  getTrialStatus, getBillingHistory, createCheckoutSession,
  type TrialStatus, type PaymentRecord,
} from '../../../lib/api'
import { cn } from '../../../lib/utils'

type SubView = 'menu' | 'trial' | 'plan' | 'history'

interface Props {
  toast:        string | null
  onBack:       () => void
  onComingSoon: () => void
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatAmount(pence: number, currency: string): string {
  const amount = pence / 100
  if (currency.toUpperCase() === 'GBP') return `£${amount.toFixed(2)}`
  if (currency.toUpperCase() === 'USD') return `$${amount.toFixed(2)}`
  return `${amount.toFixed(2)} ${currency.toUpperCase()}`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const PLAN_LABELS: Record<string, string> = {
  LIFETIME:  'Lifetime Tracker',
  AI_ANNUAL: 'AI Coach — Annual',
}

// ── Trial sub-view ─────────────────────────────────────────────────────────────

function TrialView({ onBack }: { onBack: () => void }) {
  const [trial, setTrial]   = useState<TrialStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getTrialStatus()
      .then(setTrial)
      .finally(() => setLoading(false))
  }, [])

  const daysLeft = trial?.days_remaining ?? null
  const pct = daysLeft !== null ? Math.max(0, Math.min(100, (daysLeft / 14) * 100)) : 100
  const urgent = daysLeft !== null && daysLeft <= 2

  return (
    <div className="space-y-4">
      <SectionHeader title="Trial Status" onBack={onBack} />

      {loading ? (
        <div className="h-32 rounded-xl bg-[var(--color-surface-alt)] animate-pulse" />
      ) : trial?.has_lifetime_license ? (
        <SectionCard>
          <div className="px-4 py-5 flex items-start gap-3">
            <span className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center bg-[color-mix(in_srgb,var(--brand-primary)_12%,transparent)] text-[var(--brand-primary)]">
              <Shield size={17} />
            </span>
            <div>
              <p className="text-[14px] font-bold text-[var(--color-text)]">Lifetime licence active</p>
              <p className="text-[12px] text-[var(--color-text-muted)] mt-0.5 leading-snug">
                Full access to Morechard forever — no renewals, no trial limits.
              </p>
            </div>
          </div>
        </SectionCard>
      ) : trial?.ai_subscription_active ? (
        <SectionCard>
          <div className="px-4 py-5 flex items-start gap-3">
            <span className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center bg-[color-mix(in_srgb,var(--brand-primary)_12%,transparent)] text-[var(--brand-primary)]">
              <Zap size={17} />
            </span>
            <div>
              <p className="text-[14px] font-bold text-[var(--color-text)]">AI Coach subscription active</p>
              <p className="text-[12px] text-[var(--color-text-muted)] mt-0.5 leading-snug">
                AI Mentor features are unlocked for your family.
              </p>
            </div>
          </div>
        </SectionCard>
      ) : (
        <SectionCard>
          <div className="px-4 pt-4 pb-3">
            <div className="flex items-center gap-2 mb-3">
              <Clock size={14} className={urgent ? 'text-amber-500' : 'text-teal-600'} />
              <p className="text-[13px] font-bold text-[var(--color-text)]">
                {trial?.is_expired
                  ? 'Trial expired'
                  : !trial?.is_activated
                  ? '14-day free trial'
                  : daysLeft === 1
                  ? '1 day remaining'
                  : `${daysLeft ?? 14} days remaining`}
              </p>
            </div>

            {/* Progress bar */}
            <div className={cn('h-2.5 rounded-full overflow-hidden', urgent ? 'bg-amber-100' : 'bg-teal-100')}>
              <div
                className={cn('h-full rounded-full transition-all', urgent ? 'bg-amber-400' : 'bg-teal-500')}
                style={{ width: `${trial?.is_expired ? 0 : pct}%` }}
              />
            </div>

            <div className="flex justify-between mt-1.5 text-[11px] text-[var(--color-text-muted)]">
              <span>Day 1</span>
              <span>Day 14</span>
            </div>

            {!trial?.is_activated && (
              <p className="text-[12px] text-[var(--color-text-muted)] mt-3 leading-snug">
                Your trial starts automatically when the first chore is approved. The 14-day clock begins at that point.
              </p>
            )}

            {trial?.is_expired && (
              <p className="text-[12px] text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mt-3 leading-snug">
                Your trial has ended. Upgrade to restore write access for your family.
              </p>
            )}
          </div>
        </SectionCard>
      )}

      <SectionCard>
        <div className="px-4 py-3">
          <p className="text-[12px] text-[var(--color-text-muted)] leading-relaxed">
            The trial covers full access to all features. When it ends, your data is safe — you can still
            export your ledger at any time. Upgrade to a paid plan to continue using Morechard.
          </p>
        </div>
      </SectionCard>
    </div>
  )
}

// ── Plan management sub-view ───────────────────────────────────────────────────

function PlanView({ onBack, showToast }: { onBack: () => void; showToast: (m: string) => void }) {
  const [trial, setTrial]     = useState<TrialStatus | null>(null)
  const [loading, setLoading]  = useState(true)
  const [buying, setBuying]    = useState<string | null>(null)

  useEffect(() => {
    getTrialStatus()
      .then(setTrial)
      .finally(() => setLoading(false))
  }, [])

  async function handleUpgrade(type: 'LIFETIME' | 'AI_ANNUAL') {
    setBuying(type)
    try {
      const { url } = await createCheckoutSession(type)
      window.location.href = url
    } catch {
      showToast('Could not start checkout — please try again')
    } finally {
      setBuying(null)
    }
  }

  return (
    <div className="space-y-4">
      <SectionHeader title="Plan Management" onBack={onBack} />

      {loading ? (
        <div className="h-40 rounded-xl bg-[var(--color-surface-alt)] animate-pulse" />
      ) : (
        <>
          {/* Current plan status */}
          <SectionCard>
            <div className="px-4 py-3">
              <p className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-2">
                Current plan
              </p>
              <div className="flex items-center gap-2">
                <span className={cn(
                  'inline-block px-2.5 py-1 rounded-full text-[12px] font-bold',
                  trial?.has_lifetime_license
                    ? 'bg-[color-mix(in_srgb,var(--brand-primary)_12%,transparent)] text-[var(--brand-primary)]'
                    : trial?.ai_subscription_active
                    ? 'bg-violet-100 text-violet-700'
                    : trial?.is_expired
                    ? 'bg-red-100 text-red-600'
                    : 'bg-teal-100 text-teal-700',
                )}>
                  {trial?.has_lifetime_license
                    ? 'Lifetime Tracker'
                    : trial?.ai_subscription_active
                    ? 'AI Coach Annual'
                    : trial?.is_expired
                    ? 'Trial expired'
                    : trial?.is_activated
                    ? `Trial — ${trial.days_remaining ?? 0} days left`
                    : 'Free trial (not started)'}
                </span>
              </div>
            </div>
          </SectionCard>

          {/* Upgrade options — only shown when not on lifetime */}
          {!trial?.has_lifetime_license && (
            <SectionCard>
              <div className="px-4 pt-3 pb-1">
                <p className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-2">
                  Upgrade
                </p>
              </div>

              {/* Lifetime Tracker */}
              <button
                type="button"
                disabled={buying !== null}
                onClick={() => handleUpgrade('LIFETIME')}
                className="w-full flex items-start gap-3 px-4 py-3.5 text-left border-b border-[var(--color-border)] hover:bg-[var(--color-surface-alt)] active:bg-[var(--color-surface-alt)] cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center bg-[color-mix(in_srgb,var(--brand-primary)_12%,transparent)] text-[var(--brand-primary)]">
                  <Shield size={15} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[14px] font-semibold text-[var(--color-text)]">Lifetime Tracker</p>
                    <span className="text-[11px] font-bold text-[var(--brand-primary)]">£34.99</span>
                  </div>
                  <p className="text-[12px] text-[var(--color-text-muted)] mt-0.5 leading-snug">
                    Full access forever — no subscription, no renewals
                  </p>
                </div>
                {buying === 'LIFETIME' ? (
                  <span className="shrink-0 text-[11px] text-[var(--color-text-muted)] animate-pulse">Loading…</span>
                ) : (
                  <ChevronRight size={15} className="shrink-0 text-[var(--color-text-muted)]" />
                )}
              </button>

              {/* AI Coach Annual — only if not already subscribed */}
              {!trial?.ai_subscription_active && (
                <button
                  type="button"
                  disabled={buying !== null}
                  onClick={() => handleUpgrade('AI_ANNUAL')}
                  className="w-full flex items-start gap-3 px-4 py-3.5 text-left hover:bg-[var(--color-surface-alt)] active:bg-[var(--color-surface-alt)] cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center bg-violet-100 text-violet-700">
                    <Zap size={15} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[14px] font-semibold text-[var(--color-text)]">AI Coach</p>
                      <span className="text-[11px] font-bold text-violet-600">£19.99 / yr</span>
                    </div>
                    <p className="text-[12px] text-[var(--color-text-muted)] mt-0.5 leading-snug">
                      Personalised financial coaching for your children
                    </p>
                  </div>
                  {buying === 'AI_ANNUAL' ? (
                    <span className="shrink-0 text-[11px] text-[var(--color-text-muted)] animate-pulse">Loading…</span>
                  ) : (
                    <ChevronRight size={15} className="shrink-0 text-[var(--color-text-muted)]" />
                  )}
                </button>
              )}
            </SectionCard>
          )}

          <SectionCard>
            <div className="px-4 py-3">
              <p className="text-[12px] text-[var(--color-text-muted)] leading-relaxed">
                Payments are processed securely by Stripe. Your card details are never stored by Morechard.
                To cancel a subscription contact support.
              </p>
            </div>
          </SectionCard>
        </>
      )}
    </div>
  )
}

// ── Payment history sub-view ───────────────────────────────────────────────────

function HistoryView({ onBack }: { onBack: () => void }) {
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    getBillingHistory()
      .then(r => setPayments(r.payments))
      .catch(() => setPayments([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-4">
      <SectionHeader title="Payment History" onBack={onBack} />

      {loading ? (
        <div className="space-y-2">
          {[0, 1].map(i => (
            <div key={i} className="h-14 rounded-xl bg-[var(--color-surface-alt)] animate-pulse" />
          ))}
        </div>
      ) : payments.length === 0 ? (
        <SectionCard>
          <div className="px-4 py-6 text-center">
            <Receipt size={28} className="mx-auto text-[var(--color-text-muted)] mb-2 opacity-40" />
            <p className="text-[13px] font-semibold text-[var(--color-text)]">No payments yet</p>
            <p className="text-[12px] text-[var(--color-text-muted)] mt-1">
              Your payment records will appear here after your first purchase.
            </p>
          </div>
        </SectionCard>
      ) : (
        <SectionCard>
          {payments.map((p, i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-4 py-3.5 border-b border-[var(--color-border)] last:border-0"
            >
              <span className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center bg-[color-mix(in_srgb,var(--brand-primary)_10%,transparent)] text-[var(--brand-primary)]">
                <Receipt size={14} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-[var(--color-text)]">
                  {PLAN_LABELS[p.payment_type] ?? p.payment_type}
                </p>
                <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">{formatDate(p.created_at)}</p>
              </div>
              <span className="shrink-0 text-[13px] font-bold text-[var(--color-text)]">
                {formatAmount(p.amount_paid_int, p.currency)}
              </span>
            </div>
          ))}
        </SectionCard>
      )}
    </div>
  )
}

// ── Root billing menu ──────────────────────────────────────────────────────────

export function BillingSettings({ toast, onBack, onComingSoon: _onComingSoon }: Props) {
  const [sub, setSub] = useState<SubView>('menu')
  const [localToast, setLocalToast] = useState<string | null>(null)

  function showToast(msg: string) {
    setLocalToast(msg)
    setTimeout(() => setLocalToast(null), 3000)
  }

  const activeToast = localToast ?? toast

  if (sub === 'trial')   return <div className="space-y-4">{activeToast && <Toast message={activeToast} />}<TrialView onBack={() => setSub('menu')} /></div>
  if (sub === 'plan')    return <div className="space-y-4">{activeToast && <Toast message={activeToast} />}<PlanView  onBack={() => setSub('menu')} showToast={showToast} /></div>
  if (sub === 'history') return <div className="space-y-4">{activeToast && <Toast message={activeToast} />}<HistoryView onBack={() => setSub('menu')} /></div>

  return (
    <div className="space-y-4">
      {activeToast && <Toast message={activeToast} />}
      <SectionHeader title="Billing & Subscriptions" onBack={onBack} />
      <SectionCard>
        <SettingsRow
          icon={<Clock size={15} />}
          label="Trial Status"
          description="Visual tracker for the 14-day Professional trial"
          onClick={() => setSub('trial')}
        />
        <SettingsRow
          icon={<CreditCard size={15} />}
          label="Plan Management"
          description="Upgrade or view your current subscription"
          onClick={() => setSub('plan')}
        />
        <SettingsRow
          icon={<Receipt size={15} />}
          label="Payment History"
          description="View past invoices and payments"
          onClick={() => setSub('history')}
        />
      </SectionCard>
    </div>
  )
}
