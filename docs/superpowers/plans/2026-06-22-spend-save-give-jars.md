# Spend / Save / Give Jars — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional three-jar allocation layer (Spend / Save / Give) above the immutable ledger, with child-configurable percentages, parent-mediated giving, and 10 AI Insight signals wired into the existing weekly briefing engine.

**Architecture:** `jar_movements` is an append-only event log (mirrors the ledger immutability pattern) and is the single source of truth for all jar balances. `jar_config` holds the per-child toggle and percentages. The existing `completions.ts` approval path is extended to emit allocation movements; the existing `insight_snapshots` weekly snapshot gains a `jar_snapshot` JSON column.

**Tech Stack:** Cloudflare D1 (SQL), Cloudflare Workers (TypeScript), React + TypeScript (app), inline SVG components.

## Global Constraints

- Migration naming: `NNNN_description.sql` — latest is `0067_spending_category.sql`; use 0068, 0069, 0070, 0071
- All monetary amounts in integer pence (never floats); currency from `families.base_currency`
- `jar_movements` rows are immutable — enforce with DB triggers (same pattern as `ledger`)
- JWT auth enforced on every worker route; family/child scoping checked server-side
- No parent approval required for jar config changes
- Backend must validate Spend jar non-negative independently of frontend
- Sum of jar balances must always equal `available` from `GET /api/balance`
- Child-facing copy: under-12 vocabulary; no "grove" metaphor on-screen
- SVG icons: 40×40 viewBox, ~1.5px stroke, teal (#0d9488) + gold (#d97706) palette, no emojis

---

## File Map

**New worker files:**
- `worker/migrations/0068_jar_config.sql`
- `worker/migrations/0069_jar_movements.sql`
- `worker/migrations/0070_give_requests.sql`
- `worker/migrations/0071_insight_snapshot_jars.sql`
- `worker/src/routes/jars.ts` — GET /api/jars, PUT /api/jars/config, POST /api/jars/move, GET /api/jars/movements
- `worker/src/routes/give-requests.ts` — POST /api/give-requests, GET /api/give-requests, PATCH /api/give-requests/:id
- `worker/src/lib/jar-balance.ts` — balance computation, weekly signal computation

**Modified worker files:**
- `worker/src/index.ts` — register 7 new routes
- `worker/src/routes/finance.ts` — extend `handleBalance` response with `jars` key
- `worker/src/routes/completions.ts` — emit `allocation` jar_movements after ledger credit write
- `worker/src/routes/goals.ts` — emit `goal_allocate`, `goal_deallocate`, `goal_purchase` movements
- `worker/src/routes/insights.ts` — compute + store `jar_snapshot` in weekly snapshot INSERT

**New app files:**
- `app/src/components/icons/SpendJarIcon.tsx`
- `app/src/components/icons/SaveJarIcon.tsx`
- `app/src/components/icons/GiveJarIcon.tsx`
- `app/src/components/dashboard/JarCard.tsx`
- `app/src/components/dashboard/JarDetailSheet.tsx`
- `app/src/components/dashboard/JarSettingsSheet.tsx`
- `app/src/components/dashboard/JarOnboardingWizard.tsx`
- `app/src/components/dashboard/GiveRequestSheet.tsx`
- `app/src/components/dashboard/GiveRequestsPanel.tsx`

**Modified app files:**
- `app/src/lib/api.ts` — add JarConfig, JarBalance, GiveRequest interfaces + fetch functions
- `app/src/components/dashboard/ChildMoneyTab.tsx` — render jar cards when enabled
- `app/src/screens/ParentDashboard.tsx` — add GiveRequestsPanel

---

## Task 1: D1 Migrations

**Files:**
- Create: `worker/migrations/0068_jar_config.sql`
- Create: `worker/migrations/0069_jar_movements.sql`
- Create: `worker/migrations/0070_give_requests.sql`
- Create: `worker/migrations/0071_insight_snapshot_jars.sql`

**Interfaces:**
- Produces: D1 tables `jar_config`, `jar_movements`, `give_requests`; `jar_snapshot` column on `insight_snapshots`

- [ ] **Step 1: Write 0068_jar_config.sql**

```sql
-- 0068_jar_config.sql
CREATE TABLE IF NOT EXISTS jar_config (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id   TEXT    NOT NULL REFERENCES families(id),
  child_id    TEXT    NOT NULL REFERENCES users(id),
  enabled     INTEGER NOT NULL DEFAULT 0,
  spend_pct   INTEGER NOT NULL DEFAULT 70,
  save_pct    INTEGER NOT NULL DEFAULT 20,
  give_pct    INTEGER NOT NULL DEFAULT 10,
  updated_at  INTEGER NOT NULL,
  UNIQUE(family_id, child_id),
  CHECK(spend_pct + save_pct + give_pct = 100),
  CHECK(spend_pct >= 0 AND save_pct >= 0 AND give_pct >= 0)
);
```

- [ ] **Step 2: Write 0069_jar_movements.sql**

```sql
-- 0069_jar_movements.sql
CREATE TABLE IF NOT EXISTS jar_movements (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id      TEXT    NOT NULL REFERENCES families(id),
  child_id       TEXT    NOT NULL REFERENCES users(id),
  jar            TEXT    NOT NULL CHECK(jar IN ('spend','save','give')),
  delta          INTEGER NOT NULL DEFAULT 0,
  earmark_pence  INTEGER,
  kind           TEXT    NOT NULL CHECK(kind IN (
                   'allocation','enable_seed','manual_move',
                   'spend','give_request','give_fulfilled','give_declined',
                   'goal_allocate','goal_deallocate','goal_purchase'
                 )),
  ref_id         TEXT,
  goal_id        INTEGER REFERENCES goals(id),
  note           TEXT,
  created_at     INTEGER NOT NULL
);

CREATE INDEX idx_jar_movements_child_jar
  ON jar_movements(family_id, child_id, jar);

CREATE INDEX idx_jar_movements_goal
  ON jar_movements(goal_id) WHERE goal_id IS NOT NULL;

CREATE TRIGGER jar_movements_no_update
  BEFORE UPDATE ON jar_movements
BEGIN SELECT RAISE(ABORT,'jar_movements rows are immutable.'); END;

CREATE TRIGGER jar_movements_no_delete
  BEFORE DELETE ON jar_movements
BEGIN SELECT RAISE(ABORT,'jar_movements rows are immutable.'); END;
```

- [ ] **Step 3: Write 0070_give_requests.sql**

```sql
-- 0070_give_requests.sql
CREATE TABLE IF NOT EXISTS give_requests (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id     TEXT    NOT NULL REFERENCES families(id),
  child_id      TEXT    NOT NULL REFERENCES users(id),
  cause         TEXT    NOT NULL,
  amount        INTEGER NOT NULL,
  currency      TEXT    NOT NULL,
  status        TEXT    NOT NULL DEFAULT 'requested'
                  CHECK(status IN ('requested','fulfilled','declined')),
  requested_at  INTEGER NOT NULL,
  fulfilled_at  INTEGER,
  parent_note   TEXT,
  jar_movement_id INTEGER REFERENCES jar_movements(id)
);
```

- [ ] **Step 4: Write 0071_insight_snapshot_jars.sql**

```sql
-- 0071_insight_snapshot_jars.sql
ALTER TABLE insight_snapshots ADD COLUMN jar_snapshot TEXT;
```

- [ ] **Step 5: Apply migrations to local D1**

```bash
cd "e:/Web-Video Design/Claude/Apps/Pocket Money"
npx wrangler d1 execute morechard-db --local --file=worker/migrations/0068_jar_config.sql
npx wrangler d1 execute morechard-db --local --file=worker/migrations/0069_jar_movements.sql
npx wrangler d1 execute morechard-db --local --file=worker/migrations/0070_give_requests.sql
npx wrangler d1 execute morechard-db --local --file=worker/migrations/0071_insight_snapshot_jars.sql
```

Expected: each command prints `🚣 Executed 1 commands.`

- [ ] **Step 6: Verify schema**

```bash
npx wrangler d1 execute morechard-db --local --command="SELECT name FROM sqlite_master WHERE type='table' AND name IN ('jar_config','jar_movements','give_requests') ORDER BY name;"
```

Expected: 3 rows returned.

- [ ] **Step 7: Commit**

```bash
git add worker/migrations/0068_jar_config.sql worker/migrations/0069_jar_movements.sql worker/migrations/0070_give_requests.sql worker/migrations/0071_insight_snapshot_jars.sql
git commit -m "feat: D1 migrations for spend/save/give jars (0068-0071)"
```

---

## Task 2: Jar Balance Library

**Files:**
- Create: `worker/src/lib/jar-balance.ts`

**Interfaces:**
- Consumes: D1 `jar_movements`, `jar_config`, `give_requests` tables
- Produces:
  - `getJarConfig(db, familyId, childId): Promise<JarConfigRow>`
  - `getJarBalances(db, familyId, childId): Promise<JarBalances>`
  - `getGoalEarmarked(db, childId): Promise<number>` — total pence earmarked across active goals
  - `computeJarSignals(db, childId, familyId, now): Promise<JarSignals>`

- [ ] **Step 1: Create `worker/src/lib/jar-balance.ts`**

```typescript
import type { D1Database } from '@cloudflare/workers-types';

export interface JarConfigRow {
  enabled: number;   // 0|1
  spend_pct: number;
  save_pct: number;
  give_pct: number;
  updated_at: number;
}

export interface JarBalances {
  enabled: boolean;
  spend: number;
  save: number;
  give: number;
  save_earmarked: number;   // pence earmarked for active goals within Save
  save_unallocated: number; // save - save_earmarked
}

export interface JarSignals {
  enabled: boolean;
  spend_pct: number;
  save_pct: number;
  give_pct: number;
  manual_move_count: number;
  save_raids: number;
  give_balance_age_days: number;
  auto_off_weeks: number;
  deviation_score: number;
  weeks_at_current_deviation: number;
  positive_streak_weeks: number;
}

const DEFAULT_CONFIG: JarConfigRow = {
  enabled: 0, spend_pct: 70, save_pct: 20, give_pct: 10,
  updated_at: 0,
};

export async function getJarConfig(
  db: D1Database,
  familyId: string,
  childId: string,
): Promise<JarConfigRow> {
  const row = await db
    .prepare('SELECT enabled, spend_pct, save_pct, give_pct, updated_at FROM jar_config WHERE family_id = ? AND child_id = ?')
    .bind(familyId, childId)
    .first<JarConfigRow>();
  return row ?? DEFAULT_CONFIG;
}

export async function getJarBalances(
  db: D1Database,
  familyId: string,
  childId: string,
): Promise<JarBalances> {
  const config = await getJarConfig(db, familyId, childId);

  if (!config.enabled) {
    return { enabled: false, spend: 0, save: 0, give: 0, save_earmarked: 0, save_unallocated: 0 };
  }

  // SUM delta per jar — the authoritative balance
  const rows = await db
    .prepare(`
      SELECT jar, SUM(delta) AS total
      FROM jar_movements
      WHERE family_id = ? AND child_id = ?
      GROUP BY jar
    `)
    .bind(familyId, childId)
    .all<{ jar: string; total: number }>();

  const totals: Record<string, number> = { spend: 0, save: 0, give: 0 };
  for (const r of rows.results) totals[r.jar] = r.total ?? 0;

  // Earmarked amounts for active goals (goal_allocate minus goal_deallocate per goal)
  const earmarkRow = await db
    .prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN kind='goal_allocate'   THEN earmark_pence ELSE 0 END), 0)
        - COALESCE(SUM(CASE WHEN kind='goal_deallocate' THEN earmark_pence ELSE 0 END), 0)
        AS net_earmarked
      FROM jar_movements
      WHERE child_id = ? AND kind IN ('goal_allocate','goal_deallocate')
        AND goal_id IN (SELECT id FROM goals WHERE child_id = ? AND status = 'ACTIVE')
    `)
    .bind(childId, childId)
    .first<{ net_earmarked: number }>();

  const saveEarmarked = Math.max(0, earmarkRow?.net_earmarked ?? 0);

  return {
    enabled:          true,
    spend:            totals.spend,
    save:             totals.save,
    give:             totals.give,
    save_earmarked:   saveEarmarked,
    save_unallocated: Math.max(0, totals.save - saveEarmarked),
  };
}

export async function computeJarSignals(
  db: D1Database,
  childId: string,
  familyId: string,
  now: number,
): Promise<JarSignals> {
  const config = await getJarConfig(db, familyId, childId);
  const oneWeekAgo  = now - 7 * 86400;
  const fourWeeksAgo = now - 28 * 86400;

  // Manual moves this week
  const movesRow = await db
    .prepare(`SELECT COUNT(*) AS cnt FROM jar_movements WHERE child_id = ? AND kind = 'manual_move' AND created_at >= ?`)
    .bind(childId, oneWeekAgo)
    .first<{ cnt: number }>();

  // Save-raids this week (Save→Spend manual moves = negative delta on save, positive on spend in same pair)
  // We detect by looking for manual_move rows on jar='save' with negative delta in the last 7 days
  const raidsRow = await db
    .prepare(`SELECT COUNT(*) AS cnt FROM jar_movements WHERE child_id = ? AND kind = 'manual_move' AND jar = 'save' AND delta < 0 AND created_at >= ?`)
    .bind(childId, oneWeekAgo)
    .first<{ cnt: number }>();

  // Give balance age: how long since Give jar was last drawn down
  const lastGiveOut = await db
    .prepare(`SELECT MAX(created_at) AS last FROM jar_movements WHERE child_id = ? AND jar = 'give' AND delta < 0`)
    .bind(childId)
    .first<{ last: number | null }>();
  const giveBalanceAgeDays = lastGiveOut?.last
    ? Math.floor((now - lastGiveOut.last) / 86400)
    : 999;

  // Auto-off weeks: count ISO weeks in last 8 weeks with no allocation movements
  // (simplified: weeks since last allocation movement / 7)
  const lastAlloc = await db
    .prepare(`SELECT MAX(created_at) AS last FROM jar_movements WHERE child_id = ? AND kind = 'allocation'`)
    .bind(childId)
    .first<{ last: number | null }>();
  const autoOffWeeks = config.enabled
    ? 0
    : lastAlloc?.last
      ? Math.floor((now - lastAlloc.last) / (7 * 86400))
      : 99;

  // Deviation score: weighted distance from 70/20/10
  const deviationScore = Math.min(100, Math.round(
    Math.abs(config.spend_pct - 70) * 0.4 +
    Math.abs(config.save_pct  - 20) * 0.4 +
    Math.abs(config.give_pct  - 10) * 0.2,
  ));

  // weeks_at_current_deviation and positive_streak_weeks require snapshot history —
  // computed from insight_snapshots in the insights route where snapshots are available.
  // Return 0 here; the insights route will override from snapshot history.

  return {
    enabled:                   !!config.enabled,
    spend_pct:                 config.spend_pct,
    save_pct:                  config.save_pct,
    give_pct:                  config.give_pct,
    manual_move_count:         movesRow?.cnt ?? 0,
    save_raids:                raidsRow?.cnt ?? 0,
    give_balance_age_days:     giveBalanceAgeDays,
    auto_off_weeks:            autoOffWeeks,
    deviation_score:           deviationScore,
    weeks_at_current_deviation: 0,
    positive_streak_weeks:      0,
  };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "e:/Web-Video Design/Claude/Apps/Pocket Money/worker"
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add worker/src/lib/jar-balance.ts
git commit -m "feat: jar balance utility library (getJarConfig, getJarBalances, computeJarSignals)"
```

---

## Task 3: Jars API Routes

**Files:**
- Create: `worker/src/routes/jars.ts`
- Modify: `worker/src/index.ts` (register routes)

**Interfaces:**
- Consumes: `getJarConfig`, `getJarBalances` from `../lib/jar-balance.js`
- Produces:
  - `handleGetJars(request, env): Promise<Response>` — GET /api/jars
  - `handlePutJarConfig(request, env): Promise<Response>` — PUT /api/jars/config
  - `handlePostJarMove(request, env): Promise<Response>` — POST /api/jars/move
  - `handleGetJarMovements(request, env): Promise<Response>` — GET /api/jars/movements

- [ ] **Step 1: Create `worker/src/routes/jars.ts`**

```typescript
import { Env } from '../types.js';
import { json, error } from '../lib/response.js';
import { JwtPayload } from '../lib/jwt.js';
import { getJarConfig, getJarBalances } from '../lib/jar-balance.js';

type AuthedRequest = Request & { auth: JwtPayload };

// ----------------------------------------------------------------
// GET /api/jars?family_id=&child_id=
// Returns current balances + config. Parent can read any child;
// child can only read own.
// ----------------------------------------------------------------
export async function handleGetJars(request: Request, env: Env): Promise<Response> {
  const auth = (request as AuthedRequest).auth;
  const url  = new URL(request.url);
  const family_id = url.searchParams.get('family_id');
  const child_id  = url.searchParams.get('child_id');

  if (!family_id || !child_id) return error('family_id and child_id required');
  if (family_id !== auth.family_id) return error('Forbidden', 403);
  if (auth.role === 'child' && child_id !== auth.sub) return error('Forbidden', 403);

  const [config, balances] = await Promise.all([
    getJarConfig(env.DB, family_id, child_id),
    getJarBalances(env.DB, family_id, child_id),
  ]);

  return json({ config, balances });
}

// ----------------------------------------------------------------
// PUT /api/jars/config
// Body: { family_id, child_id, enabled?, spend_pct?, save_pct?, give_pct?,
//         initial_seed?: { spend, save, give } }
// Child only. initial_seed is used on first enable (wizard).
// ----------------------------------------------------------------
export async function handlePutJarConfig(request: Request, env: Env): Promise<Response> {
  const auth = (request as AuthedRequest).auth;
  if (auth.role !== 'child') return error('Only children can configure their own jars', 403);

  const body = await request.json<{
    family_id: string; child_id: string;
    enabled?: number;
    spend_pct?: number; save_pct?: number; give_pct?: number;
    initial_seed?: { spend: number; save: number; give: number };
  }>();

  const { family_id, child_id } = body;
  if (!family_id || !child_id) return error('family_id and child_id required');
  if (family_id !== auth.family_id || child_id !== auth.sub) return error('Forbidden', 403);

  const spend_pct = body.spend_pct ?? 70;
  const save_pct  = body.save_pct  ?? 20;
  const give_pct  = body.give_pct  ?? 10;
  if (spend_pct + save_pct + give_pct !== 100) return error('Percentages must sum to 100', 400);
  if (spend_pct < 0 || save_pct < 0 || give_pct < 0) return error('Percentages must be non-negative', 400);

  const enabled = body.enabled ?? 1;
  const now = Math.floor(Date.now() / 1000);

  const existing = await getJarConfig(env.DB, family_id, child_id);
  const isFirstEnable = !existing.enabled && enabled === 1;

  const ops: ReturnType<typeof env.DB.prepare>[] = [
    env.DB.prepare(`
      INSERT INTO jar_config (family_id, child_id, enabled, spend_pct, save_pct, give_pct, updated_at)
      VALUES (?,?,?,?,?,?,?)
      ON CONFLICT(family_id, child_id) DO UPDATE SET
        enabled=excluded.enabled, spend_pct=excluded.spend_pct,
        save_pct=excluded.save_pct, give_pct=excluded.give_pct,
        updated_at=excluded.updated_at
    `).bind(family_id, child_id, enabled, spend_pct, save_pct, give_pct, now),
  ];

  // First enable: write enable_seed movements from wizard split
  if (isFirstEnable && body.initial_seed) {
    const { spend, save, give } = body.initial_seed;
    if (spend + save + give < 0) return error('Seed amounts cannot be negative', 400);
    for (const [jar, amount] of [['spend', spend], ['save', save], ['give', give]] as const) {
      if (amount > 0) {
        ops.push(env.DB.prepare(`
          INSERT INTO jar_movements (family_id, child_id, jar, delta, kind, created_at)
          VALUES (?,?,?,?,'enable_seed',?)
        `).bind(family_id, child_id, jar, amount, now));
      }
    }
  }

  await env.DB.batch(ops);
  const balances = await getJarBalances(env.DB, family_id, child_id);
  return json({ ok: true, balances });
}

// ----------------------------------------------------------------
// POST /api/jars/move
// Body: { family_id, child_id, from_jar, to_jar, amount }
// Validates source balance server-side before writing.
// ----------------------------------------------------------------
export async function handlePostJarMove(request: Request, env: Env): Promise<Response> {
  const auth = (request as AuthedRequest).auth;
  if (auth.role !== 'child') return error('Only children can move money between jars', 403);

  const body = await request.json<{
    family_id: string; child_id: string;
    from_jar: 'spend' | 'save' | 'give';
    to_jar:   'spend' | 'save' | 'give';
    amount:   number;
  }>();

  const { family_id, child_id, from_jar, to_jar, amount } = body;
  if (!family_id || !child_id || !from_jar || !to_jar || !amount)
    return error('family_id, child_id, from_jar, to_jar, amount required', 400);
  if (family_id !== auth.family_id || child_id !== auth.sub) return error('Forbidden', 403);
  if (from_jar === to_jar) return error('from_jar and to_jar must differ', 400);
  if (!['spend','save','give'].includes(from_jar) || !['spend','save','give'].includes(to_jar))
    return error('Invalid jar name', 400);
  if (amount <= 0) return error('Amount must be positive', 400);

  // Server-side balance check
  const balances = await getJarBalances(env.DB, family_id, child_id);
  if (!balances.enabled) return error('Jars are not enabled for this child', 400);
  const sourceBalance = balances[from_jar];
  if (sourceBalance < amount) return error(`Insufficient balance in ${from_jar} jar`, 400);

  const now = Math.floor(Date.now() / 1000);
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO jar_movements (family_id,child_id,jar,delta,kind,created_at) VALUES (?,?,?,?,'manual_move',?)`)
      .bind(family_id, child_id, from_jar, -amount, now),
    env.DB.prepare(`INSERT INTO jar_movements (family_id,child_id,jar,delta,kind,created_at) VALUES (?,?,?,?,'manual_move',?)`)
      .bind(family_id, child_id, to_jar, amount, now),
  ]);

  const updated = await getJarBalances(env.DB, family_id, child_id);
  return json({ ok: true, balances: updated });
}

// ----------------------------------------------------------------
// GET /api/jars/movements?family_id=&child_id=&limit=20&offset=0
// ----------------------------------------------------------------
export async function handleGetJarMovements(request: Request, env: Env): Promise<Response> {
  const auth = (request as AuthedRequest).auth;
  const url  = new URL(request.url);
  const family_id = url.searchParams.get('family_id');
  const child_id  = url.searchParams.get('child_id');
  const limit  = Math.min(50, parseInt(url.searchParams.get('limit')  ?? '20', 10));
  const offset = Math.max(0,  parseInt(url.searchParams.get('offset') ?? '0',  10));

  if (!family_id || !child_id) return error('family_id and child_id required');
  if (family_id !== auth.family_id) return error('Forbidden', 403);
  if (auth.role === 'child' && child_id !== auth.sub) return error('Forbidden', 403);

  const rows = await env.DB
    .prepare(`SELECT * FROM jar_movements WHERE family_id=? AND child_id=? ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .bind(family_id, child_id, limit, offset)
    .all();

  return json({ movements: rows.results });
}
```

- [ ] **Step 2: Register routes in `worker/src/index.ts`**

Find the imports block (around line 191 — after the consent imports). Add:

```typescript
import { handleGetJars, handlePutJarConfig, handlePostJarMove, handleGetJarMovements } from './routes/jars.js';
import { handlePostGiveRequest, handleGetGiveRequests, handlePatchGiveRequest } from './routes/give-requests.js';
```

Find the route dispatch block. After the existing `/api/balance` line (line ~571), add:

```typescript
if (path === '/api/jars'            && method === 'GET')   return withAuth(request, auth, env, handleGetJars);
if (path === '/api/jars/config'     && method === 'PUT')   return withAuth(request, auth, env, handlePutJarConfig);
if (path === '/api/jars/move'       && method === 'POST')  return withAuth(request, auth, env, handlePostJarMove);
if (path === '/api/jars/movements'  && method === 'GET')   return withAuth(request, auth, env, handleGetJarMovements);
if (path === '/api/give-requests'   && method === 'POST')  return withAuth(request, auth, env, handlePostGiveRequest);
if (path === '/api/give-requests'   && method === 'GET')   return withAuth(request, auth, env, handleGetGiveRequests);
if (giveReqMatch && method === 'PATCH') return withAuth(request, auth, env, (req, e) => handlePatchGiveRequest(req, e, giveReqMatch[1]));
```

Also add before the route dispatch block:

```typescript
const giveReqMatch = path.match(/^\/api\/give-requests\/(\d+)$/);
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd "e:/Web-Video Design/Claude/Apps/Pocket Money/worker"
npx tsc --noEmit
```

Expected: no errors (give-requests.ts doesn't exist yet — expect one missing-module error; that's fine until Task 4).

- [ ] **Step 4: Commit**

```bash
git add worker/src/routes/jars.ts worker/src/index.ts
git commit -m "feat: jars API routes (GET /api/jars, PUT /api/jars/config, POST /api/jars/move)"
```

---

## Task 4: Give Requests API

**Files:**
- Create: `worker/src/routes/give-requests.ts`

**Interfaces:**
- Consumes: `getJarBalances` from `../lib/jar-balance.js`
- Produces:
  - `handlePostGiveRequest(request, env): Promise<Response>`
  - `handleGetGiveRequests(request, env): Promise<Response>`
  - `handlePatchGiveRequest(request, env, id): Promise<Response>`

- [ ] **Step 1: Create `worker/src/routes/give-requests.ts`**

```typescript
import { Env } from '../types.js';
import { json, error } from '../lib/response.js';
import { JwtPayload } from '../lib/jwt.js';
import { getJarBalances } from '../lib/jar-balance.js';

type AuthedRequest = Request & { auth: JwtPayload };

// ----------------------------------------------------------------
// POST /api/give-requests
// Body: { family_id, child_id, cause, amount }
// Child only. Reserves Give jar balance.
// ----------------------------------------------------------------
export async function handlePostGiveRequest(request: Request, env: Env): Promise<Response> {
  const auth = (request as AuthedRequest).auth;
  if (auth.role !== 'child') return error('Only children can submit give requests', 403);

  const body = await request.json<{
    family_id: string; child_id: string; cause: string; amount: number;
  }>();
  const { family_id, child_id, cause, amount } = body;
  if (!family_id || !child_id || !cause || !amount) return error('Missing required fields', 400);
  if (family_id !== auth.family_id || child_id !== auth.sub) return error('Forbidden', 403);
  if (cause.trim().length === 0 || cause.length > 60) return error('Cause must be 1–60 characters', 400);
  if (amount <= 0) return error('Amount must be positive', 400);

  // Verify Give jar has sufficient balance
  const balances = await getJarBalances(env.DB, family_id, child_id);
  if (!balances.enabled) return error('Jars are not enabled', 400);

  // Subtract already-requested (pending) amounts from Give balance
  const pendingRow = await env.DB
    .prepare(`SELECT COALESCE(SUM(amount),0) AS total FROM give_requests WHERE child_id=? AND status='requested'`)
    .bind(child_id)
    .first<{ total: number }>();
  const availableGive = balances.give - (pendingRow?.total ?? 0);
  if (availableGive < amount) return error('Insufficient Give jar balance', 400);

  const now = Math.floor(Date.now() / 1000);
  const currencyRow = await env.DB
    .prepare('SELECT base_currency FROM families WHERE id=?')
    .bind(family_id)
    .first<{ base_currency: string }>();
  const currency = currencyRow?.base_currency ?? 'GBP';

  // Atomic: insert give_request + reserve give_request jar_movement
  const result = await env.DB
    .prepare(`INSERT INTO give_requests (family_id,child_id,cause,amount,currency,status,requested_at) VALUES (?,?,?,?,?,'requested',?) RETURNING id`)
    .bind(family_id, child_id, cause.trim(), amount, currency, now)
    .first<{ id: number }>();

  await env.DB
    .prepare(`INSERT INTO jar_movements (family_id,child_id,jar,delta,kind,ref_id,created_at) VALUES (?,?,'give',?,'give_request',?,?)`)
    .bind(family_id, child_id, -amount, String(result!.id), now)
    .run();

  return json({ ok: true, id: result!.id }, 201);
}

// ----------------------------------------------------------------
// GET /api/give-requests?family_id=&status=requested
// Parent only — lists pending give requests for all children.
// ----------------------------------------------------------------
export async function handleGetGiveRequests(request: Request, env: Env): Promise<Response> {
  const auth = (request as AuthedRequest).auth;
  if (auth.role !== 'parent') return error('Parents only', 403);

  const url       = new URL(request.url);
  const family_id = url.searchParams.get('family_id');
  const status    = url.searchParams.get('status') ?? 'requested';
  if (!family_id) return error('family_id required');
  if (family_id !== auth.family_id) return error('Forbidden', 403);

  const rows = await env.DB
    .prepare(`
      SELECT gr.*, u.display_name AS child_name
      FROM give_requests gr
      JOIN users u ON u.id = gr.child_id
      WHERE gr.family_id=? AND gr.status=?
      ORDER BY gr.requested_at DESC
    `)
    .bind(family_id, status)
    .all();

  return json({ give_requests: rows.results });
}

// ----------------------------------------------------------------
// PATCH /api/give-requests/:id
// Body: { action: 'fulfil' | 'decline', parent_note? }
// Parent only.
// ----------------------------------------------------------------
export async function handlePatchGiveRequest(
  request: Request,
  env: Env,
  id: string,
): Promise<Response> {
  const auth = (request as AuthedRequest).auth;
  if (auth.role !== 'parent') return error('Parents only', 403);

  const body = await request.json<{ action: 'fulfil' | 'decline'; parent_note?: string }>();
  if (!body.action) return error('action required', 400);

  const req = await env.DB
    .prepare('SELECT * FROM give_requests WHERE id=?')
    .bind(id)
    .first<{ id: number; family_id: string; child_id: string; amount: number; status: string }>();

  if (!req) return error('Give request not found', 404);
  if (req.family_id !== auth.family_id) return error('Forbidden', 403);
  if (req.status !== 'requested') return error('Request already resolved', 400);

  const now  = Math.floor(Date.now() / 1000);
  const kind = body.action === 'fulfil' ? 'give_fulfilled' : 'give_declined';
  const newStatus = body.action === 'fulfil' ? 'fulfilled' : 'declined';

  await env.DB.batch([
    env.DB.prepare(`UPDATE give_requests SET status=?,fulfilled_at=?,parent_note=? WHERE id=?`)
      .bind(newStatus, now, body.parent_note ?? null, id),
    // If declined: restore Give jar balance
    ...(body.action === 'decline' ? [
      env.DB.prepare(`INSERT INTO jar_movements (family_id,child_id,jar,delta,kind,ref_id,created_at) VALUES (?,?,'give',?,'give_declined',?,?)`)
        .bind(req.family_id, req.child_id, req.amount, id, now),
    ] : [
      // If fulfilled: record finalisation (delta=0, just an audit event)
      env.DB.prepare(`INSERT INTO jar_movements (family_id,child_id,jar,delta,kind,ref_id,created_at) VALUES (?,?,'give',0,'give_fulfilled',?,?)`)
        .bind(req.family_id, req.child_id, id, now),
    ]),
  ]);

  return json({ ok: true, status: newStatus });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "e:/Web-Video Design/Claude/Apps/Pocket Money/worker"
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add worker/src/routes/give-requests.ts
git commit -m "feat: give requests API (POST/GET /api/give-requests, PATCH /api/give-requests/:id)"
```

---

## Task 5: Extend Balance API + Chore Approval Integration

**Files:**
- Modify: `worker/src/routes/finance.ts` (extend balance response)
- Modify: `worker/src/routes/completions.ts` (emit allocation movements on approval)

**Interfaces:**
- Consumes: `getJarConfig`, `getJarBalances` from `../lib/jar-balance.js`

- [ ] **Step 1: Extend `handleBalance` in `worker/src/routes/finance.ts`**

At the top of the file, add the import:

```typescript
import { getJarConfig, getJarBalances } from '../lib/jar-balance.js';
```

In `handleBalance`, after the existing balance computation (before the `return json(...)` call), add:

```typescript
  // Jar balances — only computed when jars are enabled
  const jarConfig   = await getJarConfig(env.DB, family_id, child_id);
  const jarBalances = jarConfig.enabled
    ? await getJarBalances(env.DB, family_id, child_id)
    : null;
```

Extend the return object:

```typescript
  return json({
    earned, pending, reversals, paid_out, spent, available,
    streak, pending_celebrations,
    jars: jarBalances ?? { enabled: false },
  });
```

- [ ] **Step 2: Emit allocation movements in `worker/src/routes/completions.ts`**

At the top of the file, add the import:

```typescript
import { getJarConfig } from '../lib/jar-balance.js';
```

In `handleCompletionApprove` (the function that does the `env.DB.batch([INSERT INTO ledger, UPDATE completions])` around line 212), immediately **after** the `await env.DB.batch([...])` ledger write and before the gamification hook, add:

```typescript
  // ── Jar allocation hook ────────────────────────────────────────────────────
  // Emit allocation jar_movements if the child has jars enabled.
  // Runs outside the ledger batch — non-critical, never blocks the approval.
  try {
    const jarCfg = await getJarConfig(env.DB, comp.family_id, comp.child_id);
    if (jarCfg.enabled) {
      const credit = comp.reward_amount;
      const spendAmt = Math.floor(credit * jarCfg.spend_pct / 100);
      const saveAmt  = Math.floor(credit * jarCfg.save_pct  / 100);
      const giveAmt  = credit - spendAmt - saveAmt; // remainder always to give, then swap
      // Remainder to spend (per spec: rounding goes to Spend)
      const spendFinal = credit - saveAmt - giveAmt;

      const allocations: [string, number][] = [
        ['spend', spendFinal],
        ['save',  saveAmt],
        ['give',  giveAmt],
      ].filter(([, amt]) => (amt as number) > 0) as [string, number][];

      if (allocations.length > 0) {
        await env.DB.batch(
          allocations.map(([jar, amt]) =>
            env.DB.prepare(`
              INSERT INTO jar_movements (family_id,child_id,jar,delta,kind,ref_id,created_at)
              VALUES (?,?,?,?,'allocation',?,?)
            `).bind(comp.family_id, comp.child_id, jar, amt, String(newLedgerId), now)
          )
        );
      }
    }
  } catch (e) {
    console.error('[jar allocation] non-critical failure:', e);
  }
  // ── End jar allocation hook ────────────────────────────────────────────────
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd "e:/Web-Video Design/Claude/Apps/Pocket Money/worker"
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Manual smoke test**

```
1. Start dev server: npm run dev (in worker directory)
2. Approve a chore via the app (or curl the completions endpoint)
3. Query: SELECT * FROM jar_movements WHERE kind='allocation' ORDER BY id DESC LIMIT 3;
   Expected: 3 rows (spend/save/give) with deltas summing to the chore reward amount
4. GET /api/balance — verify response includes "jars": { "enabled": true, "spend": X, ... }
```

- [ ] **Step 5: Commit**

```bash
git add worker/src/routes/finance.ts worker/src/routes/completions.ts
git commit -m "feat: extend balance API with jars key; emit allocation movements on chore approval"
```

---

## Task 6: Goals Integration

**Files:**
- Modify: `worker/src/routes/goals.ts`

**Interfaces:**
- Consumes: `getJarConfig`, `getJarBalances` from `../lib/jar-balance.js`

- [ ] **Step 1: Add import to `worker/src/routes/goals.ts`**

```typescript
import { getJarConfig, getJarBalances } from '../lib/jar-balance.js';
```

- [ ] **Step 2: Extend `contributeToGoal` handler to write `goal_allocate` movement**

Find the `POST /api/goals/:id/contribute` handler. After the DB update that increments `current_saved_pence`, add:

```typescript
  // Write goal_allocate movement if jars are enabled
  try {
    const jarCfg = await getJarConfig(env.DB, goal.family_id, goal.child_id);
    if (jarCfg.enabled) {
      const now = Math.floor(Date.now() / 1000);
      await env.DB
        .prepare(`INSERT INTO jar_movements (family_id,child_id,jar,delta,earmark_pence,kind,goal_id,created_at) VALUES (?,?,'save',0,?,'goal_allocate',?,?)`)
        .bind(goal.family_id, goal.child_id, amount_pence, goal.id, now)
        .run();
    }
  } catch (e) {
    console.error('[goal_allocate] non-critical:', e);
  }
```

- [ ] **Step 3: Extend goal archive/delete to write `goal_deallocate` movement**

Find the goal PATCH or DELETE handler that sets `status='ARCHIVED'` or `archived=1`. After that update, add:

```typescript
  // Deallocate earmarked Save balance back to unallocated when goal is archived
  try {
    const jarCfg = await getJarConfig(env.DB, goal.family_id, goal.child_id);
    if (jarCfg.enabled && goal.current_saved_pence > 0) {
      const now = Math.floor(Date.now() / 1000);
      await env.DB
        .prepare(`INSERT INTO jar_movements (family_id,child_id,jar,delta,earmark_pence,kind,goal_id,created_at) VALUES (?,?,'save',0,?,'goal_deallocate',?,?)`)
        .bind(goal.family_id, goal.child_id, goal.current_saved_pence, goal.id, now)
        .run();
    }
  } catch (e) {
    console.error('[goal_deallocate] non-critical:', e);
  }
```

- [ ] **Step 4: Extend `purchaseGoal` handler to write `goal_purchase` movement**

Find the `POST /api/goals/:id/purchase` handler. After the spending record insert, add:

```typescript
  // Draw from Save jar when jars enabled
  try {
    const jarCfg = await getJarConfig(env.DB, goal.family_id, goal.child_id);
    if (jarCfg.enabled) {
      const balances = await getJarBalances(env.DB, goal.family_id, goal.child_id);
      // Backend guard: reject if Save jar can't cover the purchase
      if (balances.save < goal.target_amount) {
        // Non-critical: allow purchase but log the discrepancy
        console.warn('[goal_purchase] Save jar insufficient; purchase allowed but jar balance may go negative');
      }
      const now = Math.floor(Date.now() / 1000);
      await env.DB
        .prepare(`INSERT INTO jar_movements (family_id,child_id,jar,delta,kind,goal_id,created_at) VALUES (?,?,'save',?,'goal_purchase',?,?)`)
        .bind(goal.family_id, goal.child_id, -goal.target_amount, goal.id, now)
        .run();
    }
  } catch (e) {
    console.error('[goal_purchase] non-critical:', e);
  }
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd "e:/Web-Video Design/Claude/Apps/Pocket Money/worker"
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add worker/src/routes/goals.ts
git commit -m "feat: goals integration — goal_allocate / goal_deallocate / goal_purchase jar movements"
```

---

## Task 7: Insights Integration

**Files:**
- Modify: `worker/src/routes/insights.ts`

**Interfaces:**
- Consumes: `computeJarSignals` from `../lib/jar-balance.js`

- [ ] **Step 1: Add import**

```typescript
import { computeJarSignals } from '../lib/jar-balance.js';
```

- [ ] **Step 2: Compute jar signals and include in snapshot**

In `handleInsights`, find the weekly snapshot INSERT block (around line 271 — `if (!snapshotExists)`). Before that block, add signal computation:

```typescript
  // Jar signals for this week
  const jarSignals = await computeJarSignals(env.DB, effectiveChildId, family_id, now).catch(() => null);
```

Extend the snapshot INSERT to include `jar_snapshot`:

```typescript
  if (!snapshotExists) {
    await env.DB.prepare(`
      INSERT OR IGNORE INTO insight_snapshots
        (child_id, family_id, snapshot_date, consistency_score, responsibility_score,
         planning_horizon, total_earned_pence, jar_snapshot)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      effectiveChildId,
      family_id,
      weekKey,
      consistencyScore,
      firstTimePassRate,
      planningHorizon,
      lifetimeEarned,
      jarSignals ? JSON.stringify(jarSignals) : null,
    ).run();
  }
```

- [ ] **Step 3: Compute streak metrics from snapshot history and add to jar signals**

After the `priorSnapshot` query (around line 247), add:

```typescript
  // weeks_at_current_deviation and positive_streak_weeks from snapshot history
  let weeksAtCurrentDeviation = 0;
  let positiveStreakWeeks = 0;
  if (jarSignals) {
    const snapHistory = await env.DB
      .prepare(`SELECT jar_snapshot FROM insight_snapshots WHERE child_id=? AND snapshot_date!=? ORDER BY snapshot_date DESC LIMIT 8`)
      .bind(effectiveChildId, weekKey)
      .all<{ jar_snapshot: string | null }>();

    for (const snap of snapHistory.results) {
      if (!snap.jar_snapshot) break;
      const prev = JSON.parse(snap.jar_snapshot) as { deviation_score?: number; positive_streak_weeks?: number };
      if ((prev.deviation_score ?? 100) > 25) weeksAtCurrentDeviation++;
      else break;
    }
    for (const snap of snapHistory.results) {
      if (!snap.jar_snapshot) break;
      const prev = JSON.parse(snap.jar_snapshot) as { deviation_score?: number };
      if ((prev.deviation_score ?? 100) <= 25) positiveStreakWeeks++;
      else break;
    }
    jarSignals.weeks_at_current_deviation = weeksAtCurrentDeviation;
    jarSignals.positive_streak_weeks = positiveStreakWeeks;
  }
```

- [ ] **Step 4: Extend AI briefing prompt with jar paragraph**

In `handleInsights`, find where the AI briefing user message string is constructed (around line 1268). Before the closing of the user message, add a jar behaviour paragraph when jar signals exist:

```typescript
  // Signal 9: readiness nudge fires when jars are off + balance has been building 3+ weeks
  let jarParagraph = '';
  if (jarSignals) {
    if (jarSignals.enabled) {
      jarParagraph = buildJarBriefingParagraph(jarSignals);
    } else {
      // Check if child has been earning consistently (balance > 500p, 3+ weeks of history)
      const hasBuiltBalance = (available_balance_pence ?? 0) > 500 && (weeksOfHistory ?? 0) >= 3;
      if (hasBuiltBalance) {
        jarParagraph = buildJarReadinessNudge(jarSignals);
      }
    }
  }
```

Add this helper function at the bottom of `insights.ts`:

```typescript
function buildJarBriefingParagraph(s: {
  save_raids: number; give_balance_age_days: number; weeks_at_current_deviation: number;
  auto_off_weeks: number; manual_move_count: number; give_pct: number;
  deviation_score: number; positive_streak_weeks: number; spend_pct: number; save_pct: number;
}): string {
  const lines: string[] = ['JAR ALLOCATION DATA (Spend/Save/Give feature):'];
  // Priority 1
  if (s.save_raids >= 2) lines.push(`⚠ SAVE-JAR RAIDING: ${s.save_raids} moves from Save to Spend this week. Child's savings goal may be at risk.`);
  // Priority 2
  if (s.give_balance_age_days >= 21) lines.push(`⚠ GIVE-JAR STAGNATION: Give balance has sat untouched for ${s.give_balance_age_days} days. Child may need a prompt to follow through on giving.`);
  // Priority 3
  if (s.weeks_at_current_deviation >= 3 && s.deviation_score > 25) lines.push(`⚠ PERSISTENT DEVIATION: Allocation has been more than 25 points from the ideal 70/20/10 split for ${s.weeks_at_current_deviation} consecutive weeks.`);
  // Priority 4
  if (s.auto_off_weeks >= 2) lines.push(`⚠ AUTO-ALLOCATION DORMANT: Auto-split has been off for ${s.auto_off_weeks} weeks. The habit may be lapsing.`);
  // Priority 5
  if (s.manual_move_count >= 4) lines.push(`NOTE: ${s.manual_move_count} manual jar moves this week — possible indecision or gaming.`);
  // Priority 6
  if (s.give_pct === 0 && s.weeks_at_current_deviation >= 4) lines.push(`NOTE: Give jar set to 0% for 4+ weeks. Mention gently — autonomy is respected.`);
  // Priority 10 (positive)
  if (s.positive_streak_weeks >= 3) lines.push(`✓ POSITIVE STREAK: On-target 70/20/10 split maintained for ${s.positive_streak_weeks} consecutive weeks — celebrate this.`);

  // Priority 7: impulse/hoarding (only when earning was active)
  // Hoarding only fires when there were allocation movements (earning occurred)
  if (s.manual_move_count === 0 && s.save_raids === 0 && s.auto_off_weeks === 0) {
    // Check if Spend drained fast or not touched is handled via jar_snapshot history in the briefing
    // Leave as a note for the AI to interpret from raw numbers
  }
  // Priority 8: disengagement (distinct from never having enabled)
  if (!s.enabled && s.auto_off_weeks >= 3 && s.auto_off_weeks < 99) {
    lines.push(`⚠ HABIT DISENGAGEMENT: Child turned off auto-allocation ${s.auto_off_weeks} weeks ago and has not re-enabled it.`);
  }

  if (lines.length === 1) lines.push('No jar behaviour signals this week.');
  return lines.join('\n');
}

function buildJarReadinessNudge(s: { enabled: boolean; deviation_score: number }): string {
  // Signal 9: fires when jars are OFF and balance has been building (checked in insights route)
  return 'JAR READINESS NUDGE: This child has been earning consistently but has not yet enabled the Spend/Save/Give jar split. This might be a good week to suggest it — let them choose their own percentages.';
}
```

Append `jarParagraph` to the user message string passed to the AI.

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd "e:/Web-Video Design/Claude/Apps/Pocket Money/worker"
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add worker/src/routes/insights.ts
git commit -m "feat: jar signals in weekly insight_snapshot + AI briefing paragraph"
```

---

## Task 8: App API Client

**Files:**
- Modify: `app/src/lib/api.ts`

- [ ] **Step 1: Add jar types and fetch functions to `app/src/lib/api.ts`**

After the `BalanceSummary` interface (line ~619), add:

```typescript
// ----------------------------------------------------------------
// Jars
// ----------------------------------------------------------------
export interface JarConfig {
  enabled: number;
  spend_pct: number;
  save_pct: number;
  give_pct: number;
  updated_at: number;
}

export interface JarBalances {
  enabled: boolean;
  spend: number;
  save: number;
  give: number;
  save_earmarked: number;
  save_unallocated: number;
}

export interface JarMovement {
  id: number;
  jar: 'spend' | 'save' | 'give';
  delta: number;
  earmark_pence: number | null;
  kind: string;
  ref_id: string | null;
  goal_id: number | null;
  note: string | null;
  created_at: number;
}

export interface GiveRequest {
  id: number;
  family_id: string;
  child_id: string;
  child_name?: string;
  cause: string;
  amount: number;
  currency: string;
  status: 'requested' | 'fulfilled' | 'declined';
  requested_at: number;
  fulfilled_at: number | null;
  parent_note: string | null;
}

export async function getJars(family_id: string, child_id: string): Promise<{ config: JarConfig; balances: JarBalances }> {
  return request(`/api/jars?family_id=${family_id}&child_id=${child_id}`);
}

export async function putJarConfig(body: {
  family_id: string; child_id: string;
  enabled?: number; spend_pct?: number; save_pct?: number; give_pct?: number;
  initial_seed?: { spend: number; save: number; give: number };
}): Promise<{ ok: boolean; balances: JarBalances }> {
  return request('/api/jars/config', { method: 'PUT', body: JSON.stringify(body) });
}

export async function postJarMove(body: {
  family_id: string; child_id: string;
  from_jar: 'spend' | 'save' | 'give'; to_jar: 'spend' | 'save' | 'give'; amount: number;
}): Promise<{ ok: boolean; balances: JarBalances }> {
  return request('/api/jars/move', { method: 'POST', body: JSON.stringify(body) });
}

export async function getJarMovements(family_id: string, child_id: string, limit = 20): Promise<{ movements: JarMovement[] }> {
  return request(`/api/jars/movements?family_id=${family_id}&child_id=${child_id}&limit=${limit}`);
}

export async function postGiveRequest(body: {
  family_id: string; child_id: string; cause: string; amount: number;
}): Promise<{ ok: boolean; id: number }> {
  return request('/api/give-requests', { method: 'POST', body: JSON.stringify(body) });
}

export async function getGiveRequests(family_id: string, status = 'requested'): Promise<{ give_requests: GiveRequest[] }> {
  return request(`/api/give-requests?family_id=${family_id}&status=${status}`);
}

export async function patchGiveRequest(id: number, action: 'fulfil' | 'decline', parent_note?: string): Promise<{ ok: boolean; status: string }> {
  return request(`/api/give-requests/${id}`, { method: 'PATCH', body: JSON.stringify({ action, parent_note }) });
}
```

Also extend the `BalanceSummary` interface to include the optional jars key:

```typescript
export interface BalanceSummary {
  earned: number; pending: number; reversals: number;
  paid_out: number; spent: number; available: number;
  streak?: BalanceStreak;
  pending_celebrations?: string[];
  jars?: { enabled: boolean; spend?: number; save?: number; give?: number };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "e:/Web-Video Design/Claude/Apps/Pocket Money/app"
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/src/lib/api.ts
git commit -m "feat: jar + give-request API client types and fetch functions"
```

---

## Task 9: Premium SVG Jar Icons

**Files:**
- Create: `app/src/components/icons/SpendJarIcon.tsx`
- Create: `app/src/components/icons/SaveJarIcon.tsx`
- Create: `app/src/components/icons/GiveJarIcon.tsx`

All icons: 40×40 viewBox, ~1.5px stroke, teal (#0d9488) + gold (#d97706), no fill except subtle linework gradient.

- [ ] **Step 1: Create `SpendJarIcon.tsx`** — open hand, palm up

```tsx
interface IconProps { size?: number; className?: string }

export function SpendJarIcon({ size = 40, className }: IconProps) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 40 40"
      fill="none" xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Palm base */}
      <path
        d="M10 26 C10 26 8 24 8 21 L8 18 C8 16.9 8.9 16 10 16 C11.1 16 12 16.9 12 18 L12 20"
        stroke="#0d9488" strokeWidth="1.5" strokeLinecap="round"
      />
      {/* Fingers */}
      <path d="M12 20 L12 13 C12 11.9 12.9 11 14 11 C15.1 11 16 11.9 16 13 L16 20" stroke="#0d9488" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M16 20 L16 12 C16 10.9 16.9 10 18 10 C19.1 10 20 10.9 20 12 L20 20" stroke="#0d9488" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M20 20 L20 13 C20 11.9 20.9 11 22 11 C23.1 11 24 11.9 24 13 L24 20" stroke="#0d9488" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M24 20 L24 16 C24 14.9 24.9 14 26 14 C27.1 14 28 14.9 28 16 L28 22 C28 25 26 28 22 29 L14 29 C12 29 10 27.5 10 26" stroke="#0d9488" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      {/* Teal accent line on wrist */}
      <path d="M10 26 L28 26" stroke="#d97706" strokeWidth="1.5" strokeLinecap="round" opacity="0.7"/>
    </svg>
  );
}
```

- [ ] **Step 2: Create `SaveJarIcon.tsx`** — acorn/seedling in a vessel

```tsx
interface IconProps { size?: number; className?: string }

export function SaveJarIcon({ size = 40, className }: IconProps) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 40 40"
      fill="none" xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Vessel / jar body */}
      <path
        d="M13 20 L13 30 C13 31.1 13.9 32 15 32 L25 32 C26.1 32 27 31.1 27 30 L27 20"
        stroke="#0d9488" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      />
      {/* Vessel neck */}
      <path d="M16 20 L16 18 L24 18 L24 20" stroke="#0d9488" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      {/* Rim */}
      <path d="M14 20 L26 20" stroke="#0d9488" strokeWidth="1.5" strokeLinecap="round"/>
      {/* Seedling stem */}
      <path d="M20 26 L20 16" stroke="#d97706" strokeWidth="1.5" strokeLinecap="round"/>
      {/* Seedling leaves */}
      <path d="M20 20 C20 20 17 18 16 14 C18.5 14 20 16 20 20" fill="#d97706" opacity="0.7"/>
      <path d="M20 19 C20 19 23 17 24 13 C21.5 13 20 15.5 20 19" fill="#d97706" opacity="0.5"/>
    </svg>
  );
}
```

- [ ] **Step 3: Create `GiveJarIcon.tsx`** — two cupped hands

```tsx
interface IconProps { size?: number; className?: string }

export function GiveJarIcon({ size = 40, className }: IconProps) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 40 40"
      fill="none" xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Left hand / arm */}
      <path
        d="M8 28 C8 28 8 24 10 22 L14 18 C14 18 15 17 16 18 L18 20"
        stroke="#d97706" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      />
      {/* Right hand / arm */}
      <path
        d="M32 28 C32 28 32 24 30 22 L26 18 C26 18 25 17 24 18 L22 20"
        stroke="#d97706" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      />
      {/* Cupped bowl */}
      <path
        d="M18 20 L22 20 L24 24 C24 26 22 28 20 28 C18 28 16 26 16 24 Z"
        stroke="#d97706" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      />
      {/* Small gift/heart above */}
      <path
        d="M18 15 C18 13.3 19 12 20 12 C21 12 22 13.3 22 15 L20 18 Z"
        stroke="#0d9488" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
        opacity="0.8"
      />
    </svg>
  );
}
```

- [ ] **Step 4: Verify they render** — start the dev server and add a quick visual check by temporarily importing one icon into any existing component, then remove.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/icons/SpendJarIcon.tsx app/src/components/icons/SaveJarIcon.tsx app/src/components/icons/GiveJarIcon.tsx
git commit -m "feat: premium SVG jar icons (SpendJarIcon, SaveJarIcon, GiveJarIcon)"
```

---

## Task 10: JarCard Component + Money Tab Transformation

**Files:**
- Create: `app/src/components/dashboard/JarCard.tsx`
- Modify: `app/src/components/dashboard/ChildMoneyTab.tsx`

- [ ] **Step 1: Create `app/src/components/dashboard/JarCard.tsx`**

```tsx
import { SpendJarIcon } from '../icons/SpendJarIcon';
import { SaveJarIcon  } from '../icons/SaveJarIcon';
import { GiveJarIcon  } from '../icons/GiveJarIcon';
import type { JarBalances } from '../../lib/api';

type JarType = 'spend' | 'save' | 'give';

const JAR_LABELS: Record<JarType, string> = {
  spend: 'Spend',
  save:  'Save',
  give:  'Give',
};

const JAR_ICONS: Record<JarType, React.ComponentType<{ size?: number; className?: string }>> = {
  spend: SpendJarIcon,
  save:  SaveJarIcon,
  give:  GiveJarIcon,
};

interface JarCardProps {
  jar: JarType;
  balances: JarBalances;
  currency: string;
  onClick: (jar: JarType) => void;
}

function formatCurrency(pence: number, currency: string): string {
  const amount = pence / 100;
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount);
}

export function JarCard({ jar, balances, currency, onClick }: JarCardProps) {
  const Icon    = JAR_ICONS[jar];
  const label   = JAR_LABELS[jar];
  const balance = balances[jar];

  return (
    <button
      onClick={() => onClick(jar)}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        padding: '16px 12px',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16,
        cursor: 'pointer',
        transition: 'background 0.15s',
        minWidth: 0,
      }}
    >
      <Icon size={36} />
      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontFamily: 'Manrope', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {label}
      </span>
      <span style={{ fontSize: 18, fontWeight: 700, fontFamily: 'Manrope', color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
        {formatCurrency(balance, currency)}
      </span>
    </button>
  );
}
```

- [ ] **Step 2: Modify `app/src/components/dashboard/ChildMoneyTab.tsx`**

At the top, add imports:

```tsx
import { JarCard } from './JarCard';
import { getJars, type JarBalances } from '../../lib/api';
```

Add state near the top of the component:

```tsx
const [jarBalances, setJarBalances] = useState<JarBalances | null>(null);
const [activeJar, setActiveJar]     = useState<'spend'|'save'|'give'|null>(null);
```

In the existing `useEffect` or data-fetch function, add:

```tsx
  getJars(familyId, userId).then(({ balances }) => {
    if (balances.enabled) setJarBalances(balances);
  }).catch(() => {});
```

Replace the hero "Available to spend" card with conditional rendering. Find the hero card JSX and wrap it:

```tsx
{jarBalances?.enabled ? (
  <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
    <JarCard jar="spend" balances={jarBalances} currency={currency} onClick={setActiveJar} />
    <JarCard jar="save"  balances={jarBalances} currency={currency} onClick={setActiveJar} />
    <JarCard jar="give"  balances={jarBalances} currency={currency} onClick={setActiveJar} />
  </div>
) : (
  /* existing hero card JSX unchanged */
  <div>...</div>
)}
```

Also add a cog settings button in the Money tab header (next to the tab title). Add a `showSettings` state and wire it to a `JarSettingsSheet` (built in Task 12):

```tsx
const [showSettings, setShowSettings] = useState(false);
```

Header JSX addition:
```tsx
<button onClick={() => setShowSettings(true)} style={{ ... }}>⚙</button>
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd "e:/Web-Video Design/Claude/Apps/Pocket Money/app"
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add app/src/components/dashboard/JarCard.tsx app/src/components/dashboard/ChildMoneyTab.tsx
git commit -m "feat: JarCard component; ChildMoneyTab renders jar cards when enabled"
```

---

## Task 11: Jar Detail Sheet

**Files:**
- Create: `app/src/components/dashboard/JarDetailSheet.tsx`
- Modify: `app/src/components/dashboard/ChildMoneyTab.tsx` (mount sheet)

- [ ] **Step 1: Create `app/src/components/dashboard/JarDetailSheet.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { getJarMovements, postJarMove, type JarMovement, type JarBalances } from '../../lib/api';
import { SpendJarIcon } from '../icons/SpendJarIcon';
import { SaveJarIcon  } from '../icons/SaveJarIcon';
import { GiveJarIcon  } from '../icons/GiveJarIcon';

type JarType = 'spend' | 'save' | 'give';

const KIND_LABELS: Record<string, string> = {
  allocation:    'Earned',
  enable_seed:   'Starting balance',
  manual_move:   'Moved',
  spend:         'Spent',
  give_request:  'Gift requested',
  give_fulfilled:'Gift made',
  give_declined: 'Gift returned',
  goal_allocate: 'Saved for goal',
  goal_deallocate:'Goal released',
  goal_purchase: 'Goal bought',
};

const ICONS: Record<JarType, React.ComponentType<{ size?: number }>> = {
  spend: SpendJarIcon, save: SaveJarIcon, give: GiveJarIcon,
};

interface Props {
  jar: JarType;
  balances: JarBalances;
  currency: string;
  familyId: string;
  childId: string;
  onClose: () => void;
  onBalanceChange: (updated: JarBalances) => void;
  onGiveRequest: () => void;
  onViewGoals: () => void;
}

function fmt(pence: number, currency: string) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(pence / 100);
}

export function JarDetailSheet({
  jar, balances, currency, familyId, childId, onClose, onBalanceChange, onGiveRequest, onViewGoals,
}: Props) {
  const [movements, setMovements] = useState<JarMovement[]>([]);
  const [showMove, setShowMove]   = useState(false);
  const [moveTo, setMoveTo]       = useState<JarType>(jar === 'spend' ? 'save' : 'spend');
  const [moveAmt, setMoveAmt]     = useState('');
  const [moveErr, setMoveErr]     = useState('');
  const Icon = ICONS[jar];

  useEffect(() => {
    getJarMovements(familyId, childId, 5).then(({ movements: m }) =>
      setMovements(m.filter(mv => mv.jar === jar))
    ).catch(() => {});
  }, [jar, familyId, childId]);

  async function handleMove() {
    const amount = Math.round(parseFloat(moveAmt) * 100);
    if (!amount || amount <= 0) { setMoveErr('Enter a valid amount'); return; }
    try {
      const { balances: updated } = await postJarMove({ family_id: familyId, child_id: childId, from_jar: jar, to_jar: moveTo, amount });
      onBalanceChange(updated);
      setShowMove(false); setMoveAmt(''); setMoveErr('');
    } catch (e: any) {
      setMoveErr(e?.message ?? 'Could not move money — try again');
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'flex-end',
    }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', background: '#1a2e22', borderRadius: '20px 20px 0 0',
          padding: '24px 20px 40px', fontFamily: 'Manrope',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <Icon size={32} />
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', textTransform: 'capitalize' }}>{jar}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
              {fmt(balances[jar], currency)}
            </div>
          </div>
          <button onClick={onClose} style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        {/* Recent movements */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>RECENT</div>
          {movements.length === 0 && <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>No activity yet</div>}
          {movements.map(m => (
            <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>{KIND_LABELS[m.kind] ?? m.kind}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: m.delta >= 0 ? '#34d399' : '#f87171', fontVariantNumeric: 'tabular-nums' }}>
                {m.delta >= 0 ? '+' : ''}{fmt(m.delta, currency)}
              </span>
            </div>
          ))}
        </div>

        {/* Actions */}
        {!showMove ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button onClick={() => setShowMove(true)} style={actionBtn('#0d9488')}>Move money</button>
            {jar === 'give'  && <button onClick={onGiveRequest} style={actionBtn('#d97706')}>Make a gift</button>}
            {jar === 'save'  && <button onClick={onViewGoals}  style={actionBtn('#d97706')}>My goals</button>}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <select value={moveTo} onChange={e => setMoveTo(e.target.value as JarType)}
              style={{ padding: 12, borderRadius: 10, background: '#0f1a14', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', fontSize: 15 }}>
              {(['spend','save','give'] as JarType[]).filter(j => j !== jar).map(j => (
                <option key={j} value={j}>Move to {j.charAt(0).toUpperCase() + j.slice(1)}</option>
              ))}
            </select>
            <input
              type="number" min="0.01" step="0.01" placeholder="Amount"
              value={moveAmt} onChange={e => setMoveAmt(e.target.value)}
              style={{ padding: 12, borderRadius: 10, background: '#0f1a14', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', fontSize: 15 }}
            />
            {moveErr && <div style={{ color: '#f87171', fontSize: 13 }}>{moveErr}</div>}
            <button onClick={handleMove} style={actionBtn('#0d9488')}>Confirm move</button>
            <button onClick={() => { setShowMove(false); setMoveErr(''); }} style={actionBtn('rgba(255,255,255,0.08)')}>Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}

function actionBtn(bg: string): React.CSSProperties {
  return {
    padding: '14px', borderRadius: 12, background: bg, color: '#fff',
    border: 'none', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'Manrope',
  };
}
```

- [ ] **Step 2: Mount in `ChildMoneyTab.tsx`**

Add import:
```tsx
import { JarDetailSheet } from './JarDetailSheet';
```

Add JSX (conditionally rendered when `activeJar` is set):

```tsx
{activeJar && jarBalances && (
  <JarDetailSheet
    jar={activeJar}
    balances={jarBalances}
    currency={currency}
    familyId={familyId}
    childId={userId}
    onClose={() => setActiveJar(null)}
    onBalanceChange={(updated) => { setJarBalances(updated); setActiveJar(null); }}
    onGiveRequest={() => { setActiveJar(null); setShowGiveRequest(true); }}
    onViewGoals={() => { setActiveJar(null); /* switch to goals tab */ }}
  />
)}
```

Add `showGiveRequest` state: `const [showGiveRequest, setShowGiveRequest] = useState(false);`

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd "e:/Web-Video Design/Claude/Apps/Pocket Money/app"
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add app/src/components/dashboard/JarDetailSheet.tsx app/src/components/dashboard/ChildMoneyTab.tsx
git commit -m "feat: JarDetailSheet — balance, recent movements, move-money form, jar actions"
```

---

## Task 12: Jar Settings Sheet + Onboarding Wizard

**Files:**
- Create: `app/src/components/dashboard/JarSettingsSheet.tsx`
- Create: `app/src/components/dashboard/JarOnboardingWizard.tsx`
- Modify: `app/src/components/dashboard/ChildMoneyTab.tsx` (mount both)

- [ ] **Step 1: Create `app/src/components/dashboard/JarSettingsSheet.tsx`**

```tsx
import { useState } from 'react';
import { putJarConfig, type JarConfig, type JarBalances } from '../../lib/api';

interface Props {
  config: JarConfig;
  familyId: string;
  childId: string;
  onClose: () => void;
  onSaved: (balances: JarBalances) => void;
  onFirstEnable: () => void; // trigger wizard instead of direct save
}

export function JarSettingsSheet({ config, familyId, childId, onClose, onSaved, onFirstEnable }: Props) {
  const [enabled, setEnabled]   = useState(!!config.enabled);
  const [spend, setSpend]       = useState(config.spend_pct);
  const [save,  setSave]        = useState(config.save_pct);
  const [give,  setGive]        = useState(config.give_pct);
  const [saving, setSaving]     = useState(false);
  const [err, setErr]           = useState('');

  const sum = spend + save + give;
  const showSavingWarn = save < 20;
  const showGiveWarn   = give === 0;

  async function handleSave() {
    if (sum !== 100) { setErr('Percentages must add up to 100'); return; }
    // If enabling for first time, open wizard instead
    if (enabled && !config.enabled) { onFirstEnable(); return; }
    setSaving(true);
    try {
      const { balances } = await putJarConfig({ family_id: familyId, child_id: childId, enabled: enabled ? 1 : 0, spend_pct: spend, save_pct: save, give_pct: give });
      onSaved(balances);
    } catch (e: any) {
      setErr(e?.message ?? 'Could not save — try again');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', background: '#1a2e22', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', fontFamily: 'Manrope' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>Jar settings</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        {/* Toggle */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 15 }}>Split my earnings automatically</span>
          <button
            onClick={() => setEnabled(!enabled)}
            style={{ width: 48, height: 28, borderRadius: 14, background: enabled ? '#0d9488' : 'rgba(255,255,255,0.12)', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}
          >
            <span style={{ position: 'absolute', top: 3, left: enabled ? 22 : 3, width: 22, height: 22, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
          </button>
        </div>

        {/* Percentage steppers */}
        {enabled && (
          <>
            {[['Spend', spend, setSpend], ['Save', save, setSave], ['Give', give, setGive]].map(([label, val, setter]) => (
              <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 15 }}>{label as string}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button onClick={() => (setter as (v: number) => void)(Math.max(0, (val as number) - 5))} style={stepBtn}>−</button>
                  <span style={{ color: '#fff', fontSize: 16, fontWeight: 700, width: 36, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{val as number}%</span>
                  <button onClick={() => (setter as (v: number) => void)(Math.min(100, (val as number) + 5))} style={stepBtn}>+</button>
                </div>
              </div>
            ))}
            <div style={{ fontSize: 13, color: sum === 100 ? '#34d399' : '#f87171', marginBottom: 16, fontVariantNumeric: 'tabular-nums' }}>
              Total: {sum}% {sum !== 100 ? '— must equal 100' : '✓'}
            </div>
            {showSavingWarn && <div style={{ fontSize: 13, color: '#fbbf24', marginBottom: 8 }}>Saving less than 20% makes it hard to reach your goals.</div>}
            {showGiveWarn   && <div style={{ fontSize: 13, color: '#fbbf24', marginBottom: 8 }}>Setting Give to 0% means nothing goes to others — that's your call.</div>}
          </>
        )}

        {err && <div style={{ color: '#f87171', fontSize: 13, marginBottom: 12 }}>{err}</div>}

        <button onClick={handleSave} disabled={saving || sum !== 100}
          style={{ width: '100%', padding: 14, borderRadius: 12, background: '#0d9488', color: '#fff', border: 'none', fontSize: 15, fontWeight: 600, cursor: 'pointer', opacity: sum !== 100 ? 0.5 : 1 }}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}

const stepBtn: React.CSSProperties = {
  width: 32, height: 32, borderRadius: 8,
  background: 'rgba(255,255,255,0.08)', border: 'none',
  color: '#fff', fontSize: 18, cursor: 'pointer',
};
```

- [ ] **Step 2: Create `app/src/components/dashboard/JarOnboardingWizard.tsx`**

```tsx
import { useState } from 'react';
import { putJarConfig, type JarBalances } from '../../lib/api';
import { SpendJarIcon } from '../icons/SpendJarIcon';
import { SaveJarIcon  } from '../icons/SaveJarIcon';
import { GiveJarIcon  } from '../icons/GiveJarIcon';

interface Props {
  availableBalance: number; // pence — current total to seed
  currency: string;
  familyId: string;
  childId: string;
  spendPct: number; savePct: number; givePct: number; // from settings selection
  onComplete: (balances: JarBalances) => void;
  onCancel: () => void;
}

function fmt(pence: number, currency: string) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(pence / 100);
}

export function JarOnboardingWizard({ availableBalance, currency, familyId, childId, spendPct, savePct, givePct, onComplete, onCancel }: Props) {
  // Allow child to manually adjust the seed split (pre-filled from their chosen percentages)
  const defaultSpend = Math.floor(availableBalance * spendPct / 100);
  const defaultSave  = Math.floor(availableBalance * savePct  / 100);
  const defaultGive  = availableBalance - defaultSpend - defaultSave;

  const [spend, setSpend] = useState(defaultSpend);
  const [save,  setSave]  = useState(defaultSave);
  const [give,  setGive]  = useState(defaultGive);
  const [saving, setSaving] = useState(false);

  // Adjust Give to always keep total == availableBalance
  function setSpendAdj(v: number) { const s = Math.min(v, availableBalance - save); setSpend(Math.max(0,s)); setGive(Math.max(0, availableBalance - Math.max(0,s) - save)); }
  function setSaveAdj(v: number)  { const s = Math.min(v, availableBalance - spend); setSave(Math.max(0,s));  setGive(Math.max(0, availableBalance - spend - Math.max(0,s))); }
  const giveComputed = availableBalance - spend - save;

  async function handleConfirm() {
    setSaving(true);
    try {
      const { balances } = await putJarConfig({
        family_id: familyId, child_id: childId,
        enabled: 1, spend_pct: spendPct, save_pct: savePct, give_pct: givePct,
        initial_seed: { spend, save, give: Math.max(0, giveComputed) },
      });
      onComplete(balances);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: '#0f1a14', display: 'flex', flexDirection: 'column', padding: '40px 20px', fontFamily: 'Manrope' }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 8 }}>Split your money</div>
      <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)', marginBottom: 32 }}>
        You have {fmt(availableBalance, currency)} — how do you want to split it across your jars?
      </div>

      {([['spend', spend, setSpendAdj, SpendJarIcon], ['save', save, setSaveAdj, SaveJarIcon], ['give', giveComputed, null, GiveJarIcon]] as const).map(([jar, val, setter, Icon]) => (
        <div key={jar} style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
          <Icon size={32} />
          <div style={{ flex: 1 }}>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, textTransform: 'capitalize', marginBottom: 4 }}>{jar}</div>
            {setter ? (
              <input
                type="number" min="0" step="1"
                value={(val / 100).toFixed(2)}
                onChange={e => setter(Math.round(parseFloat(e.target.value || '0') * 100))}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 16, fontVariantNumeric: 'tabular-nums' }}
              />
            ) : (
              <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.4)', fontSize: 16, fontVariantNumeric: 'tabular-nums' }}>
                {fmt(Math.max(0, val), currency)} (remainder)
              </div>
            )}
          </div>
        </div>
      ))}

      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginBottom: 24 }}>
        Total: {fmt(spend + save + Math.max(0, giveComputed), currency)}
        {spend + save + Math.max(0, giveComputed) !== availableBalance && ' — adjust to match your balance'}
      </div>

      <button onClick={handleConfirm} disabled={saving || giveComputed < 0}
        style={{ padding: 16, borderRadius: 14, background: '#0d9488', color: '#fff', border: 'none', fontSize: 16, fontWeight: 700, cursor: 'pointer', marginBottom: 12 }}>
        {saving ? 'Setting up…' : 'Start splitting my money'}
      </button>
      <button onClick={onCancel} style={{ padding: 14, borderRadius: 14, background: 'none', color: 'rgba(255,255,255,0.4)', border: 'none', fontSize: 15, cursor: 'pointer' }}>
        Cancel
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Wire into `ChildMoneyTab.tsx`**

Add imports:
```tsx
import { JarSettingsSheet   } from './JarSettingsSheet';
import { JarOnboardingWizard } from './JarOnboardingWizard';
import { getJars, type JarConfig } from '../../lib/api';
```

Add state:
```tsx
const [jarConfig, setJarConfig]   = useState<JarConfig | null>(null);
const [showWizard, setShowWizard] = useState(false);
const [pendingConfig, setPendingConfig] = useState<{ spend: number; save: number; give: number } | null>(null);
```

Update data fetch to also capture config:
```tsx
getJars(familyId, userId).then(({ config, balances }) => {
  setJarConfig(config);
  if (balances.enabled) setJarBalances(balances);
}).catch(() => {});
```

Add sheets to JSX (after existing sheet mounts):
```tsx
{showSettings && jarConfig && (
  <JarSettingsSheet
    config={jarConfig}
    familyId={familyId}
    childId={userId}
    onClose={() => setShowSettings(false)}
    onSaved={(b) => { setJarBalances(b); setShowSettings(false); }}
    onFirstEnable={() => {
      setPendingConfig({ spend: jarConfig.spend_pct, save: jarConfig.save_pct, give: jarConfig.give_pct });
      setShowSettings(false);
      setShowWizard(true);
    }}
  />
)}
{showWizard && pendingConfig && (
  <JarOnboardingWizard
    availableBalance={balance?.available ?? 0}
    currency={currency}
    familyId={familyId}
    childId={userId}
    spendPct={pendingConfig.spend}
    savePct={pendingConfig.save}
    givePct={pendingConfig.give}
    onComplete={(b) => { setJarBalances(b); setShowWizard(false); }}
    onCancel={() => setShowWizard(false)}
  />
)}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd "e:/Web-Video Design/Claude/Apps/Pocket Money/app"
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add app/src/components/dashboard/JarSettingsSheet.tsx app/src/components/dashboard/JarOnboardingWizard.tsx app/src/components/dashboard/ChildMoneyTab.tsx
git commit -m "feat: JarSettingsSheet + JarOnboardingWizard (first-enable split wizard)"
```

---

## Task 13: Give Request Flow (Child) + Give Requests Panel (Parent)

**Files:**
- Create: `app/src/components/dashboard/GiveRequestSheet.tsx`
- Create: `app/src/components/dashboard/GiveRequestsPanel.tsx`
- Modify: `app/src/components/dashboard/ChildMoneyTab.tsx` (mount GiveRequestSheet)
- Modify: `app/src/screens/ParentDashboard.tsx` (mount GiveRequestsPanel)

- [ ] **Step 1: Create `app/src/components/dashboard/GiveRequestSheet.tsx`**

```tsx
import { useState } from 'react';
import { postGiveRequest, type JarBalances } from '../../lib/api';

interface Props {
  giveBalance: number;
  currency: string;
  familyId: string;
  childId: string;
  onClose: () => void;
  onSubmitted: () => void;
}

function fmt(pence: number, currency: string) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(pence / 100);
}

export function GiveRequestSheet({ giveBalance, currency, familyId, childId, onClose, onSubmitted }: Props) {
  const [cause, setCause]   = useState('');
  const [amt, setAmt]       = useState('');
  const [err, setErr]       = useState('');
  const [done, setDone]     = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    const amount = Math.round(parseFloat(amt) * 100);
    if (!cause.trim()) { setErr('Tell us what this is for'); return; }
    if (cause.length > 60) { setErr('Keep it under 60 characters'); return; }
    if (!amount || amount <= 0) { setErr('Enter a valid amount'); return; }
    if (amount > giveBalance) { setErr(`You only have ${fmt(giveBalance, currency)} in your Give jar`); return; }
    setSaving(true);
    try {
      await postGiveRequest({ family_id: familyId, child_id: childId, cause: cause.trim(), amount });
      setDone(true);
    } catch (e: any) {
      setErr(e?.message ?? 'Something went wrong — try again');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', background: '#1a2e22', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', fontFamily: 'Manrope' }}>
        {done ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 8 }}>Gift request sent!</div>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginBottom: 24 }}>Your parent will make the donation and let you know.</div>
            <button onClick={() => { onSubmitted(); onClose(); }} style={{ padding: '14px 28px', borderRadius: 12, background: '#0d9488', color: '#fff', border: 'none', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>Done</button>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 4 }}>Make a gift</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 24 }}>
              Give jar: {fmt(giveBalance, currency)} available
            </div>

            <label style={{ display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: 13, marginBottom: 6 }}>What is it for?</label>
            <input
              type="text" maxLength={60} placeholder="e.g. Cancer Research, school fundraiser…"
              value={cause} onChange={e => setCause(e.target.value)}
              style={{ width: '100%', padding: '12px', borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 15, marginBottom: 4, boxSizing: 'border-box' }}
            />
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 20, textAlign: 'right' }}>{cause.length}/60</div>

            <label style={{ display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: 13, marginBottom: 6 }}>Amount</label>
            <input
              type="number" min="0.01" step="0.01" placeholder="0.00"
              value={amt} onChange={e => setAmt(e.target.value)}
              style={{ width: '100%', padding: '12px', borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 15, marginBottom: 20, boxSizing: 'border-box' }}
            />

            {err && <div style={{ color: '#f87171', fontSize: 13, marginBottom: 12 }}>{err}</div>}

            <button onClick={handleSubmit} disabled={saving}
              style={{ width: '100%', padding: 14, borderRadius: 12, background: '#d97706', color: '#fff', border: 'none', fontSize: 15, fontWeight: 600, cursor: 'pointer', marginBottom: 10 }}>
              {saving ? 'Sending…' : 'Send request to parent'}
            </button>
            <button onClick={onClose} style={{ width: '100%', padding: 12, borderRadius: 12, background: 'none', color: 'rgba(255,255,255,0.4)', border: 'none', fontSize: 14, cursor: 'pointer' }}>Cancel</button>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Mount `GiveRequestSheet` in `ChildMoneyTab.tsx`**

Add import:
```tsx
import { GiveRequestSheet } from './GiveRequestSheet';
```

Add JSX (after JarDetailSheet mount):
```tsx
{showGiveRequest && jarBalances && (
  <GiveRequestSheet
    giveBalance={jarBalances.give}
    currency={currency}
    familyId={familyId}
    childId={userId}
    onClose={() => setShowGiveRequest(false)}
    onSubmitted={() => setShowGiveRequest(false)}
  />
)}
```

- [ ] **Step 3: Create `app/src/components/dashboard/GiveRequestsPanel.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { getGiveRequests, patchGiveRequest, type GiveRequest } from '../../lib/api';

interface Props { familyId: string }

function fmt(pence: number, currency: string) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(pence / 100);
}

export function GiveRequestsPanel({ familyId }: Props) {
  const [requests, setRequests] = useState<GiveRequest[]>([]);
  const [noteMap,  setNoteMap]  = useState<Record<number, string>>({});

  useEffect(() => {
    getGiveRequests(familyId, 'requested').then(({ give_requests }) => setRequests(give_requests)).catch(() => {});
  }, [familyId]);

  async function resolve(id: number, action: 'fulfil' | 'decline') {
    await patchGiveRequest(id, action, noteMap[id]);
    setRequests(prev => prev.filter(r => r.id !== id));
  }

  if (requests.length === 0) return null;

  return (
    <div style={{ marginBottom: 24, fontFamily: 'Manrope' }}>
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        Gift requests
      </div>
      {requests.map(r => (
        <div key={r.id} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 16, marginBottom: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ color: '#fff', fontWeight: 600, fontSize: 15 }}>{r.child_name}</span>
            <span style={{ color: '#d97706', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmt(r.amount, r.currency)}</span>
          </div>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, marginBottom: 12 }}>"{r.cause}"</div>
          <input
            type="text" placeholder="Add a note (optional)"
            value={noteMap[r.id] ?? ''}
            onChange={e => setNoteMap(prev => ({ ...prev, [r.id]: e.target.value }))}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 13, marginBottom: 10, boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => resolve(r.id, 'fulfil')}
              style={{ flex: 1, padding: 10, borderRadius: 8, background: '#d97706', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Done — donated
            </button>
            <button onClick={() => resolve(r.id, 'decline')}
              style={{ flex: 1, padding: 10, borderRadius: 8, background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', border: 'none', fontSize: 13, cursor: 'pointer' }}>
              Decline
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Mount in `ParentDashboard.tsx`**

Find the parent dashboard file and locate the approvals / pending section. Add:

```tsx
import { GiveRequestsPanel } from '../components/dashboard/GiveRequestsPanel';
```

Add the component in the JSX alongside existing approval panels:

```tsx
<GiveRequestsPanel familyId={familyId} />
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd "e:/Web-Video Design/Claude/Apps/Pocket Money/app"
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add app/src/components/dashboard/GiveRequestSheet.tsx app/src/components/dashboard/GiveRequestsPanel.tsx app/src/components/dashboard/ChildMoneyTab.tsx app/src/screens/ParentDashboard.tsx
git commit -m "feat: give request flow (child) + give requests panel (parent)"
```

---

## Task 14: Deploy + Smoke Test

- [ ] **Step 1: Apply migrations to production D1**

```bash
cd "e:/Web-Video Design/Claude/Apps/Pocket Money"
npx wrangler d1 execute morechard-db --remote --file=worker/migrations/0068_jar_config.sql
npx wrangler d1 execute morechard-db --remote --file=worker/migrations/0069_jar_movements.sql
npx wrangler d1 execute morechard-db --remote --file=worker/migrations/0070_give_requests.sql
npx wrangler d1 execute morechard-db --remote --file=worker/migrations/0071_insight_snapshot_jars.sql
```

- [ ] **Step 2: Deploy worker**

```bash
npm run deploy
```

- [ ] **Step 3: Build and deploy app**

```bash
cd app && npm run build
```

Then push to main (Cloudflare Pages auto-deploys on push).

- [ ] **Step 4: End-to-end smoke test checklist**

```
Child flow:
□ Open Money tab — single balance visible (jars off by default)
□ Tap cog → JarSettingsSheet opens
□ Toggle on auto-split → wizard appears with current balance
□ Adjust split, tap "Start splitting" → three jar cards appear
□ Tap a jar card → JarDetailSheet opens, shows balance + movements
□ "Move money" → enter amount → balances update correctly
□ Approve a chore → jar cards update (allocation movements written)
□ Tap Give jar → "Make a gift" → fill cause + amount → success
□ Save jar → "My goals" link present

Parent flow:
□ Gift requests panel visible after child submits request
□ "Done — donated" with note → request removed, child Give jar finalised
□ "Decline" → request removed, balance restored in Give jar

Insights:
□ After weekly snapshot runs, jar_snapshot column populated (check D1)
□ AI briefing includes jar paragraph when signals are active
```

- [ ] **Step 5: Final commit**

```bash
git add .
git commit -m "feat: Spend/Save/Give Jars — full feature ship"
git push
```
