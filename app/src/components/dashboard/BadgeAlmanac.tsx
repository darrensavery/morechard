// app/src/components/dashboard/BadgeAlmanac.tsx
import { cn } from '../../lib/utils'
import { BADGE_THRESHOLDS, type BadgeKey } from '../../../../shared/badges'

// Who you BECOME, not what you must do — narrative framing
const BADGE_NARRATIVE: Record<BadgeKey, { call: string; identity: string }> = {
  CONSISTENCY_SEED:    { call: 'Show up every day',             identity: 'Creature of habit' },
  CONSISTENCY_SAPLING: { call: 'Make it a full month',          identity: 'Habits become who you are' },
  CONSISTENCY_OAK:     { call: 'Three months straight',         identity: 'Absolutely unstoppable' },
  EFFORT_SEED:         { call: 'Get 25 chores done',            identity: 'Hard work pays off' },
  EFFORT_SAPLING:      { call: 'Keep going — 50 chores',        identity: 'The most reliable person' },
  EFFORT_OAK:          { call: 'One hundred chores',            identity: 'A legend in this house' },
  SAVER_SEED:          { call: 'Complete your first goal',      identity: 'Goals are your thing' },
  SAVER_SAPLING:       { call: 'Save £100 in total',            identity: 'You think before you spend' },
  SAVER_OAK:           { call: 'Finish three saving goals',     identity: 'Goals are your superpower' },
  SCHOLAR_SEED:        { call: 'Finish your first lesson',      identity: 'Knowledge is power' },
  SCHOLAR_SAPLING:     { call: 'Complete 5 lessons',            identity: 'You love to learn' },
  SCHOLAR_OAK:         { call: 'Complete 10 lessons',           identity: 'Money expert status' },
  LANDMARK_SEED:       { call: 'Get your first chore approved', identity: 'Every legend starts here' },
  LANDMARK_SAPLING:    { call: 'Receive your first payout',     identity: "You've earned real money" },
  LANDMARK_OAK:        { call: 'A whole year of showing up',    identity: 'Truly extraordinary' },
}

// Per-badge display metadata with unique emoji per badge
const BADGE_META: Record<BadgeKey, {
  label: string
  orchardLabel: string
  pillar: number
  emoji: string
  earnedLabel: string
}> = {
  CONSISTENCY_SEED:    { label: 'Consistency I',   orchardLabel: 'Seedling — Consistency', pillar: 3, emoji: '🌱', earnedLabel: 'Creature of habit' },
  CONSISTENCY_SAPLING: { label: 'Consistency II',  orchardLabel: 'Sapling — Consistency',  pillar: 3, emoji: '🌿', earnedLabel: 'Thirty-day legend' },
  CONSISTENCY_OAK:     { label: 'Consistency III', orchardLabel: 'Oak — Consistency',       pillar: 3, emoji: '🌳', earnedLabel: 'Three-month champion' },
  EFFORT_SEED:         { label: 'Effort I',         orchardLabel: 'Seedling — Effort',       pillar: 1, emoji: '💪', earnedLabel: 'Hard worker' },
  EFFORT_SAPLING:      { label: 'Effort II',        orchardLabel: 'Sapling — Effort',        pillar: 1, emoji: '⚡', earnedLabel: 'Reliable & strong' },
  EFFORT_OAK:          { label: 'Effort III',       orchardLabel: 'Oak — Effort',            pillar: 1, emoji: '🏆', earnedLabel: 'House legend' },
  SAVER_SEED:          { label: 'Saver I',          orchardLabel: 'Seedling — Saver',        pillar: 2, emoji: '🎯', earnedLabel: 'Goal-getter' },
  SAVER_SAPLING:       { label: 'Saver II',         orchardLabel: 'Sapling — Saver',         pillar: 2, emoji: '💰', earnedLabel: 'Smart spender' },
  SAVER_OAK:           { label: 'Saver III',        orchardLabel: 'Oak — Saver',             pillar: 2, emoji: '🦁', earnedLabel: 'Goal master' },
  SCHOLAR_SEED:        { label: 'Scholar I',        orchardLabel: 'Seedling — Scholar',      pillar: 4, emoji: '📚', earnedLabel: 'Curious learner' },
  SCHOLAR_SAPLING:     { label: 'Scholar II',       orchardLabel: 'Sapling — Scholar',       pillar: 4, emoji: '🧠', earnedLabel: 'Knowledge seeker' },
  SCHOLAR_OAK:         { label: 'Scholar III',      orchardLabel: 'Oak — Scholar',           pillar: 4, emoji: '⭐', earnedLabel: 'Money expert' },
  LANDMARK_SEED:       { label: 'Landmark I',       orchardLabel: 'Seedling — Landmark',     pillar: 5, emoji: '🚀', earnedLabel: 'First step taken' },
  LANDMARK_SAPLING:    { label: 'Landmark II',      orchardLabel: 'Sapling — Landmark',      pillar: 5, emoji: '💎', earnedLabel: 'First payday' },
  LANDMARK_OAK:        { label: 'Landmark III',     orchardLabel: 'Oak — Landmark',          pillar: 5, emoji: '👑', earnedLabel: 'Year-long champion' },
}

const ALL_BADGE_KEYS = Object.keys(BADGE_THRESHOLDS) as BadgeKey[]

interface ProgressInput {
  longestStreak:         number
  totalApprovedChores:   number
  totalGoalsCompleted:   number
  totalSavedPence:       number
  totalLessonsCompleted: number
}

function getProgress(key: BadgeKey, p: ProgressInput): { value: number; max: number } | null {
  const t = BADGE_THRESHOLDS[key]
  if ('isFirstChore' in t)  return { value: p.totalApprovedChores > 0 ? 1 : 0, max: 1 }
  if ('isFirstPayday' in t) return null
  if ('streak' in t)        return { value: p.longestStreak,         max: t.streak }
  if ('chores' in t)        return { value: p.totalApprovedChores,   max: t.chores }
  if ('goals' in t)         return { value: p.totalGoalsCompleted,   max: t.goals }
  if ('savedPence' in t)    return { value: p.totalSavedPence,       max: t.savedPence }
  if ('lessons' in t)       return { value: p.totalLessonsCompleted, max: t.lessons }
  return null
}

function getProgressPct(key: BadgeKey, p: ProgressInput): number {
  const prog = getProgress(key, p)
  if (!prog || prog.max === 0) return 0
  return Math.min(100, Math.round((prog.value / prog.max) * 100))
}

function getNextUp(
  earnedSet: Set<string>,
  progress: ProgressInput,
): { key: BadgeKey; pct: number; remaining: string } | null {
  let best: { key: BadgeKey; pct: number } | null = null
  for (const key of ALL_BADGE_KEYS) {
    if (earnedSet.has(key)) continue
    const pct = getProgressPct(key, progress)
    if (!best || pct > best.pct) best = { key, pct }
  }
  if (!best) return null

  const prog = getProgress(best.key, progress)
  let remaining = ''
  if (prog) {
    const left = prog.max - prog.value
    const t = BADGE_THRESHOLDS[best.key]
    if ('streak' in t)      remaining = `${left} more day${left !== 1 ? 's' : ''}`
    else if ('chores' in t) remaining = `${left} more chore${left !== 1 ? 's' : ''}`
    else if ('goals' in t)  remaining = `${left} more goal${left !== 1 ? 's' : ''}`
    else if ('savedPence' in t) remaining = `£${(left / 100).toFixed(0)} more to save`
    else if ('lessons' in t)    remaining = `${left} more lesson${left !== 1 ? 's' : ''}`
  }

  return { key: best.key, pct: best.pct, remaining }
}

interface Props {
  earnedBadgeKeys: string[]
  progress:        ProgressInput
  appView:         'ORCHARD' | 'CLEAN'
}

export function BadgeAlmanac({ earnedBadgeKeys, progress, appView }: Props) {
  const earnedSet   = new Set(earnedBadgeKeys)
  const earnedCount = earnedBadgeKeys.length
  const nextUp      = getNextUp(earnedSet, progress)

  return (
    <section className="mt-6">

      {/* ── Section header ─────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <h2 className={cn(
          'text-[13px] font-semibold uppercase tracking-widest',
          appView === 'CLEAN' ? 'text-white/40' : 'text-emerald-400/60',
        )}>
          {appView === 'CLEAN' ? 'Trophy Case' : 'Honours Board'}
        </h2>
        {earnedCount > 0 && (
          <span className="text-[11px] font-semibold text-teal-400/70 tabular-nums">
            {earnedCount} / {ALL_BADGE_KEYS.length} earned
          </span>
        )}
      </div>

      {/* ── Next Up hero card ──────────────────────────────── */}
      {nextUp && (
        <div className="badge-next-up rounded-2xl p-4 mb-4 relative overflow-hidden border border-teal-500/25">
          {/* radial glow behind the right edge */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse at 85% 50%, rgba(20,184,166,0.14) 0%, transparent 65%)' }}
          />
          <div className="relative flex items-center gap-3">
            {/* Icon with pulse ring when hot */}
            <div className={cn(
              'w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center text-2xl',
              'bg-teal-500/10',
              nextUp.pct >= 60 ? 'ring-2 ring-teal-400/50 badge-ring-pulse' : 'ring-1 ring-teal-500/20',
            )}>
              {BADGE_META[nextUp.key].emoji}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-teal-400/70 uppercase tracking-wider mb-0.5">
                Next up
              </p>
              <p className="text-[13px] font-bold text-white/90 leading-tight">
                {BADGE_META[nextUp.key][appView === 'CLEAN' ? 'label' : 'orchardLabel']}
              </p>
              <p className="text-[11px] text-white/45 mt-0.5 leading-tight">
                {BADGE_NARRATIVE[nextUp.key].call}
              </p>
            </div>

            <div className="text-right flex-shrink-0">
              <p className="text-[22px] font-bold text-teal-400 tabular-nums leading-none">
                {nextUp.pct}%
              </p>
              {nextUp.remaining && (
                <p className="text-[9px] text-white/30 mt-0.5 leading-tight max-w-[72px] text-right">
                  {nextUp.remaining} to go
                </p>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-3 w-full bg-white/[.06] rounded-full h-1.5">
            <div
              className="h-1.5 rounded-full bg-gradient-to-r from-teal-500 to-emerald-400 transition-all duration-700"
              style={{ width: `${nextUp.pct}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Badge grid ─────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {ALL_BADGE_KEYS.map(key => {
          const earned = earnedSet.has(key)
          const meta   = BADGE_META[key]
          const pct    = earned ? 100 : getProgressPct(key, progress)
          const label  = appView === 'CLEAN' ? meta.label : meta.orchardLabel

          // Visual tier: earned → hot (≥60%) → warm (>0%) → cold (0%)
          const isHot  = !earned && pct >= 60
          const isWarm = !earned && pct > 0 && pct < 60
          const isCold = !earned && pct === 0

          return (
            <div
              key={key}
              className={cn(
                'rounded-2xl p-3 flex flex-col items-center text-center gap-2 transition-all duration-300',
                earned && 'badge-trophy border border-teal-400/35 shadow-[0_0_16px_rgba(20,184,166,0.18)]',
                isHot  && 'bg-white/[.055] border border-teal-500/35 shadow-[0_0_8px_rgba(20,184,166,0.09)]',
                isWarm && 'bg-white/[.04] border border-white/[.08]',
                isCold && 'bg-white/[.02] border border-white/[.04] opacity-50',
              )}
            >
              {/* ── Icon ── */}
              {earned ? (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-500/30 to-emerald-600/20 flex items-center justify-center text-xl shadow-[0_0_12px_rgba(20,184,166,0.25)] badge-icon-shimmer">
                  {meta.emoji}
                </div>
              ) : isHot ? (
                <div className="w-10 h-10 rounded-full bg-teal-500/10 ring-1 ring-teal-400/30 flex items-center justify-center text-xl opacity-50">
                  {meta.emoji}
                </div>
              ) : (
                <div className="w-10 h-10 rounded-full bg-white/[.04] flex items-center justify-center">
                  <span className="text-white/15 text-xl">◌</span>
                </div>
              )}

              {/* ── Label ── */}
              <p className={cn(
                'text-[10px] font-semibold leading-tight',
                earned ? 'text-emerald-300'  :
                isHot  ? 'text-white/65'     :
                isWarm ? 'text-white/38'     :
                         'text-white/20',
              )}>
                {earned ? meta.earnedLabel : label}
              </p>

              {/* ── Sub-text & progress ── */}
              {earned ? (
                <p className="text-[9px] text-teal-400/60 leading-tight font-semibold tracking-wide">
                  ✓ Earned
                </p>
              ) : (
                <>
                  <p className={cn(
                    'text-[9px] leading-tight',
                    isHot ? 'text-white/40' : 'text-white/18',
                  )}>
                    {BADGE_NARRATIVE[key].call}
                  </p>
                  {pct > 0 && (
                    <div className="w-full bg-white/[.06] rounded-full h-1">
                      <div
                        className={cn(
                          'h-1 rounded-full transition-all duration-500',
                          isHot ? 'bg-gradient-to-r from-teal-500 to-emerald-400' : 'bg-teal-500/40',
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Bottom micro-copy when nothing earned yet ──────── */}
      {earnedCount === 0 && (
        <p className="text-[11px] text-white/20 text-center mt-4 leading-relaxed">
          Every chore gets you closer — keep going
        </p>
      )}

    </section>
  )
}
