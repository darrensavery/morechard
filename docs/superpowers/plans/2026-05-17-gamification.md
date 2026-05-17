# Gamification System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a streak + badge gamification layer to Morechard that motivates children to complete scheduled chores consistently, adapts to Seedling (ages ~10–13) and Professional (ages ~14–16) views, and integrates with the existing CelebrationEngine.

**Architecture:** A Worker-side streak engine evaluates kept-days on every chore approval and lazily detects misses on each child dashboard load (`GET /api/balance`). Badge evaluation runs server-side after streak and approval events. The Worker adds pending celebration keys to the API response; the client queues them via a FIFO celebration queue in localStorage and drains one per dashboard mount. Client-side, the CelebrationEngine gains a SVG streak ring choreography, one-shot confetti, and a BadgeAlmanac component.

**Tech Stack:** Cloudflare D1 (SQL), Cloudflare Workers (TypeScript), React + TypeScript (app), Vitest (tests), nanoid (IDs), CSS animations (ring sweep, flash, confetti)

---

## File Map

**New Worker files:**
- `worker/migrations/0058_gamification.sql` — `child_streaks` + `child_badges` tables
- `worker/src/lib/streaks.ts` — streak evaluation engine (pure functions + D1 queries)
- `worker/src/lib/streaks.test.ts` — Vitest unit tests
- `worker/src/lib/badges.ts` — badge evaluation engine
- `worker/src/lib/badges.test.ts` — Vitest unit tests
- `worker/src/routes/streaks.ts` — `GET /api/streaks/:child_id`

**Modified Worker files:**
- `worker/src/routes/completions.ts` — hook `handleCompletionApprove` to call streak + badge eval
- `worker/src/routes/finance.ts` — hook `handleBalance` to detect streak misses + return streak/badge state

**New app files:**
- `app/src/components/celebration/registry.ts` — merged CONFIGS record (replaces inline CONFIGS in MilestoneOverlay)
- `app/src/components/celebration/configs/streak-milestones.ts` — STREAK_3/7/14/30/LOST/REVIVED configs
- `app/src/components/celebration/configs/badge-consistency.ts` — badge Consistency track configs
- `app/src/components/celebration/configs/badge-effort.ts` — badge Effort track configs
- `app/src/components/celebration/configs/badge-saver.ts` — badge Saver track configs
- `app/src/components/celebration/configs/badge-scholar.ts` — badge Scholar track configs
- `app/src/components/celebration/configs/badge-landmark.ts` — badge Landmark track configs
- `app/src/components/celebration/StreakRing.tsx` — animated SVG ring component
- `app/src/components/celebration/GrowthMedallion.tsx` — SVG medallion for Seedling badge screens
- `app/src/components/celebration/MicroToast.tsx` — inline toast for Micro-tier events
- `app/src/components/dashboard/BadgeAlmanac.tsx` — badge gallery + locked silhouettes
- `app/src/components/dashboard/StreakChip.tsx` — compact streak display for parent dashboard

**Modified app files:**
- `app/src/components/celebration/types.ts` — add 18 new event types + `meta` on MilestoneEvent
- `app/src/components/celebration/index.ts` — replace setPending/consume with FIFO queue
- `app/src/components/celebration/MilestoneOverlay.tsx` — import registry; add confetti + ring for streak events
- Child dashboard screen (wherever `handleBalance` response is consumed) — wire streak state + queue drain

---

## Phase A — Backend

---

### Task 1: D1 migration 0058_gamification.sql

**Files:**
- Create: `worker/migrations/0058_gamification.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 0058_gamification.sql
-- child_streaks: one row per child, updated on every approval + balance load
CREATE TABLE IF NOT EXISTS child_streaks (
  child_id              TEXT    NOT NULL PRIMARY KEY REFERENCES users(id),
  current_streak        INTEGER NOT NULL DEFAULT 0,
  longest_streak        INTEGER NOT NULL DEFAULT 0,
  grace_days_remaining  INTEGER NOT NULL DEFAULT 0,
  last_kept_date        TEXT,                        -- ISO YYYY-MM-DD or NULL
  last_checked_date     TEXT,                        -- ISO YYYY-MM-DD or NULL
  updated_at            TEXT    NOT NULL
);

-- child_badges: one row per badge earned; UNIQUE prevents double-awards
CREATE TABLE IF NOT EXISTS child_badges (
  id          TEXT NOT NULL PRIMARY KEY,
  child_id    TEXT NOT NULL REFERENCES users(id),
  badge_key   TEXT NOT NULL,  -- e.g. 'CONSISTENCY_SEED', 'EFFORT_SAPLING'
  earned_at   TEXT NOT NULL,
  UNIQUE(child_id, badge_key)
);

CREATE INDEX IF NOT EXISTS idx_child_badges_child ON child_badges(child_id);
```

- [ ] **Step 2: Apply the migration via Wrangler**

```bash
npx wrangler d1 execute morechard-db --local --file=worker/migrations/0058_gamification.sql
```

Expected: `Successfully executed 3 statements.` (no errors)

- [ ] **Step 3: Commit**

```bash
git add worker/migrations/0058_gamification.sql
git commit -m "feat(gamification): D1 schema — child_streaks + child_badges"
```

---

### Task 2: Streak engine library + tests

**Files:**
- Create: `worker/src/lib/streaks.ts`
- Create: `worker/src/lib/streaks.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// worker/src/lib/streaks.test.ts
import { describe, it, expect } from 'vitest'
import { todayUTC, consistencyScore, buildStreakEvent } from './streaks'

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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd worker && npx vitest run src/lib/streaks.test.ts
```

Expected: FAIL — `Cannot find module './streaks'`

- [ ] **Step 3: Write the implementation**

```typescript
// worker/src/lib/streaks.ts

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
  const longest = event.type === 'KEPT'
    ? Math.max(event.newStreak, (await getStreakState(db, childId)).longest_streak)
    : undefined

  const now = new Date().toISOString()

  if (event.type === 'KEPT') {
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
    SELECT COUNT(*) AS total,
           SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS done
    FROM chores
    WHERE assigned_to = ? AND due_date = ?
  `).bind(childId, date).first<{ total: number; done: number }>()

  if (!result || result.total === 0) return false
  return result.done >= result.total
}

export async function hadScheduledChores(db: D1Database, childId: string, date: string): Promise<boolean> {
  const result = await db.prepare(
    `SELECT COUNT(*) AS total FROM chores WHERE assigned_to = ? AND due_date = ?`
  ).bind(childId, date).first<{ total: number }>()
  return (result?.total ?? 0) > 0
}

export async function getConsistencyScore(db: D1Database, childId: string): Promise<number> {
  const cutoff = (() => {
    const d = new Date(); d.setUTCDate(d.getUTCDate() - 30); return d.toISOString().slice(0, 10)
  })()

  const [scheduledResult, keptResult] = await Promise.all([
    db.prepare(
      `SELECT COUNT(DISTINCT due_date) AS total FROM chores WHERE assigned_to = ? AND due_date >= ?`
    ).bind(childId, cutoff).first<{ total: number }>(),
    db.prepare(`
      SELECT COUNT(DISTINCT due_date) AS total FROM (
        SELECT due_date, COUNT(*) AS t, SUM(CASE WHEN status='approved' THEN 1 ELSE 0 END) AS d
        FROM chores WHERE assigned_to = ? AND due_date >= ?
        GROUP BY due_date HAVING t = d
      )
    `).bind(childId, cutoff).first<{ total: number }>(),
  ])

  return consistencyScore(keptResult?.total ?? 0, scheduledResult?.total ?? 0)
}
```

- [ ] **Step 4: Run tests**

```bash
cd worker && npx vitest run src/lib/streaks.test.ts
```

Expected: PASS (all 7 tests green)

- [ ] **Step 5: Commit**

```bash
git add worker/src/lib/streaks.ts worker/src/lib/streaks.test.ts
git commit -m "feat(gamification): streak engine lib + tests"
```

---

### Task 3: Badge engine library + tests

**Files:**
- Create: `worker/src/lib/badges.ts`
- Create: `worker/src/lib/badges.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// worker/src/lib/badges.test.ts
import { describe, it, expect } from 'vitest'
import { badgesToAward, BADGE_THRESHOLDS } from './badges'

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

  it('awards CONSISTENCY_SEED at 7-day streak', () => {
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
})
```

- [ ] **Step 2: Run to verify fail**

```bash
cd worker && npx vitest run src/lib/badges.test.ts
```

Expected: FAIL — `Cannot find module './badges'`

- [ ] **Step 3: Write the implementation**

```typescript
// worker/src/lib/badges.ts

export const BADGE_THRESHOLDS = {
  // Consistency track (streak-based)
  CONSISTENCY_SEED:    { streak: 7 },
  CONSISTENCY_SAPLING: { streak: 30 },
  CONSISTENCY_OAK:     { streak: 90 },
  // Effort track (total approved chores)
  EFFORT_SEED:    { chores: 25 },
  EFFORT_SAPLING: { chores: 50 },
  EFFORT_OAK:     { chores: 100 },
  // Saver track (goals completed / total saved)
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
  earnedBadgeKeys:      string[]
  currentStreak:        number
  longestStreak:        number
  totalApprovedChores:  number
  totalGoalsCompleted:  number
  totalSavedPence:      number
  totalLessonsCompleted: number
  isFirstPayday:        boolean
  isFirstChore:         boolean
}

export function badgesToAward(input: BadgeInput): BadgeKey[] {
  const { earnedBadgeKeys, currentStreak, longestStreak, totalApprovedChores,
          totalGoalsCompleted, totalSavedPence, totalLessonsCompleted,
          isFirstPayday, isFirstChore } = input

  const earned = new Set(earnedBadgeKeys)
  const toAward: BadgeKey[] = []

  function check(key: BadgeKey, met: boolean) {
    if (met && !earned.has(key)) toAward.push(key)
  }

  // Use longestStreak so badges survive a broken streak
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
  earnedBadgeKeys:      string[]
  totalApprovedChores:  number
  totalGoalsCompleted:  number
  totalSavedPence:      number
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
```

- [ ] **Step 4: Run tests**

```bash
cd worker && npx vitest run src/lib/badges.test.ts
```

Expected: PASS (all 5 tests green)

- [ ] **Step 5: Commit**

```bash
git add worker/src/lib/badges.ts worker/src/lib/badges.test.ts
git commit -m "feat(gamification): badge engine lib + tests"
```

---

### Task 4: Streaks API route

**Files:**
- Create: `worker/src/routes/streaks.ts`
- Modify: main router file to wire up `GET /api/streaks/:child_id`

- [ ] **Step 1: Find the router file**

```bash
grep -r "handleBalance\|handleCompletionApprove" worker/src/index.ts 2>/dev/null || grep -rl "handleBalance" worker/src/
```

Note the file that registers routes — it will be `worker/src/index.ts` or similar.

- [ ] **Step 2: Write the route handler**

```typescript
// worker/src/routes/streaks.ts
import { Env } from '../types.js'
import { json, error } from '../lib/response.js'
import { JwtPayload } from '../lib/jwt.js'
import { getStreakState, getConsistencyScore } from '../lib/streaks.js'
import { getBadgeStats } from '../lib/badges.js'

type AuthedRequest = Request & { auth: JwtPayload }

// GET /api/streaks/:child_id
// Returns streak state + consistency score + earned badge keys for the child.
// Accessible by the child themselves or a parent in the same family.
export async function handleGetStreaks(
  request: Request,
  env: Env,
  childId: string,
): Promise<Response> {
  const auth = (request as AuthedRequest).auth

  // Verify the requester can see this child's data
  if (auth.role === 'child' && auth.sub !== childId) return error('Forbidden', 403)

  // Verify child belongs to the same family
  const member = await env.DB.prepare(
    `SELECT user_id FROM family_roles WHERE user_id = ? AND family_id = ? AND role = 'child'`
  ).bind(childId, auth.family_id).first()
  if (!member) return error('Child not found in family', 404)

  const [state, score, stats] = await Promise.all([
    getStreakState(env.DB, childId),
    getConsistencyScore(env.DB, childId),
    getBadgeStats(env.DB, childId),
  ])

  return json({
    current_streak:        state.current_streak,
    longest_streak:        state.longest_streak,
    grace_days_remaining:  state.grace_days_remaining,
    last_kept_date:        state.last_kept_date,
    consistency_score:     score,
    earned_badge_keys:     stats.earnedBadgeKeys,
  })
}
```

- [ ] **Step 3: Register the route in the main router**

Open the file found in Step 1 (likely `worker/src/index.ts`). Find where routes like `/api/completions` are handled. Add:

```typescript
import { handleGetStreaks } from './routes/streaks.js'

// Inside the request handler, alongside other route matches:
const streaksMatch = path.match(/^\/api\/streaks\/([^/]+)$/)
if (streaksMatch && method === 'GET') {
  return requireAuth(request, env, () => handleGetStreaks(request, env, streaksMatch[1]))
}
```

Place this block before the 404 fallthrough, after the existing completions routes.

- [ ] **Step 4: Commit**

```bash
git add worker/src/routes/streaks.ts worker/src/index.ts
git commit -m "feat(gamification): GET /api/streaks/:child_id route"
```

---

### Task 5: Hook approval route → streak + badge evaluation

**Files:**
- Modify: `worker/src/routes/completions.ts`

The hook fires inside `handleCompletionApprove` after line 231 (the `ledger_status_log` insert). Add streak evaluation for chores that have a `due_date`, then badge evaluation, and include `pending_celebrations` in the response.

- [ ] **Step 1: Read the chore's due_date in the existing query**

In `handleCompletionApprove`, the existing query at line 155 already selects `comp.*` and joins chores. Extend it to also include `ch.due_date` and `ch.assigned_to`:

Find:
```typescript
  const comp = await env.DB.prepare(`
    SELECT comp.*, ch.title, ch.reward_amount, ch.currency
    FROM completions comp
    JOIN chores ch ON ch.id = comp.chore_id
    WHERE comp.id = ?
  `).bind(completionId)
    .first<{
      id: string; family_id: string; chore_id: string; child_id: string;
      status: string; title: string; reward_amount: number; currency: string;
    }>()
```

Replace with:
```typescript
  const comp = await env.DB.prepare(`
    SELECT comp.*, ch.title, ch.reward_amount, ch.currency, ch.due_date, ch.assigned_to
    FROM completions comp
    JOIN chores ch ON ch.id = comp.chore_id
    WHERE comp.id = ?
  `).bind(completionId)
    .first<{
      id: string; family_id: string; chore_id: string; child_id: string;
      status: string; title: string; reward_amount: number; currency: string;
      due_date: string | null; assigned_to: string;
    }>()
```

- [ ] **Step 2: Add imports at the top of completions.ts**

```typescript
import { getStreakState, buildStreakEvent, saveStreakEvent, allScheduledChoresDone, todayUTC } from '../lib/streaks.js'
import { getBadgeStats, badgesToAward, insertBadges } from '../lib/badges.js'
import { nanoid } from '../lib/nanoid.js'
```

- [ ] **Step 3: Add the streak + badge hook after line 231**

After the `ledger_status_log` insert (after `.run()`), insert this block before the `return json({...})`:

```typescript
  // ── Gamification hook ──────────────────────────────────────────────
  const pendingCelebrations: string[] = []

  if (comp.due_date) {
    const childId = comp.child_id
    const date    = comp.due_date

    const [allDone, streakState] = await Promise.all([
      allScheduledChoresDone(env.DB, childId, date),
      getStreakState(env.DB, childId),
    ])

    const streakEvent = buildStreakEvent({ allChoresDone: allDone, date, state: streakState })
    if (streakEvent) {
      await saveStreakEvent(env.DB, childId, streakEvent, date)

      // Queue streak milestone celebration
      const { previousStreak, newStreak } = streakEvent
      if      (newStreak === 3)  pendingCelebrations.push(`STREAK_3:${previousStreak}:${newStreak}`)
      else if (newStreak === 7)  pendingCelebrations.push(`STREAK_7:${previousStreak}:${newStreak}`)
      else if (newStreak === 14) pendingCelebrations.push(`STREAK_14:${previousStreak}:${newStreak}`)
      else if (newStreak === 30) pendingCelebrations.push(`STREAK_30:${previousStreak}:${newStreak}`)
    }
  }

  // Badge evaluation (runs on every approval — cheap read)
  {
    const childId = comp.child_id
    const [stats, streakState] = await Promise.all([
      getBadgeStats(env.DB, childId),
      getStreakState(env.DB, childId),
    ])
    const totalApprovedChores = stats.totalApprovedChores + 1 // include this one
    const isFirstChore = totalApprovedChores === 1

    const newBadges = badgesToAward({
      earnedBadgeKeys:       stats.earnedBadgeKeys,
      currentStreak:         streakState.current_streak,
      longestStreak:         Math.max(streakState.longest_streak, streakState.current_streak),
      totalApprovedChores,
      totalGoalsCompleted:   stats.totalGoalsCompleted,
      totalSavedPence:       stats.totalSavedPence,
      totalLessonsCompleted: stats.totalLessonsCompleted,
      isFirstPayday:         false, // payouts route handles this
      isFirstChore,
    })

    if (newBadges.length > 0) {
      await insertBadges(env.DB, childId, newBadges, nanoid)
      for (const key of newBadges) {
        pendingCelebrations.push(`BADGE_${key}`)
      }
    }
  }
  // ── End gamification hook ──────────────────────────────────────────
```

- [ ] **Step 4: Include `pending_celebrations` in the response**

Find the `return json({` at the end of `handleCompletionApprove` and add the field:

```typescript
  return json({
    ok: true,
    ledger_id:           newLedgerId,
    record_hash:         recordHash,
    verification_status: verificationStatus,
    amount:              comp.reward_amount,
    currency:            comp.currency,
    pending_celebrations: pendingCelebrations,
  })
```

- [ ] **Step 5: Commit**

```bash
git add worker/src/routes/completions.ts
git commit -m "feat(gamification): hook approval → streak + badge evaluation"
```

---

### Task 6: Hook balance route → miss detection

**Files:**
- Modify: `worker/src/routes/finance.ts`

`handleBalance` is called whenever the child dashboard loads. We detect yesterday's miss here and return streak state + pending celebrations.

- [ ] **Step 1: Add imports to finance.ts**

```typescript
import { getStreakState, buildMissEvent, saveStreakEvent, hadScheduledChores, todayUTC, previousDay } from '../lib/streaks.js'
import { getBadgeStats, badgesToAward, insertBadges } from '../lib/badges.js'
import { nanoid } from '../lib/nanoid.js'
```

- [ ] **Step 2: Add miss detection after the existing balance queries**

After line 344 (`const available = earnedTotal - reversalsTotal - payoutsTotal - spentTotal`) and before the `return json({`, add:

```typescript
  // ── Gamification: lazy miss detection ──────────────────────────────
  const pendingCelebrations: string[] = []
  const today = todayUTC()
  const yesterday = previousDay(today)

  const [streakState, yesterdayHadChores] = await Promise.all([
    getStreakState(env.DB, child_id),
    hadScheduledChores(env.DB, child_id, yesterday),
  ])

  const missEvent = buildMissEvent({
    hadScheduledChores: yesterdayHadChores,
    today,
    state: streakState,
  })

  let currentStreak = streakState

  if (missEvent) {
    await saveStreakEvent(env.DB, child_id, missEvent, today)
    currentStreak = {
      ...streakState,
      current_streak:       missEvent.newStreak,
      grace_days_remaining: missEvent.newGrace,
      last_checked_date:    today,
    }
    if (missEvent.type === 'MISSED') {
      pendingCelebrations.push(`STREAK_LOST:${missEvent.previousStreak}:0`)
    } else if (missEvent.type === 'GRACE_USED') {
      pendingCelebrations.push(`STREAK_REVIVED:${missEvent.previousStreak}:${missEvent.newStreak}`)
    }
  } else if (streakState.last_checked_date !== today) {
    // Advance check date without changing streak
    await env.DB.prepare(
      `INSERT INTO child_streaks (child_id, current_streak, longest_streak, grace_days_remaining, last_kept_date, last_checked_date, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(child_id) DO UPDATE SET last_checked_date = excluded.last_checked_date, updated_at = excluded.updated_at`
    ).bind(child_id, streakState.current_streak, streakState.longest_streak, streakState.grace_days_remaining,
           streakState.last_kept_date, today, new Date().toISOString()).run()
    currentStreak = { ...streakState, last_checked_date: today }
  }
  // ── End gamification ────────────────────────────────────────────────
```

- [ ] **Step 3: Add streak state to the response**

```typescript
  return json({
    earned:       earnedTotal,
    pending:      pendingTotal,
    reversals:    reversalsTotal,
    paid_out:     payoutsTotal,
    spent:        spentTotal,
    available:    Math.max(0, available),
    streak: {
      current:         currentStreak.current_streak,
      longest:         currentStreak.longest_streak,
      grace_remaining: currentStreak.grace_days_remaining,
      last_kept_date:  currentStreak.last_kept_date,
    },
    pending_celebrations: pendingCelebrations,
  })
```

- [ ] **Step 4: Commit**

```bash
git add worker/src/routes/finance.ts
git commit -m "feat(gamification): balance route — miss detection + streak state in response"
```

---

## Phase B — Celebration Engine

---

### Task 7: Extend celebration types + FIFO queue

**Files:**
- Modify: `app/src/components/celebration/types.ts`
- Modify: `app/src/components/celebration/index.ts`

- [ ] **Step 1: Extend types.ts**

Replace the entire file with:

```typescript
// app/src/components/celebration/types.ts
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
```

- [ ] **Step 2: Replace index.ts with FIFO queue**

Replace the entire file with:

```typescript
// app/src/components/celebration/index.ts
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
  // Keep: same-tier events (FIFO) + higher-tier events
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
```

- [ ] **Step 3: Commit**

```bash
git add app/src/components/celebration/types.ts app/src/components/celebration/index.ts
git commit -m "feat(gamification): extend celebration types + FIFO queue"
```

---

### Task 8: Celebration registry

**Files:**
- Create: `app/src/components/celebration/registry.ts`
- Modify: `app/src/components/celebration/MilestoneOverlay.tsx` (replace inline CONFIGS import)

The registry imports all configs and merges them into one record. Add configs as they're created in Tasks 9–10.

- [ ] **Step 1: Create the registry**

```typescript
// app/src/components/celebration/registry.ts
import type { MilestoneConfig } from './types'
import { GRADUATION } from './achievements/graduation'
import {
  STREAK_3, STREAK_7, STREAK_14, STREAK_30, STREAK_LOST, STREAK_REVIVED,
} from './configs/streak-milestones'
import {
  BADGE_CONSISTENCY_SEED, BADGE_CONSISTENCY_SAPLING, BADGE_CONSISTENCY_OAK,
  BADGE_EFFORT_SEED, BADGE_EFFORT_SAPLING, BADGE_EFFORT_OAK,
} from './configs/badge-effort-consistency'
import {
  BADGE_SAVER_SEED, BADGE_SAVER_SAPLING, BADGE_SAVER_OAK,
  BADGE_SCHOLAR_SEED, BADGE_SCHOLAR_SAPLING, BADGE_SCHOLAR_OAK,
  BADGE_LANDMARK_SEED, BADGE_LANDMARK_SAPLING, BADGE_LANDMARK_OAK,
} from './configs/badge-saver-scholar-landmark'

export const CONFIGS: Record<string, MilestoneConfig> = {
  GRADUATION,
  STREAK_3, STREAK_7, STREAK_14, STREAK_30, STREAK_LOST, STREAK_REVIVED,
  BADGE_CONSISTENCY_SEED, BADGE_CONSISTENCY_SAPLING, BADGE_CONSISTENCY_OAK,
  BADGE_EFFORT_SEED, BADGE_EFFORT_SAPLING, BADGE_EFFORT_OAK,
  BADGE_SAVER_SEED, BADGE_SAVER_SAPLING, BADGE_SAVER_OAK,
  BADGE_SCHOLAR_SEED, BADGE_SCHOLAR_SAPLING, BADGE_SCHOLAR_OAK,
  BADGE_LANDMARK_SEED, BADGE_LANDMARK_SAPLING, BADGE_LANDMARK_OAK,
}
```

- [ ] **Step 2: Update MilestoneOverlay to use registry**

In `app/src/components/celebration/MilestoneOverlay.tsx`, replace lines 7–12:

```typescript
// Remove:
import type { MilestoneConfig, MilestoneEvent } from './types'
import { GRADUATION } from './achievements/graduation'

const CONFIGS: Record<string, MilestoneConfig> = {
  GRADUATION,
}

// Replace with:
import type { MilestoneEvent } from './types'
import { CONFIGS } from './registry'
```

- [ ] **Step 3: Add `tier` to the graduation config so TypeScript is happy**

In `app/src/components/celebration/achievements/graduation.ts`, add `tier: 'landmark'` to the export:

```typescript
export const GRADUATION: MilestoneConfig = {
  key:       'graduation',
  bgColor:   '#0f1a14',
  transition: 'shimmer',
  tier:      'landmark',
  orchard: [ /* existing unchanged */ ],
  clean:   [ /* existing unchanged */ ],
}
```

- [ ] **Step 4: Commit (will fail to compile until Tasks 9–10 add the imported configs — commit anyway)**

```bash
git add app/src/components/celebration/registry.ts app/src/components/celebration/MilestoneOverlay.tsx app/src/components/celebration/achievements/graduation.ts
git commit -m "feat(gamification): celebration registry + wire MilestoneOverlay"
```

---

### Task 9: Streak celebration configs

**Files:**
- Create: `app/src/components/celebration/configs/streak-milestones.ts`

- [ ] **Step 1: Create the file**

```typescript
// app/src/components/celebration/configs/streak-milestones.ts
import type { MilestoneConfig } from '../types'

export const STREAK_3: MilestoneConfig = {
  key: 'STREAK_3', bgColor: '#0f1a14', transition: 'shimmer', tier: 'standard',
  orchard: [
    {
      icon: '🔥', variant: 'streak-ring',
      heading: '3 days in a row!',
      body: "You've shown up 3 days straight. That's a real streak starting.",
      headingColor: 'text-emerald-300', bodyColor: 'text-emerald-200/70', durationMs: 3500,
    },
  ],
  clean: [
    {
      icon: '', variant: 'streak-ring',
      heading: '3-day streak.',
      body: 'Three consecutive scheduled days completed on time.',
      headingColor: 'text-white', bodyColor: 'text-white/60', durationMs: 3500,
    },
  ],
}

export const STREAK_7: MilestoneConfig = {
  key: 'STREAK_7', bgColor: '#0f1a14', transition: 'shimmer', tier: 'standard',
  orchard: [
    {
      icon: '🌟', variant: 'streak-ring',
      heading: 'You did it 7 days straight!',
      body: 'Every job done on time, a whole week. That\'s not luck — that\'s you showing up. Keep going!',
      headingColor: 'text-amber-300', bodyColor: 'text-emerald-200/70', durationMs: 4000,
    },
  ],
  clean: [
    {
      icon: '', variant: 'streak-ring',
      heading: '7-day streak.',
      body: 'Every scheduled task cleared, on time, for a full week. That\'s what consistency looks like on a record.',
      headingColor: 'text-white', bodyColor: 'text-white/60', durationMs: 4000,
    },
  ],
}

export const STREAK_14: MilestoneConfig = {
  key: 'STREAK_14', bgColor: '#0f1a14', transition: 'shimmer', tier: 'standard',
  orchard: [
    {
      icon: '🌳', variant: 'streak-ring',
      heading: '14 days in a row!',
      body: 'Two full weeks without missing a thing. You\'re building a real habit here.',
      headingColor: 'text-emerald-300', bodyColor: 'text-emerald-200/70', durationMs: 4000,
    },
  ],
  clean: [
    {
      icon: '', variant: 'streak-ring',
      heading: '14-day streak.',
      body: 'Two consecutive weeks. Sustained performance at this level is rare.',
      headingColor: 'text-white', bodyColor: 'text-white/60', durationMs: 4000,
    },
  ],
}

export const STREAK_30: MilestoneConfig = {
  key: 'STREAK_30', bgColor: '#0f1a14', transition: 'shimmer', tier: 'landmark',
  orchard: [
    {
      icon: '🏆', variant: 'streak-ring',
      heading: '30 days in a row!',
      body: 'A whole month without missing a single job. Most people give up long before this. You didn\'t.',
      headingColor: 'text-amber-300', bodyColor: 'text-emerald-200/70', durationMs: 4500,
    },
    {
      icon: '📊',
      heading: 'Check your Consistency Score.',
      body: 'After 30 days, your score is locked in. This is the number that shows up when it counts.',
      headingColor: 'text-emerald-300', bodyColor: 'text-emerald-200/70', durationMs: 4000,
    },
  ],
  clean: [
    {
      icon: '', variant: 'streak-ring',
      heading: '30-day streak.',
      body: 'Thirty consecutive scheduled days. This appears on your Consistency Score and goes on record.',
      headingColor: 'text-white', bodyColor: 'text-white/60', durationMs: 4500,
    },
    {
      icon: '📊',
      heading: 'Consistency Score updated.',
      body: 'Your 30-day window is now fully loaded. The score reflects every scheduled day this month.',
      headingColor: 'text-white', bodyColor: 'text-white/60', durationMs: 3500,
    },
  ],
}

export const STREAK_LOST: MilestoneConfig = {
  key: 'STREAK_LOST', bgColor: '#0f1a14', transition: 'wipe', tier: 'micro',
  orchard: [
    {
      icon: '🌧️',
      heading: 'Streak paused.',
      body: 'You missed a day. It happens. A new streak starts the moment you get back on it.',
      headingColor: 'text-white/70', bodyColor: 'text-white/50', durationMs: 3000,
    },
  ],
  clean: [
    {
      icon: '—',
      heading: 'Streak reset.',
      body: 'A scheduled day was missed. Start fresh today.',
      headingColor: 'text-white/70', bodyColor: 'text-white/50', durationMs: 2500,
    },
  ],
}

export const STREAK_REVIVED: MilestoneConfig = {
  key: 'STREAK_REVIVED', bgColor: '#0f1a14', transition: 'shimmer', tier: 'standard',
  orchard: [
    {
      icon: '⛅',
      heading: 'Rain Day used.',
      body: 'Yesterday was tough — your Rain Day protected your streak. You\'ve still got this.',
      headingColor: 'text-teal-300', bodyColor: 'text-emerald-200/70', durationMs: 3500,
    },
  ],
  clean: [
    {
      icon: '🛡️',
      heading: 'Grace day applied.',
      body: 'A grace day covered yesterday\'s miss. Your streak is intact.',
      headingColor: 'text-teal-300', bodyColor: 'text-white/60', durationMs: 3000,
    },
  ],
}
```

- [ ] **Step 2: Commit**

```bash
git add app/src/components/celebration/configs/streak-milestones.ts
git commit -m "feat(gamification): streak milestone celebration configs"
```

---

### Task 10: Badge celebration configs

**Files:**
- Create: `app/src/components/celebration/configs/badge-effort-consistency.ts`
- Create: `app/src/components/celebration/configs/badge-saver-scholar-landmark.ts`

- [ ] **Step 1: Create badge-effort-consistency.ts**

```typescript
// app/src/components/celebration/configs/badge-effort-consistency.ts
import type { MilestoneConfig } from '../types'

export const BADGE_CONSISTENCY_SEED: MilestoneConfig = {
  key: 'BADGE_CONSISTENCY_SEED', bgColor: '#0f1a14', transition: 'shimmer', tier: 'standard',
  orchard: [
    {
      icon: '🌱', variant: 'badge',
      heading: 'Seedling Badge — Consistency',
      body: 'You kept your streak going for 7 days in a row. Your first consistency badge is locked in.',
      headingColor: 'text-emerald-300', bodyColor: 'text-emerald-200/70', durationMs: 4000,
    },
  ],
  clean: [
    {
      icon: '', variant: 'badge',
      heading: 'Tier I — Consistency',
      body: '7-day streak achieved. Consistency Tier I badge recorded.',
      headingColor: 'text-white', bodyColor: 'text-white/60', durationMs: 3500,
    },
  ],
}

export const BADGE_CONSISTENCY_SAPLING: MilestoneConfig = {
  key: 'BADGE_CONSISTENCY_SAPLING', bgColor: '#0f1a14', transition: 'shimmer', tier: 'standard',
  orchard: [
    {
      icon: '🌿', variant: 'badge',
      heading: 'Sapling Badge — Consistency',
      body: '30 days straight. You\'re not just doing this when it\'s easy — you\'re doing it every day.',
      headingColor: 'text-emerald-300', bodyColor: 'text-emerald-200/70', durationMs: 4000,
    },
  ],
  clean: [
    {
      icon: '', variant: 'badge',
      heading: 'Tier II — Consistency',
      body: '30-day streak. Consistency Tier II badge recorded.',
      headingColor: 'text-white', bodyColor: 'text-white/60', durationMs: 3500,
    },
  ],
}

export const BADGE_CONSISTENCY_OAK: MilestoneConfig = {
  key: 'BADGE_CONSISTENCY_OAK', bgColor: '#0f1a14', transition: 'shimmer', tier: 'landmark',
  orchard: [
    {
      icon: '🌳', variant: 'badge',
      heading: 'Oak Badge — Consistency',
      body: '90 days in a row. That\'s three months of showing up every single day. This is who you are now.',
      headingColor: 'text-amber-300', bodyColor: 'text-emerald-200/70', durationMs: 4500,
    },
  ],
  clean: [
    {
      icon: '', variant: 'badge',
      heading: 'Tier III — Consistency',
      body: '90-day streak. Consistency Tier III badge recorded. Top 1% performance window.',
      headingColor: 'text-white', bodyColor: 'text-white/60', durationMs: 4000,
    },
  ],
}

export const BADGE_EFFORT_SEED: MilestoneConfig = {
  key: 'BADGE_EFFORT_SEED', bgColor: '#0f1a14', transition: 'shimmer', tier: 'standard',
  orchard: [
    {
      icon: '🌱', variant: 'badge',
      heading: 'Seedling Badge — Effort',
      body: '25 jobs done and approved. You\'re no longer just starting out.',
      headingColor: 'text-emerald-300', bodyColor: 'text-emerald-200/70', durationMs: 4000,
    },
  ],
  clean: [
    {
      icon: '', variant: 'badge',
      heading: 'Tier I — Effort',
      body: '25 completed chores approved. Effort Tier I badge recorded.',
      headingColor: 'text-white', bodyColor: 'text-white/60', durationMs: 3500,
    },
  ],
}

export const BADGE_EFFORT_SAPLING: MilestoneConfig = {
  key: 'BADGE_EFFORT_SAPLING', bgColor: '#0f1a14', transition: 'shimmer', tier: 'standard',
  orchard: [
    {
      icon: '🌿', variant: 'badge',
      heading: 'Sapling Badge — Effort',
      body: '50 jobs done. You\'ve put in real work to earn your money. Every approved job is on record.',
      headingColor: 'text-emerald-300', bodyColor: 'text-emerald-200/70', durationMs: 4000,
    },
  ],
  clean: [
    {
      icon: '', variant: 'badge',
      heading: 'Tier II — Effort',
      body: '50 approved chores. Effort Tier II badge recorded.',
      headingColor: 'text-white', bodyColor: 'text-white/60', durationMs: 3500,
    },
  ],
}

export const BADGE_EFFORT_OAK: MilestoneConfig = {
  key: 'BADGE_EFFORT_OAK', bgColor: '#0f1a14', transition: 'shimmer', tier: 'landmark',
  orchard: [
    {
      icon: '🌳', variant: 'badge',
      heading: 'Oak Badge — Effort',
      body: '100 jobs approved. One hundred. That\'s an actual work record now.',
      headingColor: 'text-amber-300', bodyColor: 'text-emerald-200/70', durationMs: 4500,
    },
  ],
  clean: [
    {
      icon: '', variant: 'badge',
      heading: 'Tier III — Effort',
      body: '100 approved completions. Effort Tier III badge recorded.',
      headingColor: 'text-white', bodyColor: 'text-white/60', durationMs: 4000,
    },
  ],
}
```

- [ ] **Step 2: Create badge-saver-scholar-landmark.ts**

```typescript
// app/src/components/celebration/configs/badge-saver-scholar-landmark.ts
import type { MilestoneConfig } from '../types'

export const BADGE_SAVER_SEED: MilestoneConfig = {
  key: 'BADGE_SAVER_SEED', bgColor: '#0f1a14', transition: 'shimmer', tier: 'standard',
  orchard: [
    {
      icon: '🌱', variant: 'badge',
      heading: 'Seedling Badge — Saver',
      body: 'Your first saving goal is done. You set a target, and you hit it. That\'s what saving looks like.',
      headingColor: 'text-emerald-300', bodyColor: 'text-emerald-200/70', durationMs: 4000,
    },
  ],
  clean: [
    {
      icon: '', variant: 'badge',
      heading: 'Tier I — Saver',
      body: 'First savings goal completed. Saver Tier I badge recorded.',
      headingColor: 'text-white', bodyColor: 'text-white/60', durationMs: 3500,
    },
  ],
}

export const BADGE_SAVER_SAPLING: MilestoneConfig = {
  key: 'BADGE_SAVER_SAPLING', bgColor: '#0f1a14', transition: 'shimmer', tier: 'standard',
  orchard: [
    {
      icon: '🌿', variant: 'badge',
      heading: 'Sapling Badge — Saver',
      body: '£100 saved in total. That\'s real money you earned yourself.',
      headingColor: 'text-emerald-300', bodyColor: 'text-emerald-200/70', durationMs: 4000,
    },
  ],
  clean: [
    {
      icon: '', variant: 'badge',
      heading: 'Tier II — Saver',
      body: '£100 cumulative savings. Saver Tier II badge recorded.',
      headingColor: 'text-white', bodyColor: 'text-white/60', durationMs: 3500,
    },
  ],
}

export const BADGE_SAVER_OAK: MilestoneConfig = {
  key: 'BADGE_SAVER_OAK', bgColor: '#0f1a14', transition: 'shimmer', tier: 'landmark',
  orchard: [
    {
      icon: '🌳', variant: 'badge',
      heading: 'Oak Badge — Saver',
      body: 'Three saving goals completed. You\'re not just saving — you\'re planning ahead.',
      headingColor: 'text-amber-300', bodyColor: 'text-emerald-200/70', durationMs: 4500,
    },
  ],
  clean: [
    {
      icon: '', variant: 'badge',
      heading: 'Tier III — Saver',
      body: 'Three savings goals completed. Saver Tier III badge recorded.',
      headingColor: 'text-white', bodyColor: 'text-white/60', durationMs: 4000,
    },
  ],
}

export const BADGE_SCHOLAR_SEED: MilestoneConfig = {
  key: 'BADGE_SCHOLAR_SEED', bgColor: '#0f1a14', transition: 'shimmer', tier: 'standard',
  orchard: [
    {
      icon: '📚', variant: 'badge',
      heading: 'Seedling Badge — Scholar',
      body: 'First lesson completed. You didn\'t just earn money today — you learned something about it too.',
      headingColor: 'text-emerald-300', bodyColor: 'text-emerald-200/70', durationMs: 4000,
    },
  ],
  clean: [
    {
      icon: '', variant: 'badge',
      heading: 'Tier I — Scholar',
      body: 'First lesson completed. Scholar Tier I badge recorded.',
      headingColor: 'text-white', bodyColor: 'text-white/60', durationMs: 3500,
    },
  ],
}

export const BADGE_SCHOLAR_SAPLING: MilestoneConfig = {
  key: 'BADGE_SCHOLAR_SAPLING', bgColor: '#0f1a14', transition: 'shimmer', tier: 'standard',
  orchard: [
    {
      icon: '📖', variant: 'badge',
      heading: 'Sapling Badge — Scholar',
      body: 'Five lessons done. You know things about money most adults wish they\'d learned earlier.',
      headingColor: 'text-emerald-300', bodyColor: 'text-emerald-200/70', durationMs: 4000,
    },
  ],
  clean: [
    {
      icon: '', variant: 'badge',
      heading: 'Tier II — Scholar',
      body: '5 lessons completed. Scholar Tier II badge recorded.',
      headingColor: 'text-white', bodyColor: 'text-white/60', durationMs: 3500,
    },
  ],
}

export const BADGE_SCHOLAR_OAK: MilestoneConfig = {
  key: 'BADGE_SCHOLAR_OAK', bgColor: '#0f1a14', transition: 'shimmer', tier: 'landmark',
  orchard: [
    {
      icon: '🎓', variant: 'badge',
      heading: 'Oak Badge — Scholar',
      body: 'All lessons completed. You\'ve finished the full course. That knowledge goes with you forever.',
      headingColor: 'text-amber-300', bodyColor: 'text-emerald-200/70', durationMs: 4500,
    },
  ],
  clean: [
    {
      icon: '', variant: 'badge',
      heading: 'Tier III — Scholar',
      body: 'All lessons completed. Scholar Tier III badge recorded.',
      headingColor: 'text-white', bodyColor: 'text-white/60', durationMs: 4000,
    },
  ],
}

export const BADGE_LANDMARK_SEED: MilestoneConfig = {
  key: 'BADGE_LANDMARK_SEED', bgColor: '#0f1a14', transition: 'shimmer', tier: 'standard',
  orchard: [
    {
      icon: '🌱', variant: 'badge',
      heading: 'Your first approved job!',
      body: 'One job, checked and approved. Your earning record has started. This is day one.',
      headingColor: 'text-emerald-300', bodyColor: 'text-emerald-200/70', durationMs: 4000,
    },
  ],
  clean: [
    {
      icon: '', variant: 'badge',
      heading: 'First completion approved.',
      body: 'Your ledger entry has been written. Landmark Tier I badge recorded.',
      headingColor: 'text-white', bodyColor: 'text-white/60', durationMs: 3500,
    },
  ],
}

export const BADGE_LANDMARK_SAPLING: MilestoneConfig = {
  key: 'BADGE_LANDMARK_SAPLING', bgColor: '#0f1a14', transition: 'shimmer', tier: 'standard',
  orchard: [
    {
      icon: '💰', variant: 'badge',
      heading: 'First payday!',
      body: 'Your first real payout is done. That\'s money you earned yourself, from actual work.',
      headingColor: 'text-amber-300', bodyColor: 'text-emerald-200/70', durationMs: 4000,
    },
  ],
  clean: [
    {
      icon: '', variant: 'badge',
      heading: 'First payout received.',
      body: 'First cash payout confirmed. Landmark Tier II badge recorded.',
      headingColor: 'text-white', bodyColor: 'text-white/60', durationMs: 3500,
    },
  ],
}

export const BADGE_LANDMARK_OAK: MilestoneConfig = {
  key: 'BADGE_LANDMARK_OAK', bgColor: '#0f1a14', transition: 'shimmer', tier: 'landmark',
  orchard: [
    {
      icon: '🌳', variant: 'badge',
      heading: 'One full year in a row!',
      body: '365 days. Every scheduled job, every day, for a whole year. This doesn\'t happen by accident.',
      headingColor: 'text-amber-300', bodyColor: 'text-emerald-200/70', durationMs: 5000,
    },
  ],
  clean: [
    {
      icon: '', variant: 'badge',
      heading: '365-day streak.',
      body: 'One year of consecutive scheduled completions. Landmark Tier III badge recorded.',
      headingColor: 'text-white', bodyColor: 'text-white/60', durationMs: 4500,
    },
  ],
}
```

- [ ] **Step 3: Commit**

```bash
git add app/src/components/celebration/configs/badge-effort-consistency.ts app/src/components/celebration/configs/badge-saver-scholar-landmark.ts
git commit -m "feat(gamification): badge celebration configs (all 5 tracks)"
```

---

### Task 11: Update MilestoneOverlay — ring + confetti

**Files:**
- Modify: `app/src/components/celebration/MilestoneOverlay.tsx`

Add: (1) one-shot flash + leaf confetti on every Standard/Landmark screen, (2) for `variant: 'streak-ring'` stages in clean mode, show the `StreakRing` animation instead of the text icon.

- [ ] **Step 1: Replace MilestoneOverlay.tsx in full**

```tsx
// app/src/components/celebration/MilestoneOverlay.tsx
import { useEffect, useRef, useState, useCallback } from 'react'
import { cn } from '../../lib/utils'
import type { MilestoneEvent } from './types'
import { CONFIGS } from './registry'
import { StreakRing } from './StreakRing'

interface Props {
  event:      MilestoneEvent
  onComplete: () => void
}

type Phase = 'stage' | 'transition' | 'exit'

// One-shot CSS confetti leaf
function spawnConfetti(container: HTMLDivElement) {
  const cols = ['#00959c', '#3fcf9b', '#e6b222', '#ffe39a', '#1d8f6f']
  for (let i = 0; i < 22; i++) {
    const leaf = document.createElement('div')
    const size = 10 + Math.random() * 8
    leaf.style.cssText = `
      position:absolute; top:-28px;
      width:${size}px; height:${size}px;
      left:${6 + Math.random() * 88}%;
      background:${cols[i % cols.length]};
      border-radius:0 100% 0 100%;
      opacity:0;
      animation:mc-leaf-drop ${2.6 + Math.random() * 1.4}s cubic-bezier(.3,.2,.5,1) ${Math.random() * 0.5}s 1 forwards;
      --dx:${(Math.random() * 120) - 60}px;
    `
    container.appendChild(leaf)
  }
}

export function MilestoneOverlay({ event, onComplete }: Props) {
  const config    = CONFIGS[event.type] ?? null
  const stages    = config ? (event.appView === 'CLEAN' ? config.clean : config.orchard) : []
  const isShimmer = config?.transition === 'shimmer'
  const isLandmark = config?.tier === 'landmark' || config?.tier === 'standard'

  const [stageIdx, setStageIdx] = useState(0)
  const [phase,    setPhase]    = useState<Phase>('stage')
  const [visible,  setVisible]  = useState(true)
  const containerRef            = useRef<HTMLDivElement>(null)
  const flashRef                = useRef<HTMLDivElement>(null)
  const confettiSpawned         = useRef(false)
  const onCompleteRef           = useRef(onComplete)
  useEffect(() => { onCompleteRef.current = onComplete })

  const triggerPayoff = useCallback(() => {
    if (!confettiSpawned.current && containerRef.current && isLandmark) {
      confettiSpawned.current = true
      // Flash
      if (flashRef.current) {
        flashRef.current.style.animation = 'none'
        void flashRef.current.offsetWidth
        flashRef.current.style.animation = 'mc-flash .42s ease-out 1 forwards'
      }
      spawnConfetti(containerRef.current)
    }
  }, [isLandmark])

  useEffect(() => {
    if (!config || stages.length === 0) { onCompleteRef.current(); return }
    confettiSpawned.current = false

    const current = stages[stageIdx]
    let tInner: ReturnType<typeof setTimeout> | null = null

    const tTransition = setTimeout(() => {
      if (stageIdx < stages.length - 1) {
        setPhase('transition')
        tInner = setTimeout(() => {
          setStageIdx(i => i + 1)
          setPhase('stage')
        }, 1500)
      } else {
        setPhase('exit')
        setVisible(false)
        setTimeout(() => onCompleteRef.current(), 600)
      }
    }, current.durationMs)

    return () => {
      clearTimeout(tTransition)
      if (tInner !== null) clearTimeout(tInner)
    }
  }, [stageIdx, stages, config])

  if (!config) return null

  const current = stages[stageIdx]
  const isStreakRing = current.variant === 'streak-ring' && event.appView === 'CLEAN'

  return (
    <>
      {/* Inject keyframes once */}
      <style>{`
        @keyframes mc-flash {
          0%   { opacity:0; transform:scale(.2) }
          18%  { opacity:1 }
          100% { opacity:0; transform:scale(1.5) }
        }
        @keyframes mc-leaf-drop {
          0%   { opacity:0; transform:translateY(-30px) translateX(0) rotate(0) }
          8%   { opacity:1 }
          100% { opacity:0; transform:translateY(600px) translateX(var(--dx,30px)) rotate(540deg) }
        }
      `}</style>

      <div
        ref={containerRef}
        className={cn(
          'fixed inset-0 z-[100] flex items-center justify-center overflow-hidden',
          'transition-opacity duration-[600ms]',
          visible ? 'opacity-100' : 'opacity-0',
        )}
        style={{ backgroundColor: config.bgColor }}
      >
        {/* One-shot flash */}
        <div
          ref={flashRef}
          style={{
            position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0,
            background: 'radial-gradient(circle at 50% 40%,rgba(255,255,255,.95),rgba(230,178,34,.5) 35%,transparent 70%)',
          }}
        />

        {isShimmer && phase === 'transition' && (
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 via-amber-400/10 to-blue-500/20 animate-pulse pointer-events-none" />
        )}
        {!isShimmer && phase === 'transition' && (
          <div className="absolute inset-0 bg-white/5 pointer-events-none" />
        )}
        {phase === 'transition' && (
          <div className="absolute text-5xl animate-spin pointer-events-none" style={{ animationDuration: '2s' }}>
            {isShimmer ? '✦' : '◈'}
          </div>
        )}

        <div className={cn(
          'text-center px-8 max-w-sm transition-all duration-700 flex flex-col items-center',
          phase === 'stage' ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 scale-95 pointer-events-none',
        )}>
          {isStreakRing ? (
            <StreakRing
              previousValue={event.meta?.previousStreak ?? 0}
              newValue={event.meta?.newStreak ?? 0}
              onComplete={triggerPayoff}
            />
          ) : (
            <div className="text-6xl mb-6">{current.icon}</div>
          )}
          <p className={cn('text-[22px] font-bold leading-snug mb-3', current.headingColor)}>
            {current.heading}
          </p>
          <p className={cn('text-[15px] leading-relaxed', current.bodyColor)}>
            {current.body}
          </p>
          {current.attribution && (
            <p className="text-[12px] text-white/30 mt-4 italic">{current.attribution}</p>
          )}
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/src/components/celebration/MilestoneOverlay.tsx
git commit -m "feat(gamification): MilestoneOverlay — ring + confetti payoff"
```

---

### Task 12: StreakRing + GrowthMedallion components

**Files:**
- Create: `app/src/components/celebration/StreakRing.tsx`
- Create: `app/src/components/celebration/GrowthMedallion.tsx`

- [ ] **Step 1: Create StreakRing.tsx**

```tsx
// app/src/components/celebration/StreakRing.tsx
// Duolingo-style choreography: SVG arc sweeps 0°→360°, then number rolls prev→new.
import { useEffect, useRef, useState } from 'react'

const R = 66
const CIRCUMFERENCE = 2 * Math.PI * R

interface Props {
  previousValue: number
  newValue:      number
  onComplete?:   () => void  // fires when number lands (payoff moment)
}

export function StreakRing({ previousValue, newValue, onComplete }: Props) {
  const progRef    = useRef<SVGCircleElement>(null)
  const [display, setDisplay] = useState(previousValue)
  const [popped,  setPopped]  = useState(false)
  const onCompleteRef = useRef(onComplete)
  useEffect(() => { onCompleteRef.current = onComplete })

  useEffect(() => {
    setDisplay(previousValue)
    setPopped(false)

    const prog = progRef.current
    if (!prog) return

    // Reset arc
    prog.style.transition = 'none'
    prog.style.strokeDashoffset = String(CIRCUMFERENCE)
    void prog.offsetWidth

    // Sweep arc
    const tSweep = setTimeout(() => {
      prog.style.transition = 'stroke-dashoffset 1.3s cubic-bezier(.45,.05,.3,1)'
      prog.style.strokeDashoffset = '0'
    }, 150)

    // Payoff: arc closes → number rolls
    const tPayoff = setTimeout(() => {
      setPopped(true)
      onCompleteRef.current?.()
      // Animate number from prev to new
      const start = Date.now()
      const duration = 480
      function tick() {
        const t = Math.min((Date.now() - start) / duration, 1)
        const ease = 1 - Math.pow(1 - t, 3)
        setDisplay(Math.round(previousValue + (newValue - previousValue) * ease))
        if (t < 1) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }, 1450)

    return () => {
      clearTimeout(tSweep)
      clearTimeout(tPayoff)
    }
  }, [previousValue, newValue])

  return (
    <div style={{ position: 'relative', width: 150, height: 150, margin: '0 auto 22px' }}>
      <svg width="150" height="150" viewBox="0 0 150 150" style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx="75" cy="75" r={R} fill="none" strokeWidth="7"
          stroke="rgba(255,255,255,.08)"
        />
        <circle
          ref={progRef}
          cx="75" cy="75" r={R} fill="none" strokeWidth="7"
          stroke="#00959c"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE}
          style={{ filter: 'drop-shadow(0 0 6px rgba(0,149,156,.55))' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <b style={{
          fontSize: 46, color: '#fff', fontWeight: 800, letterSpacing: '-.02em', lineHeight: 1,
          display: 'inline-block',
          transform: popped ? 'scale(1)' : 'scale(1)',
          animation: popped ? 'mc-ring-pop .42s cubic-bezier(.2,1.4,.4,1) 1' : 'none',
        }}>
          {display}
        </b>
        <small style={{ fontSize: 10, letterSpacing: '.16em', color: '#7fd4d6', marginTop: 4, textTransform: 'uppercase' }}>
          day streak
        </small>
      </div>
      <style>{`
        @keyframes mc-ring-pop {
          0%   { transform: scale(1) }
          45%  { transform: scale(1.32) }
          100% { transform: scale(1) }
        }
      `}</style>
    </div>
  )
}
```

- [ ] **Step 2: Create GrowthMedallion.tsx**

Used in Seedling-view badge screens as the visual centrepiece (replaces the text icon when `variant === 'badge'` in orchard mode — future enhancement, currently the icon field carries the emoji).

```tsx
// app/src/components/celebration/GrowthMedallion.tsx
// SVG growth mark: teal cloud-leaf with golden accent stars.
// Sizes: sm (64px), md (84px — default), lg (128px).
interface Props {
  size?: 'sm' | 'md' | 'lg'
}

const SIZES = { sm: 64, md: 84, lg: 128 }

export function GrowthMedallion({ size = 'md' }: Props) {
  const px = SIZES[size]
  return (
    <svg width={px} height={px} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="gm-leaf" x1="20" y1="14" x2="80" y2="70" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3fcf9b"/><stop offset="1" stopColor="#00959c"/>
        </linearGradient>
        <linearGradient id="gm-trunk" x1="50" y1="58" x2="50" y2="90" gradientUnits="userSpaceOnUse">
          <stop stopColor="#caa15a"/><stop offset="1" stopColor="#8a6a2f"/>
        </linearGradient>
      </defs>
      {/* Trunk */}
      <path d="M50 88 V60" stroke="url(#gm-trunk)" strokeWidth="6.5" strokeLinecap="round"/>
      <path d="M50 70 C50 70 40 64 36 56" stroke="url(#gm-trunk)" strokeWidth="4" strokeLinecap="round"/>
      <path d="M50 64 C50 64 60 60 64 53" stroke="url(#gm-trunk)" strokeWidth="4" strokeLinecap="round"/>
      {/* Canopy */}
      <path d="M50 12 C30 18 22 34 30 48 C16 50 14 66 30 70 C44 74 56 74 70 70 C86 66 84 50 70 48 C78 34 70 18 50 12 Z" fill="url(#gm-leaf)"/>
      {/* Midrib */}
      <path d="M50 12 C50 30 50 52 50 66" stroke="#0f1a14" strokeOpacity=".18" strokeWidth="2.5" strokeLinecap="round"/>
      {/* Gold fruits */}
      <circle cx="38" cy="44" r="4.4" fill="#e6b222"/>
      <circle cx="63" cy="38" r="3.4" fill="#e6b222"/>
      {/* Star accent */}
      <path d="M72 20 l2.4 5 5 2.4 -5 2.4 -2.4 5 -2.4 -5 -5 -2.4 5 -2.4 Z" fill="#ffe39a"/>
    </svg>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/src/components/celebration/StreakRing.tsx app/src/components/celebration/GrowthMedallion.tsx
git commit -m "feat(gamification): StreakRing SVG + GrowthMedallion components"
```

---

### Task 13: MicroToast component

**Files:**
- Create: `app/src/components/celebration/MicroToast.tsx`

Micro-tier events (STREAK_LOST) show an inline toast rather than a full-screen overlay.

- [ ] **Step 1: Create MicroToast.tsx**

```tsx
// app/src/components/celebration/MicroToast.tsx
// Displays a Micro-tier celebration event as a dismissible bottom toast.
import { useEffect, useState } from 'react'
import { cn } from '../../lib/utils'
import type { MilestoneEvent } from './types'
import { CONFIGS } from './registry'

interface Props {
  event:      MilestoneEvent
  onDismiss:  () => void
}

export function MicroToast({ event, onDismiss }: Props) {
  const config = CONFIGS[event.type]
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Animate in
    requestAnimationFrame(() => setVisible(true))
    // Auto-dismiss after 3s
    const t = setTimeout(() => {
      setVisible(false)
      setTimeout(onDismiss, 400)
    }, 3000)
    return () => clearTimeout(t)
  }, [onDismiss])

  if (!config) return null

  const stage = event.appView === 'CLEAN' ? config.clean[0] : config.orchard[0]
  if (!stage) return null

  return (
    <div
      className={cn(
        'fixed bottom-6 left-1/2 -translate-x-1/2 z-[90]',
        'flex items-center gap-3 px-4 py-3 rounded-2xl',
        'bg-[#1b2d2e] border border-white/10 shadow-xl',
        'transition-all duration-400',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4',
      )}
      style={{ maxWidth: 320 }}
    >
      <span className="text-2xl">{stage.icon}</span>
      <div className="flex-1 min-w-0">
        <p className={cn('text-[13px] font-semibold leading-snug', stage.headingColor)}>
          {stage.heading}
        </p>
        <p className={cn('text-[11px] leading-snug mt-0.5 truncate', stage.bodyColor)}>
          {stage.body}
        </p>
      </div>
      <button
        onClick={() => { setVisible(false); setTimeout(onDismiss, 400) }}
        className="text-white/30 hover:text-white/60 text-lg leading-none ml-1"
        aria-label="Dismiss"
      >×</button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/src/components/celebration/MicroToast.tsx
git commit -m "feat(gamification): MicroToast for Micro-tier events"
```

---

## Phase C — Child Dashboard

---

### Task 14: Wire streak state + celebrations into child dashboard

**Files:**
- Modify: the child dashboard screen that calls `GET /api/balance`

- [ ] **Step 1: Find the balance fetch**

```bash
grep -r "api/balance" app/src/ -l
```

Open the file and locate where the `/api/balance` response is consumed.

- [ ] **Step 2: Parse streak state and pending celebrations from the response**

In the component that consumes the balance API response, add:

```typescript
import { queueCelebration, consumeNextCelebration } from '../components/celebration'
import type { MilestoneEvent, MilestoneEventType } from '../components/celebration'
import { MilestoneOverlay } from '../components/celebration'
import { MicroToast } from '../components/celebration/MicroToast'
import { useTone } from '../lib/useTone' // to get appView

// Inside the component:
const { appView } = useTone()
const [activeCelebration, setActiveCelebration] = useState<MilestoneEvent | null>(null)

// Parse pending_celebrations from balance response and enqueue them
function enqueuePendingCelebrations(pending: string[], av: typeof appView) {
  for (const raw of pending) {
    // Format: "TYPE" or "TYPE:prev:next"
    const [type, prevStr, nextStr] = raw.split(':')
    const event: MilestoneEvent = {
      type: type as MilestoneEventType,
      appView: av,
      meta: {
        previousStreak: prevStr ? Number(prevStr) : undefined,
        newStreak:      nextStr ? Number(nextStr) : undefined,
      },
    }
    queueCelebration(event)
  }
}
```

- [ ] **Step 3: Drain the queue on dashboard mount**

After enqueueing, drain the next item and show it:

```typescript
useEffect(() => {
  if (balanceData?.pending_celebrations) {
    enqueuePendingCelebrations(balanceData.pending_celebrations, appView)
  }
  // Drain one celebration per mount
  if (!activeCelebration) {
    const next = consumeNextCelebration()
    if (next) setActiveCelebration(next)
  }
}, [balanceData, appView])
```

- [ ] **Step 4: Render the celebration overlay or toast**

In the JSX return, add at the top level (outside other layout):

```tsx
{activeCelebration && CONFIGS[activeCelebration.type]?.tier === 'micro' ? (
  <MicroToast
    event={activeCelebration}
    onDismiss={() => setActiveCelebration(null)}
  />
) : activeCelebration ? (
  <MilestoneOverlay
    event={activeCelebration}
    onComplete={() => setActiveCelebration(null)}
  />
) : null}
```

Import `CONFIGS` from `'../components/celebration/registry'`.

- [ ] **Step 5: Display streak in the child dashboard UI**

Wherever the child's balance summary is shown, add the streak chip. Use the streak data from the balance response:

```tsx
{balanceData?.streak && (
  <div className="flex items-center gap-2 text-sm text-teal-400 font-semibold tabular-nums">
    <span>🔥</span>
    <span>{balanceData.streak.current} day streak</span>
    {balanceData.streak.grace_remaining > 0 && (
      <span className="text-white/40 text-xs">
        ({balanceData.streak.grace_remaining} {appView === 'CLEAN' ? 'grace' : 'rain'}{balanceData.streak.grace_remaining > 1 ? ' days' : ' day'})
      </span>
    )}
  </div>
)}
```

- [ ] **Step 6: Commit**

```bash
git add <child-dashboard-file>
git commit -m "feat(gamification): wire streak state + celebration queue into child dashboard"
```

---

### Task 15: BadgeAlmanac component

**Files:**
- Create: `app/src/components/dashboard/BadgeAlmanac.tsx`

Shows earned badges and silhouettes of locked badges with unlock criteria and progress bars.

- [ ] **Step 1: Create BadgeAlmanac.tsx**

```tsx
// app/src/components/dashboard/BadgeAlmanac.tsx
import { cn } from '../../lib/utils'
import { BADGE_THRESHOLDS, type BadgeKey } from '../../../worker/src/lib/badges'

// Badge display metadata — mode-aware labels and unlock hints
const BADGE_META: Record<BadgeKey, { label: string; orchardLabel: string; pillar: number }> = {
  CONSISTENCY_SEED:    { label: 'Consistency I',    orchardLabel: 'Seedling — Consistency',    pillar: 3 },
  CONSISTENCY_SAPLING: { label: 'Consistency II',   orchardLabel: 'Sapling — Consistency',     pillar: 3 },
  CONSISTENCY_OAK:     { label: 'Consistency III',  orchardLabel: 'Oak — Consistency',          pillar: 3 },
  EFFORT_SEED:         { label: 'Effort I',          orchardLabel: 'Seedling — Effort',          pillar: 1 },
  EFFORT_SAPLING:      { label: 'Effort II',         orchardLabel: 'Sapling — Effort',           pillar: 1 },
  EFFORT_OAK:          { label: 'Effort III',        orchardLabel: 'Oak — Effort',               pillar: 1 },
  SAVER_SEED:          { label: 'Saver I',           orchardLabel: 'Seedling — Saver',           pillar: 2 },
  SAVER_SAPLING:       { label: 'Saver II',          orchardLabel: 'Sapling — Saver',            pillar: 2 },
  SAVER_OAK:           { label: 'Saver III',         orchardLabel: 'Oak — Saver',                pillar: 2 },
  SCHOLAR_SEED:        { label: 'Scholar I',         orchardLabel: 'Seedling — Scholar',         pillar: 4 },
  SCHOLAR_SAPLING:     { label: 'Scholar II',        orchardLabel: 'Sapling — Scholar',          pillar: 4 },
  SCHOLAR_OAK:         { label: 'Scholar III',       orchardLabel: 'Oak — Scholar',              pillar: 4 },
  LANDMARK_SEED:       { label: 'Landmark I',        orchardLabel: 'Seedling — Landmark',        pillar: 5 },
  LANDMARK_SAPLING:    { label: 'Landmark II',       orchardLabel: 'Sapling — Landmark',         pillar: 5 },
  LANDMARK_OAK:        { label: 'Landmark III',      orchardLabel: 'Oak — Landmark',             pillar: 5 },
}

const ALL_BADGE_KEYS = Object.keys(BADGE_THRESHOLDS) as BadgeKey[]

interface ProgressInput {
  currentStreak:        number
  totalApprovedChores:  number
  totalGoalsCompleted:  number
  totalSavedPence:      number
  totalLessonsCompleted: number
}

function getProgress(key: BadgeKey, p: ProgressInput): { value: number; max: number } | null {
  const t = BADGE_THRESHOLDS[key]
  if ('streak' in t)      return { value: p.currentStreak,          max: t.streak }
  if ('chores' in t)      return { value: p.totalApprovedChores,    max: t.chores }
  if ('goals' in t)       return { value: p.totalGoalsCompleted,    max: t.goals }
  if ('savedPence' in t)  return { value: p.totalSavedPence,        max: t.savedPence }
  if ('lessons' in t)     return { value: p.totalLessonsCompleted,  max: t.lessons }
  return null
}

function getUnlockHint(key: BadgeKey): string {
  const t = BADGE_THRESHOLDS[key]
  if ('streak' in t)      return `${t.streak}-day streak`
  if ('chores' in t)      return `${t.chores} approved chores`
  if ('goals' in t)       return `${t.goals} saving goal${t.goals > 1 ? 's' : ''} completed`
  if ('savedPence' in t)  return `£${t.savedPence / 100} total saved`
  if ('lessons' in t)     return `${t.lessons} lesson${t.lessons > 1 ? 's' : ''} completed`
  if ('isFirstChore' in t)  return 'First chore approved'
  if ('isFirstPayday' in t) return 'First payout received'
  return ''
}

interface Props {
  earnedBadgeKeys: string[]
  progress:        ProgressInput
  appView:         'ORCHARD' | 'CLEAN'
}

export function BadgeAlmanac({ earnedBadgeKeys, progress, appView }: Props) {
  const earnedSet = new Set(earnedBadgeKeys)

  return (
    <section className="mt-6">
      <h2 className={cn(
        'text-[13px] font-semibold uppercase tracking-widest mb-4',
        appView === 'CLEAN' ? 'text-white/40' : 'text-emerald-400/60',
      )}>
        {appView === 'CLEAN' ? 'Badge Record' : 'Your Badges'}
      </h2>
      <div className="grid grid-cols-3 gap-3">
        {ALL_BADGE_KEYS.map(key => {
          const earned = earnedSet.has(key)
          const meta   = BADGE_META[key]
          const prog   = earned ? null : getProgress(key, progress)
          const label  = appView === 'CLEAN' ? meta.label : meta.orchardLabel

          return (
            <div
              key={key}
              className={cn(
                'rounded-2xl p-3 flex flex-col items-center text-center gap-2',
                earned
                  ? 'bg-[#1b2d2e] border border-teal-500/30'
                  : 'bg-white/[.03] border border-white/[.06]',
              )}
            >
              {earned ? (
                <div className="w-10 h-10 rounded-full bg-teal-500/20 flex items-center justify-center text-xl">
                  {key.endsWith('_SEED') ? '🌱' : key.endsWith('_SAPLING') ? '🌿' : '🌳'}
                </div>
              ) : (
                <div className="w-10 h-10 rounded-full bg-white/[.04] flex items-center justify-center">
                  <span className="text-white/20 text-xl">◌</span>
                </div>
              )}

              <p className={cn(
                'text-[10px] font-semibold leading-tight',
                earned ? (appView === 'CLEAN' ? 'text-white/80' : 'text-emerald-300') : 'text-white/30',
              )}>
                {label}
              </p>

              {!earned && (
                <>
                  <p className="text-[9px] text-white/25 leading-tight">{getUnlockHint(key)}</p>
                  {prog && (
                    <div className="w-full bg-white/[.06] rounded-full h-1">
                      <div
                        className="bg-teal-500/50 h-1 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, (prog.value / prog.max) * 100)}%` }}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Wire BadgeAlmanac into the child dashboard**

In the child dashboard screen, import and render the Almanac below the balance summary. The `progress` object is derived from the same balance API response where available, supplemented by the streaks API:

```tsx
import { BadgeAlmanac } from '../components/dashboard/BadgeAlmanac'

// In JSX (below the balance summary):
{streakData && (
  <BadgeAlmanac
    earnedBadgeKeys={streakData.earned_badge_keys}
    progress={{
      currentStreak:         streakData.current_streak,
      totalApprovedChores:   completionCount ?? 0,
      totalGoalsCompleted:   goalsData?.completed ?? 0,
      totalSavedPence:       goalsData?.total_saved_pence ?? 0,
      totalLessonsCompleted: 0, // until Learning Lab ships
    }}
    appView={appView === 'CLEAN' ? 'CLEAN' : 'ORCHARD'}
  />
)}
```

Fetch `streakData` from `GET /api/streaks/:child_id` (added in Task 4) when the child dashboard mounts.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/dashboard/BadgeAlmanac.tsx <child-dashboard-file>
git commit -m "feat(gamification): BadgeAlmanac component + child dashboard integration"
```

---

## Phase D — Parent-Side

---

### Task 16: StreakChip component

**Files:**
- Create: `app/src/components/dashboard/StreakChip.tsx`

A compact read-only streak indicator for the parent's child overview.

- [ ] **Step 1: Create StreakChip.tsx**

```tsx
// app/src/components/dashboard/StreakChip.tsx
import { cn } from '../../lib/utils'

interface Props {
  currentStreak:       number
  graceRemaining:      number
  consistencyScore:    number
  appView:             'ORCHARD' | 'CLEAN'
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
```

- [ ] **Step 2: Commit**

```bash
git add app/src/components/dashboard/StreakChip.tsx
git commit -m "feat(gamification): StreakChip parent dashboard component"
```

---

### Task 17: Wire StreakChip into parent dashboard

**Files:**
- Modify: parent dashboard screen (wherever child cards/list are rendered)

- [ ] **Step 1: Find the parent child-list component**

```bash
grep -r "child_id\|childId\|ChildCard\|child_name" app/src/ -l | grep -v node_modules
```

Open the file that renders the parent's list of children.

- [ ] **Step 2: Fetch streak data per child**

For each child displayed, fetch `GET /api/streaks/:child_id`. If the parent dashboard already fetches per-child balance, add `streaks` to the same parallel fetch block:

```typescript
const [balanceData, streakData] = await Promise.all([
  fetch(`/api/balance?family_id=${familyId}&child_id=${child.id}`, { headers }).then(r => r.json()),
  fetch(`/api/streaks/${child.id}`, { headers }).then(r => r.json()),
])
```

- [ ] **Step 3: Render StreakChip in the child card**

```tsx
import { StreakChip } from '../components/dashboard/StreakChip'

// Inside the child card JSX, below the child's name/balance:
<StreakChip
  currentStreak={streakData?.current_streak ?? 0}
  graceRemaining={streakData?.grace_days_remaining ?? 0}
  consistencyScore={streakData?.consistency_score ?? 0}
  appView="ORCHARD" // parent view — always uses accessible language
/>
```

- [ ] **Step 4: Commit**

```bash
git add <parent-dashboard-file>
git commit -m "feat(gamification): StreakChip wired into parent child overview"
```

---

## Spec Coverage Check

| Spec requirement | Task that implements it |
|---|---|
| Streak: kept-days mechanic, due_date gate | Tasks 2, 5 |
| Streak: grace days (+1 per 7 kept, cap 2) | Task 2 (buildStreakEvent) |
| Streak: miss detection on dashboard load | Task 6 |
| Streak: grace used on miss (GRACE_USED) | Tasks 2, 6 |
| Consistency Score (last 30 days) | Task 2 (getConsistencyScore) |
| Streak milestones: 3/7/14/30/LOST/REVIVED | Tasks 5, 6, 9 |
| Duolingo ring choreography | Tasks 11, 12 |
| One-shot confetti on Standard/Landmark | Task 11 |
| Anti-fatigue: FIFO same-tier, highest wins | Task 7 |
| MicroToast for Micro-tier | Task 13 |
| Badge system: 5 tracks × 3 tiers | Tasks 3, 10 |
| Badge Almanac with locked silhouettes + progress | Task 15 |
| Badge Almanac: unlock criteria text | Task 15 |
| GET /api/streaks/:child_id | Task 4 |
| StreakChip in parent dashboard | Tasks 16, 17 |
| Celebration queue drains one per mount | Task 14 |
| Seedling vs Professional mode-aware copy | Tasks 9, 10, 15 |
