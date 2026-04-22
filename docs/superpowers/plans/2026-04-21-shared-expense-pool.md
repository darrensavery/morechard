# Shared Expense Pool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a parallel immutable ledger for parent-to-parent shared expenses, with a Pool tab UI, threshold-gated dual-signature approval, flexible splits, monthly settlement card, and co-parent departure safeguards.

**Architecture:** A new `shared_expenses` D1 table mirrors the existing ledger's SHA-256 chain-of-trust but anchors to `family_id` (not `child_id`), keeping it completely separate from child earnings. A new Worker route file handles all CRUD + approval + reconcile logic. A new `PoolTab.tsx` React component renders in the parent dashboard only — children never touch this data.

**Tech Stack:** Cloudflare Workers (TypeScript), D1 SQLite, Resend email, Cloudflare R2, React + Tailwind CSS, Web Share API.

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `worker/migrations/0033_shared_expenses.sql` | `shared_expenses` table + triggers |
| Create | `worker/migrations/0034_shared_expense_settings.sql` | Add threshold + split_bp columns to families |
| Create | `worker/src/routes/sharedExpenses.ts` | All shared expense Worker handlers |
| Create | `worker/src/lib/sharedExpenseHash.ts` | `computeSharedExpenseHash()` — mirrors `hash.ts` pattern |
| Modify | `worker/src/index.ts` | Register shared-expense routes |
| Modify | `worker/src/routes/auth.ts` | Add `sendApprovalEmail()` + void-pending on co-parent removal |
| Create | `app/src/components/dashboard/PoolTab.tsx` | Pool tab — expense list, pending approvals, flagged section, history |
| Create | `app/src/components/dashboard/AddExpenseSheet.tsx` | Bottom-sheet form for logging a new shared expense |
| Create | `app/src/components/dashboard/SettlementCard.tsx` | Read-only reconcile summary + Web Share |
| Modify | `app/src/screens/ParentDashboard.tsx` | Add `'pool'` to Tab type, TABS array, tab content switch |
| Modify | `app/src/components/dashboard/ParentSettingsTab.tsx` | Add Trust Threshold, Default Split, Payment Details fields |

---

## Task 1: Migration — `shared_expenses` table

**Files:**
- Create: `worker/migrations/0033_shared_expenses.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- 0033_shared_expenses.sql
-- Parallel immutable ledger for parent-to-parent shared costs.
-- Anchored to family_id (not child_id). Children never see this table.

CREATE TABLE IF NOT EXISTS shared_expenses (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id           TEXT    NOT NULL REFERENCES families(id),
  logged_by           TEXT    NOT NULL REFERENCES users(id),
  authorised_by       TEXT    REFERENCES users(id),
  description         TEXT    NOT NULL,
  category            TEXT    NOT NULL
                              CHECK (category IN ('education','health','clothing','travel','activities','other')),
  total_amount        INTEGER NOT NULL CHECK (total_amount > 0),
  currency            TEXT    NOT NULL CHECK (currency IN ('GBP', 'PLN', 'USD')),
  -- logged_by's share in basis points (0–10000). 5000 = 50/50.
  -- Other parent's share = 10000 - split_bp.
  split_bp            INTEGER NOT NULL DEFAULT 5000
                              CHECK (split_bp BETWEEN 0 AND 10000),
  verification_status TEXT    NOT NULL DEFAULT 'pending'
                              CHECK (verification_status IN (
                                'committed_auto',
                                'pending',
                                'committed_manual',
                                'rejected',
                                'voided',
                                'reversed'
                              )),
  attachment_key      TEXT,
  settlement_period   TEXT,
  reconciled_at       INTEGER,
  reconciled_by       TEXT    REFERENCES users(id),
  -- SHA-256 chain. Hash written at commit time only; pending rows carry 'PENDING'.
  previous_hash       TEXT    NOT NULL,
  record_hash         TEXT    NOT NULL,
  ip_address          TEXT    NOT NULL,
  created_at          INTEGER NOT NULL DEFAULT (unixepoch()),
  deleted_at          INTEGER
);

-- Committed rows are immutable. Pending/rejected/voided may transition.
CREATE TRIGGER IF NOT EXISTS shared_expenses_no_update
  BEFORE UPDATE ON shared_expenses
  WHEN OLD.verification_status IN ('committed_auto', 'committed_manual', 'reversed')
BEGIN
  SELECT RAISE(ABORT, 'Committed shared_expense rows are immutable. Use a reversal entry.');
END;

CREATE TRIGGER IF NOT EXISTS shared_expenses_no_delete
  BEFORE DELETE ON shared_expenses
BEGIN
  SELECT RAISE(ABORT, 'shared_expense rows cannot be deleted. Use deleted_at for soft-delete.');
END;

CREATE INDEX IF NOT EXISTS idx_shared_exp_family ON shared_expenses (family_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shared_exp_period ON shared_expenses (family_id, settlement_period);
```

- [ ] **Step 2: Apply the migration to local D1**

```bash
cd "e:/Web-Video Design/Claude/Apps/Pocket Money"
npx wrangler d1 execute morechard-db --local --file=worker/migrations/0033_shared_expenses.sql
```

Expected output: `Successfully applied migration` (no errors).

- [ ] **Step 3: Verify table exists**

```bash
npx wrangler d1 execute morechard-db --local --command="SELECT name FROM sqlite_master WHERE type='table' AND name='shared_expenses';"
```

Expected: one row `{ name: 'shared_expenses' }`.

- [ ] **Step 4: Commit**

```bash
git add worker/migrations/0033_shared_expenses.sql
git commit -m "feat(db): add shared_expenses table with SHA-256 chain + immutability triggers"
```

---

## Task 2: Migration — family settings columns

**Files:**
- Create: `worker/migrations/0034_shared_expense_settings.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- 0034_shared_expense_settings.sql
-- Trust Threshold and default split for shared expense governance.

ALTER TABLE families ADD COLUMN shared_expense_threshold INTEGER NOT NULL DEFAULT 5000;
-- Expenses <= threshold → committed_auto (even in standard verify_mode).
-- Expenses > threshold + verify_mode='standard' → pending approval.
-- Stored in base currency minor units (pence/groszy/cents). Default: £50.00.

ALTER TABLE families ADD COLUMN shared_expense_split_bp INTEGER NOT NULL DEFAULT 5000;
-- Family-level default split in basis points. 5000 = 50/50.
-- Pre-populates the slider on each new expense entry. Per-transaction override allowed.
```

- [ ] **Step 2: Apply and verify**

```bash
npx wrangler d1 execute morechard-db --local --file=worker/migrations/0034_shared_expense_settings.sql
npx wrangler d1 execute morechard-db --local --command="SELECT shared_expense_threshold, shared_expense_split_bp FROM families LIMIT 1;"
```

Expected: columns present with values `5000, 5000`.

- [ ] **Step 3: Commit**

```bash
git add worker/migrations/0034_shared_expense_settings.sql
git commit -m "feat(db): add shared_expense_threshold and shared_expense_split_bp to families"
```

---

## Task 3: Hash utility for shared expenses

**Files:**
- Create: `worker/src/lib/sharedExpenseHash.ts`

Background: The existing `worker/src/lib/hash.ts` exports `sha256(input: string): Promise<string>` and `GENESIS_HASH = '0'.repeat(64)`. We add a parallel function that takes shared-expense-specific fields. We reuse `sha256` — we do not duplicate it.

- [ ] **Step 1: Write the utility**

```typescript
// worker/src/lib/sharedExpenseHash.ts
import { sha256, GENESIS_HASH } from './hash';

export { GENESIS_HASH };

/**
 * Computes the record_hash for a committed shared_expense row.
 * Input mirrors the ledger pattern: fields joined with '|'.
 * Only call this at commit time — pending rows carry 'PENDING' as record_hash.
 */
export async function computeSharedExpenseHash(
  id: number,
  familyId: string,
  loggedBy: string,
  totalAmount: number,
  currency: string,
  splitBp: number,
  previousHash: string,
): Promise<string> {
  const payload = [id, familyId, loggedBy, totalAmount, currency, splitBp, previousHash].join('|');
  return sha256(payload);
}

/**
 * Fetches the record_hash of the most recently committed shared_expense row
 * for a given family, to use as previous_hash for the next committed row.
 * Returns GENESIS_HASH if no committed row exists yet.
 */
export async function getLastCommittedHash(db: D1Database, familyId: string): Promise<string> {
  const row = await db
    .prepare(
      `SELECT record_hash FROM shared_expenses
       WHERE family_id = ?
         AND verification_status IN ('committed_auto', 'committed_manual', 'reversed')
       ORDER BY id DESC
       LIMIT 1`,
    )
    .bind(familyId)
    .first<{ record_hash: string }>();
  return row?.record_hash ?? GENESIS_HASH;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "e:/Web-Video Design/Claude/Apps/Pocket Money"
npx tsc --noEmit -p worker/tsconfig.json
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add worker/src/lib/sharedExpenseHash.ts
git commit -m "feat(worker): add computeSharedExpenseHash + getLastCommittedHash utilities"
```

---

## Task 4: Worker route handlers

**Files:**
- Create: `worker/src/routes/sharedExpenses.ts`

This file contains all six route handlers. Key rules:
- All routes require `role = 'parent'`. Children are never authenticated to these endpoints.
- `family_id` always comes from the JWT (`req.auth.family_id`), never from the request body.
- Soft-delete (`DELETE`) only allowed when `verification_status IN ('pending', 'rejected')`.
- Hash is written only at commit time.

- [ ] **Step 1: Write the route file**

```typescript
// worker/src/routes/sharedExpenses.ts
import { computeSharedExpenseHash, getLastCommittedHash, GENESIS_HASH } from '../lib/sharedExpenseHash';
import { sendApprovalEmail } from './auth';

type Env = {
  DB: D1Database;
  RESEND_API_KEY: string;
  EVIDENCE: R2Bucket;
};

type AuthedRequest = Request & {
  auth: { user_id: string; family_id: string; role: string; parent_role: string; email: string; display_name: string };
};

const COMMITTED = ['committed_auto', 'committed_manual'] as const;

function ip(req: Request): string {
  return req.headers.get('CF-Connecting-IP') ?? '0.0.0.0';
}

function jsonOk(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function jsonErr(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ---------------------------------------------------------------------------
// POST /api/shared-expenses
// Log a new shared expense. Auto-commits if under threshold or amicable mode.
// ---------------------------------------------------------------------------
export async function handleCreateSharedExpense(req: AuthedRequest, env: Env): Promise<Response> {
  const body = await req.json<{
    description: string;
    category: string;
    total_amount: number;
    split_bp?: number;
    attachment_key?: string;
  }>();

  if (!body.description?.trim()) return jsonErr('description required', 400);
  if (!body.category) return jsonErr('category required', 400);
  if (!body.total_amount || body.total_amount <= 0) return jsonErr('total_amount must be positive integer', 400);

  const VALID_CATEGORIES = ['education', 'health', 'clothing', 'travel', 'activities', 'other'];
  if (!VALID_CATEGORIES.includes(body.category)) return jsonErr('invalid category', 400);

  const family = await env.DB
    .prepare('SELECT currency, verify_mode, shared_expense_threshold, shared_expense_split_bp FROM families WHERE id = ?')
    .bind(req.auth.family_id)
    .first<{ currency: string; verify_mode: string; shared_expense_threshold: number; shared_expense_split_bp: number }>();

  if (!family) return jsonErr('family not found', 404);

  const splitBp = body.split_bp ?? family.shared_expense_split_bp;
  if (splitBp < 0 || splitBp > 10000) return jsonErr('split_bp must be 0–10000', 400);

  // Determine whether to auto-commit or pend
  const isAmicable = family.verify_mode === 'amicable';
  const underThreshold = body.total_amount <= family.shared_expense_threshold;
  const autoCommit = isAmicable || underThreshold;

  const insertStatus = autoCommit ? 'committed_auto' : 'pending';

  // For pending rows we store 'PENDING' as record_hash (hash written at commit time)
  let previousHash = GENESIS_HASH;
  let recordHash = 'PENDING';

  if (autoCommit) {
    previousHash = await getLastCommittedHash(env.DB, req.auth.family_id);
  }

  const result = await env.DB
    .prepare(
      `INSERT INTO shared_expenses
         (family_id, logged_by, description, category, total_amount, currency,
          split_bp, verification_status, attachment_key, previous_hash, record_hash, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      req.auth.family_id,
      req.auth.user_id,
      body.description.trim(),
      body.category,
      body.total_amount,
      family.currency,
      splitBp,
      insertStatus,
      body.attachment_key ?? null,
      previousHash,
      recordHash,
      ip(req),
    )
    .run();

  const newId = result.meta.last_row_id as number;

  if (autoCommit) {
    recordHash = await computeSharedExpenseHash(
      newId,
      req.auth.family_id,
      req.auth.user_id,
      body.total_amount,
      family.currency,
      splitBp,
      previousHash,
    );
    await env.DB
      .prepare('UPDATE shared_expenses SET record_hash = ? WHERE id = ?')
      .bind(recordHash, newId)
      .run();
  } else {
    // Notify the other parent via email
    const otherParent = await env.DB
      .prepare(
        `SELECT u.email, u.display_name FROM users u
         JOIN family_roles fr ON fr.user_id = u.id
         WHERE fr.family_id = ? AND fr.role = 'parent' AND u.id != ?
         LIMIT 1`,
      )
      .bind(req.auth.family_id, req.auth.user_id)
      .first<{ email: string; display_name: string }>();

    if (otherParent?.email) {
      await sendApprovalEmail(
        otherParent.email,
        otherParent.display_name,
        req.auth.display_name,
        body.total_amount,
        family.currency,
        body.description.trim(),
        newId,
        env,
      );
    }
  }

  return jsonOk({ id: newId, verification_status: insertStatus }, 201);
}

// ---------------------------------------------------------------------------
// GET /api/shared-expenses
// Returns all non-deleted expenses for the family, newest first.
// ---------------------------------------------------------------------------
export async function handleListSharedExpenses(req: AuthedRequest, env: Env): Promise<Response> {
  const rows = await env.DB
    .prepare(
      `SELECT se.*,
              ul.display_name AS logged_by_name,
              ua.display_name AS authorised_by_name
       FROM shared_expenses se
       LEFT JOIN users ul ON ul.id = se.logged_by
       LEFT JOIN users ua ON ua.id = se.authorised_by
       WHERE se.family_id = ? AND se.deleted_at IS NULL
       ORDER BY se.created_at DESC`,
    )
    .bind(req.auth.family_id)
    .all();

  return jsonOk({ expenses: rows.results });
}

// ---------------------------------------------------------------------------
// POST /api/shared-expenses/:id/approve
// Parent B approves a pending expense. Computes + writes the record_hash.
// ---------------------------------------------------------------------------
export async function handleApproveSharedExpense(
  req: AuthedRequest,
  env: Env,
  expenseId: string,
): Promise<Response> {
  const expense = await env.DB
    .prepare('SELECT * FROM shared_expenses WHERE id = ? AND family_id = ?')
    .bind(expenseId, req.auth.family_id)
    .first<{
      id: number; logged_by: string; total_amount: number; currency: string;
      split_bp: number; verification_status: string;
    }>();

  if (!expense) return jsonErr('expense not found', 404);
  if (expense.verification_status !== 'pending') return jsonErr('expense is not pending', 409);
  if (expense.logged_by === req.auth.user_id) return jsonErr('cannot approve your own expense', 403);

  const previousHash = await getLastCommittedHash(env.DB, req.auth.family_id);
  const recordHash = await computeSharedExpenseHash(
    expense.id,
    req.auth.family_id,
    expense.logged_by,
    expense.total_amount,
    expense.currency,
    expense.split_bp,
    previousHash,
  );

  await env.DB
    .prepare(
      `UPDATE shared_expenses
       SET verification_status = 'committed_manual',
           authorised_by = ?,
           previous_hash = ?,
           record_hash = ?
       WHERE id = ?`,
    )
    .bind(req.auth.user_id, previousHash, recordHash, expense.id)
    .run();

  return jsonOk({ id: expense.id, verification_status: 'committed_manual' });
}

// ---------------------------------------------------------------------------
// POST /api/shared-expenses/:id/reject
// Parent B rejects a pending expense. Stays in DB, excluded from settlement.
// ---------------------------------------------------------------------------
export async function handleRejectSharedExpense(
  req: AuthedRequest,
  env: Env,
  expenseId: string,
): Promise<Response> {
  const expense = await env.DB
    .prepare('SELECT * FROM shared_expenses WHERE id = ? AND family_id = ?')
    .bind(expenseId, req.auth.family_id)
    .first<{ logged_by: string; verification_status: string }>();

  if (!expense) return jsonErr('expense not found', 404);
  if (expense.verification_status !== 'pending') return jsonErr('expense is not pending', 409);
  if (expense.logged_by === req.auth.user_id) return jsonErr('cannot reject your own expense', 403);

  await env.DB
    .prepare(`UPDATE shared_expenses SET verification_status = 'rejected' WHERE id = ?`)
    .bind(expenseId)
    .run();

  return jsonOk({ id: Number(expenseId), verification_status: 'rejected' });
}

// ---------------------------------------------------------------------------
// DELETE /api/shared-expenses/:id
// Soft-delete. Only allowed for pending or rejected rows.
// ---------------------------------------------------------------------------
export async function handleDeleteSharedExpense(
  req: AuthedRequest,
  env: Env,
  expenseId: string,
): Promise<Response> {
  const expense = await env.DB
    .prepare('SELECT * FROM shared_expenses WHERE id = ? AND family_id = ?')
    .bind(expenseId, req.auth.family_id)
    .first<{ logged_by: string; verification_status: string; deleted_at: number | null }>();

  if (!expense) return jsonErr('expense not found', 404);
  if (expense.deleted_at) return jsonErr('already deleted', 409);

  // Soft-delete constraint: committed records are immutable — issue a reversal instead.
  if (!['pending', 'rejected'].includes(expense.verification_status)) {
    return jsonErr(
      'Committed records are immutable. Issue a reversal entry to correct them.',
      403,
    );
  }

  if (expense.logged_by !== req.auth.user_id) {
    return jsonErr('only the logging parent can remove this expense', 403);
  }

  await env.DB
    .prepare('UPDATE shared_expenses SET deleted_at = ? WHERE id = ?')
    .bind(Math.floor(Date.now() / 1000), expenseId)
    .run();

  return jsonOk({ id: Number(expenseId), deleted: true });
}

// ---------------------------------------------------------------------------
// POST /api/shared-expenses/reconcile
// Marks all committed expenses in the current open period as reconciled.
// Returns the settlement summary (net balance between parents).
// ---------------------------------------------------------------------------
export async function handleReconcileSharedExpenses(req: AuthedRequest, env: Env): Promise<Response> {
  const bodyRaw = await req.text();
  const body = bodyRaw ? JSON.parse(bodyRaw) : {};
  const period: string = body.period ?? new Date().toISOString().slice(0, 7); // e.g. '2026-04'

  // Check period is not already reconciled
  const alreadyReconciled = await env.DB
    .prepare(
      `SELECT COUNT(*) as cnt FROM shared_expenses
       WHERE family_id = ? AND settlement_period = ? AND reconciled_at IS NOT NULL`,
    )
    .bind(req.auth.family_id, period)
    .first<{ cnt: number }>();

  if ((alreadyReconciled?.cnt ?? 0) > 0) {
    return jsonErr(`period ${period} is already reconciled`, 409);
  }

  const expenses = await env.DB
    .prepare(
      `SELECT se.*, ul.display_name AS logged_by_name
       FROM shared_expenses se
       LEFT JOIN users ul ON ul.id = se.logged_by
       WHERE se.family_id = ?
         AND se.deleted_at IS NULL
         AND se.verification_status IN ('committed_auto', 'committed_manual')
         AND (se.settlement_period IS NULL OR se.settlement_period = ?)
       ORDER BY se.created_at ASC`,
    )
    .bind(req.auth.family_id, period)
    .all<{
      id: number; logged_by: string; logged_by_name: string;
      total_amount: number; split_bp: number; currency: string;
      description: string; category: string;
    }>();

  if (!expenses.results.length) {
    return jsonOk({ period, net_pence: 0, expenses: [], message: 'No committed expenses to reconcile.' });
  }

  // Compute net balance. Positive = requesting parent owes; negative = other parent owes.
  let netPence = 0;
  for (const e of expenses.results) {
    const loggedByAmount = Math.round((e.total_amount * e.split_bp) / 10000);
    const otherAmount = e.total_amount - loggedByAmount;
    if (e.logged_by === req.auth.user_id) {
      // I logged it: I paid total_amount, other parent owes me their share
      netPence -= otherAmount; // negative = other parent owes me
    } else {
      // Other parent logged it: they paid total_amount, I owe my share
      netPence += loggedByAmount;
    }
  }

  const now = Math.floor(Date.now() / 1000);

  // Mark expenses as reconciled for this period
  const ids = expenses.results.map(e => e.id);
  for (const id of ids) {
    await env.DB
      .prepare(
        `UPDATE shared_expenses
         SET settlement_period = ?, reconciled_at = ?, reconciled_by = ?
         WHERE id = ?`,
      )
      .bind(period, now, req.auth.user_id, id)
      .run();
  }

  return jsonOk({
    period,
    net_pence: netPence,
    currency: expenses.results[0].currency,
    expenses: expenses.results.map(e => ({
      id: e.id,
      description: e.description,
      category: e.category,
      total_amount: e.total_amount,
      logged_by_name: e.logged_by_name,
      split_bp: e.split_bp,
    })),
  });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit -p worker/tsconfig.json
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add worker/src/routes/sharedExpenses.ts
git commit -m "feat(worker): add shared expense route handlers (create/list/approve/reject/delete/reconcile)"
```

---

## Task 5: Approval email helper

**Files:**
- Modify: `worker/src/routes/auth.ts`

The existing `sendMagicLinkEmail` function in `auth.ts` uses Resend via fetch. We add a sibling `sendApprovalEmail` export using the same pattern.

- [ ] **Step 1: Find the end of the existing email helpers in auth.ts**

Open `worker/src/routes/auth.ts` and locate `sendMagicLinkEmail`. Add the following export immediately after it (or at the end of the file before the closing export block):

```typescript
// Shared expense approval notification (pre-Phase 8 push bridge)
export async function sendApprovalEmail(
  to: string,
  recipientName: string,
  loggerName: string,
  totalAmount: number,
  currency: string,
  description: string,
  expenseId: number,
  env: { RESEND_API_KEY: string },
): Promise<void> {
  const symbol = currency === 'GBP' ? '£' : currency === 'USD' ? '$' : 'zł';
  const formatted = `${symbol}${(totalAmount / 100).toFixed(2)}`;
  const appUrl = 'https://morechard.com/parent?tab=pool';

  const html = `
    <p>Hi ${escHtml(recipientName)},</p>
    <p><strong>${escHtml(loggerName)}</strong> has logged a shared expense that requires your approval:</p>
    <blockquote style="border-left:3px solid #ccc;padding-left:12px;color:#555">
      <strong>${escHtml(description)}</strong> — ${formatted}
    </blockquote>
    <p><a href="${appUrl}&expense=${expenseId}" style="background:#1a7a4a;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;display:inline-block">
      Review in Morechard →
    </a></p>
    <p style="color:#888;font-size:12px">If you weren't expecting this, you can safely ignore it.</p>
  `;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Morechard <noreply@mail.morechard.com>',
      to,
      subject: `Shared expense of ${formatted} needs your approval`,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`sendApprovalEmail Resend error ${res.status}: ${body}`);
    // Non-fatal: expense is already recorded; email failure should not roll back the row.
  }
}
```

Note: `escHtml` is already defined in `auth.ts` — do not re-define it.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit -p worker/tsconfig.json
```

- [ ] **Step 3: Commit**

```bash
git add worker/src/routes/auth.ts
git commit -m "feat(worker): add sendApprovalEmail for shared expense pending notification"
```

---

## Task 6: Void pending expenses on co-parent removal

**Files:**
- Modify: `worker/src/routes/auth.ts` (or wherever the co-parent removal handler lives — search for `handleRemoveCoParent` or `DELETE /auth/co-parent`)

- [ ] **Step 1: Find the co-parent removal handler**

```bash
grep -n "co.parent\|coParent\|remove.*parent\|parent.*remov" "worker/src/routes/auth.ts" | head -30
```

- [ ] **Step 2: Add pending-void logic before the removal executes**

Inside the co-parent removal handler, immediately before the step that removes the co-parent from `family_roles`, add:

```typescript
// Void any pending shared expenses that can no longer be approved
await env.DB
  .prepare(
    `UPDATE shared_expenses
     SET verification_status = 'voided'
     WHERE family_id = ? AND verification_status = 'pending'`,
  )
  .bind(familyId)
  .run();
```

The UI prompt ("Export Final Shared Report before removing") is handled in the frontend — see Task 10.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit -p worker/tsconfig.json
```

- [ ] **Step 4: Commit**

```bash
git add worker/src/routes/auth.ts
git commit -m "feat(worker): void pending shared expenses on co-parent removal"
```

---

## Task 7: Register routes in the Worker

**Files:**
- Modify: `worker/src/index.ts`

- [ ] **Step 1: Add the import at the top of index.ts with the other route imports**

```typescript
import {
  handleCreateSharedExpense,
  handleListSharedExpenses,
  handleApproveSharedExpense,
  handleRejectSharedExpense,
  handleDeleteSharedExpense,
  handleReconcileSharedExpenses,
} from './routes/sharedExpenses';
```

- [ ] **Step 2: Add route registrations inside the main `route()` function**

Find the block where API routes are matched (e.g. near `/api/market-rates`). Add the following block in the same style — after the existing API routes, before the 404 fallthrough:

```typescript
// ── Shared Expenses ─────────────────────────────────────────────────────────
if (path === '/api/shared-expenses' && method === 'POST') {
  const parentCheck = requireRole(auth, 'parent');
  if (parentCheck) return parentCheck;
  return handleCreateSharedExpense(Object.assign(request, { auth }) as any, env);
}

if (path === '/api/shared-expenses' && method === 'GET') {
  const parentCheck = requireRole(auth, 'parent');
  if (parentCheck) return parentCheck;
  return handleListSharedExpenses(Object.assign(request, { auth }) as any, env);
}

if (path === '/api/shared-expenses/reconcile' && method === 'POST') {
  const parentCheck = requireRole(auth, 'parent');
  if (parentCheck) return parentCheck;
  return handleReconcileSharedExpenses(Object.assign(request, { auth }) as any, env);
}

const sharedExpenseIdMatch = path.match(/^\/api\/shared-expenses\/(\d+)$/);
if (sharedExpenseIdMatch) {
  const parentCheck = requireRole(auth, 'parent');
  if (parentCheck) return parentCheck;
  const expenseId = sharedExpenseIdMatch[1];

  if (method === 'POST') {
    // Disambiguate approve vs reject via sub-path
  }
}

const sharedExpenseApproveMatch = path.match(/^\/api\/shared-expenses\/(\d+)\/approve$/);
if (sharedExpenseApproveMatch && method === 'POST') {
  const parentCheck = requireRole(auth, 'parent');
  if (parentCheck) return parentCheck;
  return handleApproveSharedExpense(Object.assign(request, { auth }) as any, env, sharedExpenseApproveMatch[1]);
}

const sharedExpenseRejectMatch = path.match(/^\/api\/shared-expenses\/(\d+)\/reject$/);
if (sharedExpenseRejectMatch && method === 'POST') {
  const parentCheck = requireRole(auth, 'parent');
  if (parentCheck) return parentCheck;
  return handleRejectSharedExpense(Object.assign(request, { auth }) as any, env, sharedExpenseRejectMatch[1]);
}

const sharedExpenseDeleteMatch = path.match(/^\/api\/shared-expenses\/(\d+)$/);
if (sharedExpenseDeleteMatch && method === 'DELETE') {
  const parentCheck = requireRole(auth, 'parent');
  if (parentCheck) return parentCheck;
  return handleDeleteSharedExpense(Object.assign(request, { auth }) as any, env, sharedExpenseDeleteMatch[1]);
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit -p worker/tsconfig.json
```

- [ ] **Step 4: Smoke-test the Worker locally**

```bash
npm run dev
```

In another terminal:

```bash
# Should return 401 (no auth) not 404
curl -s -o /dev/null -w "%{http_code}" http://localhost:8787/api/shared-expenses
```

Expected: `401`.

- [ ] **Step 5: Commit**

```bash
git add worker/src/index.ts
git commit -m "feat(worker): register shared-expense API routes"
```

---

## Task 8: PoolTab component

**Files:**
- Create: `app/src/components/dashboard/PoolTab.tsx`

This component fetches the expense list from `GET /api/shared-expenses`, renders three sections (Open Period, Pending/Flagged, History), and shows the running balance chip. It does not handle adding expenses (that's `AddExpenseSheet`) or reconciling (that's `SettlementCard`).

- [ ] **Step 1: Write the component**

```tsx
// app/src/components/dashboard/PoolTab.tsx
import { useEffect, useState } from 'react';

type VerificationStatus =
  | 'committed_auto'
  | 'committed_manual'
  | 'pending'
  | 'rejected'
  | 'voided'
  | 'reversed';

type SharedExpense = {
  id: number;
  logged_by: string;
  logged_by_name: string;
  authorised_by: string | null;
  authorised_by_name: string | null;
  description: string;
  category: string;
  total_amount: number;
  split_bp: number;
  currency: string;
  verification_status: VerificationStatus;
  attachment_key: string | null;
  settlement_period: string | null;
  reconciled_at: number | null;
  created_at: number;
  deleted_at: number | null;
};

const CATEGORY_EMOJI: Record<string, string> = {
  education: '📚', health: '🏥', clothing: '👕',
  travel: '✈️', activities: '⚽', other: '📋',
};

function formatAmount(pence: number, currency: string): string {
  const symbol = currency === 'GBP' ? '£' : currency === 'USD' ? '$' : 'zł';
  return `${symbol}${(pence / 100).toFixed(2)}`;
}

function ledgerNote(
  expense: SharedExpense,
  currentUserId: string,
): string {
  const loggedByName = expense.logged_by_name ?? 'Unknown';
  const authorisedByName = expense.authorised_by_name ?? '';
  if (expense.verification_status === 'committed_manual') {
    return `Logged by ${loggedByName}, Verified by ${authorisedByName}`;
  }
  if (expense.verification_status === 'pending') {
    return `Logged by ${loggedByName}, awaiting approval`;
  }
  return `Logged by ${loggedByName}`;
}

type Props = {
  familyId: string;
  currentUserId: string;
  onAddClick: () => void;
  onReconcileClick: (expenses: SharedExpense[]) => void;
};

export function PoolTab({ familyId, currentUserId, onAddClick, onReconcileClick }: Props) {
  const [expenses, setExpenses] = useState<SharedExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/shared-expenses', { credentials: 'include' });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json<{ expenses: SharedExpense[] }>();
      setExpenses(data.expenses);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [familyId]);

  async function handleApprove(id: number) {
    await fetch(`/api/shared-expenses/${id}/approve`, { method: 'POST', credentials: 'include' });
    load();
  }

  async function handleReject(id: number) {
    await fetch(`/api/shared-expenses/${id}/reject`, { method: 'POST', credentials: 'include' });
    load();
  }

  async function handleRemove(id: number) {
    if (!confirm('Remove this flagged expense?')) return;
    await fetch(`/api/shared-expenses/${id}`, { method: 'DELETE', credentials: 'include' });
    load();
  }

  if (loading) return <div className="p-6 text-center text-[var(--color-text-muted)] text-sm">Loading…</div>;
  if (error) return <div className="p-6 text-center text-red-500 text-sm">{error}</div>;

  const currentPeriod = new Date().toISOString().slice(0, 7);

  const openExpenses = expenses.filter(
    e => !e.settlement_period && ['committed_auto', 'committed_manual'].includes(e.verification_status)
  );
  const pendingExpenses = expenses.filter(e => e.verification_status === 'pending');
  const flaggedExpenses = expenses.filter(e => e.verification_status === 'rejected');
  const voidedExpenses = expenses.filter(e => e.verification_status === 'voided');
  const history = expenses.filter(e => e.settlement_period);

  // Net balance (positive = I owe; negative = other parent owes me)
  let netPence = 0;
  for (const e of openExpenses) {
    const loggedByAmount = Math.round((e.total_amount * e.split_bp) / 10000);
    const otherAmount = e.total_amount - loggedByAmount;
    if (e.logged_by === currentUserId) {
      netPence -= otherAmount;
    } else {
      netPence += loggedByAmount;
    }
  }

  const currency = expenses[0]?.currency ?? 'GBP';

  return (
    <div className="flex flex-col gap-4 pb-24">

      {/* Running balance chip */}
      {openExpenses.length > 0 && (
        <div className="mx-4 mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide">This month</p>
            <p className={`text-2xl font-bold tabular-nums ${netPence < 0 ? 'text-green-600' : netPence > 0 ? 'text-red-500' : 'text-[var(--color-text)]'}`}>
              {netPence === 0 ? 'You are square' : netPence < 0
                ? `You are owed ${formatAmount(Math.abs(netPence), currency)}`
                : `You owe ${formatAmount(netPence, currency)}`}
            </p>
          </div>
          <button
            onClick={() => onReconcileClick(openExpenses)}
            className="text-sm font-semibold text-[var(--brand-primary)] border border-[var(--brand-primary)] rounded-lg px-3 py-1.5"
          >
            Reconcile
          </button>
        </div>
      )}

      {/* Add expense button */}
      <div className="px-4">
        <button
          onClick={onAddClick}
          className="w-full bg-[var(--brand-primary)] text-white font-semibold text-sm py-3 rounded-xl"
        >
          + Log shared expense
        </button>
      </div>

      {/* Pending approvals */}
      {pendingExpenses.length > 0 && (
        <section className="px-4">
          <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-2">
            Needs your approval
          </h3>
          <div className="flex flex-col gap-2">
            {pendingExpenses.filter(e => e.logged_by !== currentUserId).map(e => (
              <div key={e.id} className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm">{CATEGORY_EMOJI[e.category]} {e.description}</p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{ledgerNote(e, currentUserId)}</p>
                    <p className="text-sm font-bold tabular-nums mt-1">{formatAmount(e.total_amount, e.currency)}</p>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => handleApprove(e.id)}
                    className="flex-1 bg-green-600 text-white text-sm font-semibold py-1.5 rounded-lg"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleReject(e.id)}
                    className="flex-1 border border-red-400 text-red-600 text-sm font-semibold py-1.5 rounded-lg"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
            {/* Expenses I logged that are awaiting the other parent */}
            {pendingExpenses.filter(e => e.logged_by === currentUserId).map(e => (
              <div key={e.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 opacity-70">
                <p className="font-semibold text-sm">{CATEGORY_EMOJI[e.category]} {e.description}</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Awaiting other parent's approval</p>
                <p className="text-sm font-bold tabular-nums mt-1">{formatAmount(e.total_amount, e.currency)}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Flagged (rejected) expenses */}
      {flaggedExpenses.length > 0 && (
        <section className="px-4">
          <h3 className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-2">Flagged</h3>
          <div className="flex flex-col gap-2">
            {flaggedExpenses.map(e => (
              <div key={e.id} className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/20 p-4 opacity-80">
                <p className="font-semibold text-sm line-through text-[var(--color-text-muted)]">
                  {CATEGORY_EMOJI[e.category]} {e.description}
                </p>
                <p className="text-xs text-red-500 mt-0.5">Rejected — please discuss and re-submit if agreed</p>
                <p className="text-sm font-bold tabular-nums mt-1 text-[var(--color-text-muted)]">
                  {formatAmount(e.total_amount, e.currency)}
                </p>
                {e.logged_by === currentUserId && (
                  <button
                    onClick={() => handleRemove(e.id)}
                    className="mt-2 text-xs text-red-600 underline"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Open period committed expenses */}
      {openExpenses.length > 0 && (
        <section className="px-4">
          <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-2">
            Open — {currentPeriod}
          </h3>
          <div className="flex flex-col gap-2">
            {openExpenses.map(e => {
              const loggedByAmount = Math.round((e.total_amount * e.split_bp) / 10000);
              const otherAmount = e.total_amount - loggedByAmount;
              const myAmount = e.logged_by === currentUserId ? loggedByAmount : otherAmount;
              const uneven = loggedByAmount !== otherAmount;
              return (
                <div key={e.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="font-semibold text-sm">{CATEGORY_EMOJI[e.category]} {e.description}</p>
                      <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{ledgerNote(e, currentUserId)}</p>
                      {uneven && (
                        <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5 italic">
                          To keep things simple, we've rounded your share to {formatAmount(myAmount, e.currency)}.
                        </p>
                      )}
                    </div>
                    <p className="text-sm font-bold tabular-nums">{formatAmount(e.total_amount, e.currency)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Voided expenses */}
      {voidedExpenses.length > 0 && (
        <section className="px-4">
          <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-2">Voided</h3>
          <div className="flex flex-col gap-2">
            {voidedExpenses.map(e => (
              <div key={e.id} className="rounded-xl border border-[var(--color-border)] p-4 opacity-50">
                <p className="text-sm line-through">{e.description}</p>
                <p className="text-xs text-[var(--color-text-muted)]">Voided — co-parent removed</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Reconciled history */}
      {history.length > 0 && (
        <section className="px-4">
          <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-2">History</h3>
          {[...new Set(history.map(e => e.settlement_period))].map(period => (
            <div key={period} className="rounded-xl border border-[var(--color-border)] p-3 mb-2">
              <p className="text-sm font-semibold">{period}</p>
              <p className="text-xs text-[var(--color-text-muted)]">
                {history.filter(e => e.settlement_period === period).length} expenses reconciled
              </p>
            </div>
          ))}
        </section>
      )}

      {expenses.length === 0 && (
        <div className="px-4 pt-8 text-center text-[var(--color-text-muted)] text-sm">
          No shared expenses yet. Log one to get started.
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit -p app/tsconfig.json
```

- [ ] **Step 3: Commit**

```bash
git add app/src/components/dashboard/PoolTab.tsx
git commit -m "feat(ui): add PoolTab component with expense list, pending approvals, flagged section"
```

---

## Task 9: AddExpenseSheet component

**Files:**
- Create: `app/src/components/dashboard/AddExpenseSheet.tsx`

A bottom-sheet form for logging a new shared expense. Includes amount input, category picker, description, and the split slider with rounding empathy note.

- [ ] **Step 1: Write the component**

```tsx
// app/src/components/dashboard/AddExpenseSheet.tsx
import { useState } from 'react';

const CATEGORIES = [
  { value: 'education', label: '📚 Education' },
  { value: 'health',    label: '🏥 Health' },
  { value: 'clothing',  label: '👕 Clothing' },
  { value: 'travel',    label: '✈️ Travel' },
  { value: 'activities',label: '⚽ Activities' },
  { value: 'other',     label: '📋 Other' },
];

type Props = {
  defaultSplitBp: number;  // from families.shared_expense_split_bp
  currency: string;
  onClose: () => void;
  onSaved: () => void;
};

export function AddExpenseSheet({ defaultSplitBp, currency, onClose, onSaved }: Props) {
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('other');
  const [amountStr, setAmountStr] = useState('');
  const [splitBp, setSplitBp] = useState(defaultSplitBp);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const symbol = currency === 'GBP' ? '£' : currency === 'USD' ? '$' : 'zł';
  const totalPence = Math.round(parseFloat(amountStr || '0') * 100);
  const loggedByAmount = Math.round((totalPence * splitBp) / 10000);
  const otherAmount = totalPence - loggedByAmount;
  const uneven = totalPence > 0 && loggedByAmount !== otherAmount;

  function formatP(p: number) {
    return `${symbol}${(p / 100).toFixed(2)}`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) { setError('Please enter a description.'); return; }
    if (totalPence <= 0) { setError('Please enter a valid amount.'); return; }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/shared-expenses', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: description.trim(),
          category,
          total_amount: totalPence,
          split_bp: splitBp,
        }),
      });
      if (!res.ok) {
        const data = await res.json<{ error: string }>();
        throw new Error(data.error ?? 'Failed to save');
      }
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
      <div className="w-full max-w-[560px] bg-[var(--color-surface)] rounded-t-2xl p-6 pb-10 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Log shared expense</h2>
          <button onClick={onClose} className="text-[var(--color-text-muted)] text-2xl leading-none">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Description */}
          <div>
            <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g. School trip payment"
              className="mt-1 w-full border border-[var(--color-border)] rounded-xl px-4 py-3 text-sm bg-[var(--color-surface-raised)]"
            />
          </div>

          {/* Category */}
          <div>
            <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
              Category
            </label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="mt-1 w-full border border-[var(--color-border)] rounded-xl px-4 py-3 text-sm bg-[var(--color-surface-raised)]"
            >
              {CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* Amount */}
          <div>
            <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
              Total amount ({symbol})
            </label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              value={amountStr}
              onChange={e => setAmountStr(e.target.value)}
              placeholder="0.00"
              className="mt-1 w-full border border-[var(--color-border)] rounded-xl px-4 py-3 text-sm bg-[var(--color-surface-raised)] tabular-nums"
            />
          </div>

          {/* Split slider */}
          <div>
            <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
              Your share — {(splitBp / 100).toFixed(0)}%
            </label>
            <input
              type="range"
              min={0}
              max={10000}
              step={100}
              value={splitBp}
              onChange={e => setSplitBp(Number(e.target.value))}
              className="w-full mt-2"
            />
            {totalPence > 0 && (
              <div className="flex justify-between text-xs text-[var(--color-text-muted)] mt-1 tabular-nums">
                <span>You: {formatP(loggedByAmount)}</span>
                <span>Other parent: {formatP(otherAmount)}</span>
              </div>
            )}
            {uneven && (
              <p className="text-[10px] text-[var(--color-text-muted)] italic mt-1">
                To keep things simple, we've rounded your share to {formatP(loggedByAmount)} and the other parent's to {formatP(otherAmount)}.
              </p>
            )}
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-[var(--brand-primary)] text-white font-semibold py-3 rounded-xl disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Log expense'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit -p app/tsconfig.json
```

- [ ] **Step 3: Commit**

```bash
git add app/src/components/dashboard/AddExpenseSheet.tsx
git commit -m "feat(ui): add AddExpenseSheet with split slider and rounding empathy note"
```

---

## Task 10: SettlementCard component

**Files:**
- Create: `app/src/components/dashboard/SettlementCard.tsx`

Renders the reconcile summary and the Web Share button. Calls `POST /api/shared-expenses/reconcile`.

- [ ] **Step 1: Write the component**

```tsx
// app/src/components/dashboard/SettlementCard.tsx
import { useState } from 'react';

type Expense = {
  id: number;
  description: string;
  category: string;
  total_amount: number;
  logged_by_name: string;
  split_bp: number;
};

type ReconcileResult = {
  period: string;
  net_pence: number;
  currency: string;
  expenses: Expense[];
  message?: string;
};

type Props = {
  period: string;   // e.g. '2026-04'
  onClose: () => void;
  onReconciled: () => void;
};

function formatAmount(pence: number, currency: string): string {
  const symbol = currency === 'GBP' ? '£' : currency === 'USD' ? '$' : 'zł';
  return `${symbol}${(pence / 100).toFixed(2)}`;
}

export function SettlementCard({ period, onClose, onReconciled }: Props) {
  const [result, setResult] = useState<ReconcileResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleReconcile() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/shared-expenses/reconcile', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period }),
      });
      if (!res.ok) {
        const d = await res.json<{ error: string }>();
        throw new Error(d.error ?? 'Reconcile failed');
      }
      setResult(await res.json<ReconcileResult>());
      onReconciled();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  function buildShareText(r: ReconcileResult): string {
    const lines = [
      `Morechard Shared Expenses — ${r.period}`,
      '─────────────────────────',
      ...r.expenses.map(e =>
        `• ${e.description}: ${formatAmount(e.total_amount, r.currency)} (logged by ${e.logged_by_name})`
      ),
      '─────────────────────────',
      r.net_pence === 0
        ? 'You are square — no payment needed.'
        : r.net_pence < 0
          ? `Net: you are owed ${formatAmount(Math.abs(r.net_pence), r.currency)}`
          : `Net: you owe ${formatAmount(r.net_pence, r.currency)}`,
    ];
    return lines.join('\n');
  }

  async function handleShare(r: ReconcileResult) {
    const text = buildShareText(r);
    if (navigator.share) {
      await navigator.share({ title: `Shared expenses ${r.period}`, text });
    } else {
      await navigator.clipboard.writeText(text);
      alert('Copied to clipboard');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
      <div className="w-full max-w-[560px] bg-[var(--color-surface)] rounded-t-2xl p-6 pb-10 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Reconcile {period}</h2>
          <button onClick={onClose} className="text-[var(--color-text-muted)] text-2xl leading-none">&times;</button>
        </div>

        {!result && (
          <>
            <p className="text-sm text-[var(--color-text-muted)]">
              This will mark all committed expenses for {period} as settled and generate a summary you can share.
            </p>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button
              onClick={handleReconcile}
              disabled={loading}
              className="w-full bg-[var(--brand-primary)] text-white font-semibold py-3 rounded-xl disabled:opacity-50"
            >
              {loading ? 'Calculating…' : 'Generate settlement summary'}
            </button>
          </>
        )}

        {result && (
          <>
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-4 flex flex-col gap-2">
              {result.expenses.map(e => (
                <div key={e.id} className="flex justify-between text-sm">
                  <span className="text-[var(--color-text-muted)]">{e.description}</span>
                  <span className="font-semibold tabular-nums">{formatAmount(e.total_amount, result.currency)}</span>
                </div>
              ))}
              <div className="border-t border-[var(--color-border)] pt-2 mt-1 flex justify-between font-bold text-base">
                <span>
                  {result.net_pence === 0
                    ? 'You are square'
                    : result.net_pence < 0
                      ? `You are owed`
                      : `You owe`}
                </span>
                {result.net_pence !== 0 && (
                  <span className={result.net_pence < 0 ? 'text-green-600' : 'text-red-500'}>
                    {formatAmount(Math.abs(result.net_pence), result.currency)}
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={() => handleShare(result)}
              className="w-full border border-[var(--brand-primary)] text-[var(--brand-primary)] font-semibold py-3 rounded-xl"
            >
              Share summary
            </button>
            <button onClick={onClose} className="text-sm text-[var(--color-text-muted)] text-center">
              Close
            </button>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit -p app/tsconfig.json
```

- [ ] **Step 3: Commit**

```bash
git add app/src/components/dashboard/SettlementCard.tsx
git commit -m "feat(ui): add SettlementCard with reconcile flow and Web Share API"
```

---

## Task 11: Wire Pool tab into ParentDashboard

**Files:**
- Modify: `app/src/screens/ParentDashboard.tsx`

- [ ] **Step 1: Add `'pool'` to the Tab type**

Find the line:
```typescript
type Tab = 'chores' | 'activity' | 'insights' | 'goals'
```

Replace with:
```typescript
type Tab = 'chores' | 'activity' | 'pool' | 'insights' | 'goals'
```

- [ ] **Step 2: Add the Pool tab to the TABS array**

Find the `TABS` array definition (contains objects with `id`, `label`, and optionally `badge`). Add the Pool entry between `activity` and `insights`:

```typescript
{ id: 'pool' as Tab, label: 'Pool' },
```

- [ ] **Step 3: Add the Pool tab content to the content switch**

Find the block that conditionally renders tab content:
```typescript
{tab === 'activity' && <ActivityTab ... />}
{tab === 'insights' && <InsightsTab ... />}
```

Add between them:
```typescript
{tab === 'pool' && (
  <PoolTab
    familyId={familyId}
    currentUserId={userId}     // the logged-in parent's user_id from JWT/auth state
    onAddClick={() => setShowAddExpense(true)}
    onReconcileClick={(expenses) => setShowSettlement(true)}
  />
)}
```

- [ ] **Step 4: Add state + sheet rendering for AddExpenseSheet and SettlementCard**

Near the other modal state declarations, add:
```typescript
const [showAddExpense, setShowAddExpense] = useState(false);
const [showSettlement, setShowSettlement] = useState(false);
```

Near the end of the component's JSX (before the closing tag), add:
```typescript
{showAddExpense && (
  <AddExpenseSheet
    defaultSplitBp={family?.shared_expense_split_bp ?? 5000}
    currency={family?.currency ?? 'GBP'}
    onClose={() => setShowAddExpense(false)}
    onSaved={() => { setShowAddExpense(false); }}
  />
)}
{showSettlement && (
  <SettlementCard
    period={new Date().toISOString().slice(0, 7)}
    onClose={() => setShowSettlement(false)}
    onReconciled={() => setShowSettlement(false)}
  />
)}
```

- [ ] **Step 5: Add the missing imports at the top of ParentDashboard.tsx**

```typescript
import { PoolTab } from '../components/dashboard/PoolTab';
import { AddExpenseSheet } from '../components/dashboard/AddExpenseSheet';
import { SettlementCard } from '../components/dashboard/SettlementCard';
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npx tsc --noEmit -p app/tsconfig.json
```

- [ ] **Step 7: Commit**

```bash
git add app/src/screens/ParentDashboard.tsx
git commit -m "feat(ui): wire Pool tab into ParentDashboard with AddExpenseSheet and SettlementCard"
```

---

## Task 12: Family Settings — threshold, split, payment details

**Files:**
- Modify: `app/src/components/dashboard/ParentSettingsTab.tsx`

- [ ] **Step 1: Find the Co-Parenting section in ParentSettingsTab**

Search for `co.parent\|Co-parent\|coParent` in `ParentSettingsTab.tsx` to find the existing co-parenting settings block.

- [ ] **Step 2: Add the three settings controls**

Inside the co-parenting settings section, add:

```tsx
{/* Trust Threshold */}
<div className="flex flex-col gap-1">
  <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
    Approval threshold
  </label>
  <p className="text-xs text-[var(--color-text-muted)]">
    Expenses above this amount require the other parent's approval (Verification mode only).
  </p>
  <div className="flex items-center gap-2 mt-1">
    <span className="text-sm">{currencySymbol}</span>
    <input
      type="number"
      inputMode="decimal"
      step="1"
      min="0"
      value={(threshold / 100).toFixed(0)}
      onChange={e => setThreshold(Math.round(parseFloat(e.target.value || '0') * 100))}
      className="border border-[var(--color-border)] rounded-xl px-4 py-2 text-sm bg-[var(--color-surface-raised)] w-28 tabular-nums"
    />
  </div>
</div>

{/* Default Split */}
<div className="flex flex-col gap-1 mt-3">
  <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
    Default split — {(splitBp / 100).toFixed(0)}% / {(100 - splitBp / 100).toFixed(0)}%
  </label>
  <input
    type="range"
    min={0}
    max={10000}
    step={100}
    value={splitBp}
    onChange={e => setSplitBp(Number(e.target.value))}
    className="w-full mt-1"
  />
</div>

<button
  onClick={handleSaveCoParentSettings}
  disabled={savingSettings}
  className="mt-3 bg-[var(--brand-primary)] text-white font-semibold text-sm py-2 px-6 rounded-xl disabled:opacity-50"
>
  {savingSettings ? 'Saving…' : 'Save'}
</button>
```

- [ ] **Step 3: Add the save handler and state**

Add near other settings state declarations:
```typescript
const [threshold, setThreshold] = useState(family?.shared_expense_threshold ?? 5000);
const [splitBp, setSplitBp] = useState(family?.shared_expense_split_bp ?? 5000);
const [savingSettings, setSavingSettings] = useState(false);
```

Add the save handler:
```typescript
async function handleSaveCoParentSettings() {
  setSavingSettings(true);
  try {
    await fetch('/api/family/settings', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shared_expense_threshold: threshold,
        shared_expense_split_bp: splitBp,
      }),
    });
  } finally {
    setSavingSettings(false);
  }
}
```

> **Note:** The `PATCH /api/family/settings` route needs to be added to the Worker (see Task 13).

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit -p app/tsconfig.json
```

- [ ] **Step 5: Commit**

```bash
git add app/src/components/dashboard/ParentSettingsTab.tsx
git commit -m "feat(ui): add threshold and default split controls to family settings"
```

---

## Task 13: PATCH /api/family/settings Worker route

**Files:**
- Modify: `worker/src/routes/sharedExpenses.ts` (add one more export)
- Modify: `worker/src/index.ts` (register the route)

- [ ] **Step 1: Add the handler to sharedExpenses.ts**

```typescript
// PATCH /api/family/settings
// Updates shared_expense_threshold and shared_expense_split_bp on families.
export async function handleUpdateFamilySettings(req: AuthedRequest, env: Env): Promise<Response> {
  // Only lead parent can change family settings
  if (req.auth.parent_role !== 'lead') {
    return jsonErr('only the lead parent can change family settings', 403);
  }

  const body = await req.json<{
    shared_expense_threshold?: number;
    shared_expense_split_bp?: number;
  }>();

  const updates: string[] = [];
  const values: unknown[] = [];

  if (body.shared_expense_threshold !== undefined) {
    if (!Number.isInteger(body.shared_expense_threshold) || body.shared_expense_threshold < 0) {
      return jsonErr('shared_expense_threshold must be a non-negative integer', 400);
    }
    updates.push('shared_expense_threshold = ?');
    values.push(body.shared_expense_threshold);
  }

  if (body.shared_expense_split_bp !== undefined) {
    if (body.shared_expense_split_bp < 0 || body.shared_expense_split_bp > 10000) {
      return jsonErr('shared_expense_split_bp must be 0–10000', 400);
    }
    updates.push('shared_expense_split_bp = ?');
    values.push(body.shared_expense_split_bp);
  }

  if (!updates.length) return jsonErr('no valid fields to update', 400);

  values.push(req.auth.family_id);
  await env.DB
    .prepare(`UPDATE families SET ${updates.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run();

  return jsonOk({ updated: true });
}
```

- [ ] **Step 2: Register in index.ts**

```typescript
if (path === '/api/family/settings' && method === 'PATCH') {
  const parentCheck = requireRole(auth, 'parent');
  if (parentCheck) return parentCheck;
  return handleUpdateFamilySettings(Object.assign(request, { auth }) as any, env);
}
```

Also import `handleUpdateFamilySettings` in the import statement added in Task 7.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit -p worker/tsconfig.json
```

- [ ] **Step 4: Commit**

```bash
git add worker/src/routes/sharedExpenses.ts worker/src/index.ts
git commit -m "feat(worker): add PATCH /api/family/settings for threshold and split defaults"
```

---

## Task 14: End-to-end smoke test

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Log in as a lead parent and open the Pool tab**

Navigate to `http://localhost:5173/parent`. Confirm the Pool tab appears in the tab bar. Confirm the tab renders without errors in the browser console.

- [ ] **Step 3: Log a small expense (under £50 threshold)**

Click "Log shared expense". Fill in description, category, amount £10.00, leave split at 50/50. Submit. Confirm:
- The expense appears in the Open Period section
- `verification_status` is `committed_auto`
- The running balance chip updates

- [ ] **Step 4: Log a large expense (over £50 threshold) in Verification mode**

If the family is in `amicable` mode, temporarily change `verify_mode` to `standard` via D1:
```bash
npx wrangler d1 execute morechard-db --local --command="UPDATE families SET verify_mode='standard' WHERE id='<your-family-id>';"
```

Log an expense of £100. Confirm:
- The expense appears in the Pending section
- An approval email is triggered (check dev console for Resend API call)

- [ ] **Step 5: Approve the expense as the second parent**

Log in as the co-parent. Navigate to Pool tab. Confirm the pending expense appears with Approve/Reject buttons. Click Approve. Confirm:
- The expense moves to the Open Period section
- `verification_status` is `committed_manual`
- Ledger note reads "Logged by [A], Verified by [B]"

- [ ] **Step 6: Reconcile the open period**

Click Reconcile. Confirm:
- Settlement summary shows correct net balance
- Share button generates plain-text summary
- After reconciling, expenses move to History

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "feat: shared expense pool — complete implementation"
```

---

## Spec Coverage Check

| Spec requirement | Covered by |
|---|---|
| `shared_expenses` table with chain-of-trust | Task 1 |
| `families` threshold + split_bp columns | Task 2 |
| `computeSharedExpenseHash` + `getLastCommittedHash` | Task 3 |
| Auto-commit vs pending based on verify_mode + threshold | Task 4 (`handleCreateSharedExpense`) |
| Approve route — writes hash at commit time | Task 4 (`handleApproveSharedExpense`) |
| Reject route — sets `rejected`, excluded from chain | Task 4 (`handleRejectSharedExpense`) |
| Soft-delete constraint (pending/rejected only) | Task 4 (`handleDeleteSharedExpense`) |
| Reversal pattern documented for committed rows | Task 1 (SQL comment), Task 4 (403 response) |
| Settlement net balance formula | Task 4 (`handleReconcileSharedExpenses`) |
| Web Share API fallback to clipboard | Task 10 (`SettlementCard`) |
| Approval email via Resend magic-link pattern | Task 5 |
| Void pending expenses on co-parent removal | Task 6 |
| Pool tab in ParentDashboard (co-parent only disclosure) | Task 11 |
| Split slider + rounding empathy note | Task 9 (`AddExpenseSheet`) |
| Flagged section for rejected expenses | Task 8 (`PoolTab`) |
| Voided expenses in history | Task 8 (`PoolTab`) |
| Ledger notes ("Logged by [A]", "Verified by [B]") | Task 8 (`ledgerNote()`) |
| Trust Threshold + Default Split in Family Settings | Task 12, Task 13 |
| Child dashboard — zero access to shared_expenses | Architectural (no imports, no routes) |
| hash written only at commit time, PENDING placeholder | Task 3, Task 4 |