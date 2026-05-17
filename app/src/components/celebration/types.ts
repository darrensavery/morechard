import type { AppView } from '../../lib/useTone'

export interface MilestoneStage {
  icon:          string
  heading:       string
  body:          string
  attribution?:  string
  headingColor:  string
  bodyColor:     string
  durationMs:    number
  variant?:      'streak-ring' | 'badge' | 'default'
}

export interface MilestoneConfig {
  key:        string
  bgColor:    string
  orchard:    MilestoneStage[]
  clean:      MilestoneStage[]
  transition: 'shimmer' | 'wipe'
  tier:       'micro' | 'standard' | 'landmark'
}

export type MilestoneEventType =
  | 'GRADUATION'
  | 'PAYDAY_REACHED'
  | 'GOAL_COMPLETED'
  | 'STREAK_3'
  | 'STREAK_7'
  | 'STREAK_14'
  | 'STREAK_30'
  | 'STREAK_LOST'
  | 'STREAK_REVIVED'
  | 'BADGE_CONSISTENCY_SEED'
  | 'BADGE_CONSISTENCY_SAPLING'
  | 'BADGE_CONSISTENCY_OAK'
  | 'BADGE_EFFORT_SEED'
  | 'BADGE_EFFORT_SAPLING'
  | 'BADGE_EFFORT_OAK'
  | 'BADGE_SAVER_SEED'
  | 'BADGE_SAVER_SAPLING'
  | 'BADGE_SAVER_OAK'
  | 'BADGE_SCHOLAR_SEED'
  | 'BADGE_SCHOLAR_SAPLING'
  | 'BADGE_SCHOLAR_OAK'
  | 'BADGE_LANDMARK_SEED'
  | 'BADGE_LANDMARK_SAPLING'
  | 'BADGE_LANDMARK_OAK'

export interface MilestoneEvent {
  type:    MilestoneEventType
  appView: AppView
  meta?: {
    previousStreak?: number
    newStreak?:      number
  }
}
