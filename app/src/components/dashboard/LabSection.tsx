import { useState } from 'react'
import type { CurrentModule } from '../../lib/api'

const PILLAR_ICONS: Record<string, string> = {
  LABOR_VALUE:           'M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48 2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48 2.83-2.83',
  DELAYED_GRATIFICATION: 'M12 2a10 10 0 1 1 0 20A10 10 0 0 1 12 2zm0 5v5l3 3',
  OPPORTUNITY_COST:      'M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18',
  CAPITAL_MANAGEMENT:    'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17.93V18h-2v1.93C7.06 19.44 4.56 16.94 4.07 14H6v-2H4.07C4.56 9.06 7.06 6.56 10 6.07V8h2V6.07c2.94.49 5.44 2.99 5.93 5.93H16v2h1.93c-.49 2.94-2.99 5.44-5.93 5.93z',
  SOCIAL_RESPONSIBILITY: 'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z',
}

interface SkillModule {
  slug:     string;
  label:    string;
  pillar:   string;
  objective: string;
  outcomes:  string[];
}

const SKILL_TRACK: SkillModule[] = [
  {
    slug:      'patience-tree',
    label:     'Patience',
    pillar:    'DELAYED_GRATIFICATION',
    objective: 'Understand why waiting for something can make it more valuable.',
    outcomes:  [
      'Explain the difference between an impulse purchase and a planned one',
      'Identify a goal they are willing to wait for',
      'Connect saving behaviour to their Savings Grove progress',
    ],
  },
  {
    slug:      'compound-interest',
    label:     'Snowball',
    pillar:    'CAPITAL_MANAGEMENT',
    objective: 'Discover how money grows when it is left to work over time.',
    outcomes:  [
      'Describe compound interest in their own words',
      'Calculate a simple snowball scenario using their own savings',
      'Understand why starting early matters more than starting big',
    ],
  },
  {
    slug:      'banking-101',
    label:     'Banking',
    pillar:    'CAPITAL_MANAGEMENT',
    objective: 'Learn how banks work and what a bank account is for.',
    outcomes:  [
      'Name the difference between a current account and a savings account',
      'Understand what interest rate means on both sides (saving vs. borrowing)',
      'Know why keeping money in a bank is safer than keeping it at home',
    ],
  },
  {
    slug:      'effort-vs-reward',
    label:     'Effort',
    pillar:    'LABOR_VALUE',
    objective: 'Connect the effort put into a task with the reward received.',
    outcomes:  [
      'Rank their own chores by effort and compare to reward amount',
      'Explain why higher-value tasks earn more',
      'Identify one higher-effort chore they could take on',
    ],
  },
  {
    slug:      'taxes-net-pay',
    label:     'Taxes',
    pillar:    'LABOR_VALUE',
    objective: 'Understand that a portion of every pay goes back to the community.',
    outcomes:  [
      'Explain what a tax is and who pays it',
      'Understand the difference between gross and net pay',
      'Name two things taxes are used to fund',
    ],
  },
  {
    slug:      'opportunity-cost',
    label:     'Trade-offs',
    pillar:    'OPPORTUNITY_COST',
    objective: 'Recognise that every choice means giving up something else.',
    outcomes:  [
      'Define opportunity cost in plain language',
      'Give a real example from their own spending decisions',
      'Apply the trade-off question before making a purchase',
    ],
  },
  {
    slug:      'the-interest-trap',
    label:     'Debt',
    pillar:    'CAPITAL_MANAGEMENT',
    objective: 'Learn why borrowing money costs more than it appears.',
    outcomes:  [
      'Explain how interest turns a small debt into a large one',
      'Describe the difference between good debt and bad debt',
      'Identify warning signs of a debt trap',
    ],
  },
  {
    slug:      'giving-and-charity',
    label:     'Giving',
    pillar:    'SOCIAL_RESPONSIBILITY',
    objective: 'Explore how sharing wealth strengthens communities.',
    outcomes:  [
      'Name a cause they care about and explain why',
      'Understand the concept of charitable giving and philanthropy',
      'Decide on a percentage of future earnings they would set aside for giving',
    ],
  },
]

interface Props {
  childName:      string;
  currentModule:  CurrentModule | null;
  completedSlugs: string[];
  retentionScore: number | null;
}

function PillarIcon({ pillar, size = 20 }: { pillar: string; size?: number }) {
  const d = PILLAR_ICONS[pillar] ?? PILLAR_ICONS.LABOR_VALUE
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d={d}/>
    </svg>
  )
}

function ModuleDetailSheet({
  module, status, onClose,
}: {
  module:  SkillModule;
  status:  'completed' | 'current' | 'locked';
  onClose: () => void;
}) {
  const statusColors = {
    completed: { bg: 'color-mix(in srgb, var(--brand-primary) 12%, transparent)', border: 'color-mix(in srgb, var(--brand-primary) 30%, transparent)', text: 'var(--brand-primary)' },
    current:   { bg: 'color-mix(in srgb, #f59e0b 12%, transparent)',              border: 'color-mix(in srgb, #f59e0b 30%, transparent)',              text: '#d97706'             },
    locked:    { bg: 'var(--color-surface-alt)',                                    border: 'var(--color-border)',                                       text: 'var(--color-text-muted)' },
  }[status]

  const statusLabel = { completed: 'Completed', current: 'In Progress', locked: 'Locked' }[status]

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-sm bg-[var(--color-surface)] rounded-2xl overflow-hidden shadow-xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-[var(--color-border)]">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: statusColors.bg, border: `1.5px solid ${statusColors.border}`, color: statusColors.text }}>
              <PillarIcon pillar={module.pillar} size={22}/>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide"
                 style={{ color: statusColors.text }}>{statusLabel}</p>
              <p className="text-[16px] font-extrabold text-[var(--color-text)] leading-snug mt-0.5">{module.label}</p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-muted)] hover:bg-[var(--color-surface-alt)] cursor-pointer shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Objective */}
          <div>
            <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wide mb-1.5">
              Objective
            </p>
            <p className="text-[14px] text-[var(--color-text)] leading-relaxed">{module.objective}</p>
          </div>

          {/* Learning outcomes */}
          <div>
            <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wide mb-2">
              Learning Outcomes
            </p>
            <ul className="space-y-2">
              {module.outcomes.map((outcome, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black mt-0.5"
                    style={{ background: statusColors.bg, color: statusColors.text, border: `1px solid ${statusColors.border}` }}>
                    {i + 1}
                  </span>
                  <p className="text-[13px] text-[var(--color-text-muted)] leading-relaxed">{outcome}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export function LabSection({ childName, currentModule, completedSlugs, retentionScore }: Props) {
  const [detailSlug, setDetailSlug] = useState<string | null>(null)
  const detailModule = detailSlug ? SKILL_TRACK.find(s => s.slug === detailSlug) : null

  const getStatus = (slug: string): 'completed' | 'current' | 'locked' => {
    if (completedSlugs.includes(slug)) return 'completed'
    if (currentModule?.slug === slug)  return 'current'
    return 'locked'
  }

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
        <p className="text-[12px] font-bold text-[var(--color-text)]">
          {childName}'s Learning Lab
        </p>
        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full border"
          style={{
            background:  'color-mix(in srgb, var(--brand-primary) 12%, transparent)',
            borderColor: 'color-mix(in srgb, var(--brand-primary) 25%, transparent)',
            color:       'var(--brand-primary)',
          }}>
          {completedSlugs.length}/{SKILL_TRACK.length} modules
        </span>
      </div>

      {/* Current module progress bar */}
      {currentModule && (
        <div className="px-4 py-3 border-b border-[var(--color-border)]">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[12px] font-semibold text-[var(--color-text)]">
              Now learning: <span className="font-bold">{currentModule.title}</span>
            </p>
            <span className="text-[11px] font-bold tabular-nums"
              style={{ color: '#d97706' }}>
              {currentModule.progress_pct}%
            </span>
          </div>
          <div className="h-2 rounded-full overflow-hidden bg-[var(--color-surface-alt)]">
            <div className="h-full rounded-full transition-all duration-500"
              style={{
                width:      `${currentModule.progress_pct}%`,
                background: 'linear-gradient(90deg, var(--brand-primary), var(--brand-accent))',
              }}/>
          </div>
        </div>
      )}

      {/* Full curriculum carousel */}
      <div className="px-4 pt-3 pb-4">
        <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wide mb-3">
          Full Curriculum — tap any module to see details
        </p>
        <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
          {SKILL_TRACK.map(chip => {
            const status = getStatus(chip.slug)
            const isDone    = status === 'completed'
            const isCurrent = status === 'current'
            const isLocked  = status === 'locked'

            const cardBg     = isDone    ? 'color-mix(in srgb, var(--brand-primary) 10%, var(--color-surface))'
                             : isCurrent ? 'color-mix(in srgb, #f59e0b 10%, var(--color-surface))'
                             : 'var(--color-surface-alt)'
            const cardBorder = isDone    ? 'var(--brand-primary)'
                             : isCurrent ? '#f59e0b'
                             : 'var(--color-border)'
            const iconColor  = isDone    ? 'var(--brand-primary)'
                             : isCurrent ? '#d97706'
                             : 'var(--color-text-muted)'

            return (
              <button
                key={chip.slug}
                type="button"
                onClick={() => setDetailSlug(chip.slug)}
                className="flex flex-col items-center gap-2 shrink-0 cursor-pointer transition-opacity hover:opacity-80 active:opacity-60"
                style={{ width: 72 }}
              >
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center relative border-2"
                  style={{
                    borderColor: cardBorder,
                    background:  cardBg,
                    opacity:     isLocked ? 0.5 : 1,
                    color:       iconColor,
                  }}>
                  <PillarIcon pillar={chip.pillar} size={22}/>
                  {isDone && (
                    <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ background: 'var(--brand-primary)', border: '2px solid var(--color-surface)' }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6 9 17l-5-5"/>
                      </svg>
                    </div>
                  )}
                  {isCurrent && (
                    <div className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full"
                      style={{ background: '#f59e0b', border: '2px solid var(--color-surface)' }}>
                      <span className="sr-only">In progress</span>
                    </div>
                  )}
                  {isLocked && (
                    <div className="absolute -bottom-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center"
                      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none"
                        stroke="var(--color-text-muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                      </svg>
                    </div>
                  )}
                </div>
                <span className="text-[11px] text-center leading-tight font-semibold"
                  style={{ color: isDone ? 'var(--brand-primary)' : isCurrent ? '#d97706' : 'var(--color-text-muted)' }}>
                  {chip.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Retention score */}
      {retentionScore !== null && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-[var(--color-surface-alt)] border-t border-[var(--color-border)]">
          <div className="w-2 h-2 rounded-full bg-[#16a34a] shrink-0"/>
          <p className="text-[11px] text-[var(--color-text-muted)] flex-1 leading-tight">
            {childName}'s daily habits reflect what they've learned
          </p>
          <span className="text-[14px] font-extrabold tabular-nums text-[#16a34a]">{retentionScore}%</span>
          <span className="text-[10px] text-[var(--color-text-muted)]">retention</span>
        </div>
      )}

      {/* Module detail sheet */}
      {detailModule && (
        <ModuleDetailSheet
          module={detailModule}
          status={getStatus(detailModule.slug)}
          onClose={() => setDetailSlug(null)}
        />
      )}
    </div>
  )
}
