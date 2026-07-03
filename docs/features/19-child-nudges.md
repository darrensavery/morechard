---
feature: 19-child-nudges
title: Child Nudges
---

### Purpose

Delivers short, personalised coaching messages to children on the earn, money, and goals screens — grounded in their real activity data. Nudges reinforce the five financial literacy pillars (Labor Value, Delayed Gratification, Opportunity Cost, Capital Management, Social Responsibility) without requiring AI inference at read time, keeping latency near-zero for the child.

### Methodology

**Content library**

A static `NUDGES` record maps 35+ trigger keys to a `NudgeDef` containing: target screen (`earn` | `money` | `goals`), financial pillar, tone, a parent-visible summary, and two copy variants — `orchard` (nature metaphors, warm) and `clean` (direct financial language). The app_view stored on the child's session determines which variant is displayed. Goal-specific nudges support a `{goal}` placeholder resolved at write time.

**Write path — three entry points**

- `generateChildNudge` — unconditional write; used for event milestones (streaks, earnings thresholds, first task complete).
- `generateOnceChildNudge` — idempotency guard via a `SELECT` before writing; used for once-ever milestones (give jar activated, earnings\_milestone\_\*, multi\_goal\_portfolio).
- `maybeGenerateChildNudge` — two-layer dedup: rejects if the same trigger fired in the past 7 days, or if any nudge for the same screen was generated in the past 7 days. Caps background nudges at 3/week (one per screen).

**Read path**

- `GET /api/child-nudges?child_id=X` — returns up to one active (non-dismissed, non-expired) nudge per screen context, most-recent wins. Children can only read their own; parents can read any child in their family.
- `POST /api/child-nudges/dismiss` — child-only; sets `is_dismissed = 1` on the row.

**Background CRON (Sunday 20:00 UTC)**

`runChildNudgeBackgroundChecks` sweeps all active children and calls `checkPatterns`, which queries D1 for: recent completions (14-day window), ledger balance, active goals, jar allocation split, give-jar activity, weekly balance trend, task pass rate, repeat spend categories, and Learning Lab reinforcement flags. Each pattern uses `maybeGenerateChildNudge`, so the screen-throttle cap applies across all checks for a given child in a single sweep.

**Nudge expiry**

Every row written includes `expires_at = now + 7 days`. The GET endpoint filters on `expires_at > now`, so stale nudges drop off without a cleanup job.

### Dependencies

- **External packages**: None beyond the Cloudflare Worker runtime.
- **Internal modules**: `../lib/response.js` (json/error helpers), `../lib/jwt.js` (JwtPayload type), `../lib/logger.js` (structured error logging). The three exported write functions (`generateChildNudge`, `generateOnceChildNudge`, `maybeGenerateChildNudge`) are called directly by other route handlers (completions, goals, jars, finance, chores, Learning Lab routes).
- **APIs / services**: Cloudflare D1 (`env.DB`) — tables `child_nudges`, `users`, `families`, `ledger`, `goals`, `completions`, `jar_config`. No external API calls; all nudge copy is rule-based and resolved locally.
