// app/src/components/dashboard/BadgeAlmanac.tsx
import { cn } from '../../lib/utils'
import { BADGE_THRESHOLDS, type BadgeKey } from '../../../worker/src/lib/badges'

// Badge display metadata — mode-aware labels and unlock hints
const BADGE_META: Record<BadgeKey, { label: string; orchardLabel: string; pillar: number }> = {
  CONSISTENCY_SEED:    { label: 'Consistency I',    orchardLabel: 'Seedling — Consistency',    pillar: 3 },
  CONSISTENCY_SAPLING: { label: 'Consistency II',   orchardLabel: 'Sapling — Consistency',     pillar: 3 },
  CONSISTENCY_OAK:     { label: 'Consistency III',  orchardLabel: 'Oak — Consistency',          pillar: 3 },
  EFFORT_SEED:         { label: 'Effort I',          orchardLabel: 'Seedling — Effort',          pillar: 1 },
  EFFORT_SAPLING:      { label: 'Effort II',         orchardLabel: 'Sapling — Effort',           pillar: 1 },
  EFFORT_OAK:          { label: 'Effort III',        orchardLabel: 'Oak — Effort',               pillar: 1 },
  SAVER_SEED:          { label: 'Saver I',           orchardLabel: 'Seedling — Saver',           pillar: 2 },
  SAVER_SAPLING:       { label: 'Saver II',          orchardLabel: 'Sapling — Saver',            pillar: 2 },
  SAVER_OAK:           { label: 'Saver III',         orchardLabel: 'Oak — Saver',                pillar: 2 },
  SCHOLAR_SEED:        { label: 'Scholar I',         orchardLabel: 'Seedling — Scholar',         pillar: 4 },
  SCHOLAR_SAPLING:     { label: 'Scholar II',        orchardLabel: 'Sapling — Scholar',          pillar: 4 },
  SCHOLAR_OAK:         { label: 'Scholar III',       orchardLabel: 'Oak — Scholar',              pillar: 4 },
  LANDMARK_SEED:       { label: 'Landmark I',        orchardLabel: 'Seedling — Landmark',        pillar: 5 },
  LANDMARK_SAPLING:    { label: 'Landmark II',       orchardLabel: 'Sapling — Landmark',         pillar: 5 },
  LANDMARK_OAK:        { label: 'Landmark III',      orchardLabel: 'Oak — Landmark',             pillar: 5 },
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
  if ('streak' in t)       return { value: p.longestStreak,          max: t.streak }
  if ('chores' in t)       return { value: p.totalApprovedChores,    max: t.chores }
  if ('goals' in t)        return { value: p.totalGoalsCompleted,    max: t.goals }
  if ('savedPence' in t)   return { value: p.totalSavedPence,        max: t.savedPence }
  if ('lessons' in t)      return { value: p.totalLessonsCompleted,  max: t.lessons }
  return null
}

function getUnlockHint(key: BadgeKey): string {
  const t = BADGE_THRESHOLDS[key]
  if ('streak' in t)         return `${t.streak}-day streak`
  if ('chores' in t)         return `${t.chores} approved chores`
  if ('goals' in t)          return `${t.goals} saving goal${t.goals > 1 ? 's' : ''} completed`
  if ('savedPence' in t)     return `£${t.savedPence / 100} total saved`
  if ('lessons' in t)        return `${t.lessons} lesson${t.lessons > 1 ? 's' : ''} completed`
  if ('isFirstChore' in t)   return 'First chore approved'
  if ('isFirstPayday' in t)  return 'First payout received'
  return ''
}

interface Props {
  earnedBadgeKeys: string[]
  progress:        ProgressInput
  appView:         'ORCHARD' | 'CLEAN'
}

export function BadgeAlmanac({ earnedBadgeKeys, progress, appView }: Props) {
  const earnedSet = new Set(earnedBadgeKeys)

  return (
    <section className="mt-6">
      <h2 className={cn(
        'text-[13px] font-semibold uppercase tracking-widest mb-4',
        appView === 'CLEAN' ? 'text-white/40' : 'text-emerald-400/60',
      )}>
        {appView === 'CLEAN' ? 'Badge Record' : 'Your Badges'}
      </h2>
      <div className="grid grid-cols-3 gap-3">
        {ALL_BADGE_KEYS.map(key => {
          const earned = earnedSet.has(key)
          const meta   = BADGE_META[key]
          const prog   = earned ? null : getProgress(key, progress)
          const label  = appView === 'CLEAN' ? meta.label : meta.orchardLabel

          return (
            <div
              key={key}
              className={cn(
                'rounded-2xl p-3 flex flex-col items-center text-center gap-2',
                earned
                  ? 'bg-[#1b2d2e] border border-teal-500/30'
                  : 'bg-white/[.03] border border-white/[.06]',
              )}
            >
              {earned ? (
                <div className="w-10 h-10 rounded-full bg-teal-500/20 flex items-center justify-center text-xl">
                  {key.endsWith('_SEED') ? '🌱' : key.endsWith('_SAPLING') ? '🌿' : '🌳'}
                </div>
              ) : (
                <div className="w-10 h-10 rounded-full bg-white/[.04] flex items-center justify-center">
                  <span className="text-white/20 text-xl">◌</span>
                </div>
              )}

              <p className={cn(
                'text-[10px] font-semibold leading-tight',
                earned ? (appView === 'CLEAN' ? 'text-white/80' : 'text-emerald-300') : 'text-white/30',
              )}>
                {label}
              </p>

              {!earned && (
                <>
                  <p className="text-[9px] text-white/25 leading-tight">{getUnlockHint(key)}</p>
                  {prog && (
                    <div className="w-full bg-white/[.06] rounded-full h-1">
                      <div
                        className="bg-teal-500/50 h-1 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, (prog.value / prog.max) * 100)}%` }}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
