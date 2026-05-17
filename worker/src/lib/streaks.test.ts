import { describe, it, expect } from 'vitest'
import { todayUTC, consistencyScore, buildStreakEvent, buildMissEvent } from './streaks'

describe('todayUTC', () => {
  it('returns a YYYY-MM-DD string', () => {
    expect(todayUTC()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('consistencyScore', () => {
  it('returns 0 when no scheduled days', () => {
    expect(consistencyScore(0, 0)).toBe(0)
  })
  it('returns 100 when all days kept', () => {
    expect(consistencyScore(7, 7)).toBe(100)
  })
  it('rounds to nearest integer', () => {
    expect(consistencyScore(2, 3)).toBe(67)
  })
})

describe('buildStreakEvent', () => {
  it('returns KEPT event when all chores are done and day is consecutive', () => {
    const event = buildStreakEvent({
      allChoresDone: true,
      date: '2026-05-17',
      state: { current_streak: 6, longest_streak: 6, grace_days_remaining: 0, last_kept_date: '2026-05-16', last_checked_date: '2026-05-16' },
    })
    expect(event?.type).toBe('KEPT')
    expect(event?.newStreak).toBe(7)
  })

  it('returns null when not all chores are done yet', () => {
    const event = buildStreakEvent({
      allChoresDone: false,
      date: '2026-05-17',
      state: { current_streak: 6, longest_streak: 6, grace_days_remaining: 0, last_kept_date: '2026-05-16', last_checked_date: '2026-05-16' },
    })
    expect(event).toBeNull()
  })

  it('returns null when date is already recorded', () => {
    const event = buildStreakEvent({
      allChoresDone: true,
      date: '2026-05-17',
      state: { current_streak: 7, longest_streak: 7, grace_days_remaining: 0, last_kept_date: '2026-05-17', last_checked_date: '2026-05-17' },
    })
    expect(event).toBeNull()
  })

  it('resets streak to 1 when there is a gap (no grace)', () => {
    const event = buildStreakEvent({
      allChoresDone: true,
      date: '2026-05-17',
      state: { current_streak: 6, longest_streak: 6, grace_days_remaining: 0, last_kept_date: '2026-05-14', last_checked_date: '2026-05-16' },
    })
    expect(event?.type).toBe('KEPT')
    expect(event?.newStreak).toBe(1)
  })

  it('grants a grace day at every 7th consecutive kept day (up to cap 2)', () => {
    const event = buildStreakEvent({
      allChoresDone: true,
      date: '2026-05-17',
      state: { current_streak: 6, longest_streak: 6, grace_days_remaining: 1, last_kept_date: '2026-05-16', last_checked_date: '2026-05-16' },
    })
    expect(event?.newStreak).toBe(7)
    expect(event?.newGrace).toBe(2) // was 1, +1 at 7-day milestone
  })

  it('does not exceed grace cap of 2', () => {
    const event = buildStreakEvent({
      allChoresDone: true,
      date: '2026-05-17',
      state: { current_streak: 6, longest_streak: 6, grace_days_remaining: 2, last_kept_date: '2026-05-16', last_checked_date: '2026-05-16' },
    })
    expect(event?.newGrace).toBe(2) // capped
  })
})

describe('buildMissEvent', () => {
  it('returns null when already checked today', () => {
    const event = buildMissEvent({
      hadScheduledChores: true,
      today: '2026-05-17',
      state: { current_streak: 5, longest_streak: 5, grace_days_remaining: 0, last_kept_date: '2026-05-14', last_checked_date: '2026-05-17' },
    })
    expect(event).toBeNull()
  })

  it('returns null when no scheduled chores yesterday', () => {
    const event = buildMissEvent({
      hadScheduledChores: false,
      today: '2026-05-17',
      state: { current_streak: 5, longest_streak: 5, grace_days_remaining: 0, last_kept_date: '2026-05-14', last_checked_date: '2026-05-16' },
    })
    expect(event).toBeNull()
  })

  it('returns null when last_kept_date is yesterday (no miss)', () => {
    const event = buildMissEvent({
      hadScheduledChores: true,
      today: '2026-05-17',
      state: { current_streak: 5, longest_streak: 5, grace_days_remaining: 0, last_kept_date: '2026-05-16', last_checked_date: '2026-05-16' },
    })
    expect(event).toBeNull()
  })

  it('returns GRACE_USED and decrements grace when grace > 0', () => {
    const event = buildMissEvent({
      hadScheduledChores: true,
      today: '2026-05-17',
      state: { current_streak: 5, longest_streak: 5, grace_days_remaining: 1, last_kept_date: '2026-05-14', last_checked_date: '2026-05-16' },
    })
    expect(event?.type).toBe('GRACE_USED')
    expect(event?.newStreak).toBe(5) // preserved
    expect(event?.newGrace).toBe(0) // decremented
  })

  it('returns MISSED with newStreak 0 when no grace', () => {
    const event = buildMissEvent({
      hadScheduledChores: true,
      today: '2026-05-17',
      state: { current_streak: 5, longest_streak: 5, grace_days_remaining: 0, last_kept_date: '2026-05-14', last_checked_date: '2026-05-16' },
    })
    expect(event?.type).toBe('MISSED')
    expect(event?.newStreak).toBe(0)
  })
})
