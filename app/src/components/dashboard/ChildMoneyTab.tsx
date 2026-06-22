import { useState, useEffect, useCallback } from 'react'
import type { BalanceSummary, Goal, SpendingRecord } from '../../lib/api'
import { getBalance, getGoals, getSpending, formatCurrency } from '../../lib/api'
import { spendCategoryHeading } from '../../lib/spendCategories'
import { ChildHistoryTab } from './ChildHistoryTab'
import { SpendGuideSheet } from './SpendGuideSheet'

interface Props {
  familyId: string
  childId:  string
  currency: string
}

function fmtDate(epochSec: number): string {
  return new Date(epochSec * 1000).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

export function ChildMoneyTab({ familyId, childId, currency }: Props) {
  const [balance,  setBalance]  = useState<BalanceSummary | null>(null)
  const [goals,    setGoals]    = useState<Goal[]>([])
  const [spending, setSpending] = useState<SpendingRecord[]>([])
  const [loading,  setLoading]  = useState(true)
  const [logOpen,  setLogOpen]  = useState(false)

  // `silent` skips the loading swap so background polls refresh data in place
  // without flashing the balance hero back to "£—" every 30s.
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const [b, g, s] = await Promise.all([
        getBalance(familyId, childId),
        getGoals(familyId, childId).then(r => r.goals).catch(() => [] as Goal[]),
        getSpending(familyId, childId).then(r => r.spending).catch(() => [] as SpendingRecord[]),
      ])
      setBalance(b)
      setGoals(g)
      setSpending(s)
    } catch { /* silently degrade */ }
    finally { setLoading(false) }
  }, [familyId, childId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const t = setInterval(() => load(true), 30_000)
    const onVisible = () => { if (!document.hidden) load(true) }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVisible) }
  }, [load])

  const saved = goals
    .filter(g => g.status === 'ACTIVE' || !g.status)
    .reduce((s, g) => s + (g.current_saved_pence ?? 0), 0)

  const symbol = currency === 'GBP' ? '£' : currency === 'USD' ? '$' : 'zł'

  function handleSaved() {
    setLogOpen(false)
    load()
  }

  return (
    <div className="space-y-4">

      {/* Balance hero */}
      <div className="bg-[var(--color-surface)] rounded-2xl card-depth border-t-[3px] border-t-[var(--brand-primary)] border border-[var(--color-border)] p-4">
        <div className="text-[12px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">
          Available to spend
        </div>
        <div className="text-[46px] font-extrabold text-[var(--color-text)] leading-none tracking-tight tabular-nums">
          {loading || !balance ? `${symbol}—` : formatCurrency(balance.available, currency)}
        </div>
        {(balance?.pending ?? 0) > 0 && (
          <p className="text-[13px] text-[var(--color-text-muted)] mt-2">
            Pending approval:{' '}
            <strong className="text-amber-500 tabular-nums">
              {formatCurrency(balance!.pending, currency)}
            </strong>
          </p>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-2.5">
        <StatCard label="Earned" value={loading || !balance ? '—' : formatCurrency(balance.earned, currency)} tone="brand" />
        <StatCard label="Spent"  value={loading || !balance ? '—' : formatCurrency(balance.spent,  currency)} tone="muted" />
        <StatCard label="Saved"  value={loading             ? '—' : formatCurrency(saved,           currency)} tone="muted" />
      </div>

      {/* Log a spend CTA */}
      <button
        type="button"
        onClick={() => setLogOpen(true)}
        className="w-full flex items-center justify-center gap-2.5 bg-[var(--color-surface)] border-2 border-dashed border-[var(--brand-primary)]/40 hover:border-[var(--brand-primary)] hover:bg-[color-mix(in_srgb,var(--brand-primary)_6%,transparent)] rounded-2xl py-4 transition-all cursor-pointer group"
      >
        <span className="text-[22px] group-hover:scale-110 transition-transform">💸</span>
        <span className="text-[15px] font-bold text-[var(--brand-primary)]">Log a spend</span>
      </button>

      {/* Spending history */}
      {spending.length > 0 && (
        <SpendingHistory spending={spending} currency={currency} />
      )}

      {/* Earnings history (chore completions) */}
      <ChildHistoryTab
        familyId={familyId}
        childId={childId}
        currency={currency}
        variant="money"
      />

      <SpendGuideSheet
        open={logOpen}
        familyId={familyId}
        currency={currency}
        onClose={() => setLogOpen(false)}
        onSaved={handleSaved}
      />
    </div>
  )
}

function StatCard({ label, value, tone }: { label: string; value: string; tone: 'brand' | 'muted' }) {
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-3 py-3 text-center">
      <p className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">
        {label}
      </p>
      <p className={`text-[15px] font-extrabold tabular-nums ${tone === 'brand' ? 'text-[var(--brand-accent)]' : 'text-[var(--color-text)]'}`}>
        {value}
      </p>
    </div>
  )
}

function SpendingHistory({ spending, currency }: { spending: SpendingRecord[]; currency: string }) {
  const [open, setOpen] = useState(true)
  const total = spending.reduce((s, r) => s + r.amount, 0)

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-[color-mix(in_srgb,var(--color-surface-alt)_70%,var(--color-border))] hover:bg-[color-mix(in_srgb,var(--color-surface-alt)_55%,var(--color-border))] transition-colors cursor-pointer border-b border-[var(--color-border)]"
      >
        <div className="flex items-center gap-2">
          <svg
            width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            className={`text-[var(--color-text-muted)] transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
          >
            <path d="M9 18l6-6-6-6"/>
          </svg>
          <span className="text-[13px] font-bold text-[var(--color-text)]">My spending</span>
          <span className="text-[11px] text-[var(--color-text-muted)]">
            ({spending.length} item{spending.length !== 1 ? 's' : ''})
          </span>
        </div>
        <span className="text-[13px] font-bold tabular-nums text-red-400">
          −{formatCurrency(total, currency)}
        </span>
      </button>

      {open && (
        <div className="divide-y divide-[var(--color-border)]">
          {spending.map(record => (
            <div key={record.id} className="px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-[var(--color-text)] truncate">
                  {record.title}
                </p>
                <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5 flex items-center gap-1.5 flex-wrap">
                  <span className="rounded-full bg-[var(--color-surface-alt)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-text-muted)]">
                    {spendCategoryHeading(record.category)}
                  </span>
                  {fmtDate(record.spent_at)}
                  {record.note && (
                    <span className="italic">· {record.note}</span>
                  )}
                </p>
              </div>
              <span className="text-[14px] font-bold tabular-nums text-red-400 shrink-0">
                −{formatCurrency(record.amount, record.currency)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
