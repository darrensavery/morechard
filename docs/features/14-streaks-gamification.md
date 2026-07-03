---
feature: 14-streaks-gamification
title: Streaks & Gamification
---

### Purpose

Children earn daily streaks when all assigned chores are approved, building a visible momentum signal that reinforces consistent behaviour. The badge system layers on top to reward cumulative milestones across five pillars (effort, consistency, saving, learning, and landmark firsts), giving children identity-level recognition rather than point totals.

### Methodology

**Streak Engine (worker)**

- `GET /api/streaks/:child_id` returns `current_streak`, `longest_streak`, `grace_days_remaining`, `last_kept_date`, a 30-day consistency score (%), and the child's earned badge keys. A parent or the child themselves may call this endpoint; other roles are rejected.
- Streak state lives in the `child_streaks` D1 table. Two pure functions — `buildStreakEvent` and `buildMissEvent` — compute state transitions without touching D1, making them unit-testable. A KEPT event fires when all completions for a given UTC day reach `status = 'completed'`. A MISSED event fires when a chore day passes without completion. Grace days (max 2, earned every 7 consecutive kept days) absorb a single missed day without breaking the streak.
- Consistency score is derived from the last 30 days: days where every completion was approved divided by total days with any scheduled chores, expressed as a percentage.

**Badge Engine (worker/lib)**

- `badgesToAward()` evaluates 15 badge thresholds (3 tiers × 5 tracks) from a single shared `BADGE_THRESHOLDS` constant in `/shared/badges.ts`. Consistency badges use `longestStreak` (not current) so they survive a broken streak. New badges are batch-inserted into `child_badges` via `insertBadges()`.
- Badge stats (`getBadgeStats`) are fetched in a single parallel D1 batch: approved chore count, completed goals, total saved pence, lesson completions, and payout count.

**UI Components (app)**

- `StreakChip` — renders a flame pill with current streak, grace days remaining, and consistency %. Hidden below a 2-day streak. Teal tint with grace days; amber without.
- `BadgeAlmanac` — 3-column grid of all 15 badges. Earned badges show full colour; unearned show a progress bar. A "Next Up" hero card highlights the closest unearned badge by progress percentage. Orchard/Clean view mode switches label copy.
- `AnimatedStat` — generic fade-swap component used by both panels to cross-fade numeric values on change.

### Dependencies

- **External packages**: None beyond project-standard Cloudflare Workers runtime
- **Internal modules**: `worker/src/lib/streaks.ts` (state machine + D1 helpers), `worker/src/lib/badges.ts` (award logic + D1 helpers), `shared/badges.ts` (threshold constants, shared by both worker and app), `worker/src/lib/response.ts`, `worker/src/lib/jwt.ts`
- **APIs / services**: Cloudflare D1 (`child_streaks`, `child_badges`, `completions`, `goals`, `lesson_completions`, `payouts` tables); no third-party services
