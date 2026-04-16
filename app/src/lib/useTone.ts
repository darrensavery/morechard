/**
 * useAppView — returns app-view-appropriate copy based on the child's
 * app_view setting ('ORCHARD' | 'CLEAN'), and locale-aware terminology.
 *
 * app_view = 'ORCHARD' (default): nature metaphors, playful icons
 * app_view = 'CLEAN':             standard financial terms, minimal icons
 *
 * Usage:
 *   const view = useAppView('ORCHARD')
 *   view.balance   → "Your harvest"  |  "Total balance"
 *
 * useTone() is a legacy alias accepting the old teen_mode number — kept so
 * parent-side callers (FamilySettings, ChildProfileSettings) don't break.
 * Remove once all callers are updated.
 */

import { useLocale, type AppLocale } from './locale'

export type AppView = 'ORCHARD' | 'CLEAN'

export interface Terminology {
  money:          string
  allowanceLabel: string
}

export interface ViewCopy {
  isChild:       boolean
  dashboard:     string
  balance:       string
  addToSchedule: string
  allowance:     string
  rewards:       string
  weekSection:   string
  weekSubtitle:  string
  emptyGrove:    string
  emptyGroveSub: string
  nothingToday:  string
  doneButton:    string
  submitButton:  string
  waitingBadge:  string
  allChores:     string
  terminology:   Terminology
}

// Keep Tone as an alias so existing `import type { Tone }` don't break
export type Tone = ViewCopy

const ORCHARD_BASE = {
  isChild:       true,
  dashboard:     'The Orchard',
  balance:       'Your harvest',
  addToSchedule: 'Plant in my grove',
  allowance:     'Rainfall',
  rewards:       'Sunshine',
  weekSection:   'Your week in the grove',
  weekSubtitle:  "Tap a day to see what's growing",
  emptyGrove:    'Your grove is empty',
  emptyGroveSub: 'Ask a parent to plant some jobs for you.',
  nothingToday:  'Nothing planted for',
  doneButton:    'Done!',
  submitButton:  'Send to parent',
  waitingBadge:  'Waiting…',
  allChores:     'All my jobs',
}

const CLEAN_BASE = {
  isChild:       false,
  dashboard:     'My Account',
  balance:       'Total balance',
  addToSchedule: 'Add to schedule',
  allowance:     'Regular pay',
  rewards:       'Bonus',
  weekSection:   'My week',
  weekSubtitle:  'Select a day to filter tasks',
  emptyGrove:    'No tasks yet',
  emptyGroveSub: 'A parent will assign tasks to your account.',
  nothingToday:  'No tasks scheduled for',
  doneButton:    'Mark complete',
  submitButton:  'Submit for approval',
  waitingBadge:  'Pending',
  allChores:     'All tasks',
}

function buildTerminology(locale: AppLocale): Terminology {
  if (locale === 'pl') return { money: 'kieszonkowe', allowanceLabel: 'Kieszonkowe' }
  if (locale === 'en-US') return { money: 'allowance', allowanceLabel: 'Allowance' }
  return { money: 'pocket money', allowanceLabel: 'Pocket money' }
}

export function useAppView(appView: AppView | string | undefined): ViewCopy {
  const { locale } = useLocale()
  const terminology = buildTerminology(locale)
  const base = appView === 'CLEAN' ? CLEAN_BASE : ORCHARD_BASE
  return { ...base, terminology }
}

/** Legacy alias — accepts old teen_mode number. Remove once all callers updated. */
export function useTone(teenMode: number | boolean | undefined): ViewCopy {
  return useAppView(teenMode ? 'CLEAN' : 'ORCHARD')
}
