# Balance-Math Shared Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two independent bugs in per-child available-balance SQL (missing `verification_status` filter in `insights.ts`; missing `reversal` debit in `family-audit.ts`) by extracting one shared, correct helper both routes call.

**Architecture:** New pure-ish helper `getAvailableBalancePence(db, familyId, childId)` in `worker/src/lib/ledgerBalance.ts`, encoding the canonical formula already used correctly in `jars.ts`/`finance.ts`. Both `insights.ts` and `family-audit.ts` replace their inline SQL with a call to this helper.

**Tech Stack:** Cloudflare Workers (TypeScript), D1 (SQLite), Vitest.

## Global Constraints

- Never use `--local` on any wrangler command (dead per project CLAUDE.md).
- The canonical balance formula (from `jars.ts:89-99`, `finance.ts:397-414`): `SUM(credit) − SUM(reversal + payment)`, filtered to `verification_status IN ('verified_auto','verified_manual')`.
- Do not touch `jars.ts` or `finance.ts` — already correct, out of spec scope.
- Do not change `total_earned_pence` / `lifetime_earned_pence` in either file — different metric, out of scope.

---

### Task 1: Add `getAvailableBalancePence` helper

**Files:**
- Create: `worker/src/lib/ledgerBalance.ts`
- Test: `worker/src/lib/ledgerBalance.test.ts`
- Modify: `worker/src/routes/insights.ts:196-202`
- Modify: `worker/src/routes/family-audit.ts:97-108`

**Interfaces:**
- Produces: `getAvailableBalancePence(db: D1Database, familyId: string, childId: string): Promise<number>` — later tasks (none in this plan) can rely on this exact name/signature.

This task has no pure-logic unit to TDD against a mock `D1Database` cheaply (the existing convention — see `jar-balance.ts`, which also has no test file — is to skip a unit test for a single SQL-bound helper and instead verify via callers/integration). Given that, this task is verified by: (a) a compile-time check that the two call sites type-check against the new signature, and (b) a manual D1 spot-check after deploy. There is no Task-level TDD red/green cycle here because there is no D1 test harness in this repo (confirmed: no `vitest` D1 mock exists in `worker/src/lib/*.test.ts`).

- [ ] **Step 1: Create the helper file**

Create `worker/src/lib/ledgerBalance.ts`:

```ts
// worker/src/lib/ledgerBalance.ts
//
// Canonical "available balance" formula for a child's ledger. Single
// source of truth — insights.ts and family-audit.ts both call this instead
// of duplicating the SQL, after a 2026-07 audit found each had drifted
// from the correct formula independently (see
// docs/superpowers/specs/2026-07-07-balance-math-shared-fix-design.md).

import type { D1Database } from '@cloudflare/workers-types';

export async function getAvailableBalancePence(
  db: D1Database,
  familyId: string,
  childId: string,
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

- [ ] **Step 2: Update `insights.ts` to use the helper**

In `worker/src/routes/insights.ts`, add the import near the top (alongside the existing `jar-balance.js` import at line 28):

```ts
import { getAvailableBalancePence } from '../lib/ledgerBalance.js';
```

Replace the `balanceRow` entry inside the `Promise.all` at lines 195-202 (the block currently reading):

```ts
    // Available balance: sum of credits minus debits from ledger
    env.DB.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN entry_type = 'credit' THEN amount ELSE -amount END), 0) AS available
      FROM ledger
      WHERE family_id = ? AND child_id = ?
    `).bind(family_id, effectiveChildId)
      .first<{ available: number }>(),
```

with a placeholder `Promise.resolve(null)` in that array slot, and compute the balance separately right after the `Promise.all`:

```ts
    Promise.resolve(null),
```

Then, immediately after the destructured `const [earnedRow, spentRow, savedRow, balanceRow, lifetimeRow, goalsRow] = await Promise.all([...])` block, replace the line

```ts
  const availableBal  = balanceRow?.available ?? 0;
```

with:

```ts
  const availableBal  = await getAvailableBalancePence(env.DB, family_id, effectiveChildId);
```

Remove the now-unused `balanceRow` destructure slot by renaming it `_balanceRowUnused` is not acceptable style-wise — instead, drop it from both the `Promise.all` array and the destructure entirely:

Final destructure line becomes:

```ts
  const [earnedRow, spentRow, savedRow, lifetimeRow, goalsRow] = await Promise.all([
```

(i.e. remove the `balanceRow` slot and its corresponding `Promise` entry from the array — do not leave a `Promise.resolve(null)` placeholder; just delete that array element entirely, since nothing else in the array depends on positional order beyond the destructure itself).

- [ ] **Step 3: Update `family-audit.ts` to use the helper**

In `worker/src/routes/family-audit.ts`, add the import (alongside the existing `familyAudit.js` import at line 16-19):

```ts
import { getAvailableBalancePence } from '../lib/ledgerBalance.js';
```

Replace the `balRow` query inside the per-child loop (lines 97-108):

```ts
    const [balRow, goalsRow, completionRow] = await Promise.all([
      env.DB.prepare(`
        SELECT COALESCE(SUM(
          CASE entry_type
            WHEN 'credit'  THEN amount
            WHEN 'payment' THEN -amount
            ELSE 0
          END
        ),0) AS bal
        FROM ledger WHERE family_id=? AND child_id=?
          AND verification_status IN ('verified_auto','verified_manual')
      `).bind(family_id, childId).first<{ bal: number }>(),

      env.DB.prepare(`
        SELECT COALESCE(SUM(target_amount - current_saved_pence),0) AS locked
        FROM goals WHERE family_id=? AND child_id=? AND archived=0 AND target_amount > current_saved_pence
      `).bind(family_id, childId).first<{ locked: number }>().catch(() => ({ locked: 0 })),

      env.DB.prepare(`
        SELECT COUNT(*) AS total, SUM(CASE WHEN attempt_count=1 THEN 1 ELSE 0 END) AS first_time
        FROM completions WHERE family_id=? AND child_id=? AND status='completed' AND resolved_at >= ?
      `).bind(family_id, childId, monthStart).first<{ total: number; first_time: number }>(),
    ]);

    const availableBal    = Math.max(0, balRow?.bal ?? 0);
```

with:

```ts
    const [availableBalRaw, goalsRow, completionRow] = await Promise.all([
      getAvailableBalancePence(env.DB, family_id, childId),

      env.DB.prepare(`
        SELECT COALESCE(SUM(target_amount - current_saved_pence),0) AS locked
        FROM goals WHERE family_id=? AND child_id=? AND archived=0 AND target_amount > current_saved_pence
      `).bind(family_id, childId).first<{ locked: number }>().catch(() => ({ locked: 0 })),

      env.DB.prepare(`
        SELECT COUNT(*) AS total, SUM(CASE WHEN attempt_count=1 THEN 1 ELSE 0 END) AS first_time
        FROM completions WHERE family_id=? AND child_id=? AND status='completed' AND resolved_at >= ?
      `).bind(family_id, childId, monthStart).first<{ total: number; first_time: number }>(),
    ]);

    const availableBal    = Math.max(0, availableBalRaw);
```

- [ ] **Step 4: Typecheck**

Run: `cd worker && npx tsc --noEmit`
Expected: no errors. This confirms both call sites match the new helper's signature and that removing `balanceRow` from `insights.ts` didn't break any other reference.

- [ ] **Step 5: Run the existing worker test suite**

Run: `cd worker && npx vitest run`
Expected: all existing tests pass (this change touches no tested pure-logic function, so this is a regression guard, not new coverage).

- [ ] **Step 6: Manual D1 spot-check against morechard-dev**

Run against a child known to have at least one `disputed`/`reversed` ledger entry (check first with a SELECT):

```bash
cd worker
npx wrangler d1 execute morechard-dev --remote --command="SELECT id, child_id, entry_type, amount, verification_status FROM ledger WHERE verification_status IN ('disputed','reversed') LIMIT 5"
```

Pick one `child_id`/`family_id` pair from that result, then hit the real endpoints (via the running dev server, `npm run dev`) for that child's `GET /api/insights` and that family's `GET /api/family-audit`, and confirm `available_balance_pence` no longer includes the disputed/reversed entry's amount, and that the two endpoints agree with each other for the same child (modulo goals-locked, which family-audit doesn't surface directly — compare via `Math.max(0, availableBalRaw)` you can add as a temporary console.log if needed, then remove it).

- [ ] **Step 7: Commit**

```bash
git add worker/src/lib/ledgerBalance.ts worker/src/routes/insights.ts worker/src/routes/family-audit.ts
git commit -m "fix: unify available-balance formula across insights and family-audit

insights.ts was missing the verification_status filter (pending/disputed/
reversed entries leaked into the balance); family-audit.ts was missing
'reversal' as a debit (reversed credits stayed counted). Both now share
getAvailableBalancePence() in lib/ledgerBalance.ts."
```

---

## Self-Review Notes

- **Spec coverage:** The spec's single deliverable (shared helper, both call sites updated) is fully covered by Task 1. No `jars.ts`/`finance.ts` changes were introduced (out of scope, confirmed). No `total_earned_pence`/`lifetime_earned_pence` changes were introduced (out of scope, confirmed).
- **Placeholder scan:** No TBD/TODO. Step 6 is a manual verification step (not a red/green unit test) because this repo has no D1 test harness for SQL-bound helpers — this mirrors the existing convention for `jar-balance.ts`, which also ships without a test file.
- **Type consistency:** `getAvailableBalancePence` returns `Promise<number>` everywhere it's referenced (Task 1, Steps 1-3) — no signature drift between definition and call sites.
