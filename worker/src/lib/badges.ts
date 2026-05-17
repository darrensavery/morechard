export const BADGE_THRESHOLDS = {
  // Consistency track (streak-based — uses longestStreak so badges survive a broken streak)
  CONSISTENCY_SEED:    { streak: 7 },
  CONSISTENCY_SAPLING: { streak: 30 },
  CONSISTENCY_OAK:     { streak: 90 },
  // Effort track (total approved chores)
  EFFORT_SEED:    { chores: 25 },
  EFFORT_SAPLING: { chores: 50 },
  EFFORT_OAK:     { chores: 100 },
  // Saver track
  SAVER_SEED:    { goals: 1 },
  SAVER_SAPLING: { savedPence: 10000 }, // £100 saved total
  SAVER_OAK:     { goals: 3 },
  // Scholar track (lessons completed)
  SCHOLAR_SEED:    { lessons: 1 },
  SCHOLAR_SAPLING: { lessons: 5 },
  SCHOLAR_OAK:     { lessons: 10 },
  // Landmark track (first-time milestones)
  LANDMARK_SEED:    { isFirstChore: true },
  LANDMARK_SAPLING: { isFirstPayday: true },
  LANDMARK_OAK:     { streak: 365 },
} as const

export type BadgeKey = keyof typeof BADGE_THRESHOLDS

interface BadgeInput {
  earnedBadgeKeys:       string[]
  currentStreak:         number
  longestStreak:         number
  totalApprovedChores:   number
  totalGoalsCompleted:   number
  totalSavedPence:       number
  totalLessonsCompleted: number
  isFirstPayday:         boolean
  isFirstChore:          boolean
}

export function badgesToAward(input: BadgeInput): BadgeKey[] {
  const { earnedBadgeKeys, longestStreak, totalApprovedChores,
          totalGoalsCompleted, totalSavedPence, totalLessonsCompleted,
          isFirstPayday, isFirstChore } = input

  const earned = new Set(earnedBadgeKeys)
  const toAward: BadgeKey[] = []

  function check(key: BadgeKey, met: boolean) {
    if (met && !earned.has(key)) toAward.push(key)
  }

  // longestStreak used so badges survive a broken current streak
  check('CONSISTENCY_SEED',    longestStreak >= 7)
  check('CONSISTENCY_SAPLING', longestStreak >= 30)
  check('CONSISTENCY_OAK',     longestStreak >= 90)

  check('EFFORT_SEED',    totalApprovedChores >= 25)
  check('EFFORT_SAPLING', totalApprovedChores >= 50)
  check('EFFORT_OAK',     totalApprovedChores >= 100)

  check('SAVER_SEED',    totalGoalsCompleted >= 1)
  check('SAVER_SAPLING', totalSavedPence >= 10000)
  check('SAVER_OAK',     totalGoalsCompleted >= 3)

  check('SCHOLAR_SEED',    totalLessonsCompleted >= 1)
  check('SCHOLAR_SAPLING', totalLessonsCompleted >= 5)
  check('SCHOLAR_OAK',     totalLessonsCompleted >= 10)

  check('LANDMARK_SEED',    isFirstChore)
  check('LANDMARK_SAPLING', isFirstPayday)
  check('LANDMARK_OAK',     longestStreak >= 365)

  return toAward
}

// ---- D1 helpers ----

export interface BadgeStats {
  earnedBadgeKeys:       string[]
  totalApprovedChores:   number
  totalGoalsCompleted:   number
  totalSavedPence:       number
  totalLessonsCompleted: number
}

export async function getBadgeStats(db: D1Database, childId: string): Promise<BadgeStats> {
  const [badgeRows, choreCount, goalCount, savedRow, lessonCount] = await Promise.all([
    db.prepare(`SELECT badge_key FROM child_badges WHERE child_id = ?`)
      .bind(childId).all<{ badge_key: string }>(),
    db.prepare(
      `SELECT COUNT(*) AS total FROM completions WHERE child_id = ? AND status = 'completed'`
    ).bind(childId).first<{ total: number }>(),
    db.prepare(
      `SELECT COUNT(*) AS total FROM grove_plans WHERE child_id = ? AND status = 'completed'`
    ).bind(childId).first<{ total: number }>(),
    db.prepare(
      `SELECT COALESCE(SUM(target_amount), 0) AS total FROM grove_plans WHERE child_id = ? AND status = 'completed'`
    ).bind(childId).first<{ total: number }>(),
    db.prepare(
      `SELECT COUNT(*) AS total FROM lesson_completions WHERE child_id = ?`
    ).bind(childId).first<{ total: number }>(),
  ])

  return {
    earnedBadgeKeys:       (badgeRows.results ?? []).map(r => r.badge_key),
    totalApprovedChores:   choreCount?.total ?? 0,
    totalGoalsCompleted:   goalCount?.total ?? 0,
    totalSavedPence:       savedRow?.total ?? 0,
    totalLessonsCompleted: lessonCount?.total ?? 0,
  }
}

export async function insertBadges(
  db: D1Database,
  childId: string,
  badgeKeys: BadgeKey[],
  nanoidFn: () => string,
): Promise<void> {
  if (badgeKeys.length === 0) return
  const now = new Date().toISOString()
  const stmts = badgeKeys.map(key =>
    db.prepare(
      `INSERT OR IGNORE INTO child_badges (id, child_id, badge_key, earned_at) VALUES (?, ?, ?, ?)`
    ).bind(nanoidFn(), childId, key, now)
  )
  await db.batch(stmts)
}
