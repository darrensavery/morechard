---
feature: 06-goals-savings
title: Goals & Savings Grove
---

### Purpose

Goals & Savings Grove lets children set up to five savings targets (toys, games, experiences) and track progress toward each. Parents can contribute fixed amounts, configure auto-allocation percentages from earned income, and optionally match a child's contributions. The feature closes the loop between earning chores and spending money by requiring the Save jar to hold sufficient funds before a purchase can be confirmed.

### Methodology

**API endpoints** (`worker/src/routes/goals.ts`):
- `GET /api/goals` — lists active (non-archived) goals for a child, ordered by `sort_order`
- `POST /api/goals` — creates a goal; enforces 5-goal cap per child; inserts with `status = 'ACTIVE'`
- `PATCH /api/goals/:id` — updates allowed fields (title, target, deadline, alloc_pct, match_rate, product_url, parent_match_pct, parent_fixed_contribution, status)
- `DELETE /api/goals/:id` — soft-archives goal; deallocates earmarked Save jar balance back to unallocated via `jar_movements`
- `POST /api/goals/:id/reorder` — swaps `sort_order` with nearest neighbor (up/down) in a D1 batch
- `POST /api/goals/:id/purchase` — atomically marks goal `REACHED`, inserts a `spending` row, and debits the Save jar; guard checks `balances.save >= target_amount` before any write
- `POST /api/goals/:id/contribute` — parent gifts a fixed `amount_pence`; increments `current_saved_pence` and inserts a `jar_movements` row with `delta = amount_pence` so the Save jar balance increases

**UI components**:
- `SavingsGrove.tsx` — child-facing goal card grid, progress bars, purchase trigger
- `ChildGoalsTab.tsx` — tab wrapper rendering goal list and creation flow
- `GoalBoostingTab.tsx` — parent portal for making fixed contributions and configuring match rates
- `GoalMentorNudge.tsx` — inline AI nudge card displayed alongside active goals

**Side effects** (fire-and-forget on create/archive/purchase):
- Lab triggers (`labTriggers.ts`): `evaluateOnGoalCreate`, `evaluateOnGoalCancel`, `evaluateOnGoalPurchase`
- Child nudges: `goal_created`, `goal_funded`, `gaming_goal_created` (once-ever), `multi_goal_portfolio` (once-ever at 3+ goals)

### Dependencies

- **External packages**: `nanoid` (goal ID generation), Cloudflare D1 (all persistence)
- **Internal modules**: `lib/jar-balance.ts` (jar config + balance reads), `lib/labTriggers.ts` (Learning Lab event evaluation), `routes/child-nudges.ts` (AI nudge generation), `lib/response.ts`, `lib/jwt.ts`, `lib/logger.ts`, `lib/nanoid.ts`
- **APIs / services**: No third-party services; relies on sibling Morechard tables `goals`, `spending`, `jar_movements`, and `jars` (via `jar-balance.ts`)
