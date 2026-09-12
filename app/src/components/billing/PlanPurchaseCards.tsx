/**
 * PlanPurchaseCards — the Core / Core AI / Shield AI purchase cards plus
 * the "Compare all plans" modal. Shared between BillingSettings.PlanView
 * (in-app upgrade flow) and PaywallScreen (post-trial-expiry flow) so
 * there is exactly one checkout entry point in the app.
 *
 * Prices are read from GET /api/products (D1-backed) — never hardcoded —
 * so a Stripe price change only requires updating the products table.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { Zap, Shield, Star, X, Check } from 'lucide-react'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import {
  createCheckoutSession, getShieldUpgradePrice, getProducts,
  type TrialStatus, type ShieldUpgradePrice, type Product,
} from '../../lib/api'

type PurchasableSku = 'COMPLETE' | 'COMPLETE_AI' | 'SHIELD_AI' | 'AI_UPGRADE'

function formatGBP(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`
}

const COMPARE_ROWS: {
  feature:    string
  complete:   boolean
  completeAi: boolean
  shieldAi:   boolean
}[] = [
  { feature: 'Chore tracking & ledger',            complete: true,  completeAi: true,  shieldAi: true  },
  { feature: 'Child 6-digit code access',           complete: true,  completeAi: true,  shieldAi: true  },
  { feature: 'Savings goals (Savings Grove)',       complete: true,  completeAi: true,  shieldAi: true  },
  { feature: 'Payment bridge (Monzo etc.)',         complete: true,  completeAi: true,  shieldAi: true  },
  { feature: 'Rate Guide benchmarking',             complete: true,  completeAi: true,  shieldAi: true  },
  { feature: 'Unlimited children',                  complete: true,  completeAi: true,  shieldAi: true  },
  { feature: 'Parent Insights AI',                  complete: false, completeAi: true,  shieldAi: true  },
  { feature: 'AI Mentor (financial coaching)',      complete: false, completeAi: true,  shieldAi: true  },
  { feature: 'Learning Lab (20-module curriculum)', complete: false, completeAi: true,  shieldAi: true  },
  { feature: 'Tamper-evident PDF exports',          complete: false, completeAi: false, shieldAi: true  },
  { feature: 'Digital tamper-seal per export',      complete: false, completeAi: false, shieldAi: true  },
  { feature: 'Co-parent verified sharing',          complete: false, completeAi: false, shieldAi: true  },
  { feature: 'Court-admissible hashed records',     complete: false, completeAi: false, shieldAi: true  },
]

function ComparePlansModal({ prices, onClose }: { prices: Record<string, number>; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null)
  useFocusTrap(panelRef, true)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Compare plans"
        tabIndex={-1}
        className="w-full max-w-lg bg-[var(--color-surface)] rounded-t-2xl pb-safe overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
        style={{ maxHeight: '85vh' }}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[var(--color-border)]">
          <div>
            <p className="text-[1rem] font-bold text-[var(--color-text)]">Compare Plans</p>
            <p className="text-[0.75rem] text-[var(--color-text-muted)] mt-0.5">All plans are one-time purchases — no renewals.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="tap-target-44 w-8 h-8 rounded-full flex items-center justify-center bg-[var(--color-surface-alt)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>

        <div className="grid grid-cols-4 gap-0 px-5 pt-3 pb-2">
          <div className="col-span-1" />
          <div className="text-center">
            <p className="text-[0.625rem] font-bold text-teal-600 uppercase tracking-wide">Core</p>
            <p className="text-[0.6875rem] font-semibold text-[var(--color-text)] mt-0.5">{formatGBP(prices.COMPLETE ?? 0)}</p>
          </div>
          <div className="text-center">
            <p className="text-[0.625rem] font-bold text-violet-600 uppercase tracking-wide">Core AI</p>
            <p className="text-[0.6875rem] font-semibold text-[var(--color-text)] mt-0.5">{formatGBP(prices.COMPLETE_AI ?? 0)}</p>
          </div>
          <div className="text-center">
            <p className="text-[0.625rem] font-bold text-amber-600 uppercase tracking-wide">Shield</p>
            <p className="text-[0.6875rem] font-semibold text-[var(--color-text)] mt-0.5">{formatGBP(prices.SHIELD_AI ?? 0)}</p>
          </div>
        </div>

        <div className="overflow-y-auto px-5 pb-6" style={{ maxHeight: '55vh' }}>
          {COMPARE_ROWS.map(row => (
            <div key={row.feature} className="grid grid-cols-4 gap-0 py-2.5 border-b border-[var(--color-border)] last:border-0 items-center">
              <p className="col-span-1 text-[0.75rem] text-[var(--color-text)] pr-2 leading-snug">{row.feature}</p>
              <div className="flex justify-center">
                {row.complete
                  ? <Check size={14} className="text-teal-500" />
                  : <span className="w-3.5 h-px bg-[var(--color-border)] block mt-1.5" />}
              </div>
              <div className="flex justify-center">
                {row.completeAi
                  ? <Check size={14} className="text-violet-500" />
                  : <span className="w-3.5 h-px bg-[var(--color-border)] block mt-1.5" />}
              </div>
              <div className="flex justify-center">
                {row.shieldAi
                  ? <Check size={14} className="text-amber-500" />
                  : <span className="w-3.5 h-px bg-[var(--color-border)] block mt-1.5" />}
              </div>
            </div>
          ))}

          <div className="mt-4 space-y-2">
            <p className="text-[0.6875rem] text-amber-700 bg-amber-50 rounded-lg px-3 py-2 leading-relaxed font-medium">
              UK family mediation averages £140/hr. Morechard Shield AI is a one-time {formatGBP(prices.SHIELD_AI ?? 0)}.
            </p>
            <p className="text-[0.6875rem] text-violet-700 bg-violet-50 rounded-lg px-3 py-2 leading-relaxed font-medium">
              Already on Core? Add AI Mentor + Learning Lab for {formatGBP(prices.AI_UPGRADE ?? 0)} — one-time.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

interface Props {
  trial:              TrialStatus | null
  shieldUpgradePrice: ShieldUpgradePrice | null
  onBuyError:         (message: string) => void
}

export function PlanPurchaseCards({ trial, shieldUpgradePrice, onBuyError }: Props) {
  const [products, setProducts]       = useState<Record<string, Product> | null>(null)
  const [buying, setBuying]           = useState<string | null>(null)
  const [showCompare, setShowCompare] = useState(false)
  const [resolvedShieldPrice, setResolvedShieldPrice] = useState<ShieldUpgradePrice | null>(shieldUpgradePrice)
  const [shieldPriceFetching, setShieldPriceFetching] = useState(false)

  useEffect(() => {
    getProducts()
      .then(({ products: rows }) => {
        setProducts(Object.fromEntries(rows.map(p => [p.sku, p])))
      })
      .catch(() => setProducts({}))
  }, [])

  useEffect(() => {
    if (resolvedShieldPrice !== null || shieldPriceFetching || !trial || trial.has_shield) return
    setShieldPriceFetching(true)
    getShieldUpgradePrice()
      .then(setResolvedShieldPrice)
      .catch(() => {})
      .finally(() => setShieldPriceFetching(false))
  }, [trial, resolvedShieldPrice, shieldPriceFetching])

  const handlePurchase = useCallback(async (sku: PurchasableSku) => {
    setBuying(sku)
    try {
      const { url } = await createCheckoutSession(sku)
      window.location.href = url
    } catch {
      onBuyError('Could not start checkout — please try again')
    } finally {
      setBuying(null)
    }
  }, [onBuyError])

  const hasBase   = trial?.has_lifetime_license
  const hasAi     = trial?.has_ai_mentor
  const hasShield = trial?.has_shield

  const shieldDelta        = resolvedShieldPrice?.delta ?? products?.SHIELD_AI?.unit_amount_pence ?? 14999
  const shieldPaid         = resolvedShieldPrice?.already_paid ?? 0
  const shieldIsUpgrade    = shieldPaid > 0
  const shieldPriceUnknown = resolvedShieldPrice === null && (hasBase || hasAi)

  if (hasShield) return null

  if (!products) {
    return (
      <div className="space-y-3">
        <div className="h-48 rounded-xl bg-[var(--color-surface-alt)] animate-pulse" />
      </div>
    )
  }

  const completePrice   = products.COMPLETE?.unit_amount_pence ?? 0
  const completeAiPrice = products.COMPLETE_AI?.unit_amount_pence ?? 0
  const shieldFullPrice = products.SHIELD_AI?.unit_amount_pence ?? 14999
  const upgradePrice    = products.AI_UPGRADE?.unit_amount_pence ?? 0

  return (
    <>
      {showCompare && (
        <ComparePlansModal
          prices={{ COMPLETE: completePrice, COMPLETE_AI: completeAiPrice, SHIELD_AI: shieldFullPrice, AI_UPGRADE: upgradePrice }}
          onClose={() => setShowCompare(false)}
        />
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <p className="text-[0.6875rem] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
            {hasBase ? 'Upgrade' : 'Choose a plan'}
          </p>
          <button
            type="button"
            onClick={() => setShowCompare(true)}
            className="tap-target-44 text-[0.75rem] font-semibold text-[var(--brand-primary)] px-2.5 py-1 rounded-lg border border-[var(--brand-primary)] hover:bg-[color-mix(in_srgb,var(--brand-primary)_10%,transparent)] active:bg-[color-mix(in_srgb,var(--brand-primary)_18%,transparent)] active:scale-[0.97] transition-all duration-150"
          >
            Compare all plans
          </button>
        </div>

        {!hasBase && !hasAi && !hasShield && (
          <div className="rounded-2xl border-2 border-[var(--color-border)] overflow-hidden relative">
            <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full bg-teal-500 text-white text-[0.625rem] font-bold">
              <Star size={9} />
              Starter
            </div>
            <div className="px-4 pt-4 pb-3">
              <div className="flex items-start gap-3">
                <span className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center bg-[color-mix(in_srgb,var(--brand-primary)_12%,transparent)] text-[var(--brand-primary)]">
                  <Shield size={16} />
                </span>
                <div className="flex-1 min-w-0 pr-16">
                  <p className="text-[0.9375rem] font-bold text-[var(--color-text)]">Morechard Core</p>
                  <p className="text-[1.25rem] font-bold text-[var(--brand-primary)] leading-none mt-0.5">
                    {formatGBP(completePrice)}
                    <span className="text-[0.75rem] font-semibold text-[var(--color-text-muted)] ml-1">one-time</span>
                  </p>
                </div>
              </div>
              <ul className="mt-3 space-y-1.5">
                {[
                  'Full chore tracker, ledger & savings goals',
                  'Unlimited children',
                  'Rate Guide benchmarking',
                  'Payment bridge (Monzo, Revolut, PayPal)',
                  `AI Mentor + Learning Lab available — just ${formatGBP(completeAiPrice - completePrice)} more with Core AI (${formatGBP(completeAiPrice)})`,
                ].map(item => (
                  <li key={item} className="flex items-start gap-2">
                    <Check size={12} className="shrink-0 text-teal-500 mt-0.5" />
                    <span className="text-[0.75rem] text-[var(--color-text-muted)] leading-snug">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="px-4 pb-4">
              <button
                type="button"
                disabled={buying !== null}
                onClick={() => handlePurchase('COMPLETE')}
                className="w-full py-2.5 rounded-xl bg-[var(--brand-primary)] text-white text-[0.8125rem] font-bold hover:opacity-90 active:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {buying === 'COMPLETE' ? 'Loading…' : `Get Morechard Core — ${formatGBP(completePrice)}`}
              </button>
            </div>
          </div>
        )}

        {!hasAi && (
          <div className="rounded-2xl border-2 border-violet-300 overflow-hidden bg-[color-mix(in_srgb,#7c3aed_4%,var(--color-surface))] relative">
            {!hasBase && (
              <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-500 text-white text-[0.625rem] font-bold">
                <Star size={9} />
                Best Value
              </div>
            )}
            <div className="px-4 pt-4 pb-3">
              <div className="flex items-start gap-3">
                <span className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center bg-violet-100 text-violet-600">
                  <Zap size={16} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[0.9375rem] font-bold text-[var(--color-text)]">Morechard Core AI</p>
                    <span className="px-1.5 py-0.5 rounded-md bg-violet-100 text-violet-700 text-[0.625rem] font-bold uppercase tracking-wide">Includes AI</span>
                  </div>
                  <p className="text-[1.25rem] font-bold text-violet-600 leading-none mt-0.5">
                    {formatGBP(hasBase ? upgradePrice : completeAiPrice)}
                    <span className="text-[0.75rem] font-semibold text-[var(--color-text-muted)] ml-1">one-time</span>
                  </p>
                  {hasBase && (
                    <p className="text-[0.6875rem] text-violet-600 font-medium mt-1">
                      Upgrade price — you already have Morechard Core
                    </p>
                  )}
                </div>
              </div>
              <ul className="mt-3 space-y-1.5">
                {(hasBase ? [
                  'AI Mentor — personalised financial coaching for your children',
                  'Learning Lab — 20-module financial literacy curriculum',
                  'Lessons grounded in your children\'s real earnings data',
                ] : [
                  'Everything in Morechard Core',
                  'AI Mentor — personalised financial coaching for your children',
                  'Learning Lab — 20-module financial literacy curriculum',
                  'Lessons grounded in your children\'s real earnings data',
                ]).map(item => (
                  <li key={item} className="flex items-start gap-2">
                    <Check size={12} className="shrink-0 text-violet-500 mt-0.5" />
                    <span className="text-[0.75rem] text-[var(--color-text-muted)] leading-snug">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="px-4 pb-4">
              <button
                type="button"
                disabled={buying !== null}
                onClick={() => handlePurchase(hasBase ? 'AI_UPGRADE' : 'COMPLETE_AI')}
                className="w-full py-2.5 rounded-xl bg-violet-500 text-white text-[0.8125rem] font-bold hover:opacity-90 active:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {buying === 'COMPLETE_AI' || buying === 'AI_UPGRADE'
                  ? 'Loading…'
                  : hasBase
                  ? `Add AI Mentor + Learning Lab — ${formatGBP(upgradePrice)}`
                  : `Get Morechard Core AI — ${formatGBP(completeAiPrice)}`}
              </button>
            </div>
          </div>
        )}

        <div className="rounded-2xl border-2 border-amber-300 overflow-hidden bg-[color-mix(in_srgb,#f59e0b_6%,var(--color-surface))] shadow-[0_0_0_4px_color-mix(in_srgb,#f59e0b_8%,transparent)]">
          <div className="px-4 pt-4 pb-3">
            <div className="flex items-start gap-3">
              <span className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center bg-amber-100 text-amber-600">
                <Shield size={16} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[0.9375rem] font-bold text-[var(--color-text)]">Morechard Shield AI</p>
                  <span className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 text-[0.625rem] font-bold uppercase tracking-wide">Professional</span>
                </div>
                <p className="text-[1.25rem] font-bold text-amber-600 leading-none mt-0.5">
                  {shieldPriceUnknown && shieldPriceFetching
                    ? <span className="text-[0.875rem] font-semibold text-amber-400">Loading price…</span>
                    : shieldPriceUnknown
                    ? <span className="text-[0.875rem] font-semibold text-amber-400">Price unavailable</span>
                    : formatGBP(shieldDelta)}
                  {!shieldPriceUnknown && (
                    <span className="text-[0.75rem] font-semibold text-[var(--color-text-muted)] ml-1">one-time</span>
                  )}
                  {shieldIsUpgrade && (
                    <span className="ml-2 text-[0.75rem] font-semibold text-[var(--color-text-muted)] line-through">
                      {formatGBP(shieldFullPrice)}
                    </span>
                  )}
                </p>
                <p className="text-[0.6875rem] text-amber-700 font-medium mt-1">
                  {shieldPriceUnknown
                    ? 'Reload the page to see your upgrade price'
                    : shieldIsUpgrade
                    ? `You've already paid ${formatGBP(shieldPaid)} — only the difference is charged`
                    : 'Less than one hour of professional mediation'}
                </p>
              </div>
            </div>
            <p className="mt-2 mb-3 text-[0.75rem] text-[var(--color-text-muted)] leading-snug">
              Every export carries a cryptographic hash. If a single figure is altered after export, the seal breaks — proving the record is authentic to solicitors and mediators.
            </p>
            <ul className="space-y-1.5">
              {[
                'Everything in Morechard Core AI',
                'Court-admissible hashed PDF exports',
                'Digital tamper-seal on every export',
                'Share verified records with co-parents, mediators, or solicitors',
              ].map(item => (
                <li key={item} className="flex items-start gap-2">
                  <Check size={12} className="shrink-0 text-amber-500 mt-0.5" />
                  <span className="text-[0.75rem] text-[var(--color-text-muted)] leading-snug">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="px-4 pb-4">
            <button
              type="button"
              disabled={buying !== null || shieldPriceUnknown}
              onClick={() => handlePurchase('SHIELD_AI')}
              className="w-full py-2.5 rounded-xl bg-amber-500 text-white text-[0.8125rem] font-bold hover:bg-amber-600 hover:shadow-[0_4px_14px_color-mix(in_srgb,#f59e0b_40%,transparent)] active:bg-amber-700 active:scale-[0.98] active:shadow-none transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {buying === 'SHIELD_AI'
                ? 'Loading…'
                : shieldPriceUnknown
                ? (shieldPriceFetching ? 'Fetching price…' : 'Price unavailable — reload to retry')
                : shieldIsUpgrade
                ? `Upgrade to Morechard Shield AI — ${formatGBP(shieldDelta)}`
                : `Get Morechard Shield AI — ${formatGBP(shieldFullPrice)}`}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
