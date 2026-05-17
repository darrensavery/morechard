import { useState, useEffect, useCallback } from 'react'
import type { BalanceSummary, Goal } from '../../lib/api'
import { getBalance, getGoals, formatCurrency } from '../../lib/api'
import { ChildHistoryTab } from './ChildHistoryTab'

interface Props {
  familyId: string
  childId:  string
  currency: string
}

export function ChildMoneyTab({ familyId, childId, currency }: Props) {
  const [balance, setBalance] = useState<BalanceSummary | null>(null)
  const [goals,   setGoals]   = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [b, g] = await Promise.all([
        getBalance(familyId, childId),
        getGoals(familyId, childId).then(r => r.goals).catch(() => [] as Goal[]),
      ])
      setBalance(b)
      setGoals(g)
    } catch { /* silently degrade */ }
    finally { setLoading(false) }
  }, [familyId, childId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const t = setInterval(load, 30_000)
    const onVisible = () => { if (!document.hidden) load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVisible) }
  }, [load])

  const saved = goals
    .filter(g => g.status === 'ACTIVE' || !g.status)
    .reduce((s, g) => s + (g.current_saved_pence ?? 0), 0)

  return (
    <div className="space-y-4">

      {/* Balance hero */}
      <div className="bg-[var(--color-surface)] rounded-2xl shadow-sm border-t-[3px] border-t-[var(--brand-primary)] border border-[var(--color-border)] p-4">
        <div className="text-[12px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">
          Available to spend
        </div>
        <div className="text-[46px] font-extrabold text-[var(--color-text)] leading-none tracking-tight tabular-nums">
          {loading || !balance ? '£—' : formatCurrency(balance.available, currency)}
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

      {/* Breakdown grid */}
      <div className="grid grid-cols-3 gap-2.5">
        <StatCard
          label="Earned"
          value={loading || !balance ? '—' : formatCurrency(balance.earned, currency)}
          tone="brand"
        />
        <StatCard
          label="Spent"
          value={loading || !balance ? '—' : formatCurrency(balance.spent, currency)}
          tone="muted"
        />
        <StatCard
          label="Saved"
          value={loading ? '—' : formatCurrency(saved, currency)}
          tone="muted"
        />
      </div>

      {/* Money-focused history */}
      <ChildHistoryTab
        familyId={familyId}
        childId={childId}
        currency={currency}
        variant="money"
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
      <p className={`text-[15px] font-extrabold tabular-nums ${tone === 'brand' ? 'text-[var(--brand-primary)]' : 'text-[var(--color-text)]'}`}>
        {value}
      </p>
    </div>
  )
}
