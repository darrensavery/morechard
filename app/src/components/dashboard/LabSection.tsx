import type { CurrentModule } from '../../lib/api'

const PILLAR_ICONS: Record<string, string> = {
  LABOR_VALUE:           'M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48 2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48 2.83-2.83',
  DELAYED_GRATIFICATION: 'M12 2a10 10 0 1 1 0 20A10 10 0 0 1 12 2zm0 5v5l3 3',
  OPPORTUNITY_COST:      'M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18',
  CAPITAL_MANAGEMENT:    'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17.93V18h-2v1.93C7.06 19.44 4.56 16.94 4.07 14H6v-2H4.07C4.56 9.06 7.06 6.56 10 6.07V8h2V6.07c2.94.49 5.44 2.99 5.93 5.93H16v2h1.93c-.49 2.94-2.99 5.44-5.93 5.93z',
  SOCIAL_RESPONSIBILITY: 'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z',
}

const SKILL_TRACK = [
  { slug: 'patience-tree',      label: 'Patience',   pillar: 'DELAYED_GRATIFICATION' },
  { slug: 'compound-interest',  label: 'Snowball',   pillar: 'CAPITAL_MANAGEMENT'    },
  { slug: 'banking-101',        label: 'Banking',    pillar: 'CAPITAL_MANAGEMENT'    },
  { slug: 'effort-vs-reward',   label: 'Effort',     pillar: 'LABOR_VALUE'           },
  { slug: 'taxes-net-pay',      label: 'Taxes',      pillar: 'LABOR_VALUE'           },
  { slug: 'opportunity-cost',   label: 'Trade-offs', pillar: 'OPPORTUNITY_COST'      },
  { slug: 'the-interest-trap',  label: 'Debt',       pillar: 'CAPITAL_MANAGEMENT'    },
  { slug: 'giving-and-charity', label: 'Giving',     pillar: 'SOCIAL_RESPONSIBILITY' },
]

interface Props {
  childName:      string;
  currentModule:  CurrentModule | null;
  completedSlugs: string[];
  retentionScore: number | null;
}

function PillarIcon({ pillar, size = 16 }: { pillar: string; size?: number }) {
  const d = PILLAR_ICONS[pillar] ?? PILLAR_ICONS.LABOR_VALUE
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="var(--brand-primary)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d={d}/>
    </svg>
  )
}

function LockIcon() {
  return (
    <svg width={8} height={8} viewBox="0 0 24 24" fill="none"
      stroke="var(--color-text-muted)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  )
}

export function LabSection({ childName, currentModule, completedSlugs, retentionScore }: Props) {
  const currentIdx = currentModule ? SKILL_TRACK.findIndex(s => s.slug === currentModule.slug) : -1
  const showUpTo   = Math.min(SKILL_TRACK.length - 1, Math.max(currentIdx, 0) + 2)
  const visibleChips = SKILL_TRACK.slice(0, showUpTo + 1)

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--color-border)]">
        <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wide">
          {childName}'s Toolkit
        </p>
        <span className="text-[8px] font-bold px-2 py-0.5 rounded-full border"
          style={{
            background:  'color-mix(in srgb, var(--brand-primary) 12%, transparent)',
            borderColor: 'color-mix(in srgb, var(--brand-primary) 25%, transparent)',
            color:       'var(--brand-primary)',
          }}>
          Learning Lab
        </span>
      </div>

      {/* Current focus */}
      {currentModule && (
        <div className="flex gap-3 items-start px-4 py-3 border-b border-[var(--color-border)]">
          <div className="relative shrink-0 w-10 h-10">
            <svg width={40} height={40} viewBox="0 0 40 40">
              <circle cx={20} cy={20} r={17} fill="none" stroke="var(--color-border)" strokeWidth={3}/>
              <circle cx={20} cy={20} r={17} fill="none" stroke="var(--brand-accent)" strokeWidth={3}
                strokeDasharray={`${Math.round((currentModule.progress_pct / 100) * 107)} 107`}
                strokeLinecap="round"
                transform="rotate(-90 20 20)"
                strokeOpacity={0.7}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <PillarIcon pillar={currentModule.pillar} size={14}/>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold text-[var(--color-text)] truncate">{currentModule.title}</p>
            <div className="h-1 rounded-full overflow-hidden bg-[var(--color-surface-alt)] my-1">
              <div className="h-full rounded-full"
                style={{
                  width:      `${currentModule.progress_pct}%`,
                  background: 'linear-gradient(90deg, var(--brand-primary), var(--brand-accent))',
                }}/>
            </div>
            <p className="text-[9px] text-[var(--color-text-muted)] leading-snug">
              {childName} is <strong className="text-[var(--brand-primary)]">{currentModule.progress_pct}% through</strong> — one more chore to unlock the next level!
            </p>
          </div>
        </div>
      )}

      {/* Retention score */}
      {retentionScore !== null && (
        <div className="flex items-center gap-2 px-4 py-2 bg-[var(--color-surface-alt)] border-b border-[var(--color-border)]">
          <div className="w-2 h-2 rounded-full bg-[#16a34a] shrink-0"/>
          <p className="text-[9px] text-[var(--color-text-muted)] flex-1 leading-tight">
            Retention — {childName}'s habits are matching what's been learned
          </p>
          <span className="text-[13px] font-extrabold tabular-nums text-[#16a34a]">{retentionScore}%</span>
        </div>
      )}

      {/* Horizontal skill track */}
      <div className="px-4 pt-3 pb-4">
        <p className="text-[8px] font-bold text-[var(--color-text-muted)] uppercase tracking-wide mb-2">
          Skills {childName} is Building
        </p>
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {visibleChips.map(chip => {
            const isDone    = completedSlugs.includes(chip.slug)
            const isCurrent = currentModule?.slug === chip.slug
            const isLocked  = !isDone && !isCurrent

            return (
              <div key={chip.slug} className="flex flex-col items-center gap-1.5 shrink-0" style={{ width: 52 }}>
                <div className="w-9 h-9 rounded-[10px] flex items-center justify-center relative border"
                  style={{
                    borderColor: isDone ? 'var(--brand-primary)' : 'var(--color-border)',
                    background:  isDone ? 'color-mix(in srgb, var(--brand-primary) 10%, var(--color-surface))' : 'var(--color-surface-alt)',
                    opacity:     isLocked ? 0.45 : 1,
                  }}>
                  <PillarIcon pillar={chip.pillar} size={16}/>
                  {isLocked && (
                    <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center"
                      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                      <LockIcon/>
                    </div>
                  )}
                </div>
                <span className="text-[7px] text-center leading-tight"
                  style={{ color: isDone ? 'var(--brand-primary)' : 'var(--color-text-muted)', fontWeight: isDone ? 700 : 400 }}>
                  {chip.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
