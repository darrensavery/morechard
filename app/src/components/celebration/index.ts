export type { MilestoneConfig, MilestoneEvent, MilestoneEventType, MilestoneStage } from './types'
export { MilestoneOverlay } from './MilestoneOverlay'
export { GRADUATION } from './achievements/graduation'

import type { MilestoneEvent, MilestoneEventType } from './types'
import { CONFIGS } from './registry'

const QUEUE_KEY = 'mc_celebration_queue'

type Tier = 'micro' | 'standard' | 'landmark'

const TIER_RANK: Record<Tier, number> = { micro: 0, standard: 1, landmark: 2 }

function getTier(type: MilestoneEventType): Tier {
  return CONFIGS[type]?.tier ?? 'micro'
}

function getQueue(): MilestoneEvent[] {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]') }
  catch { return [] }
}

function saveQueue(queue: MilestoneEvent[]): void {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(queue)) } catch { /* ignore */ }
}

export function queueCelebration(event: MilestoneEvent): void {
  const queue = getQueue()
  if (queue.some(e => e.type === event.type)) return // dedupe
  const newTier = getTier(event.type)
  const newRank = TIER_RANK[newTier]
  // Keep: same-tier events (FIFO) + higher-tier events; drop lower-tier events
  const filtered = queue.filter(e => TIER_RANK[getTier(e.type)] >= newRank)
  filtered.push(event)
  saveQueue(filtered)
}

export function consumeNextCelebration(): MilestoneEvent | null {
  const queue = getQueue()
  if (queue.length === 0) return null
  const [next, ...rest] = queue
  saveQueue(rest)
  return next ?? null
}

export function clearCelebrationQueue(): void {
  try { localStorage.removeItem(QUEUE_KEY) } catch { /* ignore */ }
}

// Backwards-compat shims — kept so existing callers don't break during migration
export function consumeMilestonePending(type: string): boolean {
  const key = `mc_milestone_${type.toLowerCase()}`
  try {
    const pending = localStorage.getItem(key) === '1'
    if (pending) localStorage.removeItem(key)
    return pending
  } catch { return false }
}

export function setPendingMilestone(type: string): void {
  const key = `mc_milestone_${type.toLowerCase()}`
  try { localStorage.setItem(key, '1') } catch { /* ignore */ }
}
