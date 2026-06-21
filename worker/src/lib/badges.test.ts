import { describe, it, expect } from 'vitest'
import { badgesToAward } from './badges'

// Base input with every threshold un-met; spread + override per test.
const ZERO = {
  earnedBadgeKeys: [] as string[],
  currentStreak: 0,
  longestStreak: 0,
  totalApprovedChores: 0,
  totalGoalsCompleted: 0,
  totalSavedPence: 0,
  totalLessonsCompleted: 0,
  totalPayouts: 0,
}

describe('badgesToAward', () => {
  it('returns no badges when counts are all zero', () => {
    expect(badgesToAward({ ...ZERO })).toEqual([])
  })

  it('awards CONSISTENCY_SEED at 7-day longest streak', () => {
    const result = badgesToAward({ ...ZERO, currentStreak: 7, longestStreak: 7 })
    expect(result).toContain('CONSISTENCY_SEED')
  })

  it('does not re-award already earned badges', () => {
    const result = badgesToAward({
      ...ZERO,
      earnedBadgeKeys: ['CONSISTENCY_SEED'],
      currentStreak: 30,
      longestStreak: 30,
    })
    expect(result).not.toContain('CONSISTENCY_SEED')
    expect(result).toContain('CONSISTENCY_SAPLING')
  })

  it('awards EFFORT_SEED at 25 approved chores', () => {
    const result = badgesToAward({ ...ZERO, totalApprovedChores: 25 })
    expect(result).toContain('EFFORT_SEED')
  })

  it('awards LANDMARK_SEED on first approved chore', () => {
    const result = badgesToAward({ ...ZERO, totalApprovedChores: 1 })
    expect(result).toContain('LANDMARK_SEED')
  })

  it('self-heals LANDMARK_SEED for a child already past the milestone', () => {
    // Child has 5 approved chores but never received the badge (first
    // approval predated the award logic). Threshold check awards it now.
    const result = badgesToAward({ ...ZERO, totalApprovedChores: 5 })
    expect(result).toContain('LANDMARK_SEED')
  })

  it('awards LANDMARK_SAPLING on first payout', () => {
    const result = badgesToAward({ ...ZERO, totalPayouts: 1 })
    expect(result).toContain('LANDMARK_SAPLING')
  })

  it('self-heals LANDMARK_SAPLING when payouts already exist', () => {
    const result = badgesToAward({ ...ZERO, totalPayouts: 3 })
    expect(result).toContain('LANDMARK_SAPLING')
  })

  it('awards SAVER_SAPLING at 10000 pence (£100) saved', () => {
    const result = badgesToAward({
      ...ZERO,
      earnedBadgeKeys: ['SAVER_SEED'],
      totalGoalsCompleted: 1,
      totalSavedPence: 10000,
    })
    expect(result).toContain('SAVER_SAPLING')
  })

  it('uses longestStreak for consistency badges (survives broken streak)', () => {
    const result = badgesToAward({
      ...ZERO,
      currentStreak: 0, // streak broken
      longestStreak: 7, // but longest was 7
    })
    expect(result).toContain('CONSISTENCY_SEED')
  })
})
