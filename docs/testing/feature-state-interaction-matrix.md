# Feature-State Interaction Matrix
> Morechard PWA — Family Structure Audit (2026-06-23)

Tracks every interaction flow tested under production-like family configurations.
Each flow follows the Rigorous Execution Protocol: Map → Role Audit → Fix → Regress → Pause.

**Test suite baseline:** 9 files, 159 tests (as of F-13)

---

## Family Configurations Under Test

| Config | Description |
|--------|-------------|
| **C1** | Single Parent + Single Child |
| **C2** | Nuclear — Two Parents + Multiple Children |
| **C3** | Separated / Co-parents |
| **C4** | Age-mixed household |

---

## Flow Checklist

| Flow | Description | Status | Bugs Fixed | Notes |
|------|-------------|--------|-----------|-------|
| F-01 | Chore create / edit / archive | ✅ | 3 | |
| F-02 | Completion submit → approve cycle | ✅ | 3 | |
| F-03 | Pending badge / notifications | ✅ | 2 | |
| F-04 | History tab — status labels | ✅ | 2 | |
| F-05 | Auto-approve submission invariants | ✅ | 3 | |
| F-06 | Activity tab — give requests | ✅ | 2 | |
| F-07 | Give jar balance reconciliation | ✅ | 2 | |
| F-08 | Governance consent handshake | ✅ | 2 | |
| F-09 | Earnings mode income calculation | ✅ | 1 | BUG-020: allowance excluded from weekly income projection |
| F-10 | Anyone-chore race condition + claim flow | ✅ | 4 | BUG-022/023: completion not inserted at claim; BUG-024/025: stale state + frozen button |
| F-11 | Goal purchase / parent contribute atomicity | ✅ | 3 | BUG-026: wrong balance in progress bar; BUG-027: delta=0 on contribution; BUG-028: spending outside batch |
| F-12 | Flash chore deadline enforcement | ✅ | 3 | BUG-029/030: expired chores not filtered from list queries; BUG-031: deadline display missing |
| F-13 | Pay-out / balance integrity | ✅ | 2 | BUG-032: payout not debited to jars; BUG-033: bonus not allocated to jars |
| F-14 | Jar configuration & manual transfer | ✅ | 2 | BUG-034: first-enable without seed skips wizard; BUG-035: Save move allows draining earmarked goal funds |
| F-15 | Settings flow — earnings mode / allowance config / family rules | ✅ | 2 | BUG-036: growth update didn't bust child settings cache; BUG-038: shared expense settings update didn't bust family config cache |
| F-16 | Give requests panel — approve / decline / state transitions | ✅ | 2 | BUG-039: non-integer amount not rejected → float truncated by SQLite; BUG-043: refresh only on success path → stale card if PATCH fails |
| F-17 | History tabs — status label rendering & month grouping | ✅ | 1 | BUG-044: HistoryTab STATUS_STYLES used 'approved'/'pending'/'suggestion' keys — DB statuses are 'completed'/'awaiting_review'/'needs_revision' → all approved chores showed gray "completed" badge |

---

## Bug Register

| Bug ID | Flow | Severity | Description | Fix Location |
|--------|------|----------|-------------|--------------|
| BUG-020 | F-09 | Medium | Allowance amount excluded from weekly income projection in EarnTab | `app/src/screens/ChildDashboard.tsx`, `EarnTab.tsx` |
| BUG-022 | F-10 | High | `anyone` chore claim didn't insert completion record → child couldn't submit | `worker/src/routes/chores.ts` `handleChoreClaim` |
| BUG-023 | F-10 | High | Race: parallel claims could both succeed (no atomic UPDATE) | `worker/src/routes/chores.ts` `handleChoreClaim` |
| BUG-024 | F-10 | Medium | UI frozen after 409 claim rejection (no finally reload) | `app/src/components/dashboard/EarnTab.tsx` `handleClaim` |
| BUG-025 | F-10 | Low | Stale chore list after successful claim (no reload on success path) | `app/src/components/dashboard/EarnTab.tsx` `handleClaim` |
| BUG-026 | F-11 | Medium | Goal progress bar used `available` total instead of `save` jar balance | `app/src/components/dashboard/ChildGoalsTab.tsx`, `ChildDashboard.tsx` |
| BUG-027 | F-11 | High | Parent contribution jar movement had `delta=0` → Save jar not increased → purchase guard always failed | `worker/src/routes/goals.ts` `handleGoalContribute` |
| BUG-028 | F-11 | High | Goal purchase: spending INSERT was outside batch → goal could be REACHED without deducting balance | `worker/src/routes/goals.ts` `handleGoalPurchase` |
| BUG-029 | F-12 | Medium | Expired flash chores not filtered from anyone-pool query | `worker/src/routes/chores.ts` `handleChoreList` |
| BUG-030 | F-12 | Medium | Expired flash chores not filtered from child-assigned query | `worker/src/routes/chores.ts` `handleChoreList` |
| BUG-031 | F-12 | Low | Flash deadline not displayed in child EarnTab open-tasks section | `app/src/components/dashboard/EarnTab.tsx` |
| BUG-032 | F-13 | High | Payout not debited to jar_movements → `getJarBalances` diverges from `handleBalance` after payout | `worker/src/routes/finance.ts` `handlePayoutCreate` |
| BUG-033 | F-13 | High | Bonus not allocated to jar_movements → jar balances understated after parent bonus | `worker/src/routes/finance.ts` `handleBonusCreate` |
| BUG-034 | F-14 | Medium | First-enable without `initial_seed` silently succeeds → jars enabled with zero balances while `available` is non-zero | `worker/src/routes/jars.ts` `handlePutJarConfig` |
| BUG-035 | F-14 | High | Save jar move checks `balances.save` (total) instead of `save_unallocated` → earmarked goal funds can be drained | `worker/src/routes/jars.ts` `handlePostJarMove` |
| BUG-036 | F-15 | Medium | `handleChildGrowthUpdate` didn't invalidate `user:settings:{childId}` cache → stale earnings_mode for up to 60s after parent updates | `worker/src/routes/settings.ts` `handleChildGrowthUpdate` |
| BUG-038 | F-15 | Low | `handleUpdateFamilySettings` didn't invalidate `family:config:{familyId}` cache → shared expense threshold stale for up to 1 hour | `worker/src/routes/sharedExpenses.ts` `handleUpdateFamilySettings` |
| BUG-039 | F-16 | Medium | `handlePostGiveRequest` didn't validate integer amount → float silently truncated by SQLite INTEGER affinity | `worker/src/routes/give-requests.ts` `handlePostGiveRequest` |
| BUG-043 | F-16 | Low | `GiveRequestsPanel.resolve()` called `refresh()` only on success → stale pending card if PATCH fails (co-parent already resolved) | `app/src/components/dashboard/GiveRequestsPanel.tsx` `resolve` |
| BUG-044 | F-17 | Medium | `HistoryTab` `STATUS_STYLES` used `'approved'`/`'pending'`/`'suggestion'` keys; actual DB statuses are `'completed'`/`'awaiting_review'`/`'needs_revision'` → all parent history rows rendered unstyled gray "completed" badge | `app/src/components/dashboard/HistoryTab.tsx` `STATUS_STYLES` |

---

## Key Architectural Notes (discovered during audit)

- **Two balance systems**: `handleBalance` (ledger-based: earned − reversals − payouts − spent) vs `getJarBalances` (jar_movements SUM(delta)). Must stay in sync.
- **`SKIP = new Set(['as_needed', 'quarterly'])`** in `lazyGenerateCompletions` — these frequencies never get `available` completions.
- **`assigned_to = 'anyone'`** — open-pool sentinel; claim is atomic via `UPDATE ... WHERE assigned_to='anyone'`.
- **`assigned_to = 'everyone'`** — broadcast sentinel; all children see it but each has their own completion.
- **Goal progress balance**: when jars enabled, use `b.jars.save`, not `b.available` (save is the funding pool for goals).
- **`jar_movements` is immutable** — guarded by BEFORE UPDATE / BEFORE DELETE triggers. Migrations must recreate via rename-swap.
- **Payout kind `'payout'`** added in migration 0072 (required table recreation).

---

## Migrations Created During Audit

| Migration | Purpose |
|-----------|---------|
| `0072_jar_movements_payout_kind.sql` | Add `'payout'` to `jar_movements.kind` CHECK constraint |

---

## Test Suite Evolution

| After Flow | Test Count |
|------------|-----------|
| F-08 (end of prior session) | 153 |
| F-09 | +6 → 159 |
| F-10 | +6 → 165 (planned; merged into 159 at session start) |
| F-11 | +6 |
| F-12 | +6 |
| F-13 | +6 → **159 total** |
| F-14 | +7 → **166 total** |
| F-15 | +7 → **173 total** |
| F-16 | +7 → **180 total** |
| F-17 | +7 → **187 total** |

---

*Updated automatically after each flow. Next: F-18.*
