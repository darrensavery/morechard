# Relocation Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the "Relocation Audit" feature promised in onboarding copy — a lead-only action that changes a family's going-forward ledger currency and writes a permanent, hash-chained marker explaining the switch — and fix a pre-existing ledger hash-chain bug discovered while researching it.

**Architecture:** A new exported helper in the shared hash-chain library (`worker/src/lib/hash.ts`) prepares a correctly-hashed, non-monetary `system_note` ledger row as a `D1PreparedStatement` so callers can bundle it into their own atomic `db.batch()`. A new worker route (`POST /api/family/relocate`) uses it to atomically insert the marker and update `families.currency`/`base_currency`. Two existing call sites with the same bug (co-parent leaves, co-parent removed) are fixed to use the same corrected helper. A new Settings > Family row + confirm screen lets the lead parent trigger it.

**Tech Stack:** Cloudflare Workers + D1 (SQL), Zod validation, vitest (hand-rolled D1 fakes — this codebase has no shared D1 test harness), React + `@testing-library/react` on the app side.

**Spec:** `docs/superpowers/specs/2026-09-12-relocation-audit-design.md`

## Global Constraints

- Never use `--local` on any wrangler command; `--env production` targets the live `morechard` DB, anything else targets `morechard-dev`.
- The ledger is append-only — the `ledger_immutable_fields` trigger blocks any UPDATE to `currency`/`amount`/`entry_type`/`record_hash`/`previous_hash` on existing rows. Nothing in this plan updates an existing ledger row.
- Supported currencies are exactly `'GBP' | 'USD' | 'PLN'` — matches the existing inline `z.enum` convention repeated across `finance.ts`/`market-rates.ts`/`settings.ts`; do not introduce a shared constant (see spec's "Currency enum" note — the real constraint is the D1 `CHECK` columns, which need a migration regardless).
- `ledger.id` is `INTEGER PRIMARY KEY AUTOINCREMENT` but is a single sequence **shared by every family** — any new id must come from `SELECT MAX(id) FROM ledger` (table-wide), never from a single family's own last row + 1.
- A `NULL` `child_id` must be hashed as the literal string `'NULL'` (matching `fetchAndVerifyChainTip`'s own re-derivation), never `''` or raw `null`.
- End every commit message with `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.

---

## Task 1: Fix the ledger.id global-vs-family-scoped collision bug in `fetchAndVerifyChainTip`

**Files:**
- Modify: `worker/src/lib/hash.ts:56-87`
- Test: `worker/src/lib/hash.test.ts` (new file)

**Interfaces:**
- Consumes: nothing new.
- Produces: `fetchAndVerifyChainTip(db, familyId)` now returns `{ previousHash, newId }` where `newId` is `(table-wide MAX(id)) + 1`, not `(family's own last row id) + 1`. Signature unchanged. `GENESIS_HASH`, `computeRecordHash` unchanged (already exported).

- [ ] **Step 1: Write the failing tests**

Create `worker/src/lib/hash.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { GENESIS_HASH, computeRecordHash, fetchAndVerifyChainTip } from './hash.js';

interface FakeRow {
  id: number; family_id: string; child_id: string | null; amount: number;
  currency: string; entry_type: string; previous_hash: string; record_hash: string;
}

function makeFakeLedgerDb(seedRows: FakeRow[] = []) {
  const rows: FakeRow[] = [...seedRows];
  const db = {
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            async first<T>() {
              if (sql.includes('MAX(id) AS max_id')) {
                const maxId = rows.length ? Math.max(...rows.map(r => r.id)) : null;
                return { max_id: maxId } as unknown as T;
              }
              if (sql.includes('SELECT record_hash FROM ledger')) {
                const [familyId] = args as [string];
                const tip = rows.filter(r => r.family_id === familyId).sort((a, b) => b.id - a.id)[0];
                return (tip ? { record_hash: tip.record_hash } : null) as unknown as T;
              }
              if (sql.includes('SELECT id, family_id, child_id')) {
                const [familyId] = args as [string];
                const tip = rows.filter(r => r.family_id === familyId).sort((a, b) => b.id - a.id)[0];
                return (tip ?? null) as unknown as T;
              }
              return null as unknown as T;
            },
            async run() { return { success: true }; },
          };
        },
      };
    },
  };
  return { db: db as unknown as D1Database, rows };
}

describe('fetchAndVerifyChainTip', () => {
  it('returns genesis hash and id 1 for a completely empty ledger', async () => {
    const { db } = makeFakeLedgerDb([]);
    const result = await fetchAndVerifyChainTip(db, 'fam_a');
    expect(result).toEqual({ previousHash: GENESIS_HASH, newId: 1 });
  });

  it("computes newId from the table-wide max id, not the family's own last row", async () => {
    // family A's only row is id=5; family B has advanced the shared id
    // sequence to 20. The next write for family A must not reuse 6 — another
    // family may already hold that id.
    const famAHash = await computeRecordHash(5, 'fam_a', 'NULL', 0, 'GBP', 'system_note', GENESIS_HASH);
    const famBHash = await computeRecordHash(20, 'fam_b', 'NULL', 0, 'GBP', 'system_note', GENESIS_HASH);
    const { db } = makeFakeLedgerDb([
      { id: 5, family_id: 'fam_a', child_id: null, amount: 0, currency: 'GBP', entry_type: 'system_note', previous_hash: GENESIS_HASH, record_hash: famAHash },
      { id: 20, family_id: 'fam_b', child_id: null, amount: 0, currency: 'GBP', entry_type: 'system_note', previous_hash: GENESIS_HASH, record_hash: famBHash },
    ]);
    const result = await fetchAndVerifyChainTip(db, 'fam_a');
    expect(result.newId).toBe(21);
    expect(result.previousHash).toBe(famAHash);
  });

  it('throws when the stored hash no longer matches recomputation (corrupted chain)', async () => {
    const { db } = makeFakeLedgerDb([
      { id: 1, family_id: 'fam_a', child_id: null, amount: 0, currency: 'GBP', entry_type: 'system_note', previous_hash: GENESIS_HASH, record_hash: 'tampered-hash' },
    ]);
    await expect(fetchAndVerifyChainTip(db, 'fam_a')).rejects.toThrow(/chain integrity failure/i);
  });
});
```

- [ ] **Step 2: Run the tests to confirm the collision test fails**

Run: `cd worker && npx vitest run src/lib/hash.test.ts`
Expected: the first and third tests pass (existing behavior), the second test (`computes newId from the table-wide max id`) FAILS with `newId` equal to `6`, not `21`.

- [ ] **Step 3: Fix `fetchAndVerifyChainTip`**

In `worker/src/lib/hash.ts`, replace the function body (lines 56-87) with:

```ts
export async function fetchAndVerifyChainTip(
  db: D1Database,
  familyId: string,
): Promise<{ previousHash: string; newId: number }> {
  const tip = await db
    .prepare(`SELECT id, family_id, child_id, amount, currency, entry_type,
                     previous_hash, record_hash
              FROM ledger WHERE family_id = ? ORDER BY id DESC LIMIT 1`)
    .bind(familyId)
    .first<ChainTipRow>();

  // `ledger.id` is a single AUTOINCREMENT sequence shared by every family,
  // not scoped per family — the next id must come from the table-wide max,
  // not this family's own last row, or a family that isn't the most recent
  // writer to the table collides with another family's row on every write.
  const globalMax = await db
    .prepare('SELECT MAX(id) AS max_id FROM ledger')
    .first<{ max_id: number | null }>();
  const newId = (globalMax?.max_id ?? 0) + 1;

  if (!tip) return { previousHash: GENESIS_HASH, newId };

  const expected = await computeRecordHash(
    tip.id,
    tip.family_id,
    tip.child_id ?? 'NULL',
    tip.amount,
    tip.currency,
    tip.entry_type,
    tip.previous_hash,
  );

  if (expected !== tip.record_hash) {
    throw new Error(
      `Ledger chain integrity failure on family ${familyId} at row ${tip.id}. ` +
      `Expected hash ${expected}, stored ${tip.record_hash}.`,
    );
  }

  return { previousHash: tip.record_hash, newId };
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `cd worker && npx vitest run src/lib/hash.test.ts`
Expected: all 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add worker/src/lib/hash.ts worker/src/lib/hash.test.ts
git commit -m "$(cat <<'EOF'
fix(ledger): compute next ledger id from the table-wide max, not a family's own last row

ledger.id is a single AUTOINCREMENT sequence shared by every family, not
scoped per family. fetchAndVerifyChainTip() was computing newId as
(this family's last row id) + 1, which collides with another family's
row whenever that family isn't the most recent writer to the table —
causing an uncaught PRIMARY KEY failure on the next chore approval,
invite acceptance, manual ledger entry, or allowance payout for that
family. A sibling helper (writeSystemNote in auth.ts) already had the
correct fix; this brings the shared hash-chain library in line with it.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Add `prepareSystemNoteInsert` and fix NULL-`child_id` hashing in `verifyChain`

**Files:**
- Modify: `worker/src/lib/hash.ts` (add export, fix `verifyChain`)
- Modify: `worker/src/routes/ledger-verify-public.ts:17-26` (type fix)
- Test: `worker/src/lib/hash.test.ts` (extend)

**Interfaces:**
- Consumes: `GENESIS_HASH`, `computeRecordHash` (from Task 1's file, unchanged).
- Produces: `prepareSystemNoteInsert(db: D1Database, familyId: string, currency: string, description: string, ipAddress: string, authorisedBy?: string | null): Promise<{ statement: ReturnType<D1Database['prepare']>; id: number; recordHash: string }>` — prepares but does not execute the INSERT, so callers can bundle it into their own `db.batch([...])`. `verifyChain(entries)` signature unchanged except `child_id` is now typed `string | null`.

- [ ] **Step 1: Write the failing tests**

Append to `worker/src/lib/hash.test.ts`:

```ts
import { prepareSystemNoteInsert, verifyChain } from './hash.js';

describe('prepareSystemNoteInsert', () => {
  it('prepares a statement whose id/hash come from the table-wide max, and hashes NULL child_id as the literal string \'NULL\'', async () => {
    const famBHash = await computeRecordHash(20, 'fam_b', 'NULL', 0, 'GBP', 'system_note', GENESIS_HASH);
    const { db } = makeFakeLedgerDb([
      { id: 20, family_id: 'fam_b', child_id: null, amount: 0, currency: 'GBP', entry_type: 'system_note', previous_hash: GENESIS_HASH, record_hash: famBHash },
    ]);

    const expectedHash = await computeRecordHash(21, 'fam_a', 'NULL', 0, 'USD', 'system_note', GENESIS_HASH);
    const { id, recordHash } = await prepareSystemNoteInsert(db, 'fam_a', 'USD', 'test note', '1.2.3.4', 'user_1');

    expect(id).toBe(21);
    expect(recordHash).toBe(expectedHash);
  });
});

describe('verifyChain', () => {
  it('validates a row whose NULL child_id was hashed as the literal string \'NULL\'', async () => {
    const hash = await computeRecordHash(1, 'fam_a', 'NULL', 0, 'GBP', 'system_note', GENESIS_HASH);
    const entries = [{
      id: 1, family_id: 'fam_a', child_id: null, amount: 0, currency: 'GBP',
      entry_type: 'system_note', previous_hash: GENESIS_HASH, record_hash: hash,
    }];
    const result = await verifyChain(entries);
    expect(result).toEqual({ valid: true, brokenAt: null });
  });

  it('flags a broken chain when a NULL child_id was hashed with a different convention at write time', async () => {
    // Reproduces the pre-fix bug: a row written with child_id hashed as ''
    // instead of 'NULL' fails verification forever after.
    const wrongHash = await computeRecordHash(1, 'fam_a', '', 0, 'GBP', 'system_note', GENESIS_HASH);
    const entries = [{
      id: 1, family_id: 'fam_a', child_id: null, amount: 0, currency: 'GBP',
      entry_type: 'system_note', previous_hash: GENESIS_HASH, record_hash: wrongHash,
    }];
    const result = await verifyChain(entries);
    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBe(1);
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `cd worker && npx vitest run src/lib/hash.test.ts`
Expected: FAIL — `prepareSystemNoteInsert` is not exported yet (import error), so the whole file fails to run.

- [ ] **Step 3: Add `prepareSystemNoteInsert` and fix `verifyChain`**

In `worker/src/lib/hash.ts`, add this export (after `writeLedgerEntry`, before `verifyChain`):

```ts
/**
 * Prepares (but does not execute) a zero-amount, non-monetary `system_note`
 * ledger row — the standard way to record an account-lifecycle event
 * (co-parent left, currency relocated, etc.) on the hash chain without it
 * representing money movement. Returns a D1PreparedStatement so callers can
 * bundle it into their own `db.batch([...])` alongside other writes that
 * must land atomically with it.
 *
 * `child_id` is always NULL for these rows; NULL is hashed as the literal
 * string 'NULL' to match how fetchAndVerifyChainTip() re-derives the hash of
 * a NULL child_id row on every subsequent write.
 */
export async function prepareSystemNoteInsert(
  db: D1Database,
  familyId: string,
  currency: string,
  description: string,
  ipAddress: string,
  authorisedBy: string | null = null,
): Promise<{ statement: ReturnType<D1Database['prepare']>; id: number; recordHash: string }> {
  const prevRow = await db
    .prepare('SELECT record_hash FROM ledger WHERE family_id = ? ORDER BY id DESC LIMIT 1')
    .bind(familyId)
    .first<{ record_hash: string }>();
  const previousHash = prevRow?.record_hash ?? GENESIS_HASH;

  const globalMax = await db
    .prepare('SELECT MAX(id) AS max_id FROM ledger')
    .first<{ max_id: number | null }>();
  const newId = (globalMax?.max_id ?? 0) + 1;

  const recordHash = await computeRecordHash(newId, familyId, 'NULL', 0, currency, 'system_note', previousHash);

  const statement = db.prepare(`
    INSERT INTO ledger
      (id, family_id, child_id, chore_id, entry_type, amount, currency,
       description, verification_status, authorised_by,
       previous_hash, record_hash, ip_address)
    VALUES (?,?,NULL,NULL,'system_note',0,?,?,'verified_auto',?,?,?,?)
  `).bind(newId, familyId, currency, description, authorisedBy, previousHash, recordHash, ipAddress);

  return { statement, id: newId, recordHash };
}
```

Then replace the `verifyChain` function with:

```ts
export async function verifyChain(entries: Array<{
  id: number;
  family_id: string;
  child_id: string | null;
  amount: number;
  currency: string;
  entry_type: string;
  previous_hash: string;
  record_hash: string;
}>): Promise<{ valid: boolean; brokenAt: number | null }> {
  for (const entry of entries) {
    const expected = await computeRecordHash(
      entry.id,
      entry.family_id,
      entry.child_id ?? 'NULL',
      entry.amount,
      entry.currency,
      entry.entry_type,
      entry.previous_hash,
    );
    if (expected !== entry.record_hash) {
      return { valid: false, brokenAt: entry.id };
    }
  }
  return { valid: true, brokenAt: null };
}
```

In `worker/src/routes/ledger-verify-public.ts`, change the `LedgerRow` interface's `child_id: string;` (line 20) to `child_id: string | null;` — it was lying about nullability; D1 returns `null` for a SQL NULL and `verifyChain` now coalesces it correctly.

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `cd worker && npx vitest run src/lib/hash.test.ts`
Expected: all 6 tests PASS (3 from Task 1 + 3 new).

- [ ] **Step 5: Run the full worker typecheck**

Run: `cd worker && npm run typecheck` (or `npx tsc --noEmit` if no such script — check `worker/package.json` `scripts` first)
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add worker/src/lib/hash.ts worker/src/lib/hash.test.ts worker/src/routes/ledger-verify-public.ts
git commit -m "$(cat <<'EOF'
fix(ledger): standardise NULL child_id hashing to 'NULL', add reusable system_note helper

Three different spots in the ledger code stringified a NULL child_id
three different ways when computing its hash: '' (auth.ts co-parent-leave),
'NULL' (auth.ts writeSystemNote — matches what fetchAndVerifyChainTip
expects on read), and raw null (verifyChain, via ledger-verify-public.ts).
Any system_note row hashed with the wrong convention at write time fails
verification the next time the chain is checked. Standardised on 'NULL'
everywhere, and added prepareSystemNoteInsert() as the one correct,
reusable way to build one of these rows — returns a D1PreparedStatement
so it can be bundled into a caller's own atomic batch.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Fix the two buggy `system_note` writers in `auth.ts` to use `prepareSystemNoteInsert`

**Files:**
- Modify: `worker/src/routes/auth.ts:964-993` (co-parent voluntarily leaves)
- Modify: `worker/src/routes/auth.ts:1081-1114` (lead removes a co-parent)

**Interfaces:**
- Consumes: `prepareSystemNoteInsert` from `../lib/hash.js` (Task 2).
- Produces: nothing new — internal fix only, no signature changes to either handler.

This task does **not** touch `handleMePatch`'s nested `writeSystemNote` helper (lines 717-756) — it already uses the global-max-id + `'NULL'` convention correctly and is the reference implementation `prepareSystemNoteInsert` was extracted from. It also does not change the hardcoded `'GBP'` currency literal in either buggy call site — both already hardcode `'GBP'` rather than reading the family's actual `base_currency`, which is a separate, pre-existing, lower-severity inconsistency out of scope for this fix (the two bugs being fixed here are the id collision and the hash-input mismatch, not the currency value).

- [ ] **Step 1: Locate the exact current code**

Read `worker/src/routes/auth.ts` lines 960-993 and 1081-1114 to confirm line numbers haven't shifted from Task 1/2's edits to other files (they shouldn't have, since those edits were in different files).

- [ ] **Step 2: Fix the co-parent-leaves flow**

In `worker/src/routes/auth.ts`, find:

```ts
  // Ledger: compute hash chain
  const prevRow = await env.DB
    .prepare('SELECT id, record_hash FROM ledger WHERE family_id = ? ORDER BY id DESC LIMIT 1')
    .bind(familyId)
    .first<{ id: number; record_hash: string }>();
  const previousHash = prevRow?.record_hash ?? GENESIS_HASH;
  const newId        = (prevRow?.id ?? 0) + 1;
  const recordHash   = await computeRecordHash(newId, familyId, '', 0, 'GBP', 'system_note', previousHash);

  const capturedName = caller.display_name;

  const batch: ReturnType<typeof env.DB.prepare>[] = [
```

Replace with:

```ts
  const { statement: systemNoteStatement } = await prepareSystemNoteInsert(
    env.DB, familyId, 'GBP', `🌱 ${caller.display_name} has left the orchard.`, ip,
  );

  const batch: ReturnType<typeof env.DB.prepare>[] = [
```

A few lines below, find:

```ts
    // Audit note
    env.DB.prepare(`INSERT INTO ledger (id, family_id, child_id, entry_type, amount, currency, description, verification_status, previous_hash, record_hash, ip_address) VALUES (?,?,NULL,'system_note',0,'GBP',?,'verified_auto',?,?,?)`)
      .bind(newId, familyId, `🌱 ${capturedName} has left the orchard.`, previousHash, recordHash, ip),
  ];
```

Replace with:

```ts
    // Audit note
    systemNoteStatement,
  ];
```

- [ ] **Step 3: Fix the remove-co-parent flow**

In the same file, find (around line 1081-1088):

```ts
  // Ledger audit note — hash chain
  const prevRow = await env.DB
    .prepare('SELECT id, record_hash FROM ledger WHERE family_id = ? ORDER BY id DESC LIMIT 1')
    .bind(familyId)
    .first<{ id: number; record_hash: string }>();
  const previousHash = prevRow?.record_hash ?? GENESIS_HASH;
  const newId        = (prevRow?.id ?? 0) + 1;
  const recordHash   = await computeRecordHash(newId, familyId, '', 0, 'GBP', 'system_note', previousHash);
  const capturedName = target.display_name;
```

Replace with:

```ts
  const { statement: systemNoteStatement } = await prepareSystemNoteInsert(
    env.DB, familyId, 'GBP', `🌿 ${target.display_name} has been removed from the orchard.`, ip,
  );
```

Then find:

```ts
    // Immutable audit trail
    env.DB.prepare(`
      INSERT INTO ledger
        (id, family_id, child_id, entry_type, amount, currency,
         description, verification_status, previous_hash, record_hash, ip_address)
      VALUES (?,?,NULL,'system_note',0,'GBP',?,'verified_auto',?,?,?)
    `).bind(newId, familyId, `🌿 ${capturedName} has been removed from the orchard.`, previousHash, recordHash, ip),
  ];
```

Replace with:

```ts
    // Immutable audit trail
    systemNoteStatement,
  ];
```

- [ ] **Step 4: Add the import**

In `worker/src/routes/auth.ts`, change line 25 from:

```ts
import { sha256, computeRecordHash, GENESIS_HASH } from '../lib/hash.js';
```

to:

```ts
import { sha256, computeRecordHash, GENESIS_HASH, prepareSystemNoteInsert } from '../lib/hash.js';
```

(`computeRecordHash` and `GENESIS_HASH` stay — `handleMePatch`'s `writeSystemNote` still uses them directly.)

- [ ] **Step 5: Typecheck**

Run: `cd worker && npm run typecheck` (or `npx tsc --noEmit`)
Expected: no errors — confirms `newId`/`previousHash`/`recordHash`/`capturedName` are no longer referenced anywhere they were deleted from (a leftover reference would be a compile error here, since TypeScript would flag the now-undefined variable).

- [ ] **Step 6: Run the full worker test suite**

Run: `cd worker && npx vitest run`
Expected: all existing tests still PASS (no test currently exercises these two handlers directly — this is a known gap, not introduced by this change — so this step confirms no *other* test broke).

- [ ] **Step 7: Commit**

```bash
git add worker/src/routes/auth.ts
git commit -m "$(cat <<'EOF'
fix(ledger): route co-parent-leave/remove audit notes through prepareSystemNoteInsert

Both call sites inlined the same two bugs fixed in hash.ts: a
family-scoped next-id (collides with other families on a shared
AUTOINCREMENT column) and hashing a NULL child_id as '' instead of
'NULL' (breaks chain verification on the next write for that family).
Delegating to the shared, already-correct helper removes the duplicated
logic and the bugs in one pass.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `POST /api/family/relocate` endpoint + tighten `PATCH /api/family`

**Files:**
- Modify: `worker/src/routes/settings.ts` (add handler, tighten schema, add imports)
- Modify: `worker/src/index.ts` (register route + import)
- Test: `worker/src/routes/family-relocate.test.ts` (new file)

**Interfaces:**
- Consumes: `prepareSystemNoteInsert` from `../lib/hash.js` (Task 2), `clientIp` from `../lib/response.js`, `parseValidatedBody` from `../lib/validate.js` (all already-existing exports).
- Produces: `handleFamilyRelocate(request: Request, env: Env): Promise<Response>` — exported from `settings.ts`, registered at `POST /api/family/relocate`.

- [ ] **Step 1: Write the failing tests**

Create `worker/src/routes/family-relocate.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { handleFamilyRelocate } from './settings.js';
import type { Env } from '../types.js';

function makeRelocateEnv(opts: {
  parentRole: 'lead' | 'co_parent' | null;
  baseCurrency: string;
  ledgerRows?: Array<{ id: number; family_id: string; record_hash: string }>;
}) {
  const ledgerRows = opts.ledgerRows ?? [];
  const familiesUpdated: Array<{ currency: string; base_currency: string; id: string }> = [];
  const batchCalls: unknown[][] = [];

  const DB = {
    prepare(sql: string) {
      // resolveFirst backs both call shapes production code uses: a parameterised
      // query via `.bind(args).first()`, and a bind-less `.first()` directly on
      // `.prepare()` — real D1 allows .first()/.run() with no .bind() when a query
      // has no placeholders, and prepareSystemNoteInsert's `SELECT MAX(id) FROM
      // ledger` relies on exactly that (no `?` in the SQL, so no bind is ever
      // called on it in production).
      const resolveFirst = async <T>(args: unknown[]): Promise<T> => {
        if (sql.includes('FROM family_roles')) {
          return (opts.parentRole ? { parent_role: opts.parentRole } : null) as unknown as T;
        }
        if (sql.includes('SELECT base_currency FROM families')) {
          return { base_currency: opts.baseCurrency } as unknown as T;
        }
        if (sql.includes('MAX(id) AS max_id')) {
          const maxId = ledgerRows.length ? Math.max(...ledgerRows.map(r => r.id)) : null;
          return { max_id: maxId } as unknown as T;
        }
        if (sql.includes('SELECT record_hash FROM ledger')) {
          const [familyId] = args as [string];
          const tip = ledgerRows.filter(r => r.family_id === familyId).sort((a, b) => b.id - a.id)[0];
          return (tip ? { record_hash: tip.record_hash } : null) as unknown as T;
        }
        return null as unknown as T;
      };
      return {
        first: <T>() => resolveFirst<T>([]),
        bind(...args: unknown[]) {
          return {
            first: <T>() => resolveFirst<T>(args),
            async run() {
              if (sql.includes('UPDATE families SET currency')) {
                const [currency, baseCurrency, id] = args as [string, string, string];
                familiesUpdated.push({ currency, base_currency: baseCurrency, id });
              }
              return { success: true };
            },
          };
        },
      };
    },
    async batch(statements: Array<{ run: () => Promise<unknown> }>) {
      batchCalls.push(statements);
      for (const s of statements) await s.run();
      return [];
    },
  };

  const CACHE = { delete: vi.fn(async () => undefined), get: vi.fn(async () => null), put: vi.fn(async () => undefined) };

  return { env: { DB, CACHE } as unknown as Env, familiesUpdated, batchCalls };
}

describe('handleFamilyRelocate', () => {
  it('rejects a co-parent (non-lead) with 403', async () => {
    const { env } = makeRelocateEnv({ parentRole: 'co_parent', baseCurrency: 'GBP' });
    const req = new Request('https://x/api/family/relocate', { method: 'POST', body: JSON.stringify({ new_currency: 'USD' }) });
    (req as unknown as { auth: unknown }).auth = { sub: 'parent_1', family_id: 'fam_1', role: 'parent' };

    const res = await handleFamilyRelocate(req, env);
    expect(res.status).toBe(403);
  });

  it('rejects a request to relocate to the currency already in use with 400', async () => {
    const { env } = makeRelocateEnv({ parentRole: 'lead', baseCurrency: 'GBP' });
    const req = new Request('https://x/api/family/relocate', { method: 'POST', body: JSON.stringify({ new_currency: 'GBP' }) });
    (req as unknown as { auth: unknown }).auth = { sub: 'parent_1', family_id: 'fam_1', role: 'parent' };

    const res = await handleFamilyRelocate(req, env);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/already using GBP/);
  });

  it('rejects an unsupported currency with 400', async () => {
    const { env } = makeRelocateEnv({ parentRole: 'lead', baseCurrency: 'GBP' });
    const req = new Request('https://x/api/family/relocate', { method: 'POST', body: JSON.stringify({ new_currency: 'EUR' }) });
    (req as unknown as { auth: unknown }).auth = { sub: 'parent_1', family_id: 'fam_1', role: 'parent' };

    const res = await handleFamilyRelocate(req, env);
    expect(res.status).toBe(400);
  });

  it('lead relocating to a new currency writes a system_note ledger entry and updates both currency columns in one atomic batch', async () => {
    const { env, familiesUpdated, batchCalls } = makeRelocateEnv({ parentRole: 'lead', baseCurrency: 'GBP' });
    const req = new Request('https://x/api/family/relocate', {
      method: 'POST',
      body: JSON.stringify({ new_currency: 'USD', note: 'Moved to Austin' }),
    });
    (req as unknown as { auth: unknown }).auth = { sub: 'parent_1', family_id: 'fam_1', role: 'parent' };

    const res = await handleFamilyRelocate(req, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; new_currency: string };
    expect(body).toEqual({ ok: true, new_currency: 'USD' });

    expect(batchCalls).toHaveLength(1);
    expect(batchCalls[0]).toHaveLength(2); // system_note insert + families update, same batch
    expect(familiesUpdated).toEqual([{ currency: 'USD', base_currency: 'USD', id: 'fam_1' }]);
    expect(env.CACHE.delete).toHaveBeenCalledWith('family:config:fam_1');
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `cd worker && npx vitest run src/routes/family-relocate.test.ts`
Expected: FAIL — `handleFamilyRelocate` is not exported from `settings.ts` yet.

- [ ] **Step 3: Implement the handler**

In `worker/src/routes/settings.ts`, change the imports at the top (lines 15-20) from:

```ts
import { Env } from '../types.js';

import { json, error } from '../lib/response.js';
import { JwtPayload } from '../lib/jwt.js';
import { z } from 'zod';
import { parseValidatedBody } from '../lib/validate.js';
```

to:

```ts
import { Env } from '../types.js';

import { json, error, clientIp } from '../lib/response.js';
import { JwtPayload } from '../lib/jwt.js';
import { z } from 'zod';
import { parseValidatedBody } from '../lib/validate.js';
import { prepareSystemNoteInsert } from '../lib/hash.js';
```

Then, remove `base_currency` from `familyUpdateSchema` — change:

```ts
const familyUpdateSchema = z.object({
  base_currency:  z.enum(['GBP', 'PLN', 'USD'], { message: 'Invalid base_currency' }).optional(),
  parenting_mode: z.enum(['single', 'co-parenting'], { message: 'Invalid parenting_mode' }).optional(),
```

to:

```ts
const familyUpdateSchema = z.object({
  // base_currency is deliberately NOT editable here — it must go through
  // POST /api/family/relocate, which is lead-gated and writes a ledger
  // audit note. See docs/superpowers/specs/2026-09-12-relocation-audit-design.md.
  parenting_mode: z.enum(['single', 'co-parenting'], { message: 'Invalid parenting_mode' }).optional(),
```

And remove its handling block inside `handleFamilyUpdate`:

```ts
  if ('base_currency' in parsed) {
    updates.push('base_currency = ?'); values.push(parsed.base_currency);
  }
```

Then add the new handler after `handleFamilyUpdate` (after its closing `}`, before the `GET /api/children` section comment):

```ts
// ----------------------------------------------------------------
// POST /api/family/relocate
// Body: { new_currency: 'GBP' | 'USD' | 'PLN', note?: string }
// Lead-only. Writes a system_note ledger entry marking the currency
// switch, then updates families.currency/base_currency going forward.
// Past ledger rows, chores, and goals keep whatever currency they were
// created with — see docs/superpowers/specs/2026-09-12-relocation-audit-design.md.
// ----------------------------------------------------------------
const relocateSchema = z.object({
  new_currency: z.enum(['GBP', 'USD', 'PLN'], { message: 'new_currency must be GBP, USD, or PLN' }),
  note: z.string().max(200, 'note must be 200 characters or fewer').optional(),
});

export async function handleFamilyRelocate(request: Request, env: Env): Promise<Response> {
  const auth = (request as AuthedRequest).auth;
  if (auth.role !== 'parent') return error('Only parents can relocate the family', 403);

  const callerRole = await env.DB
    .prepare(`SELECT parent_role FROM family_roles WHERE user_id = ? AND family_id = ? AND role = 'parent'`)
    .bind(auth.sub, auth.family_id)
    .first<{ parent_role: string | null }>();
  if (!callerRole || callerRole.parent_role !== 'lead') {
    return error('Only the family lead can run a Relocation Audit', 403);
  }

  const parsed = await parseValidatedBody(request, relocateSchema);
  if (parsed instanceof Response) return parsed;

  const family = await env.DB
    .prepare('SELECT base_currency FROM families WHERE id = ?')
    .bind(auth.family_id)
    .first<{ base_currency: string }>();
  if (!family) return error('Family not found', 404);

  const oldCurrency = family.base_currency;
  const newCurrency = parsed.new_currency;
  if (newCurrency === oldCurrency) {
    return error(`Family is already using ${newCurrency}`, 400);
  }

  const ip = clientIp(request);
  const description = `🧭 Relocation Audit: currency changed from ${oldCurrency} to ${newCurrency}.`
    + (parsed.note ? ` Note: ${parsed.note}` : '');

  const { statement: noteStatement } = await prepareSystemNoteInsert(
    env.DB, auth.family_id, newCurrency, description, ip, auth.sub,
  );

  await env.DB.batch([
    noteStatement,
    env.DB.prepare('UPDATE families SET currency = ?, base_currency = ? WHERE id = ?')
      .bind(newCurrency, newCurrency, auth.family_id),
  ]);

  await env.CACHE.delete(`family:config:${auth.family_id}`);

  return json({ ok: true, new_currency: newCurrency });
}
```

- [ ] **Step 4: Register the route**

In `worker/src/index.ts`, change the import block (around line 104) from:

```ts
  handleFamilyGet, handleFamilyUpdate,
```

to:

```ts
  handleFamilyGet, handleFamilyUpdate, handleFamilyRelocate,
```

Then add a new route line right after line 888 (`if (path === '/api/family' && method === 'PATCH') return withAuth(...)`):

```ts
  if (path === '/api/family/relocate' && method === 'POST') return withAuth(request, auth, env, ctx, handleFamilyRelocate);
```

- [ ] **Step 5: Run the tests to confirm they pass**

Run: `cd worker && npx vitest run src/routes/family-relocate.test.ts`
Expected: all 4 tests PASS.

- [ ] **Step 6: Run the full worker test suite + typecheck**

Run: `cd worker && npx vitest run && npm run typecheck`
Expected: no failures, no new type errors. In particular, confirm no other code references `base_currency` via `PATCH /api/family` (checked during brainstorming — only `Stage2FamilyConstitution.tsx` → `RegistrationShell.tsx` send it, and that's the one-time registration call, not this endpoint).

- [ ] **Step 7: Commit**

```bash
git add worker/src/routes/settings.ts worker/src/routes/family-relocate.test.ts worker/src/index.ts
git commit -m "$(cat <<'EOF'
feat(family): add lead-only POST /api/family/relocate (Relocation Audit)

Builds the feature promised in onboarding copy since 2026-04 but never
implemented. Lead parent picks a new currency; the family's
currency/base_currency change going forward and a permanent, hashed
system_note ledger row records the switch. Past ledger rows, chores,
and goals keep their original currency.

Also removes base_currency from the generic PATCH /api/family schema —
it let any parent (not lead-gated) change currency with zero audit
trail; no frontend caller used it outside one-time registration, so
this closes the gap without breaking anything.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Frontend — Settings > Family row, confirm screen, and wiring

**Files:**
- Modify: `app/src/lib/api.ts` (add `relocateFamily`)
- Modify: `app/src/components/settings/sections/FamilySettings.tsx` (new row + sheet)
- Modify: `app/src/components/dashboard/ParentSettingsTab.tsx` (wiring)
- Test: `app/src/components/settings/sections/__tests__/FamilySettings.relocate.test.tsx` (new file)

**Interfaces:**
- Consumes: none new beyond the existing `request()` helper in `api.ts` and existing `FamilySettings` prop-drilling pattern.
- Produces: `relocateFamily(newCurrency: 'GBP' | 'USD' | 'PLN', note?: string): Promise<{ ok: boolean; new_currency: string }>` exported from `api.ts`. `FamilySettings` gains two new required props: `currentCurrency: string` and `onRelocate: (newCurrency: 'GBP' | 'USD' | 'PLN', note?: string) => Promise<void>`.

- [ ] **Step 1: Add the API function**

In `app/src/lib/api.ts`, after `updateFamily` (around line 420), add:

```ts
export async function relocateFamily(
  newCurrency: 'GBP' | 'USD' | 'PLN', note?: string,
): Promise<{ ok: boolean; new_currency: string }> {
  return request('/api/family/relocate', {
    method: 'POST',
    body: JSON.stringify({ new_currency: newCurrency, note }),
  });
}
```

- [ ] **Step 2: Write the failing component test**

Create `app/src/components/settings/sections/__tests__/FamilySettings.relocate.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import type { ComponentProps } from 'react'
import { FamilySettings } from '../FamilySettings'

function renderFamilySettings(overrides: Partial<ComponentProps<typeof FamilySettings>> = {}) {
  const props: ComponentProps<typeof FamilySettings> = {
    children: [], appViews: {}, appViewBusy: null, growthSettings: {}, growthBusy: null,
    familyId: 'fam_1', userId: 'parent_1', isLead: true, hasCoParent: false,
    sharedExpenseThreshold: 0, sharedExpenseSplitBp: 5000, savingSharedExpense: false,
    toast: null, onBack: () => {}, onComingSoon: () => {},
    onAddChild: async () => ({ child_id: 'c1', invite_code: '123456' }),
    onAppViewToggle: () => {}, onGrowthUpdate: () => {}, onRenameChild: () => {},
    onPinResetSuccess: () => {}, onGenerateInvite: async () => ({ code: '123456', expires_at: 0 }),
    onSharedExpenseThresholdChange: () => {}, onSharedExpenseSplitChange: () => {},
    onSaveSharedExpense: async () => {},
    pocketMoneyDay: 6, onSavePocketMoneyDay: async () => {},
    overdraftEnabled: false, overdraftLimitPence: 0, onSaveOverdraftPolicy: async () => {},
    onCoParentRemoved: async () => {},
    currentCurrency: 'GBP', onRelocate: vi.fn(async () => {}),
    ...overrides,
  }
  return render(<FamilySettings {...props} />)
}

describe('FamilySettings — Relocation Audit', () => {
  it('shows the Relocation Audit row with the current currency, enabled for the lead', () => {
    renderFamilySettings({ isLead: true, currentCurrency: 'GBP' })
    expect(screen.getByText('Relocation Audit')).toBeTruthy()
    expect(screen.getByText(/Currently GBP/)).toBeTruthy()
  })

  it('disables the row for a non-lead co-parent', () => {
    renderFamilySettings({ isLead: false })
    const row = screen.getByText('Relocation Audit').closest('button')
    expect(row).toHaveProperty('disabled', true)
  })

  it('calls onRelocate with the selected currency and note, then closes the sheet', async () => {
    const onRelocate = vi.fn(async () => {})
    renderFamilySettings({ isLead: true, currentCurrency: 'GBP', onRelocate })

    fireEvent.click(screen.getByText('Relocation Audit'))
    fireEvent.click(screen.getByText(/\$ USD/))
    fireEvent.change(screen.getByPlaceholderText('e.g. Moved to the US'), { target: { value: 'Moved to Austin' } })
    fireEvent.click(screen.getByText('Switch to USD'))

    await waitFor(() => expect(onRelocate).toHaveBeenCalledWith('USD', 'Moved to Austin'))
    await waitFor(() => expect(screen.queryByText('Switch to USD')).toBeNull())
  })

  it('shows the server error message when onRelocate rejects', async () => {
    const onRelocate = vi.fn(async () => { throw new Error('Family is already using USD') })
    renderFamilySettings({ isLead: true, currentCurrency: 'GBP', onRelocate })

    fireEvent.click(screen.getByText('Relocation Audit'))
    fireEvent.click(screen.getByText(/\$ USD/))
    fireEvent.click(screen.getByText('Switch to USD'))

    await waitFor(() => expect(screen.getByText('Family is already using USD')).toBeTruthy())
  })
})
```

- [ ] **Step 3: Run the test to confirm it fails**

Run: `cd app && npx vitest run src/components/settings/sections/__tests__/FamilySettings.relocate.test.tsx`
Expected: FAIL — `currentCurrency`/`onRelocate` props don't exist yet, "Relocation Audit" text not found.

- [ ] **Step 4: Add the props and state**

In `app/src/components/settings/sections/FamilySettings.tsx`, change the icon import (line 12) from:

```ts
import { Users, Shield, Calendar, ChevronRight, AlertTriangle } from 'lucide-react'
```

to:

```ts
import { Users, Shield, Calendar, ChevronRight, AlertTriangle, Globe } from 'lucide-react'
```

Add this import after the `useTone` import (line 19):

```ts
import { currencySymbol } from '../../../lib/locale'
```

In the `Props` interface, after `onCoParentRemoved: () => Promise<void>` (line 54), add:

```ts
  currentCurrency:  string
  onRelocate:       (newCurrency: 'GBP' | 'USD' | 'PLN', note?: string) => Promise<void>
```

In the component's destructured parameters, after `onCoParentRemoved,` (line 68), add:

```ts
  currentCurrency, onRelocate,
```

After the `removeCoParentError` state declaration (line 99), add:

```ts
  const [showRelocationAudit, setShowRelocationAudit] = useState(false)
  const [selectedCurrency,    setSelectedCurrency]    = useState<'GBP' | 'USD' | 'PLN'>('GBP')
  const [relocationNote,      setRelocationNote]      = useState('')
  const [relocating,          setRelocating]          = useState(false)
  const [relocationError,     setRelocationError]     = useState<string | null>(null)
```

- [ ] **Step 5: Add the confirm handler and sheet**

After `handleConfirmRemoveCoParent`'s closing `}` (line 170), add:

```ts
  async function handleConfirmRelocate() {
    setRelocating(true)
    setRelocationError(null)
    try {
      await onRelocate(selectedCurrency, relocationNote.trim() || undefined)
      setShowRelocationAudit(false)
    } catch (err) {
      setRelocationError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setRelocating(false)
    }
  }
```

After the `showOverdraftPolicy` block's closing `}` (line 286), add the new sheet block (before `if (showSharedExpenses) {`):

```ts

  if (showRelocationAudit) {
    const currencies: Array<'GBP' | 'USD' | 'PLN'> = ['GBP', 'USD', 'PLN']
    return (
      <div className="space-y-4">
        {toast && <Toast message={toast} />}
        <SectionHeader title="Relocation Audit" onBack={() => setShowRelocationAudit(false)} />

        <SectionCard>
          <div className="px-4 py-3.5">
            <p className="text-[0.8125rem] font-semibold text-[var(--color-text)] mb-0.5">New currency</p>
            <p className="text-[0.75rem] text-[var(--color-text-muted)] mb-3 leading-snug">
              New chores and goals will use this currency. Past entries stay recorded in their original currency — this is permanent and added to your ledger.
            </p>
            <div className="flex gap-1.5 mb-3">
              {currencies.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setSelectedCurrency(c)}
                  disabled={c === currentCurrency}
                  className={`flex-1 py-2 rounded-lg text-[0.75rem] font-semibold border cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    selectedCurrency === c
                      ? 'bg-[var(--brand-primary)] text-white border-[var(--brand-primary)]'
                      : 'bg-[var(--color-surface)] text-[var(--color-text-muted)] border-[var(--color-border)] hover:bg-[var(--color-surface-alt)]'
                  }`}
                >
                  {currencySymbol(c)} {c}{c === currentCurrency ? ' (current)' : ''}
                </button>
              ))}
            </div>
            <label htmlFor="relocation-note" className="text-[0.8125rem] font-semibold text-[var(--color-text)] block mb-1">Note (optional)</label>
            <textarea
              id="relocation-note"
              value={relocationNote}
              onChange={e => setRelocationNote(e.target.value.slice(0, 200))}
              placeholder="e.g. Moved to the US"
              rows={2}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[0.8125rem] text-[var(--color-text)] p-2.5 resize-none"
            />
          </div>
        </SectionCard>

        {relocationError && (
          <p className="text-[0.8125rem] text-red-600 font-semibold px-1">{relocationError}</p>
        )}

        <button
          onClick={handleConfirmRelocate}
          disabled={relocating || selectedCurrency === currentCurrency}
          className="w-full bg-[var(--brand-primary)] text-white font-semibold text-[0.875rem] py-3 rounded-xl disabled:opacity-50 cursor-pointer"
        >
          {relocating ? 'Recording…' : `Switch to ${selectedCurrency}`}
        </button>
      </div>
    )
  }
```

Finally, add the row itself in the lead-gated `SectionCard` (line 562-565), after the Overdraft Policy row:

```tsx
          <SettingsRow icon={<Globe size={15} />} label="Relocation Audit" description={`Currently ${currentCurrency} — mark a move to a new currency`} onClick={() => { setSelectedCurrency(currentCurrency as 'GBP' | 'USD' | 'PLN'); setRelocationNote(''); setRelocationError(null); setShowRelocationAudit(true) }} disabled={!isLead} disabledReason="Only the family lead can change this" />
```

- [ ] **Step 6: Run the component test to confirm it passes**

Run: `cd app && npx vitest run src/components/settings/sections/__tests__/FamilySettings.relocate.test.tsx`
Expected: all 4 tests PASS.

- [ ] **Step 7: Wire up `ParentSettingsTab.tsx`**

In `app/src/components/dashboard/ParentSettingsTab.tsx`, change the `api.ts` import block (line 76) from:

```ts
  getFamily, updateFamily, getSettings, updateSettings,
```

to:

```ts
  getFamily, updateFamily, relocateFamily, getSettings, updateSettings,
```

After `handleSaveOverdraftPolicy` (after its closing `}`, around line 375), add:

```ts
  async function handleRelocate(newCurrency: 'GBP' | 'USD' | 'PLN', note?: string) {
    await relocateFamily(newCurrency, note)
    const updated = await getFamily()
    setFamily(updated)
    showToast('Relocation Audit recorded')
  }
```

In the `<FamilySettings .../>` JSX (around line 389-395), add to the prop list (after `onCoParentRemoved={handleCoParentRemoved}`):

```tsx
currentCurrency={(family?.base_currency as string) ?? 'GBP'}
onRelocate={handleRelocate}
```

- [ ] **Step 8: Typecheck and run the full app test suite**

Run: `cd app && npx tsc --noEmit && npx vitest run`
Expected: no type errors, no test failures.

- [ ] **Step 9: Commit**

```bash
git add app/src/lib/api.ts app/src/components/settings/sections/FamilySettings.tsx app/src/components/dashboard/ParentSettingsTab.tsx app/src/components/settings/sections/__tests__/FamilySettings.relocate.test.tsx
git commit -m "$(cat <<'EOF'
feat(settings): add Relocation Audit row to Settings > Family

Lead-only row opens a confirm screen to pick a new base currency
(optionally with a note), calling POST /api/family/relocate. Honours
the onboarding promise at Stage2FamilyConstitution.tsx:158, which has
pointed at a nonexistent feature since 2026-04.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Manual verification against `morechard-dev`

**Files:** none — verification only, no code changes.

**Interfaces:** none.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev` (from the repo root — starts the worker against remote `morechard-dev` + the Vite app).

- [ ] **Step 2: Exercise the feature end-to-end**

As a lead parent on a test family in `morechard-dev`: open Settings > Family, confirm the "Relocation Audit" row shows the current currency and is enabled; tap it, pick a different currency, add a note, confirm. Expect a success toast and the row to reflect the new currency afterward.

As a co-parent (non-lead) on the same family: confirm the row is visibly disabled with the "Only the family lead can change this" tooltip/reason.

- [ ] **Step 3: Verify the ledger row directly**

Run:
```bash
cd worker && npx wrangler d1 execute morechard-dev --remote --command="SELECT id, family_id, entry_type, amount, currency, description, previous_hash, record_hash FROM ledger WHERE entry_type='system_note' ORDER BY id DESC LIMIT 5"
```
Expected: the new row appears with `entry_type='system_note'`, `amount=0`, `currency` equal to the new currency, and a non-null `record_hash`/`previous_hash`.

- [ ] **Step 4: Verify the chain still verifies**

Use the chain-head `record_hash` from Step 3 and call the public verify endpoint:
```bash
curl https://<dev-worker-url>/api/verify/<record_hash>
```
Expected: `{"valid": true, ...}`.

- [ ] **Step 5: Check production for the NULL-child_id hashing incident**

This sandboxed environment cannot reach the production Cloudflare account (confirmed during planning — `wrangler d1 execute morechard --remote --env production` returns "account is not valid or is not authorized"). From a machine with real production access, run:
```bash
cd worker && npx wrangler d1 execute morechard --remote --env production --command="SELECT id, family_id, child_id, entry_type, record_hash FROM ledger WHERE entry_type='system_note' AND child_id IS NULL ORDER BY id"
```
If this returns any rows, cross-check each family's chain via `GET /api/verify/<that family's chain-head record_hash>` (or the forensic PDF export) to see whether any pre-existing `system_note` row already broke that family's chain before this fix landed. Report findings — this plan's fixes prevent *new* breakage but cannot retroactively repair an already-mismatched historical hash (the ledger is append-only by design).

- [ ] **Step 6: No commit** — this task is verification only.
