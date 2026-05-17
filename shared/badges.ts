// Shared badge threshold table — single source of truth for both the
// Cloudflare worker (award logic) and the app (BadgeAlmanac display).
// Zero dependencies on purpose: safe to include from both tsconfig projects.

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
