import { describe, it, expect } from 'vitest'
import { badgesToAward } from './badges'

describe('badgesToAward', () => {
  it('returns no badges when counts are all zero', () => {
    const result = badgesToAward({
      earnedBadgeKeys: [],
      currentStreak: 0,
      longestStreak: 0,
      totalApprovedChores: 0,
      totalGoalsCompleted: 0,
      totalSavedPence: 0,
      totalLessonsCompleted: 0,
      isFirstPayday: false,
      isFirstChore: false,
    })
    expect(result).toEqual([])
  })

  it('awards CONSISTENCY_SEED at 7-day longest streak', () => {
    const result = badgesToAward({
      earnedBadgeKeys: [],
      currentStreak: 7,
      longestStreak: 7,
      totalApprovedChores: 0,
      totalGoalsCompleted: 0,
      totalSavedPence: 0,
      totalLessonsCompleted: 0,
      isFirstPayday: false,
      isFirstChore: false,
    })
    expect(result).toContain('CONSISTENCY_SEED')
  })

  it('does not re-award already earned badges', () => {
    const result = badgesToAward({
      earnedBadgeKeys: ['CONSISTENCY_SEED'],
      currentStreak: 30,
      longestStreak: 30,
      totalApprovedChores: 0,
      totalGoalsCompleted: 0,
      totalSavedPence: 0,
      totalLessonsCompleted: 0,
      isFirstPayday: false,
      isFirstChore: false,
    })
    expect(result).not.toContain('CONSISTENCY_SEED')
    expect(result).toContain('CONSISTENCY_SAPLING')
  })

  it('awards EFFORT_SEED at 25 approved chores', () => {
    const result = badgesToAward({
      earnedBadgeKeys: [],
      currentStreak: 0,
      longestStreak: 0,
      totalApprovedChores: 25,
      totalGoalsCompleted: 0,
      totalSavedPence: 0,
      totalLessonsCompleted: 0,
      isFirstPayday: false,
      isFirstChore: false,
    })
    expect(result).toContain('EFFORT_SEED')
  })

  it('awards LANDMARK_SEED on first chore approval', () => {
    const result = badgesToAward({
      earnedBadgeKeys: [],
      currentStreak: 0,
      longestStreak: 0,
      totalApprovedChores: 1,
      totalGoalsCompleted: 0,
      totalSavedPence: 0,
      totalLessonsCompleted: 0,
      isFirstPayday: false,
      isFirstChore: true,
    })
    expect(result).toContain('LANDMARK_SEED')
  })

  it('awards LANDMARK_SAPLING on first payday', () => {
    const result = badgesToAward({
      earnedBadgeKeys: [],
      currentStreak: 0,
      longestStreak: 0,
      totalApprovedChores: 0,
      totalGoalsCompleted: 0,
      totalSavedPence: 0,
      totalLessonsCompleted: 0,
      isFirstPayday: true,
      isFirstChore: false,
    })
    expect(result).toContain('LANDMARK_SAPLING')
  })

  it('awards SAVER_SAPLING at 10000 pence (£100) saved', () => {
    const result = badgesToAward({
      earnedBadgeKeys: ['SAVER_SEED'],
      currentStreak: 0,
      longestStreak: 0,
      totalApprovedChores: 0,
      totalGoalsCompleted: 1,
      totalSavedPence: 10000,
      totalLessonsCompleted: 0,
      isFirstPayday: false,
      isFirstChore: false,
    })
    expect(result).toContain('SAVER_SAPLING')
  })

  it('uses longestStreak for consistency badges (survives broken streak)', () => {
    const result = badgesToAward({
      earnedBadgeKeys: [],
      currentStreak: 0, // streak broken
      longestStreak: 7, // but longest was 7
      totalApprovedChores: 0,
      totalGoalsCompleted: 0,
      totalSavedPence: 0,
      totalLessonsCompleted: 0,
      isFirstPayday: false,
      isFirstChore: false,
    })
    expect(result).toContain('CONSISTENCY_SEED')
  })
})
