---
feature: 10-jars
title: Spend / Save / Give Jars
---

### Purpose

Gives each child a three-way split of their available balance into Spend, Save, and Give jars, teaching intentional allocation before money is earned or spent. The system enforces that jar balances are always consistent with the verified ledger — the seed must equal the child's actual available balance, and moves between jars are validated server-side before writing. Parents can observe jar signals (save-raids, deviation from 70/20/10, give balance age) through the AI Insights pipeline.

### Methodology

**Enabling jars (onboarding)**
- `PUT /api/jars/config` (child-only) upserts `jar_config` with the chosen split percentages and an `initial_seed` object.
- On first enable the server independently calculates available balance from `ledger`, `payouts`, and `spending` tables and rejects the request if `spend + save + give` differs by more than 1p (`422`). Seed amounts are written as `enable_seed` rows in `jar_movements`.
- Default split is 70 / 20 / 10. All three percentages must sum to exactly 100.

**Reading balances**
- `GET /api/jars?family_id=&child_id=` returns current config plus computed balances.
- `getJarBalances` in `lib/jar-balance.ts` sums `delta` per jar from `jar_movements`. Save balance is split into `save_earmarked` (active goal allocations) and `save_unallocated` (movable).

**Moving money between jars**
- `POST /api/jars/move` (child-only) accepts `from_jar`, `to_jar`, `amount` (integer pence).
- Moving from Save checks `save_unallocated`, not the raw Save balance, to protect earmarked goal funds (BUG-035).
- Writes a matched pair of `manual_move` rows atomically. A Save→Spend move triggers a `jar_raid` AI nudge via `generateChildNudge`.

**Give requests**
- `POST /api/give-requests` (child-only) submits a charitable cause against the Give jar.
- Atomically inserts into `give_requests` and deducts from the Give jar via a `give_request` movement row, then cross-links the two via `jar_movement_id`.
- Parents approve or decline via `PUT /api/give-requests/:id`.

**Jar signals**
- `computeJarSignals` (lib/jar-balance.ts) calculates behavioural metrics — save-raid count, give balance age, deviation score from the 70/20/10 baseline — consumed by the AI Insights route.

**UI components**
- `JarCard.tsx` — balance display tile per jar
- `JarDetailSheet.tsx` — transaction history per jar
- `JarSettingsSheet.tsx` — percentage reconfiguration
- `JarOnboardingWizard.tsx` — first-enable flow with seed split UI
- `GiveRequestSheet.tsx` / `GiveRequestsPanel.tsx` — submit and review give requests

### Dependencies

- **External packages**: `@cloudflare/workers-types` (D1Database typing)
- **Internal modules**: `lib/jar-balance.ts` (`getJarConfig`, `getJarBalances`, `getGoalEarmarked`, `computeJarSignals`), `routes/child-nudges.ts` (`generateChildNudge`, `generateOnceChildNudge`), `lib/response.ts`, `lib/jwt.ts`, `lib/logger.ts`
- **APIs / services**: Cloudflare D1 (`jar_config`, `jar_movements`, `give_requests`, `ledger`, `payouts`, `spending`, `goals` tables); `/api/goals` (earmarking); AI Insights route (consumes jar signals)
