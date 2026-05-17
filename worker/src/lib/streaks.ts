export interface StreakState {
  current_streak:       number
  longest_streak:       number
  grace_days_remaining: number
  last_kept_date:       string | null
  last_checked_date:    string | null
}

export interface StreakEvent {
  type:           'KEPT' | 'MISSED' | 'GRACE_USED' | 'REVIVED'
  previousStreak: number
  newStreak:      number
  newGrace:       number
  graceUsed:      boolean
}

export function todayUTC(): string {
  return new Date().toISOString().slice(0, 10)
}

export function previousDay(date: string): string {
  const d = new Date(date)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

export function consistencyScore(keptDays: number, scheduledDays: number): number {
  if (scheduledDays === 0) return 0
  return Math.round((keptDays / scheduledDays) * 100)
}

// Pure function — computes the StreakEvent for a KEPT day without touching D1.
// Returns null if nothing changed (not all done, or already recorded).
export function buildStreakEvent(params: {
  allChoresDone: boolean
  date: string
  state: StreakState
}): StreakEvent | null {
  const { allChoresDone, date, state } = params
  if (!allChoresDone) return null
  if (state.last_kept_date === date) return null // already recorded today

  const prev = state.current_streak
  const yesterday = previousDay(date)
  const isConsecutive = state.last_kept_date === yesterday || (prev === 0 && state.last_kept_date === null)
  const newStreak = isConsecutive ? prev + 1 : 1

  // Grace day earned every 7 consecutive kept days, cap 2
  const graceGain = (newStreak % 7 === 0 && state.grace_days_remaining < 2) ? 1 : 0
  const newGrace = Math.min(2, state.grace_days_remaining + graceGain)

  return {
    type: 'KEPT',
    previousStreak: prev,
    newStreak,
    newGrace,
    graceUsed: false,
  }
}

// Pure function — computes the StreakEvent for a MISSED day.
// Returns null if no miss (streak already up to date or no scheduled chores).
export function buildMissEvent(params: {
  hadScheduledChores: boolean
  today: string
  state: StreakState
}): StreakEvent | null {
  const { hadScheduledChores, today, state } = params

  if (state.last_checked_date === today) return null
  if (!hadScheduledChores) return null
  // If last kept date is today or yesterday, no miss
  if (state.last_kept_date === today) return null
  if (state.last_kept_date === previousDay(today)) return null
  if (state.current_streak === 0) return null // nothing to lose

  const prev = state.current_streak

  if (state.grace_days_remaining > 0) {
    return {
      type: 'GRACE_USED',
      previousStreak: prev,
      newStreak: prev,
      newGrace: state.grace_days_remaining - 1,
      graceUsed: true,
    }
  }

  return {
    type: 'MISSED',
    previousStreak: prev,
    newStreak: 0,
    newGrace: state.grace_days_remaining,
    graceUsed: false,
  }
}

// ---- D1 helpers ----

export async function getStreakState(db: D1Database, childId: string): Promise<StreakState> {
  const row = await db.prepare(
    `SELECT current_streak, longest_streak, grace_days_remaining, last_kept_date, last_checked_date
     FROM child_streaks WHERE child_id = ?`
  ).bind(childId).first<StreakState>()

  return row ?? {
    current_streak: 0,
    longest_streak: 0,
    grace_days_remaining: 0,
    last_kept_date: null,
    last_checked_date: null,
  }
}

export async function saveStreakEvent(
  db: D1Database,
  childId: string,
  event: StreakEvent,
  date: string,
): Promise<void> {
  const now = new Date().toISOString()

  if (event.type === 'KEPT') {
    const currentState = await getStreakState(db, childId)
    const longest = Math.max(event.newStreak, currentState.longest_streak)

    await db.prepare(`
      INSERT INTO child_streaks
        (child_id, current_streak, longest_streak, grace_days_remaining, last_kept_date, last_checked_date, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(child_id) DO UPDATE SET
        current_streak       = excluded.current_streak,
        longest_streak       = excluded.longest_streak,
        grace_days_remaining = excluded.grace_days_remaining,
        last_kept_date       = excluded.last_kept_date,
        last_checked_date    = excluded.last_checked_date,
        updated_at           = excluded.updated_at
    `).bind(childId, event.newStreak, longest, event.newGrace, date, date, now).run()
  } else {
    // MISSED or GRACE_USED — update current streak and grace, advance check date
    await db.prepare(`
      INSERT INTO child_streaks
        (child_id, current_streak, longest_streak, grace_days_remaining, last_kept_date, last_checked_date, updated_at)
      VALUES (?, ?, 0, ?, NULL, ?, ?)
      ON CONFLICT(child_id) DO UPDATE SET
        current_streak       = excluded.current_streak,
        grace_days_remaining = excluded.grace_days_remaining,
        last_checked_date    = excluded.last_checked_date,
        updated_at           = excluded.updated_at
    `).bind(childId, event.newStreak, event.newGrace, date, now).run()
  }
}

export async function allScheduledChoresDone(db: D1Database, childId: string, date: string): Promise<boolean> {
  const result = await db.prepare(`
    SELECT COUNT(DISTINCT chore_id) AS total,
           COUNT(DISTINCT CASE WHEN status = 'completed' THEN chore_id END) AS done
    FROM completions
    WHERE child_id = ?
      AND date(submitted_at, 'unixepoch') = ?
  `).bind(childId, date).first<{ total: number; done: number }>()

  if (!result || result.total === 0) return false
  return result.done >= result.total
}

export async function hadScheduledChores(db: D1Database, childId: string, date: string): Promise<boolean> {
  const result = await db.prepare(
    `SELECT COUNT(*) AS total FROM completions WHERE child_id = ? AND date(submitted_at, 'unixepoch') = ?`
  ).bind(childId, date).first<{ total: number }>()
  return (result?.total ?? 0) > 0
}

export async function getConsistencyScore(db: D1Database, childId: string): Promise<number> {
  const cutoffEpoch = Math.floor(Date.now() / 1000) - 30 * 86400

  const [scheduledResult, keptResult] = await Promise.all([
    db.prepare(
      `SELECT COUNT(DISTINCT date(submitted_at, 'unixepoch')) AS total
       FROM completions
       WHERE child_id = ? AND submitted_at >= ?`
    ).bind(childId, cutoffEpoch).first<{ total: number }>(),
    db.prepare(`
      SELECT COUNT(*) AS total FROM (
        SELECT date(submitted_at, 'unixepoch') AS sub_date
        FROM completions
        WHERE child_id = ? AND submitted_at >= ?
        GROUP BY sub_date
        HAVING COUNT(*) = SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)
          AND COUNT(*) > 0
      )
    `).bind(childId, cutoffEpoch).first<{ total: number }>(),
  ])

  return consistencyScore(keptResult?.total ?? 0, scheduledResult?.total ?? 0)
}
