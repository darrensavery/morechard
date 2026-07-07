# Balance-Math Shared Fix — Design Spec

**Date:** 2026-07-07
**Status:** Approved for planning
**Origin:** Follow-up noted during Family Audit build — `insights.ts` and
`family-audit.ts` each compute a child's available balance with slightly
different, independently buggy SQL.

## Problem

Both routes compute "available balance" for a child, but neither uses the
canonical formula already established elsewhere in the codebase (`jars.ts`,
`finance.ts` — see comment "same formula as GET /api/balance"):

```sql
SUM(CASE entry_type
      WHEN 'credit'   THEN amount
      WHEN 'reversal' THEN -amount
      WHEN 'payment'  THEN -amount
      ELSE 0 END)
WHERE verification_status IN ('verified_auto','verified_manual')
```

- **`insights.ts:196-202`** (`available_balance_pence`): no `verification_status`
  filter — pending, disputed, and reversed ledger entries all leak into the
  balance. `CASE WHEN entry_type = 'credit' THEN amount ELSE -amount END`
  also implicitly treats `system_note` as a debit, which is harmless today
  (its amount is always inserted as 0) but is incidental, not intentional.
- **`family-audit.ts:99-108`** (per-child `bal`, used to pick the flagged
  child): has the `verification_status` filter, but its `CASE` only handles
  `credit`/`payment` — `reversal` falls into `ELSE 0`, so a child who has had
  a disputed entry reversed keeps the reversed credit counted, inflating
  their balance and skewing which child gets flagged for the monthly audit.

Both bugs affect real user-facing numbers: the KPI balance bar in Insights,
and which child + Pillar the Family Audit surfaces to a parent.

## Fix

Add one shared helper, `worker/src/lib/ledgerBalance.ts`:

```ts
export async function getAvailableBalancePence(
  db: D1Database, familyId: string, childId: string,
): Promise<number> {
  const row = await db.prepare(`
    SELECT COALESCE(SUM(
      CASE entry_type
        WHEN 'credit'   THEN amount
        WHEN 'reversal' THEN -amount
        WHEN 'payment'  THEN -amount
        ELSE 0
      END
    ), 0) AS bal
    FROM ledger WHERE family_id = ? AND child_id = ?
      AND verification_status IN ('verified_auto', 'verified_manual')
  `).bind(familyId, childId).first<{ bal: number }>();
  return row?.bal ?? 0;
}
```

- `insights.ts` replaces its inline `balanceRow` query (lines 196-202) with a
  call to `getAvailableBalancePence`.
- `family-audit.ts` replaces its inline per-child `balRow` query (lines
  99-108) with the same call.
- Both routes keep `Math.max(0, ...)` at the call site where they already
  clamp negative balances to 0 (unchanged behaviour, just fed a corrected
  input).

## Out of scope

- `jars.ts` and `finance.ts` — already use the correct formula, not touched.
- `total_earned_pence` / `lifetime_earned_pence` in `insights.ts` and
  `total_earned_pence` in `family-audit.ts` — these are gross-earnings KPIs
  (entry_type = 'credit' only, no verification_status filter), a different
  metric from "available balance." Not part of this fix; not reported as
  buggy.
- Any change to `pickFlaggedChild`'s priority ladder logic itself — only the
  `available_balance_pence` input it receives changes.

## Testing

- Unit test for `getAvailableBalancePence` isn't practical without a D1
  binding (matches existing convention — `jar-balance.ts` has no direct
  test either). Verify via `family-audit.test.ts`-style pure-logic tests
  where feasible, and manual `wrangler d1 execute` spot-check against
  `morechard-dev` post-deploy: a child with a `disputed`/`reversed` entry
  should show a different (correct) balance before/after.
