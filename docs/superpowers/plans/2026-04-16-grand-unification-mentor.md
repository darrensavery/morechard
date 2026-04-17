# Grand Unification — AI Mentor Brain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unlock the US market via schema migration, build a per-child intelligence aggregator, and refactor `chat.ts` into a tri-locale (UK/PL/US) AI Mentor with real data injection and structured Truth Engine output.

**Architecture:** A new migration adds `USD`/`en-US` support. A new `worker/src/lib/intelligence.ts` module runs a single aggregator query to build a rich child context snapshot (balance, goals, reliability rating, velocity, planning horizon, spending behaviour). `chat.ts` consumes that snapshot to build a locale-aware system prompt and returns a structured JSON response with `reply`, `pillar`, and `data_points`.

**Tech Stack:** Cloudflare D1 (SQL), Cloudflare Workers AI (`@cf/meta/llama-3-8b-instruct`), TypeScript, Wrangler for migration apply.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| **Create** | `worker/migrations/0027_global_foundations.sql` | Add USD to all currency CHECK constraints; add `en-US` to `users.locale` |
| **Modify** | `worker/src/types.ts` | Add `USD` to `Currency`, `en-US` to `Locale`, new `ChildIntelligence` interface, `MentorResponse` interface |
| **Create** | `worker/src/lib/intelligence.ts` | `getChildIntelligence(db, childId)` — all aggregation logic lives here |
| **Modify** | `worker/src/routes/chat.ts` | Replace static system prompts with locale-aware prompt builder consuming `ChildIntelligence` |

---

## Task 1: Migration — Global Foundations

**Files:**
- Create: `worker/migrations/0027_global_foundations.sql`

D1 doesn't support `ALTER COLUMN` to change CHECK constraints. The correct pattern is: rename old table, recreate with new constraints, copy data, drop old. However, tables with immutable triggers (ledger) need care — we must preserve the triggers. For all other tables (`chores`, `goals`, `spending`), a standard recreate works. For `ledger`, we add a new column approach isn't possible either — so we recreate using the same pattern but preserve the hash chain triggers.

The safest D1-compatible approach for CHECK constraint expansion on tables with existing data: drop the CHECK via recreate. SQLite (which D1 runs) allows `INSERT INTO new SELECT * FROM old` without CHECK violations on existing data because existing rows aren't re-validated during copy.

- [ ] **Step 1.1: Write the migration file**

```sql
-- Migration 0027: Global Foundations — USD currency + en-US locale
-- Expands CHECK constraints on currency columns to include 'USD'.
-- Expands users.locale to include 'en-US'.
-- SQLite does not support ALTER COLUMN; we recreate affected tables.

-- ─────────────────────────────────────────────────────────────────
-- 1. users.locale  (en → en | en-US | pl)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE users_new (
  id                   TEXT PRIMARY KEY,
  family_id            TEXT REFERENCES families(id),
  display_name         TEXT NOT NULL,
  email                TEXT UNIQUE,
  locale               TEXT NOT NULL DEFAULT 'en'
                         CHECK (locale IN ('en', 'en-US', 'pl')),
  created_at           INTEGER NOT NULL DEFAULT (unixepoch()),
  password_hash        TEXT,
  pin_hash             TEXT,
  email_verified       INTEGER NOT NULL DEFAULT 0,
  allowance_amount     INTEGER NOT NULL DEFAULT 0,
  allowance_day        INTEGER NOT NULL DEFAULT 6 CHECK (allowance_day BETWEEN 0 AND 6),
  earnings_mode        TEXT NOT NULL DEFAULT 'HYBRID'
                         CHECK (earnings_mode IN ('ALLOWANCE','CHORES','HYBRID')),
  allowance_frequency  TEXT NOT NULL DEFAULT 'WEEKLY'
                         CHECK (allowance_frequency IN ('WEEKLY','BI_WEEKLY','MONTHLY')),
  parent_pin_hash      TEXT,
  pin_attempt_count    INTEGER NOT NULL DEFAULT 0,
  pin_locked_until     INTEGER,
  google_sub           TEXT,
  google_picture       TEXT,
  email_pending        TEXT
);
INSERT INTO users_new SELECT * FROM users;
DROP TABLE users;
ALTER TABLE users_new RENAME TO users;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_sub ON users(google_sub) WHERE google_sub IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────
-- 2. chores.currency  (GBP|PLN → GBP|PLN|USD)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE chores_new (
  id              TEXT PRIMARY KEY,
  family_id       TEXT NOT NULL REFERENCES families(id),
  assigned_to     TEXT NOT NULL REFERENCES users(id),
  created_by      TEXT NOT NULL REFERENCES users(id),
  title           TEXT NOT NULL,
  description     TEXT,
  reward_amount   INTEGER NOT NULL CHECK (reward_amount > 0),
  currency        TEXT NOT NULL DEFAULT 'GBP'
                    CHECK (currency IN ('GBP','PLN','USD')),
  frequency       TEXT NOT NULL DEFAULT 'weekly'
                    CHECK (frequency IN ('daily','weekly','bi_weekly','monthly','quarterly','as_needed','school_days')),
  due_date        TEXT,
  is_priority     INTEGER NOT NULL DEFAULT 0,
  is_flash        INTEGER NOT NULL DEFAULT 0,
  flash_deadline  TEXT,
  archived        INTEGER NOT NULL DEFAULT 0,
  proof_required  INTEGER NOT NULL DEFAULT 0,
  auto_approve    INTEGER NOT NULL DEFAULT 0,
  created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at      INTEGER NOT NULL DEFAULT (unixepoch())
);
INSERT INTO chores_new SELECT * FROM chores;
DROP TABLE chores;
ALTER TABLE chores_new RENAME TO chores;

-- ─────────────────────────────────────────────────────────────────
-- 3. goals.currency  (GBP|PLN → GBP|PLN|USD)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE goals_new (
  id                       TEXT PRIMARY KEY,
  family_id                TEXT NOT NULL REFERENCES families(id),
  child_id                 TEXT NOT NULL REFERENCES users(id),
  title                    TEXT NOT NULL,
  target_amount            INTEGER NOT NULL CHECK (target_amount > 0),
  currency                 TEXT NOT NULL DEFAULT 'GBP'
                             CHECK (currency IN ('GBP','PLN','USD')),
  category                 TEXT NOT NULL DEFAULT 'other',
  deadline                 TEXT,
  alloc_pct                INTEGER NOT NULL DEFAULT 0 CHECK (alloc_pct BETWEEN 0 AND 100),
  match_rate               INTEGER NOT NULL DEFAULT 0 CHECK (match_rate IN (0,10,25,50,100)),
  sort_order               INTEGER NOT NULL DEFAULT 0,
  archived                 INTEGER NOT NULL DEFAULT 0,
  status                   TEXT NOT NULL DEFAULT 'ACTIVE'
                             CHECK (status IN ('ACTIVE','REACHED','ARCHIVED')),
  current_saved_pence      INTEGER NOT NULL DEFAULT 0,
  product_url              TEXT,
  parent_match_pct         INTEGER NOT NULL DEFAULT 0 CHECK (parent_match_pct BETWEEN 0 AND 100),
  parent_fixed_contribution INTEGER NOT NULL DEFAULT 0,
  created_at               INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at               INTEGER NOT NULL DEFAULT (unixepoch())
);
INSERT INTO goals_new SELECT * FROM goals;
DROP TABLE goals;
ALTER TABLE goals_new RENAME TO goals;

-- ─────────────────────────────────────────────────────────────────
-- 4. spending.currency  (GBP|PLN → GBP|PLN|USD)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE spending_new (
  id         TEXT PRIMARY KEY,
  family_id  TEXT NOT NULL REFERENCES families(id),
  child_id   TEXT NOT NULL REFERENCES users(id),
  title      TEXT NOT NULL,
  amount     INTEGER NOT NULL CHECK (amount > 0),
  currency   TEXT NOT NULL DEFAULT 'GBP'
               CHECK (currency IN ('GBP','PLN','USD')),
  note       TEXT,
  goal_id    TEXT REFERENCES goals(id),
  spent_at   INTEGER NOT NULL DEFAULT (unixepoch())
);
INSERT INTO spending_new SELECT * FROM spending;
DROP TABLE spending;
ALTER TABLE spending_new RENAME TO spending;

-- ─────────────────────────────────────────────────────────────────
-- 5. ledger.currency  (GBP|PLN → GBP|PLN|USD)
-- The ledger has immutable-field triggers. We recreate the table
-- and reattach the triggers.
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE ledger_new (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id           TEXT NOT NULL REFERENCES families(id),
  child_id            TEXT REFERENCES users(id),
  chore_id            TEXT REFERENCES chores(id),
  entry_type          TEXT NOT NULL
                        CHECK (entry_type IN ('credit','reversal','payment','system_note')),
  amount              INTEGER NOT NULL DEFAULT 0 CHECK (amount >= 0),
  currency            TEXT NOT NULL DEFAULT 'GBP'
                        CHECK (currency IN ('GBP','PLN','USD')),
  description         TEXT NOT NULL DEFAULT '',
  receipt_id          TEXT,
  category            TEXT,
  verification_status TEXT NOT NULL DEFAULT 'pending'
                        CHECK (verification_status IN
                          ('pending','verified_auto','verified_manual','disputed','reversed')),
  authorised_by       TEXT REFERENCES users(id),
  verified_at         INTEGER,
  verified_by         TEXT REFERENCES users(id),
  dispute_code        TEXT,
  dispute_before      INTEGER,
  previous_hash       TEXT NOT NULL DEFAULT '0000000000000000',
  record_hash         TEXT NOT NULL DEFAULT '',
  ip_address          TEXT NOT NULL DEFAULT '',
  created_at          INTEGER NOT NULL DEFAULT (unixepoch())
);
INSERT INTO ledger_new SELECT * FROM ledger;
DROP TABLE ledger;
ALTER TABLE ledger_new RENAME TO ledger;

-- Recreate immutable-field trigger on new ledger table
CREATE TRIGGER IF NOT EXISTS ledger_immutable_fields
BEFORE UPDATE ON ledger
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'ledger: amount is immutable')
    WHERE NEW.amount     != OLD.amount;
  SELECT RAISE(ABORT, 'ledger: currency is immutable')
    WHERE NEW.currency   != OLD.currency;
  SELECT RAISE(ABORT, 'ledger: entry_type is immutable')
    WHERE NEW.entry_type != OLD.entry_type;
  SELECT RAISE(ABORT, 'ledger: record_hash is immutable')
    WHERE NEW.record_hash    != OLD.record_hash;
  SELECT RAISE(ABORT, 'ledger: previous_hash is immutable')
    WHERE NEW.previous_hash  != OLD.previous_hash;
  SELECT RAISE(ABORT, 'ledger: ip_address is immutable')
    WHERE NEW.ip_address     != OLD.ip_address;
  SELECT RAISE(ABORT, 'ledger: created_at is immutable')
    WHERE NEW.created_at     != OLD.created_at;
END;

-- ─────────────────────────────────────────────────────────────────
-- 6. families.base_currency / currency  (GBP|PLN → GBP|PLN|USD)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE families_new (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'GBP'
                    CHECK (currency IN ('GBP','PLN','USD')),
  verify_mode     TEXT NOT NULL DEFAULT 'standard'
                    CHECK (verify_mode IN ('amicable','standard')),
  created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  base_currency   TEXT NOT NULL DEFAULT 'GBP'
                    CHECK (base_currency IN ('GBP','PLN','USD')),
  parenting_mode  TEXT NOT NULL DEFAULT 'single'
                    CHECK (parenting_mode IN ('single','co-parenting')),
  deleted_at      INTEGER
);
INSERT INTO families_new SELECT * FROM families;
DROP TABLE families;
ALTER TABLE families_new RENAME TO families;
```

- [ ] **Step 1.2: Apply the migration locally via Wrangler**

```bash
cd "e:/Web-Video Design/Claude/Apps/Pocket Money"
npx wrangler d1 migrations apply morechard-db --local
```

Expected output: `✅  Applied migration 0027_global_foundations.sql`

- [ ] **Step 1.3: Smoke-test the new constraints**

```bash
npx wrangler d1 execute morechard-db --local --command \
  "INSERT INTO chores (id,family_id,assigned_to,created_by,title,reward_amount,currency) VALUES ('test-usd','fam1','child1','parent1','Test',100,'USD'); SELECT currency FROM chores WHERE id='test-usd'; DELETE FROM chores WHERE id='test-usd';"
```

Expected: `USD` returned then deleted cleanly.

```bash
npx wrangler d1 execute morechard-db --local --command \
  "UPDATE users SET locale='en-US' WHERE id=(SELECT id FROM users LIMIT 1); SELECT locale FROM users LIMIT 1;"
```

Expected: `en-US` returned.

- [ ] **Step 1.4: Commit**

```bash
git add worker/migrations/0027_global_foundations.sql
git commit -m "feat(db): migration 0027 — add USD currency + en-US locale (global foundations)"
```

---

## Task 2: Update `types.ts`

**Files:**
- Modify: `worker/src/types.ts`

- [ ] **Step 2.1: Expand `Currency` and add `Locale`, `ChildIntelligence`, `MentorResponse`**

Replace the existing `Currency` type line and add new types after the existing type block. Find this block near the top of `types.ts`:

```typescript
export type Currency = 'GBP' | 'PLN';
```

Replace with:

```typescript
export type Currency = 'GBP' | 'PLN' | 'USD';
export type Locale = 'en' | 'en-US' | 'pl';
```

Then add at the end of `types.ts`, before the closing:

```typescript
// ─────────────────────────────────────────────────────────────
// AI Mentor — Intelligence snapshot & response shapes
// ─────────────────────────────────────────────────────────────

export type FinancialPillar =
  | 'LABOR_VALUE'
  | 'DELAYED_GRATIFICATION'
  | 'OPPORTUNITY_COST'
  | 'CAPITAL_MANAGEMENT'
  | 'SOCIAL_RESPONSIBILITY';

/** Per-child intelligence snapshot built by getChildIntelligence(). */
export interface ChildIntelligence {
  // Identity
  child_id: string;
  display_name: string;
  locale: Locale;
  currency: Currency;
  app_view: 'ORCHARD' | 'CLEAN';
  earnings_mode: 'ALLOWANCE' | 'CHORES' | 'HYBRID';

  // Balance (smallest unit: pence/cents/grosze)
  balance_minor: number;

  // Goals (top 3 active, sorted by progress desc)
  goals: Array<{
    title: string;
    target_minor: number;
    saved_minor: number;
    progress_pct: number;          // 0–100
    deadline: string | null;
    parent_match_pct: number;
  }>;

  // Chores
  assigned_chore_count: number;
  completed_7d: number;           // completions in last 7 days
  needs_revision_7d: number;      // sent back in last 7 days

  // Reliability Rating (0–100, US "credit score" proxy)
  // = (first_time_pass / total_completed) * 100 − quality_penalty
  reliability_rating: number;

  // Velocity (minor units earned per day, trailing 7 days)
  velocity_7d: number;

  // Planning horizon (days ahead furthest planned chore)
  planning_horizon_days: number;

  // Sunday Scrambler flag
  // true when >60% of last 14 completions landed on the same weekday
  is_sunday_scrambler: boolean;
  scrambler_day: string | null;   // e.g. "Sunday"

  // Spending (last 7 days)
  spent_minor_7d: number;
  spend_to_balance_pct: number;   // spent_7d / balance * 100

  // Cached snapshot from insight_snapshots (may be null first week)
  consistency_score: number | null;
  responsibility_score: number | null;
  last_snapshot_date: string | null;

  // Parent engagement
  bonus_pence_7d: number;
  has_parent_message: boolean;
  parent_message: string | null;
}

/** Structured response returned by the chat endpoint. */
export interface MentorResponse {
  reply: string;
  pillar: FinancialPillar;
  data_points: Record<string, string | number | boolean>;
  app_view: 'ORCHARD' | 'CLEAN';
  locale: Locale;
}
```

- [ ] **Step 2.2: Verify TypeScript compiles (no errors introduced)**

```bash
cd "e:/Web-Video Design/Claude/Apps/Pocket Money/worker"
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 2.3: Commit**

```bash
git add worker/src/types.ts
git commit -m "feat(types): add USD/en-US, ChildIntelligence snapshot, MentorResponse shapes"
```

---

## Task 3: Build the Omni-Orchard Aggregator (`intelligence.ts`)

**Files:**
- Create: `worker/src/lib/intelligence.ts`

This module runs a series of focused D1 queries (not one mega-join — D1 performs better with small targeted queries than large aggregating joins) and assembles a `ChildIntelligence` object.

- [ ] **Step 3.1: Create the file**

```typescript
// worker/src/lib/intelligence.ts
// Omni-Orchard Aggregator — builds a per-child intelligence snapshot
// for the AI Mentor at chat time. All queries are read-only.

import type { D1Database } from '@cloudflare/workers-types'
import type { ChildIntelligence, Currency, Locale } from '../types.js'

const DAY_SECONDS = 86_400
const WEEK_SECONDS = 7 * DAY_SECONDS
const FORTNIGHT_SECONDS = 14 * DAY_SECONDS
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

// ─────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────

export async function getChildIntelligence(
  db: D1Database,
  childId: string,
): Promise<ChildIntelligence | null> {
  const now = Math.floor(Date.now() / 1000)
  const week_ago = now - WEEK_SECONDS
  const fortnight_ago = now - FORTNIGHT_SECONDS

  // Run all queries in parallel for speed
  const [
    identity,
    balance,
    goals,
    choreStats,
    completionDays,
    velocity,
    spending,
    snapshot,
    bonus,
    parentMsg,
  ] = await Promise.all([
    queryIdentity(db, childId),
    queryBalance(db, childId),
    queryGoals(db, childId),
    queryChoreStats(db, childId, week_ago),
    queryCompletionDays(db, childId, fortnight_ago),
    queryVelocity(db, childId, week_ago),
    querySpending(db, childId, week_ago),
    querySnapshot(db, childId),
    queryBonus(db, childId, week_ago),
    queryParentMessage(db, childId, now),
  ])

  if (!identity) return null

  // ── Reliability Rating ──────────────────────────────────────────
  // Base: first-time-pass rate over completed chores (all time)
  // Quality penalty: −5 points per needs_revision in last 7 days (max −25)
  const firstTimePassRate = choreStats.total_completed > 0
    ? (choreStats.first_time_pass / choreStats.total_completed) * 100
    : 0
  const qualityPenalty = Math.min(choreStats.needs_revision_7d * 5, 25)
  const reliability_rating = Math.max(0, Math.round(firstTimePassRate - qualityPenalty))

  // ── Velocity ────────────────────────────────────────────────────
  // Minor units earned over last 7 days ÷ 7
  const velocity_7d = Math.round(velocity.earned_7d / 7)

  // ── Sunday Scrambler detection ──────────────────────────────────
  const { is_scrambler, scrambler_day } = detectScrambler(completionDays)

  // ── Spend-to-balance ────────────────────────────────────────────
  const spend_to_balance_pct = balance > 0
    ? Math.round((spending.spent_minor_7d / balance) * 100)
    : 0

  // ── Goal enrichment ─────────────────────────────────────────────
  const enrichedGoals = goals.map(g => ({
    ...g,
    progress_pct: g.target_minor > 0
      ? Math.round((g.saved_minor / g.target_minor) * 100)
      : 0,
  }))

  return {
    child_id: childId,
    display_name: identity.display_name,
    locale: (identity.locale as Locale) ?? 'en',
    currency: (identity.currency as Currency) ?? 'GBP',
    app_view: (identity.app_view as 'ORCHARD' | 'CLEAN') ?? 'ORCHARD',
    earnings_mode: (identity.earnings_mode as 'ALLOWANCE' | 'CHORES' | 'HYBRID') ?? 'HYBRID',

    balance_minor: balance,

    goals: enrichedGoals,

    assigned_chore_count: choreStats.assigned_count,
    completed_7d: choreStats.completed_7d,
    needs_revision_7d: choreStats.needs_revision_7d,

    reliability_rating,
    velocity_7d,

    planning_horizon_days: await queryPlanningHorizon(db, childId, now),

    is_sunday_scrambler: is_scrambler,
    scrambler_day: scrambler_day,

    spent_minor_7d: spending.spent_minor_7d,
    spend_to_balance_pct,

    consistency_score: snapshot?.consistency_score ?? null,
    responsibility_score: snapshot?.responsibility_score ?? null,
    last_snapshot_date: snapshot?.snapshot_date ?? null,

    bonus_pence_7d: bonus,
    has_parent_message: !!parentMsg,
    parent_message: parentMsg,
  }
}

// ─────────────────────────────────────────────────────────────────
// Individual query helpers
// ─────────────────────────────────────────────────────────────────

async function queryIdentity(db: D1Database, childId: string) {
  return db
    .prepare(`
      SELECT u.display_name, u.locale, u.earnings_mode,
             f.base_currency AS currency,
             us.app_view
      FROM   users u
      JOIN   families f ON f.id = u.family_id
      LEFT JOIN user_settings us ON us.user_id = u.id
      WHERE  u.id = ?
    `)
    .bind(childId)
    .first<{
      display_name: string
      locale: string
      earnings_mode: string
      currency: string
      app_view: string | null
    }>()
}

async function queryBalance(db: D1Database, childId: string): Promise<number> {
  const row = await db
    .prepare(`
      SELECT COALESCE(SUM(
        CASE entry_type
          WHEN 'credit'  THEN amount
          WHEN 'payment' THEN -amount
          ELSE 0
        END
      ), 0) AS balance
      FROM ledger
      WHERE child_id = ?
        AND verification_status IN ('verified_auto','verified_manual')
    `)
    .bind(childId)
    .first<{ balance: number }>()
  return row?.balance ?? 0
}

interface GoalRow {
  title: string
  target_minor: number
  saved_minor: number
  deadline: string | null
  parent_match_pct: number
}

async function queryGoals(db: D1Database, childId: string): Promise<GoalRow[]> {
  const result = await db
    .prepare(`
      SELECT title, target_amount AS target_minor,
             current_saved_pence AS saved_minor,
             deadline, parent_match_pct
      FROM   goals
      WHERE  child_id = ?
        AND  status = 'ACTIVE'
      ORDER BY current_saved_pence DESC
      LIMIT 3
    `)
    .bind(childId)
    .all<GoalRow>()
  return result.results ?? []
}

interface ChoreStats {
  assigned_count: number
  total_completed: number
  first_time_pass: number
  completed_7d: number
  needs_revision_7d: number
}

async function queryChoreStats(
  db: D1Database,
  childId: string,
  week_ago: number,
): Promise<ChoreStats> {
  const [assigned, completions] = await Promise.all([
    db
      .prepare(`SELECT COUNT(*) AS n FROM chores WHERE assigned_to = ? AND archived = 0`)
      .bind(childId)
      .first<{ n: number }>(),
    db
      .prepare(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'completed') AS total_completed,
          COUNT(*) FILTER (WHERE status = 'completed' AND attempt_count = 1) AS first_time_pass,
          COUNT(*) FILTER (WHERE status = 'completed' AND submitted_at >= ?) AS completed_7d,
          COUNT(*) FILTER (WHERE status = 'needs_revision' AND submitted_at >= ?) AS needs_revision_7d
        FROM completions
        WHERE child_id = ?
      `)
      .bind(week_ago, week_ago, childId)
      .first<{
        total_completed: number
        first_time_pass: number
        completed_7d: number
        needs_revision_7d: number
      }>(),
  ])
  return {
    assigned_count: assigned?.n ?? 0,
    total_completed: completions?.total_completed ?? 0,
    first_time_pass: completions?.first_time_pass ?? 0,
    completed_7d: completions?.completed_7d ?? 0,
    needs_revision_7d: completions?.needs_revision_7d ?? 0,
  }
}

// Returns ISO weekday number (0=Mon … 6=Sun) for each completed submission
// in the last fortnight — used for scrambler detection.
async function queryCompletionDays(
  db: D1Database,
  childId: string,
  fortnight_ago: number,
): Promise<number[]> {
  const result = await db
    .prepare(`
      SELECT CAST(strftime('%w', datetime(submitted_at, 'unixepoch')) AS INTEGER) AS dow
      FROM   completions
      WHERE  child_id = ?
        AND  status = 'completed'
        AND  submitted_at >= ?
    `)
    .bind(childId, fortnight_ago)
    .all<{ dow: number }>()
  // SQLite %w: 0=Sunday … 6=Saturday — remap to 0=Monday … 6=Sunday
  return (result.results ?? []).map(r => (r.dow + 6) % 7)
}

async function queryVelocity(
  db: D1Database,
  childId: string,
  week_ago: number,
): Promise<{ earned_7d: number }> {
  const row = await db
    .prepare(`
      SELECT COALESCE(SUM(amount), 0) AS earned_7d
      FROM   ledger
      WHERE  child_id = ?
        AND  entry_type = 'credit'
        AND  verification_status IN ('verified_auto','verified_manual')
        AND  created_at >= ?
    `)
    .bind(childId, week_ago)
    .first<{ earned_7d: number }>()
  return { earned_7d: row?.earned_7d ?? 0 }
}

async function querySpending(
  db: D1Database,
  childId: string,
  week_ago: number,
): Promise<{ spent_minor_7d: number }> {
  const row = await db
    .prepare(`
      SELECT COALESCE(SUM(amount), 0) AS spent_minor_7d
      FROM   spending
      WHERE  child_id = ?
        AND  spent_at >= ?
    `)
    .bind(childId, week_ago)
    .first<{ spent_minor_7d: number }>()
  return { spent_minor_7d: row?.spent_minor_7d ?? 0 }
}

async function queryPlanningHorizon(
  db: D1Database,
  childId: string,
  nowEpoch: number,
): Promise<number> {
  const row = await db
    .prepare(`
      SELECT MAX(
        CAST((julianday(week_start) + day_of_week - julianday(datetime(?, 'unixepoch'))) AS INTEGER)
      ) AS horizon_days
      FROM plans
      WHERE child_id = ?
        AND week_start >= date(datetime(?, 'unixepoch'))
    `)
    .bind(nowEpoch, childId, nowEpoch)
    .first<{ horizon_days: number | null }>()
  return row?.horizon_days ?? 0
}

interface SnapshotRow {
  consistency_score: number | null
  responsibility_score: number | null
  snapshot_date: string
}

async function querySnapshot(
  db: D1Database,
  childId: string,
): Promise<SnapshotRow | null> {
  return db
    .prepare(`
      SELECT consistency_score, responsibility_score, snapshot_date
      FROM   insight_snapshots
      WHERE  child_id = ?
      ORDER  BY snapshot_date DESC
      LIMIT  1
    `)
    .bind(childId)
    .first<SnapshotRow>()
}

async function queryBonus(
  db: D1Database,
  childId: string,
  week_ago: number,
): Promise<number> {
  const row = await db
    .prepare(`
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM   bonus_payments
      WHERE  child_id = ?
        AND  created_at >= ?
    `)
    .bind(childId, week_ago)
    .first<{ total: number }>()
  return row?.total ?? 0
}

async function queryParentMessage(
  db: D1Database,
  childId: string,
  nowEpoch: number,
): Promise<string | null> {
  const row = await db
    .prepare(`
      SELECT message
      FROM   parent_messages
      WHERE  to_child = ?
        AND  expires_at > ?
      ORDER  BY created_at DESC
      LIMIT  1
    `)
    .bind(childId, nowEpoch)
    .first<{ message: string }>()
  return row?.message ?? null
}

// ─────────────────────────────────────────────────────────────────
// Sunday Scrambler detection
// ─────────────────────────────────────────────────────────────────
// If >60% of the last 14 completions cluster on one weekday, the child
// is a "scrambler" — they batch all chores on one day rather than
// distributing them. This is a planning/habit signal.

function detectScrambler(days: number[]): {
  is_scrambler: boolean
  scrambler_day: string | null
} {
  if (days.length < 4) return { is_scrambler: false, scrambler_day: null }

  const counts = new Array<number>(7).fill(0)
  for (const d of days) counts[d]++

  const maxCount = Math.max(...counts)
  const maxDay = counts.indexOf(maxCount)
  const pct = maxCount / days.length

  if (pct > 0.6) {
    return { is_scrambler: true, scrambler_day: DAYS[maxDay] }
  }
  return { is_scrambler: false, scrambler_day: null }
}
```

- [ ] **Step 3.2: Verify TypeScript compiles**

```bash
cd "e:/Web-Video Design/Claude/Apps/Pocket Money/worker"
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3.3: Commit**

```bash
git add worker/src/lib/intelligence.ts
git commit -m "feat(intelligence): Omni-Orchard aggregator — balance, goals, reliability rating, velocity, scrambler"
```

---

## Task 4: Refactor `chat.ts` — The Master Mentor Brain

**Files:**
- Modify: `worker/src/routes/chat.ts`

This is the largest task. Replace the two static system prompts with a locale-aware prompt builder that:
1. Calls `getChildIntelligence()` to get real data
2. Selects the correct persona (UK Coach / PL Master Mentor / US Performance Coach)
3. Injects a data-rich context block into the system prompt
4. Returns a structured `MentorResponse` with `reply`, `pillar`, `data_points`

- [ ] **Step 4.1: Replace `chat.ts` entirely**

```typescript
// worker/src/routes/chat.ts
// Grand Unification — Localized AI Mentor with real child data injection.

import type { Env } from '../types.js'
import type { ChildIntelligence, FinancialPillar, MentorResponse } from '../types.js'
import { json } from '../lib/response.js'
import type { JwtPayload } from '../lib/jwt.js'
import { getChildIntelligence } from '../lib/intelligence.js'

type AuthedRequest = Request & { auth: JwtPayload }

interface ChatBody {
  message: string
}

// ─────────────────────────────────────────────────────────────────
// Currency helpers
// ─────────────────────────────────────────────────────────────────

function formatMinor(minor: number, currency: string): string {
  switch (currency) {
    case 'GBP': return `£${(minor / 100).toFixed(2)}`
    case 'USD': return `$${(minor / 100).toFixed(2)}`
    case 'PLN': return `${(minor / 100).toFixed(2)} zł`
    default:    return `${(minor / 100).toFixed(2)}`
  }
}

function choresToPhysical(minor: number, currency: string): string {
  // Express balance in units of average chore effort (~£2 / $2 / 10zł)
  const unitValue = currency === 'PLN' ? 1000 : 200  // minor units
  const units = Math.round(minor / unitValue)
  const label = currency === 'PLN' ? 'zadań' : 'chores'
  return `${units} ${label}`
}

// ─────────────────────────────────────────────────────────────────
// Pillar selector — infer the most relevant Pillar from the data
// ─────────────────────────────────────────────────────────────────

function selectPillar(intel: ChildIntelligence, message: string): FinancialPillar {
  const lower = message.toLowerCase()

  // Explicit keyword overrides
  if (/interest|compound|inflation|grow|invest/.test(lower)) return 'CAPITAL_MANAGEMENT'
  if (/give|donat|charity|share|tithe/.test(lower))          return 'SOCIAL_RESPONSIBILITY'
  if (/wait|save|goal|later|delay/.test(lower))              return 'DELAYED_GRATIFICATION'
  if (/instead|opport|cost|choice|give up/.test(lower))      return 'OPPORTUNITY_COST'

  // Data-driven fallback
  if (intel.spend_to_balance_pct > 15)      return 'OPPORTUNITY_COST'
  if (intel.velocity_7d === 0)              return 'LABOR_VALUE'
  if (intel.goals.length > 0 &&
      intel.goals[0].progress_pct < 30)     return 'DELAYED_GRATIFICATION'
  if (intel.reliability_rating < 60)        return 'LABOR_VALUE'
  if (intel.balance_minor > 10_000)         return 'CAPITAL_MANAGEMENT'  // >£100

  return 'LABOR_VALUE'  // safe default
}

// ─────────────────────────────────────────────────────────────────
// System prompt builders — one per locale
// ─────────────────────────────────────────────────────────────────

function buildSystemPrompt(intel: ChildIntelligence, pillar: FinancialPillar): string {
  switch (intel.locale) {
    case 'en-US': return buildUSPrompt(intel, pillar)
    case 'pl':    return buildPLPrompt(intel, pillar)
    default:      return buildUKPrompt(intel, pillar)
  }
}

// ── UK: Collaborative Coach (FCA / National Curriculum) ───────────

function buildUKPrompt(intel: ChildIntelligence, pillar: FinancialPillar): string {
  const isOrchard = intel.app_view === 'ORCHARD'
  const balance = formatMinor(intel.balance_minor, intel.currency)
  const topGoal = intel.goals[0]

  const goalLine = topGoal
    ? isOrchard
      ? `Their biggest tree is "${topGoal.title}" — ${topGoal.progress_pct}% grown (${formatMinor(topGoal.saved_minor, intel.currency)} of ${formatMinor(topGoal.target_minor, intel.currency)}).`
      : `Active savings target: "${topGoal.title}" — ${topGoal.progress_pct}% funded (${formatMinor(topGoal.saved_minor, intel.currency)} of ${formatMinor(topGoal.target_minor, intel.currency)}).`
    : 'No active savings goals.'

  const velocityLine = isOrchard
    ? `They are earning about ${formatMinor(intel.velocity_7d * 7, intel.currency)} a week from their grove.`
    : `Current weekly earnings velocity: ${formatMinor(intel.velocity_7d * 7, intel.currency)}.`

  const scramblerNote = intel.is_sunday_scrambler
    ? `Note: ${intel.display_name} completes most chores on ${intel.scrambler_day}s — a habit pattern worth addressing.`
    : ''

  const pillarNote = UK_PILLAR_NOTES[pillar] ?? ''

  return `You are the Orchard Mentor — a warm, collaborative financial coach for UK children.
Tone: Egalitarian, first-name basis, supportive peer. Formality level: 3/5.
Voice: Use "We" not "I". Never say "Morechard". Never use financial jargon for children under 12.
${isOrchard ? 'Use nature/harvest metaphors: money=seeds, balance=grove, spending=harvesting, goals=trees.' : 'Use clear financial terminology. No metaphors.'}
Emojis: ${isOrchard ? 'Max 1 per message. Nature only: 🌱 🍎 🌳' : 'None.'}
Response length: 2–4 sentences.

CHILD DATA (use this to make responses personal and specific — never teach in the abstract):
- Name: ${intel.display_name}
- Balance (their grove): ${balance} ${isOrchard ? `(${choresToPhysical(intel.balance_minor, intel.currency)})` : ''}
- ${goalLine}
- Weekly velocity: ${formatMinor(intel.velocity_7d * 7, intel.currency)} earned this week
- ${velocityLine}
- Reliability Rating: ${intel.reliability_rating}% (chore completion quality score)
- Chores completed this week: ${intel.completed_7d} of ${intel.assigned_chore_count} assigned
- Spent this week: ${formatMinor(intel.spent_minor_7d, intel.currency)} (${intel.spend_to_balance_pct}% of balance)
- Planning horizon: ${intel.planning_horizon_days} days ahead
${scramblerNote}
${intel.has_parent_message ? `Parent message to child: "${intel.parent_message}"` : ''}

ACTIVE PILLAR: ${pillar} — ${pillarNote}

UK NATIONAL CURRICULUM RULES:
- Mention a £10 "Rainy Day" buffer before any luxury goal if balance is below £10.
- For large bonuses, model Net = Gross − Deductions to introduce UK tax awareness.
- Treat spending as a "contract" — mention return policy for large purchases.
- Opportunity cost check: if spend > 15% of balance, ask "What are you giving up for this?"

CHOICE ARCHITECT CONSTRAINT: Never dictate. Present evidence, then ask ${intel.display_name} to decide.`
}

// ── US: Performance Coach (Jump$tart / CEE Standards) ─────────────

function buildUSPrompt(intel: ChildIntelligence, pillar: FinancialPillar): string {
  const isOrchard = intel.app_view === 'ORCHARD'
  const balance = formatMinor(intel.balance_minor, intel.currency)
  const topGoal = intel.goals[0]

  const goalLine = topGoal
    ? `Savings target: "${topGoal.title}" — ${topGoal.progress_pct}% funded (${formatMinor(topGoal.saved_minor, intel.currency)} of ${formatMinor(topGoal.target_minor, intel.currency)}).`
    : 'No active savings goals.'

  const pillarNote = US_PILLAR_NOTES[pillar] ?? ''

  return `You are the Performance Coach — a direct, outcome-focused financial mentor for US children.
Tone: Energetic, achievement-oriented. Formality: 2/5 (friendly but goal-driven).
Voice: Use "We". Call the child by first name. Frame chores as career-building.
Emojis: ${isOrchard ? 'Max 1: 🌱 or ⭐' : 'None.'}
Response length: 2–4 sentences.

CHILD DATA (ground every lesson in these real numbers):
- Name: ${intel.display_name}
- Balance: ${balance}
- ${goalLine}
- Reliability Rating: ${intel.reliability_rating}% — this is their "Credit Score." Above 90% = eligible for Parental Boost.
- Chores completed this week: ${intel.completed_7d} of ${intel.assigned_chore_count}
- Needs revision (quality failures): ${intel.needs_revision_7d} this week
- Weekly velocity: ${formatMinor(intel.velocity_7d * 7, intel.currency)} earned
- Spent this week: ${formatMinor(intel.spent_minor_7d, intel.currency)} (${intel.spend_to_balance_pct}% of balance)
${intel.is_sunday_scrambler ? `- Sunday Scrambler alert: ${intel.display_name} batches chores on ${intel.scrambler_day}s — missing distributed-habit development.` : ''}

ACTIVE PILLAR: ${pillar} — ${pillarNote}

US NATIONAL STANDARDS RULES:
- SALES TAX SPEED-BUMP: When a purchase is mentioned, ALWAYS remind ${intel.display_name} that the real cost is higher.
  Use the formula: $$Total = Price \\times (1 + tax)$$ where a typical US rate is ~8%.
  Example: "That $10.00 item will cost around $10.80 at the till."
- RELIABILITY RATING: Frame chore consistency as a credit-score simulation.
  "Your Reliability Rating is ${intel.reliability_rating}%. Banks use scores like this to decide who to trust."
- GIVING BUCKET: Always mention the Share/Give allocation (10% of earnings).
- INVESTING BASICS (age 12+): Introduce stock market analogies for goals over $50.
- Opportunity cost check: if spend > 15% of balance, trigger: "What's the opportunity cost here?"

CHOICE ARCHITECT CONSTRAINT: Never dictate. Show data, then let ${intel.display_name} decide.`
}

// ── PL: Master Mentor (Polish National Financial Education Strategy) ─

function buildPLPrompt(intel: ChildIntelligence, pillar: FinancialPillar): string {
  // Formal address: Pan/Pani for 16+ (Mature/CLEAN), respectful "ty" for younger
  const isOrchard = intel.app_view === 'ORCHARD'
  const isMature = intel.app_view === 'CLEAN'  // proxy for 16+ (Mature mode)
  const formalAddress = isMature ? 'Pan/Pani' : intel.display_name
  const balance = formatMinor(intel.balance_minor, intel.currency)
  const topGoal = intel.goals[0]

  const goalLine = topGoal
    ? `Cel oszczędnościowy: "${topGoal.title}" — ${topGoal.progress_pct}% sfinansowany (${formatMinor(topGoal.saved_minor, intel.currency)} z ${formatMinor(topGoal.target_minor, intel.currency)}).`
    : 'Brak aktywnych celów oszczędnościowych.'

  const pillarNote = PL_PILLAR_NOTES[pillar] ?? ''

  return `Jesteś Mistrzem Sadu — formalnym, bezpośrednim mentorem finansowym dla polskich dzieci.
Ton: Hierarchiczny, strukturalny, z szacunkiem dla zasad. Poziom formalności: 5/5.
Głos: Używaj "My". Zwracaj się do dziecka: ${formalAddress}. Bądź zwięzły i precyzyjny.
${isOrchard ? 'Używaj metafor: pieniądze=nasiona, balans=sad, wydatki=zbiory, cele=drzewa.' : 'Używaj standardowej terminologii finansowej. Bez metafor.'}
Emoji: ${isOrchard ? 'Maksymalnie 1: 🌱 lub 🍎' : 'Brak.'}
Długość odpowiedzi: 2–4 zdania.

DANE DZIECKA (każdą lekcję opieraj na tych konkretnych liczbach):
- Imię / zwrot: ${formalAddress}
- Saldo (sad): ${balance}
- ${goalLine}
- Wskaźnik niezawodności: ${intel.reliability_rating}%
- Zadania wykonane w tym tygodniu: ${intel.completed_7d} z ${intel.assigned_chore_count}
- Prędkość zarobków: ${formatMinor(intel.velocity_7d * 7, intel.currency)} w tym tygodniu
- Wydane w tym tygodniu: ${formatMinor(intel.spent_minor_7d, intel.currency)} (${intel.spend_to_balance_pct}% salda)
${intel.is_sunday_scrambler ? `- Wzorzec: ${formalAddress} wykonuje większość zadań w ${intel.scrambler_day}. To sygnał braku planowania ciągłego.` : ''}

AKTYWNY FILAR: ${pillar} — ${pillarNote}

ZASADY POLSKIEJ STRATEGII EDUKACJI FINANSOWEJ:
- PRZEDSIĘBIORCZOŚĆ: Odróżniaj dochód aktywny (zadania) od pasywnego (odsetki). 
  Wzór: $$Siła Nabywcza = \\frac{Dochód}{Cena}$$
- BUDŻET DOMOWY: Podkreślaj koszty stałe vs. wydatki uznaniowe.
- INFLACJA: "Przechowywanie nasion w celu chroni je przed wzrostem cen."
- Dla ${formalAddress} 16+: Używaj Pan/Pani, formalnych struktur, odwołań do "Honoru i Obowiązku."
- Kontrola kosztu alternatywnego: jeśli wydatek > 15% salda, zapytaj o alternatywę.

ZASADA ARCHITEKTA WYBORU: Nigdy nie nakazuj. Przedstaw dane, pozwól ${formalAddress} zdecydować.`
}

// ─────────────────────────────────────────────────────────────────
// Pillar teaching notes per locale
// ─────────────────────────────────────────────────────────────────

const UK_PILLAR_NOTES: Record<FinancialPillar, string> = {
  LABOR_VALUE:            'Money is stored effort. Link the task count to the purchase.',
  DELAYED_GRATIFICATION:  'The wait for a bigger harvest. Differentiate Needs vs Wants.',
  OPPORTUNITY_COST:       'Every Yes to a small spend is a No to a bigger goal.',
  CAPITAL_MANAGEMENT:     'Compound interest grows the grove. Inflation shrinks it. Use: $$A = P(1 + r/n)^{nt}$$',
  SOCIAL_RESPONSIBILITY:  'The Overhang — using surplus harvest for the Community Forest.',
}

const US_PILLAR_NOTES: Record<FinancialPillar, string> = {
  LABOR_VALUE:            'Every chore builds the Reliability Rating — the foundation of creditworthiness.',
  DELAYED_GRATIFICATION:  'The compounding advantage of waiting. Short-term sacrifice, long-term gain.',
  OPPORTUNITY_COST:       'Capital allocation: every dollar spent is a dollar not invested.',
  CAPITAL_MANAGEMENT:     'Compound growth and sales tax reality. Use: $$A = P(1 + r)^t$$ and $$Total = Price \\times (1 + tax)$$',
  SOCIAL_RESPONSIBILITY:  'The Give bucket: 10% of all earnings to charity builds lifelong generosity habits.',
}

const PL_PILLAR_NOTES: Record<FinancialPillar, string> = {
  LABOR_VALUE:            'Praca to zmagazynowana energia. Łącz zadania z siłą nabywczą.',
  DELAYED_GRATIFICATION:  'Cierpliwość to strategia. Większy plon wymaga większego zbioru.',
  OPPORTUNITY_COST:       'Każde "tak" dla małego wydatku to "nie" dla większego celu.',
  CAPITAL_MANAGEMENT:     'Procent składany i inflacja: $$A = P(1 + r/n)^{nt}$$ i $$Siła Nabywcza = Dochód/Cena$$',
  SOCIAL_RESPONSIBILITY:  'Honor i Obowiązek Zbiorów — dzielenie nadwyżki z Lasem Społeczności.',
}

// ─────────────────────────────────────────────────────────────────
// Data points builder — for MentorResponse.data_points
// ─────────────────────────────────────────────────────────────────

function buildDataPoints(
  intel: ChildIntelligence,
  pillar: FinancialPillar,
): Record<string, string | number | boolean> {
  const base: Record<string, string | number | boolean> = {
    reliability_rating: intel.reliability_rating,
    velocity_7d_minor: intel.velocity_7d,
    balance_minor: intel.balance_minor,
    completed_7d: intel.completed_7d,
    spend_to_balance_pct: intel.spend_to_balance_pct,
    is_sunday_scrambler: intel.is_sunday_scrambler,
    pillar,
  }
  if (intel.goals[0]) {
    base['top_goal_title']       = intel.goals[0].title
    base['top_goal_progress_pct'] = intel.goals[0].progress_pct
  }
  if (intel.is_sunday_scrambler && intel.scrambler_day) {
    base['scrambler_day'] = intel.scrambler_day
  }
  return base
}

// ─────────────────────────────────────────────────────────────────
// Fallback reply per locale
// ─────────────────────────────────────────────────────────────────

function fallbackReply(locale: string, appView: string): string {
  if (locale === 'pl')    return 'System jest chwilowo niedostępny. Proszę spróbować ponownie.'
  if (locale === 'en-US') return 'The mentor is offline right now — check back shortly!'
  return appView === 'CLEAN'
    ? 'I am currently unavailable. Please check back shortly.'
    : 'The orchard is quiet right now — come back in a moment! 🌱'
}

// ─────────────────────────────────────────────────────────────────
// Route handler
// ─────────────────────────────────────────────────────────────────

export async function handleChildChat(
  request: Request,
  env: Env,
): Promise<Response> {
  const auth = (request as AuthedRequest).auth

  if (auth.role !== 'child') {
    return json({ error: 'Child auth required' }, 403)
  }

  let body: ChatBody
  try {
    body = await request.json() as ChatBody
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  if (!body?.message?.trim()) {
    return json({ error: 'message is required' }, 400)
  }

  const userMessage = body.message.slice(0, 500)

  // ── Build intelligence snapshot ──────────────────────────────────
  const intel = await getChildIntelligence(env.DB, auth.sub)
  if (!intel) {
    return json({ error: 'Child profile not found' }, 404)
  }

  // ── Select Pillar & build system prompt ──────────────────────────
  const pillar = selectPillar(intel, userMessage)
  const systemPrompt = buildSystemPrompt(intel, pillar)
  const dataPoints = buildDataPoints(intel, pillar)

  // ── Call AI with timeout ─────────────────────────────────────────
  const aiPromise = env.AI.run('@cf/meta/llama-3-8b-instruct', {
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userMessage },
    ],
  })
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('AI timeout')), 5000),
  )

  try {
    const aiResponse = await Promise.race([aiPromise, timeoutPromise])
    const reply = (aiResponse as { response?: string }).response?.trim()
      ?? fallbackReply(intel.locale, intel.app_view)

    const response: MentorResponse = {
      reply,
      pillar,
      data_points: dataPoints,
      app_view: intel.app_view,
      locale: intel.locale,
    }
    return json(response)
  } catch {
    const response: MentorResponse = {
      reply: fallbackReply(intel.locale, intel.app_view),
      pillar,
      data_points: dataPoints,
      app_view: intel.app_view,
      locale: intel.locale,
    }
    return json(response)
  }
}
```

- [ ] **Step 4.2: Verify TypeScript compiles**

```bash
cd "e:/Web-Video Design/Claude/Apps/Pocket Money/worker"
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4.3: Commit**

```bash
git add worker/src/routes/chat.ts
git commit -m "feat(mentor): Grand Unification — tri-locale AI Mentor (UK/PL/US) with real data injection"
```

---

## Task 5: Integration Smoke Test

**Files:** No file changes — runtime verification only.

- [ ] **Step 5.1: Start the local dev server**

```bash
cd "e:/Web-Video Design/Claude/Apps/Pocket Money"
npm run dev
```

Leave running in one terminal.

- [ ] **Step 5.2: Obtain a child JWT (use an existing child account from local D1)**

```bash
# List child users in local D1
npx wrangler d1 execute morechard-db --local \
  --command "SELECT u.id, u.display_name, u.locale FROM users u JOIN family_roles fr ON fr.user_id = u.id WHERE fr.role = 'child' LIMIT 5;"
```

Note a child `id` from the output. Use the app's login flow or a direct PIN check to get a JWT, or generate one using the worker's JWT secret for testing:

```bash
# Alternatively, query user_settings to confirm app_view for a child
npx wrangler d1 execute morechard-db --local \
  --command "SELECT user_id, app_view FROM user_settings WHERE user_id IN (SELECT id FROM users LIMIT 5);"
```

- [ ] **Step 5.3: Test UK child (default en locale)**

```bash
curl -s -X POST http://localhost:8787/child/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <CHILD_JWT>" \
  -d '{"message":"How close am I to my goal?"}' | jq .
```

Expected shape:
```json
{
  "reply": "...",
  "pillar": "DELAYED_GRATIFICATION",
  "data_points": {
    "reliability_rating": 85,
    "top_goal_title": "...",
    "top_goal_progress_pct": 45
  },
  "app_view": "ORCHARD",
  "locale": "en"
}
```

- [ ] **Step 5.4: Test US locale**

```bash
# Set a child to en-US locale temporarily
npx wrangler d1 execute morechard-db --local \
  --command "UPDATE users SET locale='en-US' WHERE id='<CHILD_ID>';"
```

```bash
curl -s -X POST http://localhost:8787/child/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <CHILD_JWT>" \
  -d '{"message":"I want to buy a $10 game"}' | jq .
```

Expected: `reply` mentions sales tax (~$10.80), `pillar` is `OPPORTUNITY_COST` or `LABOR_VALUE`, `locale` is `en-US`.

- [ ] **Step 5.5: Test PL locale**

```bash
npx wrangler d1 execute morechard-db --local \
  --command "UPDATE users SET locale='pl' WHERE id='<CHILD_ID>';"
```

```bash
curl -s -X POST http://localhost:8787/child/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <CHILD_JWT>" \
  -d '{"message":"Chcę kupić grę"}' | jq .
```

Expected: `reply` in Polish, formal tone, Mistrz Sadu persona, `locale` is `pl`.

- [ ] **Step 5.6: Restore locale and final commit**

```bash
npx wrangler d1 execute morechard-db --local \
  --command "UPDATE users SET locale='en' WHERE id='<CHILD_ID>';"

git add -A
git commit -m "test(mentor): smoke test — verified UK/US/PL personas and structured MentorResponse"
```

---

## Self-Review

**Spec coverage check:**

| Requirement | Task |
|---|---|
| USD in currency CHECK constraints | Task 1 |
| `en-US` locale support | Task 1 |
| `getChildIntelligence()` aggregator | Task 3 |
| Reliability Rating (completion + quality penalty) | Task 3 |
| Velocity (7-day earnings / 7) | Task 3 |
| Sunday Scrambler detection (>60% clustering) | Task 3 |
| UK Collaborative Coach persona | Task 4 |
| PL Master Mentor + Pan/Pani formal address | Task 4 |
| US Performance Coach persona | Task 4 |
| Sales tax speed-bump ($$Total = Price \times 1.08$$) | Task 4 (buildUSPrompt) |
| Real data injected into every prompt | Task 4 (all three builders) |
| LaTeX formulas from national standards | Task 4 (all pillar notes) |
| `reply`, `pillar`, `data_points` in response | Task 4 (MentorResponse) |
| Choice Architect constraint in all locales | Task 4 (all three builders) |
| 5 Pillars driving pillar selection | Task 4 (selectPillar + notes) |

**Placeholder scan:** None found. All code blocks are complete.

**Type consistency:**
- `ChildIntelligence` defined in Task 2, imported in Tasks 3 and 4 ✓
- `MentorResponse` defined in Task 2, returned in Task 4 ✓
- `FinancialPillar` defined in Task 2, used in Tasks 3, 4 ✓
- `getChildIntelligence` defined in Task 3, called in Task 4 ✓
- `formatMinor` used in Tasks 3 helper stubs — defined in Task 4 (chat.ts). No cross-file dependency: intelligence.ts returns raw minor-unit numbers, formatting stays in chat.ts ✓
