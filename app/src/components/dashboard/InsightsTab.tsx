/**
 * InsightsTab — Parent behavioural dashboard for each child.
 *
 * Sections:
 *  1. Child selector (only when family has > 1 child)
 *  2. Period toggle (This week / This month / All time)
 *  3. Balance status bar (available | saved in goals | lifetime earned)
 *  4. Mentor Executive Briefing slot
 *     - Discovery phase: "Observation Phase: Initializing" with coaching strategy
 *     - Live phase: reserved AI slot placeholder
 *  5. Three SVG arc gauges: Responsibility · Consistency · Savings Orientation
 *  6. Effort Preference habit tag
 *  7. Supporting stats row
 */

import { useState, useEffect, useCallback } from 'react'
import type { ChildRecord, InsightsData } from '../../lib/api'
import { getInsights, formatCurrency } from '../../lib/api'
import { AvatarSVG } from '../../lib/avatars'

interface Props {
  familyId: string
  child: ChildRecord
  children: ChildRecord[]
}

type Period = 'week' | 'month' | 'all'

const PERIOD_LABELS: Record<Period, string> = {
  week:  'This week',
  month: 'This month',
  all:   'All time',
}

export function InsightsTab({ familyId, child, children }: Props) {
  const [selectedChild, setSelectedChild] = useState<ChildRecord>(child)
  const [period,        setPeriod]        = useState<Period>('week')
  const [data,          setData]          = useState<InsightsData | null>(null)
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState(false)

  // Sync if parent switches active child via header selector
  useEffect(() => { setSelectedChild(child) }, [child.id])

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const d = await getInsights(familyId, selectedChild.id, period)
      setData(d)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [familyId, selectedChild.id, period])

  useEffect(() => { load() }, [load])

  const currency = 'GBP' // TODO: pull from child record once currency is stored there

  return (
    <div className="space-y-4">

      {/* ── Child selector (multi-child families only) ── */}
      {children.length > 1 && (
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5">
          {children.map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedChild(c)}
              className={`
                shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-semibold
                transition-colors duration-100 cursor-pointer border
                ${selectedChild.id === c.id
                  ? 'bg-[var(--brand-primary)] text-white border-[var(--brand-primary)]'
                  : 'bg-[var(--color-surface)] text-[var(--color-text-muted)] border-[var(--color-border)] hover:opacity-80'}
              `}
            >
              <AvatarSVG id={c.avatar_id ?? 'bot'} size={18} />
              {c.display_name}
            </button>
          ))}
        </div>
      )}

      {/* ── Period toggle ── */}
      <div className="flex gap-1.5 bg-[var(--color-surface-alt)] rounded-xl p-1">
        {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`
              flex-1 py-1.5 rounded-lg text-[12px] font-semibold transition-all duration-150 cursor-pointer
              ${period === p
                ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}
            `}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingSkeleton />
      ) : error ? (
        <ErrorState onRetry={load} />
      ) : data ? (
        <InsightsDashboard data={data} child={selectedChild} currency={currency} />
      ) : null}
    </div>
  )
}

// ── InsightsDashboard ────────────────────────────────────────────────────────

function InsightsDashboard({
  data, child, currency,
}: { data: InsightsData; child: ChildRecord; currency: string }) {
  return (
    <div className="space-y-4">

      {/* ── Balance status bar ── */}
      <BalanceBar data={data} currency={currency} />

      {/* ── Mentor Executive Briefing ── */}
      <BriefingSlot data={data} child={child} />

      {/* ── KPI gauges ── */}
      <div className="grid grid-cols-3 gap-2.5">
        <GaugeCard
          label="Responsibility"
          sublabel="First-time pass rate"
          value={data.is_discovery_phase ? null : data.first_time_pass_rate}
          isDiscovery={data.is_discovery_phase}
          color="var(--brand-primary)"
        />
        <GaugeCard
          label="Consistency"
          sublabel="Weekly volume stability"
          value={data.is_discovery_phase ? null : data.consistency_score}
          isDiscovery={data.is_discovery_phase}
          color="#f59e0b"
        />
        <GaugeCard
          label="Savings"
          sublabel="Of disposable income saved"
          value={data.is_discovery_phase ? null : data.savings_consistency}
          isDiscovery={data.is_discovery_phase}
          color="#8b5cf6"
        />
      </div>

      {/* ── Effort preference tag ── */}
      {!data.is_discovery_phase && data.effort_preference && (
        <EffortTag preference={data.effort_preference} child={child} />
      )}

      {/* ── Supporting stats ── */}
      <SupportingStats data={data} currency={currency} />
    </div>
  )
}

// ── Balance status bar ────────────────────────────────────────────────────────

function BalanceBar({ data, currency }: { data: InsightsData; currency: string }) {
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl px-4 py-3.5">
      <div className="grid grid-cols-3 divide-x divide-[var(--color-border)]">
        <BalanceStat
          label="Available"
          value={formatCurrency(data.available_balance_pence, currency)}
          valueColor="text-[var(--brand-primary)]"
          position="left"
        />
        <BalanceStat
          label="In goals"
          value={formatCurrency(data.goals_locked_pence, currency)}
          valueColor="text-[#8b5cf6]"
          position="center"
        />
        <BalanceStat
          label="Lifetime earned"
          value={formatCurrency(data.lifetime_earned_pence, currency)}
          valueColor="text-[var(--color-text)]"
          position="right"
        />
      </div>
    </div>
  )
}

function BalanceStat({
  label, value, valueColor, position,
}: { label: string; value: string; valueColor: string; position: 'left' | 'center' | 'right' }) {
  const align = position === 'left' ? 'items-start' : position === 'right' ? 'items-end' : 'items-center'
  return (
    <div className={`flex flex-col gap-0.5 px-3 first:pl-0 last:pr-0 ${align}`}>
      <span className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{label}</span>
      <span className={`text-[15px] font-extrabold tabular-nums leading-tight ${valueColor}`}>{value}</span>
    </div>
  )
}

// ── Mentor Executive Briefing slot ───────────────────────────────────────────

function BriefingSlot({ data, child }: { data: InsightsData; child: ChildRecord }) {
  const name = child.display_name.split(' ')[0]

  if (data.is_discovery_phase) {
    return (
      <div className="relative bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl overflow-hidden">
        {/* Subtle teal gradient accent */}
        <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-[var(--brand-primary)] via-[color-mix(in_srgb,var(--brand-primary)_60%,transparent)] to-transparent" />

        <div className="px-4 pt-4 pb-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">
                  Mentor Executive Briefing
                </span>
              </div>
              <p className="text-[15px] font-extrabold text-[var(--color-text)] tracking-tight">
                Observation Phase: Initializing
              </p>
            </div>
            <div className="shrink-0 w-9 h-9 rounded-xl bg-[color-mix(in_srgb,var(--brand-primary)_10%,transparent)] border border-[color-mix(in_srgb,var(--brand-primary)_20%,transparent)] flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--brand-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 6v6l4 2"/>
              </svg>
            </div>
          </div>

          {/* Body */}
          <p className="text-[13px] text-[var(--color-text-muted)] leading-relaxed mb-3">
            To provide high-integrity coaching, I need to observe{' '}
            <strong className="text-[var(--color-text)] font-semibold">{name}'s</strong>{' '}
            work and spending habits for a few more days. To accelerate this process, I recommend:
          </p>

          {/* Recommendations */}
          <div className="space-y-2">
            <RecommendationRow
              icon={
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                </svg>
              }
              text="Assign 2–3 small daily tasks to establish a Consistency baseline."
            />
            <RecommendationRow
              icon={
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
                </svg>
              }
              text={`Encourage ${name} to set their first Savings Goal to define their Planning Horizon.`}
            />
            <RecommendationRow
              icon={
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              }
              text="Enable Photo Proof on at least one task to begin measuring Responsibility."
            />
          </div>

          {/* Progress indicator */}
          <div className="mt-3.5 pt-3 border-t border-[var(--color-border)]">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] text-[var(--color-text-muted)]">Baseline progress</span>
              <span className="text-[11px] font-semibold text-[var(--color-text)] tabular-nums">
                {data.all_time_completed} / 3 tasks
              </span>
            </div>
            <div className="h-1.5 bg-[var(--color-surface-alt)] rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--brand-primary)] rounded-full transition-all duration-700"
                style={{ width: `${Math.min(100, Math.round((data.all_time_completed / 3) * 100))}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Live phase — reserved AI slot
  return (
    <div className="relative bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-[var(--brand-primary)] via-[color-mix(in_srgb,var(--brand-primary)_60%,transparent)] to-transparent" />
      <div className="px-4 pt-4 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="inline-block w-2 h-2 rounded-full bg-[var(--brand-primary)]" />
              <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">
                Mentor Executive Briefing
              </span>
            </div>
            <p className="text-[15px] font-extrabold text-[var(--color-text)] tracking-tight">
              AI Analysis
            </p>
            <p className="text-[12px] text-[var(--color-text-muted)] mt-0.5 leading-relaxed">
              Personalised coaching insights are coming in Phase 5. The data is live — the mentor is being trained.
            </p>
          </div>
          <div className="shrink-0 w-9 h-9 rounded-xl bg-[color-mix(in_srgb,var(--brand-primary)_10%,transparent)] border border-[color-mix(in_srgb,var(--brand-primary)_20%,transparent)] flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--brand-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a10 10 0 1 0 10 10"/><path d="M12 6v6l4 2"/><path d="M22 2 12 12"/>
            </svg>
          </div>
        </div>
      </div>
    </div>
  )
}

function RecommendationRow({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="shrink-0 w-5 h-5 rounded-md bg-[color-mix(in_srgb,var(--brand-primary)_12%,transparent)] text-[var(--brand-primary)] flex items-center justify-center mt-0.5">
        {icon}
      </div>
      <p className="text-[12px] text-[var(--color-text)] leading-relaxed">{text}</p>
    </div>
  )
}

// ── Gauge card ────────────────────────────────────────────────────────────────

function GaugeCard({
  label, sublabel, value, isDiscovery, color,
}: {
  label: string
  sublabel: string
  value: number | null
  isDiscovery: boolean
  color: string
}) {
  const size   = 72
  const stroke = 7
  const r      = (size - stroke) / 2
  const cx     = size / 2
  const cy     = size / 2

  // Arc spans 220° (from 160° to 380° = 20° past horizontal right)
  const arcDeg = 220
  const startAngle = 160
  const endAngle   = startAngle + arcDeg

  function polarToCartesian(angle: number) {
    const rad = (angle * Math.PI) / 180
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad),
    }
  }

  function arcPath(fromDeg: number, toDeg: number) {
    const s   = polarToCartesian(fromDeg)
    const e   = polarToCartesian(toDeg)
    const lg  = toDeg - fromDeg > 180 ? 1 : 0
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${lg} 1 ${e.x} ${e.y}`
  }

  const filled    = isDiscovery || value === null ? 0 : value
  const fillEnd   = startAngle + (arcDeg * filled) / 100
  const trackPath = arcPath(startAngle, endAngle)
  const fillPath  = filled > 0 ? arcPath(startAngle, fillEnd) : null

  const displayText = isDiscovery
    ? value === null
      ? '—'
      : `${value}%`
    : value === null
    ? '—'
    : `${value}%`

  const subText = isDiscovery ? 'Establishing...' : value === null ? 'No data' : null

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 flex flex-col items-center gap-1.5">
      {/* SVG arc */}
      <div className="relative">
        <svg width={size} height={size * 0.72} viewBox={`0 0 ${size} ${size}`} style={{ overflow: 'visible' }}>
          {/* Track */}
          <path
            d={trackPath}
            fill="none"
            stroke="var(--color-surface-alt)"
            strokeWidth={stroke}
            strokeLinecap="round"
          />
          {/* Fill */}
          {fillPath && !isDiscovery && (
            <path
              d={fillPath}
              fill="none"
              stroke={color}
              strokeWidth={stroke}
              strokeLinecap="round"
            />
          )}
        </svg>
        {/* Centre label */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className={`text-[14px] font-extrabold tabular-nums leading-none ${isDiscovery ? 'text-[var(--color-text-muted)]' : 'text-[var(--color-text)]'}`}
            style={!isDiscovery && value !== null ? { color } : undefined}
          >
            {displayText}
          </span>
        </div>
      </div>

      {/* Labels */}
      <div className="text-center">
        <p className="text-[11px] font-bold text-[var(--color-text)] leading-tight">{label}</p>
        <p className="text-[9.5px] text-[var(--color-text-muted)] leading-tight mt-0.5">
          {subText ?? sublabel}
        </p>
      </div>
    </div>
  )
}

// ── Effort preference tag ─────────────────────────────────────────────────────

function EffortTag({
  preference, child,
}: { preference: 'high_yield' | 'steady'; child: ChildRecord }) {
  const name = child.display_name.split(' ')[0]

  const config = preference === 'high_yield'
    ? {
        label: 'Preference: High-Yield / Heavy',
        description: `${name} consistently chooses higher-value tasks. Strong work ethic; monitor for burnout on streaks.`,
        bgColor: 'bg-[color-mix(in_srgb,#f59e0b_10%,transparent)]',
        borderColor: 'border-[color-mix(in_srgb,#f59e0b_25%,transparent)]',
        textColor: 'text-amber-700 dark:text-amber-400',
        dotColor: 'bg-amber-400',
      }
    : {
        label: 'Preference: Steady / Light',
        description: `${name} gravitates toward routine, lower-value tasks. Reliable baseline; consider introducing stretch goals.`,
        bgColor: 'bg-[color-mix(in_srgb,var(--brand-primary)_8%,transparent)]',
        borderColor: 'border-[color-mix(in_srgb,var(--brand-primary)_20%,transparent)]',
        textColor: 'text-[var(--brand-primary)]',
        dotColor: 'bg-[var(--brand-primary)]',
      }

  return (
    <div className={`${config.bgColor} ${config.borderColor} border rounded-2xl px-4 py-3 flex items-start gap-3`}>
      <div className={`shrink-0 w-2 h-2 rounded-full ${config.dotColor} mt-1.5`} />
      <div>
        <p className={`text-[12px] font-bold ${config.textColor} uppercase tracking-wide`}>{config.label}</p>
        <p className="text-[12px] text-[var(--color-text-muted)] mt-0.5 leading-relaxed">{config.description}</p>
      </div>
    </div>
  )
}

// ── Supporting stats ─────────────────────────────────────────────────────────

function SupportingStats({ data, currency }: { data: InsightsData; currency: string }) {
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--color-border)]">
        <p className="text-[11px] font-bold text-[var(--color-text-muted)] uppercase tracking-wide">Period breakdown</p>
      </div>
      <div className="grid grid-cols-2 divide-x divide-y divide-[var(--color-border)]">
        <StatCell label="Tasks completed" value={String(data.tasks_completed)} />
        <StatCell label="Needed revision"  value={String(data.tasks_revised)} />
        <StatCell label="Earned"           value={formatCurrency(data.total_earned_pence, currency)} />
        <StatCell label="Spent"            value={formatCurrency(data.total_spent_pence,  currency)} />
        <StatCell label="Saved to goals"   value={formatCurrency(data.total_saved_pence,  currency)} />
        <StatCell label="Planning horizon" value={data.planning_horizon !== null ? `${data.planning_horizon}%` : '—'} />
      </div>
    </div>
  )
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-3">
      <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">{label}</p>
      <p className="text-[15px] font-bold text-[var(--color-text)] tabular-nums mt-0.5">{value}</p>
    </div>
  )
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl h-16" />
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl h-44" />
      <div className="grid grid-cols-3 gap-2.5">
        {[0, 1, 2].map(i => (
          <div key={i} className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl h-28" />
        ))}
      </div>
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl h-24" />
    </div>
  )
}

// ── Error state ───────────────────────────────────────────────────────────────

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-8 text-center space-y-3">
      <p className="text-[14px] font-semibold text-[var(--color-text)]">Unable to load insights</p>
      <p className="text-[12px] text-[var(--color-text-muted)]">Check your connection and try again.</p>
      <button
        onClick={onRetry}
        className="text-[13px] font-semibold text-[var(--brand-primary)] hover:underline cursor-pointer"
      >
        Retry
      </button>
    </div>
  )
}
