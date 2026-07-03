---
feature: 29-dev-tools
title: Dev & Testing Tools
---

### Purpose

Morechard's Learning Lab triggers, streak milestones, and passive sweeps require days or weeks of real data to fire — making them impractical to test manually. This feature provides two complementary dev-only tools: a SQL seed library that loads backdated database state into `morechard-dev`, and a browser-side Dev Trigger Panel that lets developers inspect child state and fire celebration overlays instantly. Both are gated to the development environment and stripped from production.

### Methodology

**Worker API (`worker/src/routes/dev.ts`)**

All routes return `404` unless `env.ENVIRONMENT === 'development'`.

- `GET /dev/trigger-status?child_id=<id>` — Runs five parallel D1 queries to return the child's unlocked modules, earned badges, current/longest streak, lifetime earnings, and current balance in a single JSON response.
- `POST /dev/run-passive?child_id=<id>` — Snapshots the child's unlocked modules, calls `evaluatePassive()` from `labTriggers.ts`, then diffs the result to report which modules were newly unlocked. Errors from the evaluator are caught and surfaced in the response rather than propagated.

**SQL Seed Library (`worker/dev/seeds/`)**

Seeds write backdated rows directly to the remote `morechard-dev` D1 database via `wrangler d1 execute`. Each npm script chains `_reset.sql` + `_base.sql` + a scenario file (e.g. `state-m13.sql`). Rows are tagged `is_seed = 1` for safe cleanup via `seed:reset`. Ledger rows use placeholder hash values — real SHA-256 chain integrity is not maintained in seeds by design.

**Dev Trigger Panel (client-side)**

A floating panel rendered only when `import.meta.env.DEV` is true (stripped at build). Two tabs:
- **Overlays tab** — Renders a button per `MilestoneEventType`. Clicking pushes the event to `localStorage.mc_celebration_queue` and reloads; `ChildDashboard` reads the queue on mount and renders the overlay. Supports ORCHARD/CLEAN view toggle.
- **Status tab** — Calls `/dev/trigger-status` and displays balance, earnings, streaks, modules, and badges. The "Run Passive" button calls `/dev/run-passive` and reports newly unlocked modules.

### Dependencies

- **External packages**: `wrangler` CLI (D1 query execution for seeds)
- **Internal modules**: `worker/src/lib/labTriggers.ts` (`evaluatePassive`), `worker/src/types.ts` (`Env`), `worker/src/lib/streaks.ts` (called by event routes, not directly by dev tools), `ChildDashboard` component (reads `mc_celebration_queue`)
- **APIs / services**: Cloudflare D1 (`morechard-dev` remote database only); no third-party services involved
