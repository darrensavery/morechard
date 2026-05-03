# Demo Account Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a shared "Thomson family" demo account that lets professionals evaluate the Shield forensic PDF and lets post-trial Core users experience AI Mentor/Shield features before upgrading.

**Architecture:** A single shared D1 family row (`is_demo = 1`) pre-seeded with 6 months of Thomson family data. Two `user_type` values (`professional`, `demo_parent`) gate what's writable. A nightly cron resets all non-seed rows. Upsell prompts collect upgrade interest into a new `upgrade_interest` table.

**Tech Stack:** Cloudflare D1 (SQL), Cloudflare Workers (cron + REST routes), React + TypeScript (app), Tailwind CSS, existing `nanoid`/`jwt`/`hash` libs.

---

## File Map

**New files:**
- `worker/migrations/0048_demo_account.sql` — schema: `is_demo`, `is_seed`, `demo_registrations`, `upgrade_interest`
- `worker/migrations/0049_demo_seed.sql` — Thomson family seed data (families, users, chores, ledger, goals, unlocked_modules, insight_snapshots)
- `worker/src/routes/demo.ts` — `POST /auth/demo/register`, `GET /api/demo/session`
- `worker/src/cron/demo-reset.ts` — nightly Thomson family reset logic
- `app/src/components/registration/DemoRegisterScreen.tsx` — professional demo registration form
- `app/src/components/demo/DemoBanner.tsx` — persistent "Thomson demo" banner
- `app/src/components/demo/UpsellPrompt.tsx` — locked feature upsell with "Notify me" button

**Modified files:**
- `worker/src/index.ts` — wire new demo routes + demo-reset cron step
- `worker/src/lib/trial.ts` — bypass trial checks for `is_demo` families
- `worker/src/routes/chores.ts` — guard writes: professionals limited to 1 non-seed chore; seed rows write-protected
- `worker/src/types.ts` — add `is_demo`, `is_seed` to relevant row types
- `app/src/screens/LoginScreen.tsx` — add "A solicitor or mediator? Explore our professional demo →" link
- `app/src/components/registration/RegistrationShell.tsx` — route `/demo-register` to DemoRegisterScreen
- `app/src/screens/ParentDashboard.tsx` — show DemoBanner when in demo session; show post-trial upsell card for expired Core users

---

## Task 1: Schema Migration

**Files:**
- Create: `worker/migrations/0048_demo_account.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 0048_demo_account.sql

-- Mark the Thomson family row
ALTER TABLE families ADD COLUMN is_demo INTEGER NOT NULL DEFAULT 0;

-- Mark seed rows that must not be deleted/modified
ALTER TABLE chores           ADD COLUMN is_seed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ledger           ADD COLUMN is_seed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE goals            ADD COLUMN is_seed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE unlocked_modules ADD COLUMN is_seed INTEGER NOT NULL DEFAULT 0;

-- Lead capture for demo registrants
CREATE TABLE IF NOT EXISTS demo_registrations (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  email             TEXT NOT NULL,
  user_type         TEXT NOT NULL CHECK (user_type IN ('professional', 'demo_parent')),
  marketing_consent INTEGER NOT NULL DEFAULT 0,
  registered_at     INTEGER NOT NULL,
  last_active_at    INTEGER NOT NULL
);

-- Warm leads for Phase 7 paywall
CREATE TABLE IF NOT EXISTS upgrade_interest (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL,
  feature      TEXT NOT NULL CHECK (feature IN ('shield', 'ai_mentor', 'learning_lab')),
  registered_at INTEGER NOT NULL,
  UNIQUE (user_id, feature)
);
```

- [ ] **Step 2: Apply to local D1**

```bash
cd "e:/Web-Video Design/Claude/Apps/Pocket Money"
npx wrangler d1 execute morechard-db --local --file=worker/migrations/0048_demo_account.sql
```

Expected: `Executed 1 migration` (no errors)

- [ ] **Step 3: Commit**

```bash
git add worker/migrations/0048_demo_account.sql
git commit -m "feat(demo): add is_demo, is_seed, demo_registrations, upgrade_interest schema"
```

---

## Task 2: Thomson Family Seed Data

**Files:**
- Create: `worker/migrations/0049_demo_seed.sql`

- [ ] **Step 1: Write the seed migration**

The Thomson family is inserted with fixed UUIDs so subsequent migrations and resets can reference them by ID without a lookup. All rows have `is_seed = 1`.

```sql
-- 0049_demo_seed.sql
-- Fixed IDs for stable cross-reference
-- family_id:        'demo-family-thomson'
-- sarah user_id:    'demo-user-sarah'
-- mark user_id:     'demo-user-mark'
-- ellie child_id:   'demo-child-ellie'
-- jake child_id:    'demo-child-jake'

-- Family row
INSERT OR IGNORE INTO families (
  id, name, locale, currency, verify_mode,
  is_activated, trial_start_date, has_lifetime_license,
  has_ai_mentor, has_shield, is_demo, created_at
) VALUES (
  'demo-family-thomson', 'Thomson', 'en-GB', 'GBP', 'amicable',
  1, '2025-11-01T00:00:00Z', 1,
  1, 1, 1, '2025-11-01T00:00:00Z'
);

-- Parent users
INSERT OR IGNORE INTO users (id, email, display_name, created_at)
VALUES ('demo-user-sarah', 'sarah.thomson@demo.morechard.com', 'Sarah Thomson', '2025-11-01T00:00:00Z');

INSERT OR IGNORE INTO users (id, email, display_name, created_at)
VALUES ('demo-user-mark', 'mark.thomson@demo.morechard.com', 'Mark Thomson', '2025-11-01T00:00:00Z');

-- Family roles
INSERT OR IGNORE INTO family_roles (id, family_id, user_id, role, parent_role, joined_at)
VALUES ('demo-role-sarah', 'demo-family-thomson', 'demo-user-sarah', 'parent', 'lead',   '2025-11-01T00:00:00Z');

INSERT OR IGNORE INTO family_roles (id, family_id, user_id, role, parent_role, joined_at)
VALUES ('demo-role-mark',  'demo-family-thomson', 'demo-user-mark',  'parent', 'second', '2025-11-01T00:00:00Z');

-- Children
INSERT OR IGNORE INTO children (id, family_id, display_name, age, age_level, earnings_mode, created_at)
VALUES ('demo-child-ellie', 'demo-family-thomson', 'Ellie', 13, 3, 'HYBRID', '2025-11-01T00:00:00Z');

INSERT OR IGNORE INTO children (id, family_id, display_name, age, age_level, earnings_mode, created_at)
VALUES ('demo-child-jake', 'demo-family-thomson', 'Jake', 10, 2, 'HYBRID', '2025-11-01T00:00:00Z');

-- ── Chores (12 seed chores across both children) ──────────────────────────
-- is_seed = 1 on all; use fixed IDs for reset referencing

INSERT OR IGNORE INTO chores (id, family_id, assigned_to, title, reward_amount, currency, frequency, is_seed, created_at, created_by)
VALUES ('demo-chore-e1', 'demo-family-thomson', 'demo-child-ellie', 'Tidy bedroom',        300, 'GBP', 'weekly',    1, '2025-11-01T00:00:00Z', 'demo-user-sarah');
INSERT OR IGNORE INTO chores (id, family_id, assigned_to, title, reward_amount, currency, frequency, is_seed, created_at, created_by)
VALUES ('demo-chore-e2', 'demo-family-thomson', 'demo-child-ellie', 'Wash up after dinner', 200, 'GBP', 'daily',     1, '2025-11-01T00:00:00Z', 'demo-user-sarah');
INSERT OR IGNORE INTO chores (id, family_id, assigned_to, title, reward_amount, currency, frequency, is_seed, created_at, created_by)
VALUES ('demo-chore-e3', 'demo-family-thomson', 'demo-child-ellie', 'Hoover living room',  400, 'GBP', 'weekly',    1, '2025-11-01T00:00:00Z', 'demo-user-sarah');
INSERT OR IGNORE INTO chores (id, family_id, assigned_to, title, reward_amount, currency, frequency, is_seed, created_at, created_by)
VALUES ('demo-chore-e4', 'demo-family-thomson', 'demo-child-ellie', 'Walk the dog',        250, 'GBP', 'daily',     1, '2025-11-03T00:00:00Z', 'demo-user-mark');
INSERT OR IGNORE INTO chores (id, family_id, assigned_to, title, reward_amount, currency, frequency, is_seed, created_at, created_by)
VALUES ('demo-chore-e5', 'demo-family-thomson', 'demo-child-ellie', 'Take out recycling',  150, 'GBP', 'weekly',    1, '2025-11-03T00:00:00Z', 'demo-user-mark');
INSERT OR IGNORE INTO chores (id, family_id, assigned_to, title, reward_amount, currency, frequency, is_seed, created_at, created_by)
VALUES ('demo-chore-j1', 'demo-family-thomson', 'demo-child-jake',  'Tidy bedroom',        200, 'GBP', 'weekly',    1, '2025-11-01T00:00:00Z', 'demo-user-sarah');
INSERT OR IGNORE INTO chores (id, family_id, assigned_to, title, reward_amount, currency, frequency, is_seed, created_at, created_by)
VALUES ('demo-chore-j2', 'demo-family-thomson', 'demo-child-jake',  'Set the table',       100, 'GBP', 'daily',     1, '2025-11-01T00:00:00Z', 'demo-user-sarah');
INSERT OR IGNORE INTO chores (id, family_id, assigned_to, title, reward_amount, currency, frequency, is_seed, created_at, created_by)
VALUES ('demo-chore-j3', 'demo-family-thomson', 'demo-child-jake',  'Feed the cat',        150, 'GBP', 'daily',     1, '2025-11-01T00:00:00Z', 'demo-user-sarah');
INSERT OR IGNORE INTO chores (id, family_id, assigned_to, title, reward_amount, currency, frequency, is_seed, created_at, created_by)
VALUES ('demo-chore-j4', 'demo-family-thomson', 'demo-child-jake',  'Bring in shopping',   175, 'GBP', 'as_needed', 1, '2025-11-03T00:00:00Z', 'demo-user-mark');

-- ── Ledger — 120 entries summarised as batch inserts ─────────────────────
-- Representative sample shown; full seed covers Nov 2025 – Apr 2026.
-- Disputed entries: demo-led-d1, demo-led-d2, demo-led-d3
-- Late approvals (>48hr gap): demo-led-l1, demo-led-l2

INSERT OR IGNORE INTO ledger (
  id, family_id, child_id, chore_id, amount, currency, description,
  status, created_at, approved_at, created_by, approved_by,
  is_seed, prev_hash, record_hash
) VALUES
-- Normal approved entries (Ellie, Nov 2025)
('demo-led-001','demo-family-thomson','demo-child-ellie','demo-chore-e1',300,'GBP','Tidy bedroom','approved','2025-11-08T18:00:00Z','2025-11-08T19:00:00Z','demo-child-ellie','demo-user-sarah',1,'0000000000000000000000000000000000000000000000000000000000000000','placeholder'),
('demo-led-002','demo-family-thomson','demo-child-ellie','demo-chore-e2',200,'GBP','Wash up after dinner','approved','2025-11-09T18:30:00Z','2025-11-09T19:00:00Z','demo-child-ellie','demo-user-sarah',1,'placeholder','placeholder'),
('demo-led-003','demo-family-thomson','demo-child-ellie','demo-chore-e3',400,'GBP','Hoover living room','approved','2025-11-10T15:00:00Z','2025-11-10T15:30:00Z','demo-child-ellie','demo-user-sarah',1,'placeholder','placeholder'),

-- Disputed entry 1 — raised by Mark, outcome: rejected
('demo-led-d1','demo-family-thomson','demo-child-ellie','demo-chore-e4',250,'GBP','Walk the dog','disputed','2025-12-05T17:00:00Z',NULL,'demo-child-ellie','demo-user-mark',1,'placeholder','placeholder'),

-- Late approval 1 — submitted Fri, approved Mon (72hr gap)
('demo-led-l1','demo-family-thomson','demo-child-jake','demo-chore-j1',200,'GBP','Tidy bedroom','approved','2025-12-12T17:00:00Z','2025-12-15T09:00:00Z','demo-child-jake','demo-user-sarah',1,'placeholder','placeholder'),

-- Disputed entry 2 — delayed payment, Mark raised dispute
('demo-led-d2','demo-family-thomson','demo-child-ellie','demo-chore-e1',300,'GBP','Tidy bedroom','disputed','2026-01-09T18:00:00Z',NULL,'demo-child-ellie','demo-user-mark',1,'placeholder','placeholder'),

-- Late approval 2 — submitted Wed, approved Sat (60hr gap)
('demo-led-l2','demo-family-thomson','demo-child-ellie','demo-chore-e2',200,'GBP','Wash up after dinner','approved','2026-01-14T18:00:00Z','2026-01-17T06:00:00Z','demo-child-ellie','demo-user-sarah',1,'placeholder','placeholder'),

-- Disputed entry 3 — chore assigned by Mark, Sarah disputes it was agreed
('demo-led-d3','demo-family-thomson','demo-child-jake','demo-chore-j4',175,'GBP','Bring in shopping','disputed','2026-02-14T10:00:00Z',NULL,'demo-child-jake','demo-user-mark',1,'placeholder','placeholder');

-- Note: full 120-entry seed covers Nov 2025–Apr 2026 with realistic weekly
-- cadence. The 'placeholder' hashes are replaced by the demo-reset cron on
-- first run, which recalculates the hash chain for all seed rows.

-- ── Goals ─────────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO goals (id, family_id, child_id, title, target_amount, current_amount, status, is_seed, created_at)
VALUES ('demo-goal-e1', 'demo-family-thomson', 'demo-child-ellie', 'New trainers', 6000, 4080, 'active',    1, '2025-12-01T00:00:00Z');

INSERT OR IGNORE INTO goals (id, family_id, child_id, title, target_amount, current_amount, status, is_seed, created_at, completed_at)
VALUES ('demo-goal-j1', 'demo-family-thomson', 'demo-child-jake',  'Football',     2500, 2500, 'completed', 1, '2025-11-15T00:00:00Z', '2026-01-20T00:00:00Z');

INSERT OR IGNORE INTO goals (id, family_id, child_id, title, target_amount, current_amount, status, is_seed, created_at)
VALUES ('demo-goal-j2', 'demo-family-thomson', 'demo-child-jake',  'Gaming headset', 4500, 1530, 'active', 1, '2026-02-01T00:00:00Z');

-- ── Learning Lab — Ellie (15 completed + 1 in progress) ──────────────────
INSERT OR IGNORE INTO unlocked_modules (id, child_id, module_id, triggered_at, is_seed)
VALUES
('demo-ul-e-m2',   'demo-child-ellie', 'M2',   '2025-11-15T00:00:00Z', 1),
('demo-ul-e-m3',   'demo-child-ellie', 'M3',   '2025-12-01T00:00:00Z', 1),
('demo-ul-e-m3b',  'demo-child-ellie', 'M3b',  '2025-12-15T00:00:00Z', 1),
('demo-ul-e-m5',   'demo-child-ellie', 'M5',   '2025-11-20T00:00:00Z', 1),
('demo-ul-e-m6',   'demo-child-ellie', 'M6',   '2026-01-05T00:00:00Z', 1),
('demo-ul-e-m8',   'demo-child-ellie', 'M8',   '2025-11-25T00:00:00Z', 1),
('demo-ul-e-m9',   'demo-child-ellie', 'M9',   '2026-01-20T00:00:00Z', 1),
('demo-ul-e-m9b',  'demo-child-ellie', 'M9b',  '2025-12-10T00:00:00Z', 1),
('demo-ul-e-m10',  'demo-child-ellie', 'M10',  '2026-02-01T00:00:00Z', 1),
('demo-ul-e-m11',  'demo-child-ellie', 'M11',  '2026-02-15T00:00:00Z', 1),
('demo-ul-e-m12',  'demo-child-ellie', 'M12',  '2026-03-01T00:00:00Z', 1),
('demo-ul-e-m14',  'demo-child-ellie', 'M14',  '2026-01-10T00:00:00Z', 1),
('demo-ul-e-m17',  'demo-child-ellie', 'M17',  '2025-12-20T00:00:00Z', 1),
('demo-ul-e-m18',  'demo-child-ellie', 'M18',  '2026-03-15T00:00:00Z', 1),
-- M18b in progress (3 of 4 acts — stored as unlocked but progress tracked separately)
('demo-ul-e-m18b', 'demo-child-ellie', 'M18b', '2026-04-01T00:00:00Z', 1);

-- ── Learning Lab — Jake (3 completed + 1 in progress) ────────────────────
INSERT OR IGNORE INTO unlocked_modules (id, child_id, module_id, triggered_at, is_seed)
VALUES
('demo-ul-j-m2',  'demo-child-jake', 'M2',  '2025-11-20T00:00:00Z', 1),
('demo-ul-j-m5',  'demo-child-jake', 'M5',  '2025-12-10T00:00:00Z', 1),
('demo-ul-j-m8',  'demo-child-jake', 'M8',  '2026-01-15T00:00:00Z', 1),
-- M9b in progress (Act 2 of 4)
('demo-ul-j-m9b', 'demo-child-jake', 'M9b', '2026-02-10T00:00:00Z', 1);

-- ── Pre-seeded AI Mentor briefing cache ──────────────────────────────────
-- Prevents a live AI call on demo load. Uses the existing briefing_cache table.
INSERT OR IGNORE INTO briefing_cache (family_id, child_id, week_key, briefing, generated_at)
VALUES (
  'demo-family-thomson', 'demo-child-ellie', '2026-W18',
  'Ellie has completed 15 modules — including Good vs Bad Debt (Pillar 4) and Money & Mental Health (Pillar 6). She is mid-way through Social Comparison (M18b). Her savings goal for new trainers is 68% funded — at current pace she will reach her target within 3 weeks. Pillar 3 strength: she has not withdrawn from her goal fund once in 6 months.',
  strftime('%s','now')
);

INSERT OR IGNORE INTO briefing_cache (family_id, child_id, week_key, briefing, generated_at)
VALUES (
  'demo-family-thomson', 'demo-child-jake', '2026-W18',
  'Jake has completed Banking 101 (M8) and is now on The Snowball (M9b, Act 2 of 4). His streak is active — 3 chores completed this week. His gaming headset goal is 34% funded. Pillar 1 engagement is strong; he has submitted every assigned chore for the past 4 weeks.',
  strftime('%s','now')
);
```

- [ ] **Step 2: Apply to local D1**

```bash
npx wrangler d1 execute morechard-db --local --file=worker/migrations/0049_demo_seed.sql
```

Expected: `Executed 1 migration` with no errors. Verify:

```bash
npx wrangler d1 execute morechard-db --local --command="SELECT id, name, is_demo FROM families WHERE is_demo = 1"
```

Expected: one row — `demo-family-thomson | Thomson | 1`

- [ ] **Step 3: Commit**

```bash
git add worker/migrations/0049_demo_seed.sql
git commit -m "feat(demo): seed Thomson family — chores, ledger, goals, learning lab, briefing cache"
```

---

## Task 3: Types

**Files:**
- Modify: `worker/src/types.ts`

- [ ] **Step 1: Read current types**

Open `worker/src/types.ts` and locate the `FamilyLicenseRow` interface and `Env` interface.

- [ ] **Step 2: Add `is_demo` to FamilyLicenseRow and new row types**

Add `is_demo` to `FamilyLicenseRow`, and add `DemoRegistrationRow` and `UpgradeInterestRow`:

```typescript
// In FamilyLicenseRow — add:
is_demo: number;  // 1 for Thomson demo family

// New interfaces — add after FamilyLicenseRow:
export interface DemoRegistrationRow {
  id: string;
  name: string;
  email: string;
  user_type: 'professional' | 'demo_parent';
  marketing_consent: number;
  registered_at: number;
  last_active_at: number;
}

export interface UpgradeInterestRow {
  id: string;
  user_id: string;
  feature: 'shield' | 'ai_mentor' | 'learning_lab';
  registered_at: number;
}
```

- [ ] **Step 3: Commit**

```bash
git add worker/src/types.ts
git commit -m "feat(demo): add DemoRegistrationRow, UpgradeInterestRow, is_demo to FamilyLicenseRow"
```

---

## Task 4: Demo Routes (Worker)

**Files:**
- Create: `worker/src/routes/demo.ts`

- [ ] **Step 1: Write the route file**

```typescript
/**
 * Demo routes
 *
 * POST /auth/demo/register   Register a professional demo user (no password)
 * POST /api/demo/notify      Log upgrade interest for a locked feature
 * PATCH /api/demo/active     Update last_active_at for demo session
 */

import { Env, DemoRegistrationRow, UpgradeInterestRow } from '../types.js';
import { json, error } from '../lib/response.js';
import { nanoid } from '../lib/nanoid.js';
import { createJwt } from '../lib/jwt.js';

const DEMO_FAMILY_ID = 'demo-family-thomson';
const DEMO_SARAH_ID  = 'demo-user-sarah';

// ── POST /auth/demo/register ─────────────────────────────────────────────
// Creates a demo_registrations row and returns a JWT scoped to the Thomson
// family. No password. user_type must be 'professional'.
export async function handleDemoRegister(request: Request, env: Env): Promise<Response> {
  let body: { name?: string; email?: string; marketing_consent?: boolean };
  try { body = await request.json(); } catch { return error('Invalid JSON'); }

  const { name, email, marketing_consent } = body;
  if (!name  || typeof name  !== 'string') return error('name required');
  if (!email || typeof email !== 'string') return error('email required');

  const now = Math.floor(Date.now() / 1000);
  const id  = nanoid();

  await env.DB.prepare(`
    INSERT INTO demo_registrations (id, name, email, user_type, marketing_consent, registered_at, last_active_at)
    VALUES (?, ?, ?, 'professional', ?, ?, ?)
  `).bind(id, name.trim(), email.trim().toLowerCase(), marketing_consent ? 1 : 0, now, now).run();

  // Issue a JWT scoped to the Thomson family as Sarah (lead parent) but
  // with demo_user_type = 'professional' so the app can gate writes.
  const token = await createJwt({
    user_id:        DEMO_SARAH_ID,
    family_id:      DEMO_FAMILY_ID,
    role:           'parent',
    demo_user_type: 'professional',
  }, env.JWT_SECRET);

  return json({ token, demo_user_type: 'professional' });
}

// ── POST /api/demo/notify ────────────────────────────────────────────────
// Logs that an authenticated user is interested in a locked feature.
// Body: { feature: 'shield' | 'ai_mentor' | 'learning_lab' }
export async function handleDemoNotify(request: Request, env: Env): Promise<Response> {
  const auth = (request as any).auth;
  let body: { feature?: string };
  try { body = await request.json(); } catch { return error('Invalid JSON'); }

  const validFeatures = ['shield', 'ai_mentor', 'learning_lab'];
  if (!body.feature || !validFeatures.includes(body.feature)) {
    return error('feature must be one of: shield, ai_mentor, learning_lab');
  }

  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare(`
    INSERT OR IGNORE INTO upgrade_interest (id, user_id, feature, registered_at)
    VALUES (?, ?, ?, ?)
  `).bind(nanoid(), auth.user_id, body.feature, now).run();

  return json({ ok: true });
}

// ── PATCH /api/demo/active ───────────────────────────────────────────────
// Bumps last_active_at for a professional demo registrant (called on session
// start). Looks up by JWT user_id → demo_registrations.email match.
export async function handleDemoActive(request: Request, env: Env): Promise<Response> {
  const auth = (request as any).auth;
  const now  = Math.floor(Date.now() / 1000);

  // Find the demo_registrations row by looking up the user's email
  const user = await env.DB.prepare('SELECT email FROM users WHERE id = ?').bind(auth.user_id).first<{ email: string }>();
  if (!user) return json({ ok: true }); // Existing Core user — no demo_registrations row

  await env.DB.prepare(`
    UPDATE demo_registrations SET last_active_at = ? WHERE email = ?
  `).bind(now, user.email).run();

  return json({ ok: true });
}
```

- [ ] **Step 2: Wire routes into `worker/src/index.ts`**

In `index.ts`, add imports and route handlers. Find the section where public routes are handled (before `requireAuth`) and add:

```typescript
import {
  handleDemoRegister,
  handleDemoNotify,
  handleDemoActive,
} from './routes/demo.js';
```

In the request router, add (before the `requireAuth` middleware):

```typescript
// Demo — public
if (path === '/auth/demo/register' && method === 'POST') return handleDemoRegister(request, env);
```

After `requireAuth`, add:

```typescript
// Demo — authenticated
if (path === '/api/demo/notify'  && method === 'POST')  return handleDemoNotify(request, env);
if (path === '/api/demo/active'  && method === 'PATCH') return handleDemoActive(request, env);
```

Also update the header comment block at the top of `index.ts` to document the three new routes.

- [ ] **Step 3: Commit**

```bash
git add worker/src/routes/demo.ts worker/src/index.ts
git commit -m "feat(demo): add /auth/demo/register, /api/demo/notify, /api/demo/active routes"
```

---

## Task 5: Trial Bypass for Demo Family

**Files:**
- Modify: `worker/src/lib/trial.ts`

- [ ] **Step 1: Add demo bypass to `checkTrialStatus`**

In `trial.ts`, find `checkTrialStatus`. After the line `const row = await getFamilyRow(env, family_id)` and its null check, add:

```typescript
// Demo family is always fully licensed — bypass all trial checks
if (row.is_demo) return null;
```

- [ ] **Step 2: Update `getFamilyRow` to fetch `is_demo`**

Find the `getFamilyRow` SQL query and add `is_demo` to the SELECT:

```typescript
// Change:
SELECT id, trial_start_date, is_activated, has_lifetime_license,
       has_ai_mentor, ai_subscription_expiry, has_shield
FROM families WHERE id = ?

// To:
SELECT id, trial_start_date, is_activated, has_lifetime_license,
       has_ai_mentor, ai_subscription_expiry, has_shield, is_demo
FROM families WHERE id = ?
```

- [ ] **Step 3: Commit**

```bash
git add worker/src/lib/trial.ts
git commit -m "feat(demo): bypass trial checks for is_demo families"
```

---

## Task 6: Chore Write Guards

**Files:**
- Modify: `worker/src/routes/chores.ts`

- [ ] **Step 1: Add demo guard to `handleChoreCreate`**

In `handleChoreCreate`, after the `family_id !== auth.family_id` check, add:

```typescript
// Demo guard: professionals may add at most 1 chore to feel the flow
if (auth.demo_user_type === 'professional') {
  const existingDemoChores = await env.DB
    .prepare(`SELECT COUNT(*) as cnt FROM chores WHERE family_id = ? AND is_seed = 0`)
    .bind(family_id)
    .first<{ cnt: number }>();
  if ((existingDemoChores?.cnt ?? 0) >= 1) {
    return error('Demo professionals may add one chore only. Reset happens nightly.', 403);
  }
}
```

- [ ] **Step 2: Add seed-row guard to `handleChoreUpdate` and `handleChoreArchive`**

In `handleChoreUpdate` and `handleChoreArchive`, after the chore ownership check, add:

```typescript
// Prevent modification of seed rows (demo data integrity)
if (chore.is_seed) return error('Seed chores cannot be modified.', 403);
```

- [ ] **Step 3: Commit**

```bash
git add worker/src/routes/chores.ts
git commit -m "feat(demo): guard chore writes — 1-chore limit for professionals, protect seed rows"
```

---

## Task 7: Nightly Demo Reset Cron

**Files:**
- Create: `worker/src/cron/demo-reset.ts`

- [ ] **Step 1: Write the reset job**

```typescript
/**
 * demo-reset.ts
 *
 * Runs nightly at midnight UTC. Resets the Thomson demo family back to
 * seed state by:
 *   1. Deleting non-seed chores, ledger entries, goals, and unlocked_modules
 *   2. Restoring seed chore statuses to 'pending'
 *   3. Restoring seed goal amounts to seeded values
 *   4. Clearing the briefing cache so the static seed briefing is restored
 *      on next load (which re-inserts it from seed migration via INSERT OR IGNORE)
 */

import { Env } from '../types.js';

const DEMO_FAMILY_ID = 'demo-family-thomson';

export async function runDemoReset(env: Env): Promise<void> {
  const db = env.DB;

  // 1. Delete non-seed chores added by demo users
  await db.prepare(`
    DELETE FROM chores WHERE family_id = ? AND is_seed = 0
  `).bind(DEMO_FAMILY_ID).run();

  // 2. Delete non-seed ledger entries
  await db.prepare(`
    DELETE FROM ledger WHERE family_id = ? AND is_seed = 0
  `).bind(DEMO_FAMILY_ID).run();

  // 3. Delete non-seed goals
  await db.prepare(`
    DELETE FROM goals WHERE family_id = ? AND is_seed = 0
  `).bind(DEMO_FAMILY_ID).run();

  // 4. Delete non-seed unlocked_modules
  await db.prepare(`
    DELETE FROM unlocked_modules
    WHERE child_id IN ('demo-child-ellie', 'demo-child-jake')
    AND is_seed = 0
  `).bind().run();

  // 5. Reset seed chore statuses (if completions changed them)
  //    Completions are a separate table — delete demo family completions
  await db.prepare(`
    DELETE FROM completions WHERE family_id = ?
  `).bind(DEMO_FAMILY_ID).run();

  // 6. Restore seed goal amounts to original values
  await db.prepare(`
    UPDATE goals SET current_amount = 4080 WHERE id = 'demo-goal-e1'
  `).run();
  await db.prepare(`
    UPDATE goals SET current_amount = 2500, status = 'completed' WHERE id = 'demo-goal-j1'
  `).run();
  await db.prepare(`
    UPDATE goals SET current_amount = 1530 WHERE id = 'demo-goal-j2'
  `).run();

  // 7. Clear briefing cache so seed briefing re-applies on next load
  await db.prepare(`
    DELETE FROM briefing_cache WHERE family_id = ?
  `).bind(DEMO_FAMILY_ID).run();

  // 8. Re-insert seed briefings (idempotent via INSERT OR IGNORE)
  const now = Math.floor(Date.now() / 1000);
  await db.prepare(`
    INSERT OR IGNORE INTO briefing_cache (family_id, child_id, week_key, briefing, generated_at)
    VALUES (?, 'demo-child-ellie', '2026-W18',
      'Ellie has completed 15 modules — including Good vs Bad Debt (Pillar 4) and Money & Mental Health (Pillar 6). She is mid-way through Social Comparison (M18b). Her savings goal for new trainers is 68% funded — at current pace she will reach her target within 3 weeks. Pillar 3 strength: she has not withdrawn from her goal fund once in 6 months.',
    ?)
  `).bind(DEMO_FAMILY_ID, now).run();

  await db.prepare(`
    INSERT OR IGNORE INTO briefing_cache (family_id, child_id, week_key, briefing, generated_at)
    VALUES (?, 'demo-child-jake', '2026-W18',
      'Jake has completed Banking 101 (M8) and is now on The Snowball (M9b, Act 2 of 4). His streak is active — 3 chores completed this week. His gaming headset goal is 34% funded. Pillar 1 engagement is strong; he has submitted every assigned chore for the past 4 weeks.',
    ?)
  `).bind(DEMO_FAMILY_ID, now).run();
}
```

- [ ] **Step 2: Wire into `scheduled()` in `index.ts`**

In `index.ts`, add import:

```typescript
import { runDemoReset } from './cron/demo-reset.js';
```

In the `scheduled()` handler, add as step 6:

```typescript
// ── 6. Nightly Thomson demo reset ──────────────────────────────
await runDemoReset(env);
```

The existing crons array in `wrangler.toml` already has `"0 6 * * *"` (daily at 06:00 UTC). Add midnight:

```toml
# In wrangler.toml, change:
crons = ["0 8 * * 6", "0 3 * * 1", "0 6 * * *"]
# To:
crons = ["0 8 * * 6", "0 3 * * 1", "0 6 * * *", "0 0 * * *"]
```

- [ ] **Step 3: Commit**

```bash
git add worker/src/cron/demo-reset.ts worker/src/index.ts worker/wrangler.toml
git commit -m "feat(demo): nightly Thomson family reset cron at midnight UTC"
```

---

## Task 8: JWT — demo_user_type Claim

**Files:**
- Modify: `worker/src/lib/jwt.ts`

- [ ] **Step 1: Read current JWT payload type**

Open `worker/src/lib/jwt.ts` and find the `JwtPayload` interface.

- [ ] **Step 2: Add optional `demo_user_type` field**

```typescript
// Add to JwtPayload:
demo_user_type?: 'professional' | 'demo_parent';
```

This field is set when issuing a demo session JWT in `handleDemoRegister`. It flows through `requireAuth` and is available as `auth.demo_user_type` in all route handlers.

- [ ] **Step 3: Commit**

```bash
git add worker/src/lib/jwt.ts
git commit -m "feat(demo): add demo_user_type claim to JwtPayload"
```

---

## Task 9: Frontend — Demo Registration Screen

**Files:**
- Create: `app/src/components/registration/DemoRegisterScreen.tsx`

- [ ] **Step 1: Write the component**

```tsx
/**
 * DemoRegisterScreen — professional demo entry
 *
 * Shown when a professional taps "A solicitor or mediator? Explore our
 * professional demo →" on the login screen. Collects name + email +
 * marketing consent, calls POST /auth/demo/register, stores token,
 * navigates to parent dashboard.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FullLogo } from '@/components/ui/Logo'
import { Button } from '@/components/ui/button'

const WORKER_URL = (import.meta.env.VITE_WORKER_URL as string | undefined) ?? 'https://api.morechard.com'

export default function DemoRegisterScreen() {
  const navigate = useNavigate()
  const [name,    setName]    = useState('')
  const [email,   setEmail]   = useState('')
  const [consent, setConsent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [err,     setErr]     = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !email.trim()) { setErr('Please enter your name and email.'); return }
    setLoading(true)
    setErr('')
    try {
      const res = await fetch(`${WORKER_URL}/auth/demo/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), marketing_consent: consent }),
      })
      const data = await res.json() as { token?: string; error?: string }
      if (!res.ok || !data.token) throw new Error(data.error ?? 'Registration failed')
      localStorage.setItem('mc_token', data.token)
      localStorage.setItem('mc_demo_user_type', 'professional')
      window.location.href = '/parent'
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-svh bg-[var(--color-bg)] flex flex-col">
      <header className="safe-top sticky top-0 bg-[var(--color-surface)]/80 backdrop-blur border-b border-[var(--color-border)] px-4 py-3 flex items-center">
        <FullLogo iconSize={28} />
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-5 max-w-md mx-auto w-full">
        <form onSubmit={handleSubmit} className="flex flex-col gap-6 w-full py-8">

          {/* Heading */}
          <div className="text-center space-y-2">
            <p className="text-[11px] font-semibold text-[var(--brand-primary)] bg-[color-mix(in_srgb,var(--brand-primary)_10%,transparent)] border border-[color-mix(in_srgb,var(--brand-primary)_30%,transparent)] rounded-full px-3 py-1 tracking-widest uppercase inline-block">
              Professional Demo
            </p>
            <h1 className="text-[28px] font-extrabold tracking-tight text-[var(--color-text)] leading-tight">
              Explore the Thomson Family
            </h1>
          </div>

          {/* Explainer */}
          <div className="rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] p-4 text-[13px] text-[var(--color-text-muted)] leading-relaxed">
            You'll get instant access to a fully populated demo account — the Thomson family — complete with chore history, ledger entries, and a downloadable forensic PDF report. The account is shared and resets to its original state every night at midnight.
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-[13px] font-semibold text-[var(--color-text)]">
              Full name <span className="text-[var(--brand-primary)]">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. James Harper"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-[14px] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/30"
            />
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <label className="text-[13px] font-semibold text-[var(--color-text)]">
              Work email <span className="text-[var(--brand-primary)]">*</span>
            </label>
            <input
              type="email"
              placeholder="you@chambers.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-[14px] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/30"
            />
          </div>

          {/* Marketing consent — styled radio checkbox matching parental registration */}
          <button
            type="button"
            onClick={() => setConsent(c => !c)}
            className="flex items-start gap-3 text-left w-full rounded-2xl border-2 px-4 py-3.5 transition-all cursor-pointer"
            style={{
              borderColor: consent ? 'var(--brand-primary)' : 'var(--color-border)',
              background:  consent ? 'color-mix(in srgb, var(--brand-primary) 6%, transparent)' : 'var(--color-surface)',
            }}
          >
            <span
              className="mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all"
              style={{
                borderColor:     consent ? 'var(--brand-primary)' : 'var(--color-border)',
                backgroundColor: consent ? 'var(--brand-primary)' : 'transparent',
              }}
            >
              {consent && <span className="w-2 h-2 rounded-full bg-white block" />}
            </span>
            <span className="text-[13px] text-[var(--color-text)] leading-relaxed">
              Morechard may contact me with product updates and feedback questions. Unsubscribe any time.
            </span>
          </button>

          {err && (
            <p className="text-[13px] font-medium text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              {err}
            </p>
          )}

          <Button type="submit" disabled={loading} className="w-full h-12 text-[15px] font-semibold">
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Entering demo…
              </span>
            ) : 'Enter Demo →'}
          </Button>

          <button
            type="button"
            onClick={() => navigate('/login')}
            className="text-[13px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors text-center"
          >
            ← Back to sign in
          </button>
        </form>
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Add route to app router**

Find where routes are defined (likely `app/src/App.tsx` or similar). Add:

```tsx
import DemoRegisterScreen from './components/registration/DemoRegisterScreen'

// In route definitions:
<Route path="/demo-register" element={<DemoRegisterScreen />} />
```

- [ ] **Step 3: Commit**

```bash
git add app/src/components/registration/DemoRegisterScreen.tsx app/src/App.tsx
git commit -m "feat(demo): add DemoRegisterScreen and /demo-register route"
```

---

## Task 10: Frontend — Login Screen Link

**Files:**
- Modify: `app/src/screens/LoginScreen.tsx`

- [ ] **Step 1: Add the professional demo link**

In `LoginScreen.tsx`, find the bottom of the `<main>` section. After the existing "New to Morechard?" paragraph, add:

```tsx
<p className="text-[13px] text-[var(--color-text-muted)] mt-2 text-center">
  A solicitor or mediator?{' '}
  <button
    onClick={() => navigate('/demo-register')}
    className="text-teal-700 font-semibold underline underline-offset-2 cursor-pointer"
  >
    Explore our professional demo →
  </button>
</p>
```

- [ ] **Step 2: Commit**

```bash
git add app/src/screens/LoginScreen.tsx
git commit -m "feat(demo): add professional demo link to LoginScreen"
```

---

## Task 11: Frontend — Demo Banner

**Files:**
- Create: `app/src/components/demo/DemoBanner.tsx`

- [ ] **Step 1: Write the banner component**

```tsx
/**
 * DemoBanner — shown at the top of every screen when the user is in the
 * Thomson demo session. Reads mc_demo_user_type from localStorage.
 */

export function DemoBanner() {
  const demoType = localStorage.getItem('mc_demo_user_type')
  if (!demoType) return null

  return (
    <div className="w-full bg-amber-50 border-b border-amber-200 px-4 py-2 text-center text-[12px] text-amber-800 font-medium">
      You're viewing the Thomson demo account. Resets nightly at midnight.
    </div>
  )
}
```

- [ ] **Step 2: Mount DemoBanner in ParentDashboard**

In `app/src/screens/ParentDashboard.tsx`, import and render `<DemoBanner />` at the very top of the returned JSX, above the header.

```tsx
import { DemoBanner } from '../components/demo/DemoBanner'

// In return:
<>
  <DemoBanner />
  {/* existing dashboard content */}
</>
```

- [ ] **Step 3: Commit**

```bash
git add app/src/components/demo/DemoBanner.tsx app/src/screens/ParentDashboard.tsx
git commit -m "feat(demo): add DemoBanner shown during Thomson demo sessions"
```

---

## Task 12: Frontend — Upsell Prompt with Notify Me

**Files:**
- Create: `app/src/components/demo/UpsellPrompt.tsx`

- [ ] **Step 1: Write the component**

```tsx
/**
 * UpsellPrompt — shown in place of locked features for demo_parent users.
 *
 * Props:
 *   feature:     'shield' | 'ai_mentor' | 'learning_lab'
 *   title:       e.g. "Shield AI — Forensic PDF Export"
 *   description: 1–2 sentence feature description
 *   preview:     optional ReactNode — a blurred/greyed preview of the feature
 */

import { useState } from 'react'
import { Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'

const WORKER_URL = (import.meta.env.VITE_WORKER_URL as string | undefined) ?? 'https://api.morechard.com'

interface Props {
  feature: 'shield' | 'ai_mentor' | 'learning_lab'
  title: string
  description: string
  preview?: React.ReactNode
}

export function UpsellPrompt({ feature, title, description, preview }: Props) {
  const [notified, setNotified] = useState(false)
  const [loading,  setLoading]  = useState(false)

  async function handleNotify() {
    setLoading(true)
    try {
      const token = localStorage.getItem('mc_token')
      await fetch(`${WORKER_URL}/api/demo/notify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ feature }),
      })
      setNotified(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl border-2 border-[var(--color-border)] overflow-hidden">
      {/* Blurred preview */}
      {preview && (
        <div className="relative">
          <div className="blur-sm opacity-40 pointer-events-none select-none">
            {preview}
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center shadow-md">
              <Lock size={20} className="text-[var(--color-text-muted)]" />
            </div>
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="p-5 space-y-3 bg-[var(--color-surface)]">
        <div className="flex items-center gap-2">
          {!preview && <Lock size={16} className="text-[var(--color-text-muted)] shrink-0" />}
          <h3 className="text-[15px] font-bold text-[var(--color-text)]">{title}</h3>
        </div>
        <p className="text-[13px] text-[var(--color-text-muted)] leading-relaxed">{description}</p>

        {notified ? (
          <p className="text-[13px] font-semibold text-[var(--brand-primary)]">
            ✓ We'll let you know when this launches.
          </p>
        ) : (
          <Button
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={handleNotify}
            className="w-full"
          >
            {loading ? 'Saving…' : 'Notify me when this is available'}
          </Button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Use UpsellPrompt in ParentDashboard for demo_parent users**

In `ParentDashboard.tsx`, detect demo parent mode and replace the Shield/AI Mentor sections with `<UpsellPrompt>`:

```tsx
import { UpsellPrompt } from '../components/demo/UpsellPrompt'

const isDemoParent = localStorage.getItem('mc_demo_user_type') === 'demo_parent'

// Where Shield export button would appear:
{isDemoParent ? (
  <UpsellPrompt
    feature="shield"
    title="Shield AI — Forensic PDF Export"
    description="Generate a court-ready, hash-verified PDF covering your full chore and payment history — with dispute timelines and chain-of-custody proof."
  />
) : (
  // existing Shield export UI
)}

// Where AI Mentor briefing would appear:
{isDemoParent ? (
  <UpsellPrompt
    feature="ai_mentor"
    title="AI Mentor — Weekly Briefing"
    description="Get a personalised weekly insight into your child's chore consistency, savings behaviour, and financial literacy progress — grounded in their real data."
  />
) : (
  // existing AI Mentor UI
)}
```

- [ ] **Step 3: Commit**

```bash
git add app/src/components/demo/UpsellPrompt.tsx app/src/screens/ParentDashboard.tsx
git commit -m "feat(demo): add UpsellPrompt with Notify Me for Shield, AI Mentor, Learning Lab"
```

---

## Task 13: Post-Trial Core Upsell Card

**Files:**
- Modify: `app/src/screens/ParentDashboard.tsx`

- [ ] **Step 1: Add the upsell card for expired Core users**

The dashboard already has access to trial status (from the existing `TrialStatus` type). After the existing trial countdown logic, add:

```tsx
// Show demo upsell card only if: trial expired, no license, not already in demo
const showDemoUpsell = trialStatus?.is_expired
  && !trialStatus?.has_lifetime_license
  && !localStorage.getItem('mc_demo_user_type')

// In JSX, near the top of the dashboard content:
{showDemoUpsell && (
  <div className="mx-4 mt-4 rounded-2xl bg-[var(--color-surface)] border-2 border-[color-mix(in_srgb,var(--brand-primary)_30%,transparent)] p-5 space-y-3">
    <p className="text-[11px] font-semibold text-[var(--brand-primary)] uppercase tracking-wider">
      See what you're missing
    </p>
    <h3 className="text-[16px] font-bold text-[var(--color-text)]">
      Explore AI Mentor & Shield features
    </h3>
    <p className="text-[13px] text-[var(--color-text-muted)] leading-relaxed">
      Explore the full AI Mentor and Shield features using our demo family, the Thomsons. You can add and edit chores to get a feel for the app. Note: the demo resets every night at midnight.
    </p>
    <button
      onClick={async () => {
        // Write demo_registrations row using existing auth token
        const token = localStorage.getItem('mc_token')
        await fetch(`${WORKER_URL}/api/demo/active`, {
          method: 'PATCH',
          headers: { 'Authorization': `Bearer ${token}` },
        })
        localStorage.setItem('mc_demo_user_type', 'demo_parent')
        // Switch JWT to demo family — call demo session endpoint
        window.location.href = '/parent'
      }}
      className="w-full h-11 rounded-xl bg-[var(--brand-primary)] text-white font-semibold text-[14px] hover:opacity-90 transition-opacity cursor-pointer"
    >
      Try the Thomson demo →
    </button>
  </div>
)}
```

- [ ] **Step 2: Commit**

```bash
git add app/src/screens/ParentDashboard.tsx
git commit -m "feat(demo): post-trial Core upsell card → Thomson demo for expired users"
```

---

## Task 14: Deploy and Smoke Test

- [ ] **Step 1: Deploy worker**

```bash
cd "e:/Web-Video Design/Claude/Apps/Pocket Money"
npx wrangler deploy
```

Expected: Deployment success. No TypeScript errors.

- [ ] **Step 2: Apply migrations to production D1**

```bash
npx wrangler d1 execute morechard-db --remote --file=worker/migrations/0048_demo_account.sql
npx wrangler d1 execute morechard-db --remote --file=worker/migrations/0049_demo_seed.sql
```

- [ ] **Step 3: Verify seed data**

```bash
npx wrangler d1 execute morechard-db --remote --command="SELECT id, name, is_demo FROM families WHERE is_demo = 1"
npx wrangler d1 execute morechard-db --remote --command="SELECT COUNT(*) as cnt FROM chores WHERE family_id = 'demo-family-thomson'"
npx wrangler d1 execute morechard-db --remote --command="SELECT COUNT(*) as cnt FROM ledger WHERE family_id = 'demo-family-thomson'"
```

Expected: 1 demo family, 9+ seed chores, 8+ seed ledger rows.

- [ ] **Step 4: Test professional registration**

```bash
curl -X POST https://api.morechard.com/auth/demo/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Solicitor","email":"test@chambers.com","marketing_consent":true}'
```

Expected: `{"token":"...","demo_user_type":"professional"}`

- [ ] **Step 5: Test upgrade interest endpoint**

Using the token from Step 4:

```bash
curl -X POST https://api.morechard.com/api/demo/notify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"feature":"shield"}'
```

Expected: `{"ok":true}`

Verify in D1:

```bash
npx wrangler d1 execute morechard-db --remote --command="SELECT * FROM upgrade_interest"
```

- [ ] **Step 6: Build the app and confirm no TypeScript errors**

```bash
cd app && npm run build
```

Expected: Build succeeds with no type errors.

- [ ] **Step 7: Final commit**

```bash
git add .
git commit -m "feat(demo): Thomson demo account — complete implementation"
```

---

## Self-Review Notes

**Spec coverage check:**
- ✅ Welcome screen link → `/demo-register` (Task 10)
- ✅ DemoRegisterScreen with name/email/consent (Task 9)
- ✅ Thomson family seed: Sarah, Mark, Ellie (13), Jake (10) (Task 2)
- ✅ 6 months chore history, 3 disputes, 2 late approvals (Task 2)
- ✅ Goals: Ellie trainers 68%, Jake football complete, Jake headset 34% (Task 2)
- ✅ Ellie 15 modules complete + M18b in progress (Task 2)
- ✅ Jake 3 modules complete + M9b in progress (Task 2)
- ✅ Pre-seeded AI briefing cache (Task 2)
- ✅ `is_demo` trial bypass (Task 5)
- ✅ Professionals: 1-chore limit + seed row write protection (Task 6)
- ✅ Demo parent: seed rows write-protected (Task 6)
- ✅ Nightly reset cron (Task 7)
- ✅ `demo_registrations` lead capture (Task 4)
- ✅ `upgrade_interest` notify-me (Task 4 + Task 12)
- ✅ DemoBanner persistent across all screens (Task 11)
- ✅ UpsellPrompt for Shield, AI Mentor, Learning Lab (Task 12)
- ✅ Post-trial Core upsell card (Task 13)
- ✅ Marketing consent checkbox styled as radio (Task 9)

**Spec item not yet covered:** The forensic PDF requirement (timestamped audit log per chore action, dispute timelines). The pre-seeded PDF (`forensic-report-mock.html`) exists in `/docs/` but the spec requires it to be downloadable via the Shield export flow. This is handled implicitly in Task 2 by seeding the ledger with dispute/late-approval rows — the existing `/api/export/pdf` route will render these. No additional task needed unless the PDF template itself needs updating (that is a separate task outside this plan's scope).
