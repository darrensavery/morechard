// app/src/components/dashboard/StreakChip.tsx
import { cn } from '../../lib/utils'

interface Props {
  currentStreak:    number
  graceRemaining:   number
  consistencyScore: number
  appView:          'ORCHARD' | 'CLEAN'
}

export function StreakChip({ currentStreak, graceRemaining, consistencyScore, appView }: Props) {
  const isAmber = currentStreak > 0 && graceRemaining === 0
  const isTeal  = currentStreak > 0 && graceRemaining > 0
  const label   = appView === 'CLEAN' ? 'streak' : 'days in a row'

  return (
    <div className={cn(
      'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-semibold',
      currentStreak === 0
        ? 'bg-white/[.04] text-white/30'
        : isTeal
          ? 'bg-teal-500/15 text-teal-300 border border-teal-500/30'
          : isAmber
            ? 'bg-amber-500/15 text-amber-300 border border-amber-500/20'
            : 'bg-white/[.04] text-white/30',
    )}>
      <span>{currentStreak === 0 ? '—' : '🔥'}</span>
      <span className="tabular-nums">
        {currentStreak === 0 ? 'No streak' : `${currentStreak} ${label}`}
      </span>
      {graceRemaining > 0 && (
        <span className="text-white/40 text-[10px]">
          ({graceRemaining} {appView === 'CLEAN' ? 'grace' : 'rain'})
        </span>
      )}
      {consistencyScore > 0 && (
        <span className={cn(
          'ml-1 text-[10px] tabular-nums',
          consistencyScore >= 80 ? 'text-teal-400' : 'text-white/30',
        )}>
          {consistencyScore}%
        </span>
      )}
    </div>
  )
}
