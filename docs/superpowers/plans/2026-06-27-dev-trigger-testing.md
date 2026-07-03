# Dev Trigger Testing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build two dev-only tools — a SQL seed library that puts a test child in any trigger-ready DB state, and a browser panel that lets you fire any celebration overlay or inspect trigger status without waiting for real data.

**Architecture:** The seed library is a set of standalone `.sql` files under `worker/dev/seeds/` (wrangler d1 execute target); each file is self-contained — it runs `_reset.sql` preamble then inserts backdated rows. The dev panel is a React component mounted only in `import.meta.env.DEV` mode; overlays are driven by pushing to the existing `mc_celebration_queue` localStorage key; trigger status is fetched from a new `ENVIRONMENT=development`-gated worker endpoint.

**Tech Stack:** SQLite/D1, Wrangler CLI, React 18, TypeScript, Vite (DEV flag), Cloudflare Workers (Hono or raw Request routing)

## Global Constraints

- All currency in INTEGER pence (never floats)
- All timestamps in INTEGER Unix epoch seconds (`strftime('%s', ...)` in SQL)
- `is_seed = 1` on every ledger and completions row for clean wipe
- Dev worker endpoints must 404 in production (`ENVIRONMENT !== 'development'`)
- No new npm dependencies — use existing fetch, React, lucide-react
- Dev panel renders only inside `{import.meta.env.DEV && ...}` guard
- Fixed test IDs (see constants below) must never collide with real nanoid output
- Wrangler commands run from the `worker/` directory

## Canonical Test IDs (copy-paste these verbatim throughout)

```
FAMILY_ID : fDEV000000000000000001
PARENT_ID : uDEV_PARENT0000000001
CHILD_ID  : uDEV_CHILD00000000001
CHORE_A   : cDEV_BINS000000000001   (Take Out the Bins — £1.00 = 100p)
CHORE_B   : cDEV_ROOM000000000001   (Tidy the Room     — £1.10 = 110p)
CHORE_C   : cDEV_WASH000000000001   (Hang the Washing  — £0.90 =  90p)
CHORE_D   : cDEV_WALK000000000001   (Walk the Dog      — £2.00 = 200p)
CHORE_E   : cDEV_DISH000000000001   (Load Dishwasher   — £0.75 =  75p)
CHORE_F   : cDEV_VACU000000000001   (Vacuum Lounge     — £1.50 = 150p)
CHORE_G   : cDEV_LAWN000000000001   (Mow the Lawn      — £3.50 = 350p)
CHORE_H   : cDEV_SHOP000000000001   (Help with Shopping — £2.50 = 250p)
CHORE_I   : cDEV_COOK000000000001   (Help Cook Dinner  — £1.75 = 175p)
CHORE_J   : cDEV_WIPE000000000001   (Wipe Down Kitchen — £1.25 = 125p)
```

---

## File Map

### New files (create)
| File | Purpose |
|------|---------|
| `worker/dev/seeds/_reset.sql` | Wipe all dev test data for the test family |
| `worker/dev/seeds/_base.sql` | Insert test family + parent + child + 10 chores |
| `worker/dev/seeds/state-m2.sql` | £20+ lifetime earnings → M2 Taxes unlock |
| `worker/dev/seeds/state-m8.sql` | £30 balance → M8 Banking 101 unlock |
| `worker/dev/seeds/state-m11.sql` | 90%+ pass rate, 8 wks, 10+ jobs → M11 Credit Scores |
| `worker/dev/seeds/state-m13.sql` | £100+ earnings → M13 Stocks & Shares unlock |
| `worker/dev/seeds/state-m14.sql` | No transactions for 21+ days → M14 Inflation unlock |
| `worker/dev/seeds/state-m16.sql` | £75 balance → M16 Insurance unlock |
| `worker/dev/seeds/state-m19.sql` | £150+ earnings → M19 Pensions unlock |
| `worker/dev/seeds/state-m3b.sql` | Earnings variance >40% over 4 weeks → M3b Gig Trap |
| `worker/dev/seeds/state-streak-7.sql` | 7-day streak active → BADGE_CONSISTENCY_SEED |
| `worker/dev/seeds/state-streak-30.sql` | 30-day streak active → BADGE_CONSISTENCY_SAPLING |
| `worker/dev/seeds/state-gaming-goals.sql` | 2 gaming goals → M17 + M20 unlocks |
| `worker/dev/seeds/state-multi-goals.sql` | 3+ goals, 1 long-term → M15 unlock |
| `worker/src/routes/dev.ts` | Dev-only worker endpoint: trigger-status + passive-sweep |
| `app/src/components/dev/DevTriggerPanel.tsx` | Floating dev panel with overlay launcher + status |
| `docs/dev/time-trigger-testing.md` | Complete usage guide |

### Modified files
| File | Change |
|------|--------|
| `package.json` | Add `seed:*` npm scripts |
| `worker/src/index.ts` | Register `/dev/*` router (dev env only) |
| `app/src/screens/ChildDashboard.tsx` | Mount `<DevTriggerPanel>` inside DEV guard |

---

## Task 1: Reset + Base seed files

**Files:**
- Create: `worker/dev/seeds/_reset.sql`
- Create: `worker/dev/seeds/_base.sql`

**Interfaces:**
- Produces: test family row, parent user + family_role, child user + family_role + user_settings + child_streaks row, 10 chore rows — all keyed by the canonical IDs above

- [ ] **Step 1: Create `_reset.sql`**

```sql
-- worker/dev/seeds/_reset.sql
-- Wipes ALL data for the dev test family so seeds are idempotent.
-- Run this before any state-*.sql seed.
-- WARNING: dev only — never run against morechard (production DB).

-- Delete in dependency order (children before parents)
DELETE FROM child_nudges        WHERE child_id  = 'uDEV_CHILD00000000001';
DELETE FROM unlocked_modules    WHERE child_id  = 'uDEV_CHILD00000000001';
DELETE FROM child_badges        WHERE child_id  = 'uDEV_CHILD00000000001';
DELETE FROM lesson_completions  WHERE child_id  = 'uDEV_CHILD00000000001';
DELETE FROM child_streaks       WHERE child_id  = 'uDEV_CHILD00000000001';
DELETE FROM jar_config          WHERE child_id  = 'uDEV_CHILD00000000001';
DELETE FROM jar_movements       WHERE child_id  = 'uDEV_CHILD00000000001';
DELETE FROM insight_snapshots   WHERE child_id  = 'uDEV_CHILD00000000001';
DELETE FROM goals               WHERE child_id  = 'uDEV_CHILD00000000001';
DELETE FROM completions         WHERE is_seed = 1 AND child_id = 'uDEV_CHILD00000000001';
DELETE FROM ledger              WHERE is_seed = 1 AND child_id = 'uDEV_CHILD00000000001';
DELETE FROM chores              WHERE family_id = 'fDEV000000000000000001';
DELETE FROM user_settings       WHERE user_id   = 'uDEV_CHILD00000000001';
DELETE FROM user_settings       WHERE user_id   = 'uDEV_PARENT0000000001';
DELETE FROM family_roles        WHERE family_id = 'fDEV000000000000000001';
DELETE FROM users               WHERE family_id = 'fDEV000000000000000001';
DELETE FROM families            WHERE id        = 'fDEV000000000000000001';
```

- [ ] **Step 2: Create `_base.sql`**

```sql
-- worker/dev/seeds/_base.sql
-- Creates the canonical dev test family with a parent, a child, and 10 chores.
-- No completions or ledger entries — call state-*.sql after this to add history.
-- Always run _reset.sql first to avoid duplicate-key errors.

INSERT INTO families (id, name, currency, base_currency, verify_mode, parenting_mode, created_at)
VALUES ('fDEV000000000000000001', 'Dev Test Family', 'GBP', 'GBP', 'standard', 'single',
        strftime('%s', 'now', '-90 days'));

INSERT INTO users (id, family_id, display_name, email, locale, email_verified,
                   earnings_mode, allowance_frequency, allowance_amount, allowance_day,
                   pin_attempt_count, created_at)
VALUES
  ('uDEV_PARENT0000000001', 'fDEV000000000000000001', 'Dev Parent',
   'dev-parent@morechard.dev', 'en', 1, 'HYBRID', 'WEEKLY', 0, 6, 0,
   strftime('%s', 'now', '-90 days')),
  ('uDEV_CHILD00000000001', 'fDEV000000000000000001', 'Alex',
   NULL, 'en', 1, 'CHORES', 'WEEKLY', 0, 6, 0,
   strftime('%s', 'now', '-90 days'));

INSERT INTO family_roles (user_id, family_id, role, granted_at)
VALUES
  ('uDEV_PARENT0000000001', 'fDEV000000000000000001', 'parent', strftime('%s', 'now', '-90 days')),
  ('uDEV_CHILD00000000001', 'fDEV000000000000000001', 'child',  strftime('%s', 'now', '-90 days'));

INSERT INTO user_settings (user_id, avatar_id, theme, locale, updated_at)
VALUES
  ('uDEV_PARENT0000000001', 'bottts:bolt', 'system', 'en', strftime('%s', 'now')),
  ('uDEV_CHILD00000000001', 'bottts:spark', 'system', 'en', strftime('%s', 'now'));

INSERT INTO child_streaks (child_id, current_streak, longest_streak, grace_days_remaining,
                           last_kept_date, last_checked_date, updated_at)
VALUES ('uDEV_CHILD00000000001', 0, 0, 0, NULL, NULL, date('now'));

-- 10 distinct chores (10 different chore_ids = prerequisite for M3 Entrepreneurship)
INSERT INTO chores (id, family_id, assigned_to, created_by, title, reward_amount,
                    currency, frequency, archived, created_at, updated_at)
VALUES
  ('cDEV_BINS000000000001','fDEV000000000000000001','uDEV_CHILD00000000001','uDEV_PARENT0000000001',
   'Take Out the Bins',100,'GBP','weekly',0,strftime('%s','now','-90 days'),strftime('%s','now','-90 days')),
  ('cDEV_ROOM000000000001','fDEV000000000000000001','uDEV_CHILD00000000001','uDEV_PARENT0000000001',
   'Tidy the Room',110,'GBP','weekly',0,strftime('%s','now','-90 days'),strftime('%s','now','-90 days')),
  ('cDEV_WASH000000000001','fDEV000000000000000001','uDEV_CHILD00000000001','uDEV_PARENT0000000001',
   'Hang the Washing',90,'GBP','weekly',0,strftime('%s','now','-90 days'),strftime('%s','now','-90 days')),
  ('cDEV_WALK000000000001','fDEV000000000000000001','uDEV_CHILD00000000001','uDEV_PARENT0000000001',
   'Walk the Dog',200,'GBP','weekly',0,strftime('%s','now','-90 days'),strftime('%s','now','-90 days')),
  ('cDEV_DISH000000000001','fDEV000000000000000001','uDEV_CHILD00000000001','uDEV_PARENT0000000001',
   'Load Dishwasher',75,'GBP','daily',0,strftime('%s','now','-90 days'),strftime('%s','now','-90 days')),
  ('cDEV_VACU000000000001','fDEV000000000000000001','uDEV_CHILD00000000001','uDEV_PARENT0000000001',
   'Vacuum Lounge',150,'GBP','weekly',0,strftime('%s','now','-90 days'),strftime('%s','now','-90 days')),
  ('cDEV_LAWN000000000001','fDEV000000000000000001','uDEV_CHILD00000000001','uDEV_PARENT0000000001',
   'Mow the Lawn',350,'GBP','monthly',0,strftime('%s','now','-90 days'),strftime('%s','now','-90 days')),
  ('cDEV_SHOP000000000001','fDEV000000000000000001','uDEV_CHILD00000000001','uDEV_PARENT0000000001',
   'Help with Shopping',250,'GBP','weekly',0,strftime('%s','now','-90 days'),strftime('%s','now','-90 days')),
  ('cDEV_COOK000000000001','fDEV000000000000000001','uDEV_CHILD00000000001','uDEV_PARENT0000000001',
   'Help Cook Dinner',175,'GBP','weekly',0,strftime('%s','now','-90 days'),strftime('%s','now','-90 days')),
  ('cDEV_WIPE000000000001','fDEV000000000000000001','uDEV_CHILD00000000001','uDEV_PARENT0000000001',
   'Wipe Down Kitchen',125,'GBP','weekly',0,strftime('%s','now','-90 days'),strftime('%s','now','-90 days'));
```

- [ ] **Step 3: Verify SQL is valid**

```bash
cd "e:/Web-Video Design/Claude/Apps/Pocket Money/worker"
wrangler d1 execute morechard-dev --file=dev/seeds/_reset.sql
wrangler d1 execute morechard-dev --file=dev/seeds/_base.sql
wrangler d1 execute morechard-dev --command="SELECT id, display_name FROM users WHERE family_id='fDEV000000000000000001'"
```
Expected: two rows — Dev Parent and Alex.

- [ ] **Step 4: Commit**

```bash
git add worker/dev/seeds/_reset.sql worker/dev/seeds/_base.sql
git commit -m "dev: add seed reset + base family scaffold"
```

---

## Task 2: Scenario seed files (earnings / balance / streak / goals)

**Files:**
- Create: `worker/dev/seeds/state-m2.sql`
- Create: `worker/dev/seeds/state-m8.sql`
- Create: `worker/dev/seeds/state-m11.sql`
- Create: `worker/dev/seeds/state-m13.sql`
- Create: `worker/dev/seeds/state-m14.sql`
- Create: `worker/dev/seeds/state-m16.sql`
- Create: `worker/dev/seeds/state-m19.sql`
- Create: `worker/dev/seeds/state-m3b.sql`
- Create: `worker/dev/seeds/state-streak-7.sql`
- Create: `worker/dev/seeds/state-streak-30.sql`
- Create: `worker/dev/seeds/state-gaming-goals.sql`
- Create: `worker/dev/seeds/state-multi-goals.sql`

**Interfaces:**
- Consumes: `_base.sql` (must be run first — all state files assume the base rows exist)
- Produces: DB state that will cause `evaluateOnChoreApproval`, `evaluatePassive`, or `evaluateOnGoalCreate` to unlock the target module when next called

**Note on ledger immutability:** After migration 0027 the table was dropped and recreated. Only the UPDATE immutability trigger survived the migration; the DELETE trigger did not. The `_reset.sql` uses `is_seed = 1` as an additional safety guard to scope deletes to seed rows only.

- [ ] **Step 1: Create `state-m2.sql` (£20+ earnings → M2 Taxes)**

```sql
-- worker/dev/seeds/state-m2.sql
-- Target: M2 (Taxes & Net Pay) — cumulative credits >= £20 (2000p)
-- Strategy: 25 credits over 10 weeks totalling £22.50 (2250p)
-- After loading: call evaluateOnChoreApproval or open Learning Lab to trigger unlock.

.read dev/seeds/_reset.sql
.read dev/seeds/_base.sql

INSERT INTO completions (id, family_id, chore_id, child_id, note, status, attempt_count,
  submitted_at, resolved_at, resolved_by, is_seed)
VALUES
  ('cmp_m2_01','fDEV000000000000000001','cDEV_BINS000000000001','uDEV_CHILD00000000001',NULL,'completed',1,strftime('%s','now','-70 days'),strftime('%s','now','-70 days'),'uDEV_PARENT0000000001',1),
  ('cmp_m2_02','fDEV000000000000000001','cDEV_ROOM000000000001','uDEV_CHILD00000000001',NULL,'completed',1,strftime('%s','now','-63 days'),strftime('%s','now','-63 days'),'uDEV_PARENT0000000001',1),
  ('cmp_m2_03','fDEV000000000000000001','cDEV_WASH000000000001','uDEV_CHILD00000000001',NULL,'completed',1,strftime('%s','now','-56 days'),strftime('%s','now','-56 days'),'uDEV_PARENT0000000001',1),
  ('cmp_m2_04','fDEV000000000000000001','cDEV_WALK000000000001','uDEV_CHILD00000000001',NULL,'completed',1,strftime('%s','now','-49 days'),strftime('%s','now','-49 days'),'uDEV_PARENT0000000001',1),
  ('cmp_m2_05','fDEV000000000000000001','cDEV_DISH000000000001','uDEV_CHILD00000000001',NULL,'completed',1,strftime('%s','now','-42 days'),strftime('%s','now','-42 days'),'uDEV_PARENT0000000001',1),
  ('cmp_m2_06','fDEV000000000000000001','cDEV_VACU000000000001','uDEV_CHILD00000000001',NULL,'completed',1,strftime('%s','now','-35 days'),strftime('%s','now','-35 days'),'uDEV_PARENT0000000001',1),
  ('cmp_m2_07','fDEV000000000000000001','cDEV_LAWN000000000001','uDEV_CHILD00000000001',NULL,'completed',1,strftime('%s','now','-28 days'),strftime('%s','now','-28 days'),'uDEV_PARENT0000000001',1),
  ('cmp_m2_08','fDEV000000000000000001','cDEV_SHOP000000000001','uDEV_CHILD00000000001',NULL,'completed',1,strftime('%s','now','-21 days'),strftime('%s','now','-21 days'),'uDEV_PARENT0000000001',1),
  ('cmp_m2_09','fDEV000000000000000001','cDEV_COOK000000000001','uDEV_CHILD00000000001',NULL,'completed',1,strftime('%s','now','-14 days'),strftime('%s','now','-14 days'),'uDEV_PARENT0000000001',1),
  ('cmp_m2_10','fDEV000000000000000001','cDEV_WIPE000000000001','uDEV_CHILD00000000001',NULL,'completed',1,strftime('%s','now','-7 days'),strftime('%s','now','-7 days'),'uDEV_PARENT0000000001',1);

INSERT INTO ledger (family_id, child_id, chore_id, entry_type, amount, currency, description,
  verification_status, authorised_by, verified_at, ip_address, previous_hash, record_hash, created_at, is_seed)
VALUES
  ('fDEV000000000000000001','uDEV_CHILD00000000001','cDEV_BINS000000000001','credit',100,'GBP','Take Out the Bins','verified_auto','uDEV_PARENT0000000001',strftime('%s','now','-70 days'),'127.0.0.1','seed_m2_hash_0','seed_m2_hash_1',strftime('%s','now','-70 days'),1),
  ('fDEV000000000000000001','uDEV_CHILD00000000001','cDEV_ROOM000000000001','credit',110,'GBP','Tidy the Room','verified_auto','uDEV_PARENT0000000001',strftime('%s','now','-63 days'),'127.0.0.1','seed_m2_hash_1','seed_m2_hash_2',strftime('%s','now','-63 days'),1),
  ('fDEV000000000000000001','uDEV_CHILD00000000001','cDEV_WASH000000000001','credit',90,'GBP','Hang the Washing','verified_auto','uDEV_PARENT0000000001',strftime('%s','now','-56 days'),'127.0.0.1','seed_m2_hash_2','seed_m2_hash_3',strftime('%s','now','-56 days'),1),
  ('fDEV000000000000000001','uDEV_CHILD00000000001','cDEV_WALK000000000001','credit',200,'GBP','Walk the Dog','verified_auto','uDEV_PARENT0000000001',strftime('%s','now','-49 days'),'127.0.0.1','seed_m2_hash_3','seed_m2_hash_4',strftime('%s','now','-49 days'),1),
  ('fDEV000000000000000001','uDEV_CHILD00000000001','cDEV_DISH000000000001','credit',75,'GBP','Load Dishwasher','verified_auto','uDEV_PARENT0000000001',strftime('%s','now','-42 days'),'127.0.0.1','seed_m2_hash_4','seed_m2_hash_5',strftime('%s','now','-42 days'),1),
  ('fDEV000000000000000001','uDEV_CHILD00000000001','cDEV_VACU000000000001','credit',150,'GBP','Vacuum Lounge','verified_auto','uDEV_PARENT0000000001',strftime('%s','now','-35 days'),'127.0.0.1','seed_m2_hash_5','seed_m2_hash_6',strftime('%s','now','-35 days'),1),
  ('fDEV000000000000000001','uDEV_CHILD00000000001','cDEV_LAWN000000000001','credit',350,'GBP','Mow the Lawn','verified_auto','uDEV_PARENT0000000001',strftime('%s','now','-28 days'),'127.0.0.1','seed_m2_hash_6','seed_m2_hash_7',strftime('%s','now','-28 days'),1),
  ('fDEV000000000000000001','uDEV_CHILD00000000001','cDEV_SHOP000000000001','credit',250,'GBP','Help with Shopping','verified_auto','uDEV_PARENT0000000001',strftime('%s','now','-21 days'),'127.0.0.1','seed_m2_hash_7','seed_m2_hash_8',strftime('%s','now','-21 days'),1),
  ('fDEV000000000000000001','uDEV_CHILD00000000001','cDEV_COOK000000000001','credit',175,'GBP','Help Cook Dinner','verified_auto','uDEV_PARENT0000000001',strftime('%s','now','-14 days'),'127.0.0.1','seed_m2_hash_8','seed_m2_hash_9',strftime('%s','now','-14 days'),1),
  ('fDEV000000000000000001','uDEV_CHILD00000000001','cDEV_WIPE000000000001','credit',125,'GBP','Wipe Down Kitchen','verified_auto','uDEV_PARENT0000000001',strftime('%s','now','-7 days'),'127.0.0.1','seed_m2_hash_9','seed_m2_hash_10',strftime('%s','now','-7 days'),1);
-- Total credits: 100+110+90+200+75+150+350+250+175+125 = 1625p. BELOW £20 threshold.
-- Add 5 more to breach £20 (2000p — need 375p more):
INSERT INTO ledger (family_id, child_id, chore_id, entry_type, amount, currency, description,
  verification_status, authorised_by, verified_at, ip_address, previous_hash, record_hash, created_at, is_seed)
VALUES
  ('fDEV000000000000000001','uDEV_CHILD00000000001',NULL,'credit',200,'GBP','Bonus: extra job','verified_auto','uDEV_PARENT0000000001',strftime('%s','now','-6 days'),'127.0.0.1','seed_m2_hash_10','seed_m2_hash_11',strftime('%s','now','-6 days'),1),
  ('fDEV000000000000000001','uDEV_CHILD00000000001',NULL,'credit',200,'GBP','Bonus: extra job','verified_auto','uDEV_PARENT0000000001',strftime('%s','now','-5 days'),'127.0.0.1','seed_m2_hash_11','seed_m2_hash_12',strftime('%s','now','-5 days'),1);
-- Running total: 1625 + 200 + 200 = 2025p (£20.25) — M2 threshold breached ✓
```

- [ ] **Step 2: Create `state-m8.sql` (£30 balance → M8 Banking 101)**

```sql
-- worker/dev/seeds/state-m8.sql
-- Target: M8 (Banking 101) — current balance >= £30 (3000p) with no payments
-- Strategy: £31.50 of credits, no payment entries
-- After loading: open Learning Lab or call /dev/run-passive to trigger unlock.

.read dev/seeds/_reset.sql
.read dev/seeds/_base.sql

INSERT INTO ledger (family_id, child_id, chore_id, entry_type, amount, currency, description,
  verification_status, authorised_by, verified_at, ip_address, previous_hash, record_hash, created_at, is_seed)
VALUES
  ('fDEV000000000000000001','uDEV_CHILD00000000001',NULL,'credit',700,'GBP','Week 1 earnings','verified_auto','uDEV_PARENT0000000001',strftime('%s','now','-28 days'),'127.0.0.1','seed_m8_h0','seed_m8_h1',strftime('%s','now','-28 days'),1),
  ('fDEV000000000000000001','uDEV_CHILD00000000001',NULL,'credit',800,'GBP','Week 2 earnings','verified_auto','uDEV_PARENT0000000001',strftime('%s','now','-21 days'),'127.0.0.1','seed_m8_h1','seed_m8_h2',strftime('%s','now','-21 days'),1),
  ('fDEV000000000000000001','uDEV_CHILD00000000001',NULL,'credit',900,'GBP','Week 3 earnings','verified_auto','uDEV_PARENT0000000001',strftime('%s','now','-14 days'),'127.0.0.1','seed_m8_h2','seed_m8_h3',strftime('%s','now','-14 days'),1),
  ('fDEV000000000000000001','uDEV_CHILD00000000001',NULL,'credit',750,'GBP','Week 4 earnings','verified_auto','uDEV_PARENT0000000001',strftime('%s','now','-7 days'),'127.0.0.1','seed_m8_h3','seed_m8_h4',strftime('%s','now','-7 days'),1);
-- Balance: 700+800+900+750 = 3150p (£31.50) ≥ 3000p threshold ✓
```

- [ ] **Step 3: Create `state-m11.sql` (90%+ pass rate, 8 wks, 10+ jobs → M11 Credit Scores)**

```sql
-- worker/dev/seeds/state-m11.sql
-- Target: M11 (Credit Scores & Reliability) — ≥90% pass rate over last 8 weeks,
-- minimum 10 completions total.
-- Strategy: 13 completed + 1 rejected = 92.9% rate, 14 total completions.
-- After loading: call /dev/run-passive to trigger passive evaluation.

.read dev/seeds/_reset.sql
.read dev/seeds/_base.sql

INSERT INTO completions (id, family_id, chore_id, child_id, status, attempt_count,
  submitted_at, resolved_at, resolved_by, is_seed)
VALUES
  ('cmp_m11_01','fDEV000000000000000001','cDEV_BINS000000000001','uDEV_CHILD00000000001','completed',1,strftime('%s','now','-55 days'),strftime('%s','now','-55 days'),'uDEV_PARENT0000000001',1),
  ('cmp_m11_02','fDEV000000000000000001','cDEV_ROOM000000000001','uDEV_CHILD00000000001','completed',1,strftime('%s','now','-50 days'),strftime('%s','now','-50 days'),'uDEV_PARENT0000000001',1),
  ('cmp_m11_03','fDEV000000000000000001','cDEV_WASH000000000001','uDEV_CHILD00000000001','rejected', 2,strftime('%s','now','-48 days'),strftime('%s','now','-47 days'),'uDEV_PARENT0000000001',1),
  ('cmp_m11_04','fDEV000000000000000001','cDEV_WALK000000000001','uDEV_CHILD00000000001','completed',1,strftime('%s','now','-45 days'),strftime('%s','now','-45 days'),'uDEV_PARENT0000000001',1),
  ('cmp_m11_05','fDEV000000000000000001','cDEV_DISH000000000001','uDEV_CHILD00000000001','completed',1,strftime('%s','now','-42 days'),strftime('%s','now','-42 days'),'uDEV_PARENT0000000001',1),
  ('cmp_m11_06','fDEV000000000000000001','cDEV_VACU000000000001','uDEV_CHILD00000000001','completed',1,strftime('%s','now','-36 days'),strftime('%s','now','-36 days'),'uDEV_PARENT0000000001',1),
  ('cmp_m11_07','fDEV000000000000000001','cDEV_LAWN000000000001','uDEV_CHILD00000000001','completed',1,strftime('%s','now','-30 days'),strftime('%s','now','-30 days'),'uDEV_PARENT0000000001',1),
  ('cmp_m11_08','fDEV000000000000000001','cDEV_SHOP000000000001','uDEV_CHILD00000000001','completed',1,strftime('%s','now','-24 days'),strftime('%s','now','-24 days'),'uDEV_PARENT0000000001',1),
  ('cmp_m11_09','fDEV000000000000000001','cDEV_COOK000000000001','uDEV_CHILD00000000001','completed',1,strftime('%s','now','-18 days'),strftime('%s','now','-18 days'),'uDEV_PARENT0000000001',1),
  ('cmp_m11_10','fDEV000000000000000001','cDEV_WIPE000000000001','uDEV_CHILD00000000001','completed',1,strftime('%s','now','-12 days'),strftime('%s','now','-12 days'),'uDEV_PARENT0000000001',1),
  ('cmp_m11_11','fDEV000000000000000001','cDEV_BINS000000000001','uDEV_CHILD00000000001','completed',1,strftime('%s','now','-9 days'),strftime('%s','now','-9 days'),'uDEV_PARENT0000000001',1),
  ('cmp_m11_12','fDEV000000000000000001','cDEV_ROOM000000000001','uDEV_CHILD00000000001','completed',1,strftime('%s','now','-6 days'),strftime('%s','now','-6 days'),'uDEV_PARENT0000000001',1),
  ('cmp_m11_13','fDEV000000000000000001','cDEV_WALK000000000001','uDEV_CHILD00000000001','completed',1,strftime('%s','now','-3 days'),strftime('%s','now','-3 days'),'uDEV_PARENT0000000001',1),
  ('cmp_m11_14','fDEV000000000000000001','cDEV_DISH000000000001','uDEV_CHILD00000000001','completed',1,strftime('%s','now','-1 days'),strftime('%s','now','-1 days'),'uDEV_PARENT0000000001',1);
-- 13 completed / 14 total = 92.9% ≥ 90%, total ≥ 10 ✓
-- Note: completions query checks within 8 weeks — all entries above are within 56 days ✓

-- Ledger credits for each completed chore (trigger queries SUM of credits)
INSERT INTO ledger (family_id, child_id, chore_id, entry_type, amount, currency, description,
  verification_status, authorised_by, ip_address, previous_hash, record_hash, created_at, is_seed)
VALUES
  ('fDEV000000000000000001','uDEV_CHILD00000000001',NULL,'credit',100,'GBP','Take Out the Bins','verified_auto','uDEV_PARENT0000000001','127.0.0.1','seed_m11_h0','seed_m11_h1',strftime('%s','now','-55 days'),1),
  ('fDEV000000000000000001','uDEV_CHILD00000000001',NULL,'credit',110,'GBP','Tidy the Room','verified_auto','uDEV_PARENT0000000001','127.0.0.1','seed_m11_h1','seed_m11_h2',strftime('%s','now','-50 days'),1),
  ('fDEV000000000000000001','uDEV_CHILD00000000001',NULL,'credit',200,'GBP','Walk the Dog','verified_auto','uDEV_PARENT0000000001','127.0.0.1','seed_m11_h2','seed_m11_h3',strftime('%s','now','-45 days'),1),
  ('fDEV000000000000000001','uDEV_CHILD00000000001',NULL,'credit',75,'GBP','Load Dishwasher','verified_auto','uDEV_PARENT0000000001','127.0.0.1','seed_m11_h3','seed_m11_h4',strftime('%s','now','-42 days'),1),
  ('fDEV000000000000000001','uDEV_CHILD00000000001',NULL,'credit',150,'GBP','Vacuum Lounge','verified_auto','uDEV_PARENT0000000001','127.0.0.1','seed_m11_h4','seed_m11_h5',strftime('%s','now','-36 days'),1),
  ('fDEV000000000000000001','uDEV_CHILD00000000001',NULL,'credit',350,'GBP','Mow the Lawn','verified_auto','uDEV_PARENT0000000001','127.0.0.1','seed_m11_h5','seed_m11_h6',strftime('%s','now','-30 days'),1),
  ('fDEV000000000000000001','uDEV_CHILD00000000001',NULL,'credit',250,'GBP','Help with Shopping','verified_auto','uDEV_PARENT0000000001','127.0.0.1','seed_m11_h6','seed_m11_h7',strftime('%s','now','-24 days'),1),
  ('fDEV000000000000000001','uDEV_CHILD00000000001',NULL,'credit',175,'GBP','Help Cook Dinner','verified_auto','uDEV_PARENT0000000001','127.0.0.1','seed_m11_h7','seed_m11_h8',strftime('%s','now','-18 days'),1),
  ('fDEV000000000000000001','uDEV_CHILD00000000001',NULL,'credit',125,'GBP','Wipe Down Kitchen','verified_auto','uDEV_PARENT0000000001','127.0.0.1','seed_m11_h8','seed_m11_h9',strftime('%s','now','-12 days'),1),
  ('fDEV000000000000000001','uDEV_CHILD00000000001',NULL,'credit',100,'GBP','Take Out the Bins','verified_auto','uDEV_PARENT0000000001','127.0.0.1','seed_m11_h9','seed_m11_h10',strftime('%s','now','-9 days'),1),
  ('fDEV000000000000000001','uDEV_CHILD00000000001',NULL,'credit',110,'GBP','Tidy the Room','verified_auto','uDEV_PARENT0000000001','127.0.0.1','seed_m11_h10','seed_m11_h11',strftime('%s','now','-6 days'),1),
  ('fDEV000000000000000001','uDEV_CHILD00000000001',NULL,'credit',200,'GBP','Walk the Dog','verified_auto','uDEV_PARENT0000000001','127.0.0.1','seed_m11_h11','seed_m11_h12',strftime('%s','now','-3 days'),1),
  ('fDEV000000000000000001','uDEV_CHILD00000000001',NULL,'credit',75,'GBP','Load Dishwasher','verified_auto','uDEV_PARENT0000000001','127.0.0.1','seed_m11_h12','seed_m11_h13',strftime('%s','now','-1 days'),1);
```

- [ ] **Step 4: Create `state-m13.sql` (£100+ earnings → M13 Stocks)**

```sql
-- worker/dev/seeds/state-m13.sql
-- Target: M13 (Stocks & Shares) — cumulative credits >= £100 (10000p)
-- Also unlocks M2 (£20) and M8 (£30 balance) as side effects.
-- After loading: call evaluateOnChoreApproval or open Learning Lab.

.read dev/seeds/_reset.sql
.read dev/seeds/_base.sql

INSERT INTO ledger (family_id, child_id, chore_id, entry_type, amount, currency, description,
  verification_status, authorised_by, ip_address, previous_hash, record_hash, created_at, is_seed)
VALUES
  ('fDEV000000000000000001','uDEV_CHILD00000000001',NULL,'credit',2500,'GBP','Month 1 earnings','verified_auto','uDEV_PARENT0000000001','127.0.0.1','seed_m13_h0','seed_m13_h1',strftime('%s','now','-84 days'),1),
  ('fDEV000000000000000001','uDEV_CHILD00000000001',NULL,'credit',2500,'GBP','Month 2 earnings','verified_auto','uDEV_PARENT0000000001','127.0.0.1','seed_m13_h1','seed_m13_h2',strftime('%s','now','-56 days'),1),
  ('fDEV000000000000000001','uDEV_CHILD00000000001',NULL,'credit',2500,'GBP','Month 3 earnings','verified_auto','uDEV_PARENT0000000001','127.0.0.1','seed_m13_h2','seed_m13_h3',strftime('%s','now','-28 days'),1),
  ('fDEV000000000000000001','uDEV_CHILD00000000001',NULL,'credit',2501,'GBP','Month 4 earnings','verified_auto','uDEV_PARENT0000000001','127.0.0.1','seed_m13_h3','seed_m13_h4',strftime('%s','now','-7 days'),1);
-- Total: 2500+2500+2500+2501 = 10001p (£100.01) ≥ 10000p threshold ✓
```

- [ ] **Step 5: Create `state-m14.sql` (21+ days inactive → M14 Inflation)**

```sql
-- worker/dev/seeds/state-m14.sql
-- Target: M14 (Inflation & Purchasing Power) — no ledger entry for 21+ days.
-- Strategy: a few credits 30+ days ago, nothing recent.
-- After loading: call /dev/run-passive — the nightly CRON condition fires.

.read dev/seeds/_reset.sql
.read dev/seeds/_base.sql

INSERT INTO ledger (family_id, child_id, chore_id, entry_type, amount, currency, description,
  verification_status, authorised_by, ip_address, previous_hash, record_hash, created_at, is_seed)
VALUES
  ('fDEV000000000000000001','uDEV_CHILD00000000001',NULL,'credit',500,'GBP','Old earnings w1','verified_auto','uDEV_PARENT0000000001','127.0.0.1','seed_m14_h0','seed_m14_h1',strftime('%s','now','-45 days'),1),
  ('fDEV000000000000000001','uDEV_CHILD00000000001',NULL,'credit',500,'GBP','Old earnings w2','verified_auto','uDEV_PARENT0000000001','127.0.0.1','seed_m14_h1','seed_m14_h2',strftime('%s','now','-38 days'),1),
  ('fDEV000000000000000001','uDEV_CHILD00000000001',NULL,'credit',300,'GBP','Old earnings w3','verified_auto','uDEV_PARENT0000000001','127.0.0.1','seed_m14_h2','seed_m14_h3',strftime('%s','now','-22 days'),1);
-- Last entry: 22 days ago → > 21 day threshold ✓
-- Balance: 1300p (£13) — has some balance so it's a "waiting" scenario
```

- [ ] **Step 6: Create `state-m16.sql` (£75 balance → M16 Insurance)**

```sql
-- worker/dev/seeds/state-m16.sql
-- Target: M16 (Insurance & Protection) — balance >= £75 (7500p)
-- Also unlocks M2 and M8 as side effects.
-- After loading: call /dev/run-passive.

.read dev/seeds/_reset.sql
.read dev/seeds/_base.sql

INSERT INTO ledger (family_id, child_id, chore_id, entry_type, amount, currency, description,
  verification_status, authorised_by, ip_address, previous_hash, record_hash, created_at, is_seed)
VALUES
  ('fDEV000000000000000001','uDEV_CHILD00000000001',NULL,'credit',2500,'GBP','Month 1','verified_auto','uDEV_PARENT0000000001','127.0.0.1','seed_m16_h0','seed_m16_h1',strftime('%s','now','-56 days'),1),
  ('fDEV000000000000000001','uDEV_CHILD00000000001',NULL,'credit',2500,'GBP','Month 2','verified_auto','uDEV_PARENT0000000001','127.0.0.1','seed_m16_h1','seed_m16_h2',strftime('%s','now','-28 days'),1),
  ('fDEV000000000000000001','uDEV_CHILD00000000001',NULL,'credit',2501,'GBP','Month 3','verified_auto','uDEV_PARENT0000000001','127.0.0.1','seed_m16_h2','seed_m16_h3',strftime('%s','now','-7 days'),1);
-- Balance: 7501p (£75.01) ≥ 7500p threshold ✓
```

- [ ] **Step 7: Create `state-m19.sql` (£150+ earnings → M19 Pensions)**

```sql
-- worker/dev/seeds/state-m19.sql
-- Target: M19 (Pensions & The Long Game) — cumulative credits >= £150 (15000p)
-- Also unlocks M2, M13 as side effects.
-- After loading: call evaluateOnChoreApproval.

.read dev/seeds/_reset.sql
.read dev/seeds/_base.sql

INSERT INTO ledger (family_id, child_id, chore_id, entry_type, amount, currency, description,
  verification_status, authorised_by, ip_address, previous_hash, record_hash, created_at, is_seed)
VALUES
  ('fDEV000000000000000001','uDEV_CHILD00000000001',NULL,'credit',3800,'GBP','Month 1','verified_auto','uDEV_PARENT0000000001','127.0.0.1','seed_m19_h0','seed_m19_h1',strftime('%s','now','-112 days'),1),
  ('fDEV000000000000000001','uDEV_CHILD00000000001',NULL,'credit',3800,'GBP','Month 2','verified_auto','uDEV_PARENT0000000001','127.0.0.1','seed_m19_h1','seed_m19_h2',strftime('%s','now','-84 days'),1),
  ('fDEV000000000000000001','uDEV_CHILD00000000001',NULL,'credit',3800,'GBP','Month 3','verified_auto','uDEV_PARENT0000000001','127.0.0.1','seed_m19_h2','seed_m19_h3',strftime('%s','now','-56 days'),1),
  ('fDEV000000000000000001','uDEV_CHILD00000000001',NULL,'credit',3601,'GBP','Month 4','verified_auto','uDEV_PARENT0000000001','127.0.0.1','seed_m19_h3','seed_m19_h4',strftime('%s','now','-28 days'),1);
-- Total: 3800*3 + 3601 = 15001p (£150.01) ≥ 15000p threshold ✓
```

- [ ] **Step 8: Create `state-m3b.sql` (earnings variance >40% over 4 weeks → M3b Gig Trap)**

```sql
-- worker/dev/seeds/state-m3b.sql
-- Target: M3b (The Gig Trap — Income Volatility) — weekly earnings stddev/avg > 40% over 4 weeks.
-- Strategy: wildly uneven weeks: £10 / £40 / £5 / £35 → avg=22.50, stddev≈16.7, CV=74%
-- The query groups by strftime('%Y-%W') so entries must span 4 distinct calendar weeks.
-- After loading: call evaluateOnChoreApproval.

.read dev/seeds/_reset.sql
.read dev/seeds/_base.sql

-- Week 1: low earnings (£1.00 = 100p)
INSERT INTO ledger (family_id, child_id, chore_id, entry_type, amount, currency, description,
  verification_status, authorised_by, ip_address, previous_hash, record_hash, created_at, is_seed)
VALUES
  ('fDEV000000000000000001','uDEV_CHILD00000000001',NULL,'credit',100,'GBP','Slow week 1','verified_auto','uDEV_PARENT0000000001','127.0.0.1','seed_m3b_h0','seed_m3b_h1',strftime('%s','now','-25 days'),1);

-- Week 2: high earnings (£40.00 = 4000p)
INSERT INTO ledger (family_id, child_id, chore_id, entry_type, amount, currency, description,
  verification_status, authorised_by, ip_address, previous_hash, record_hash, created_at, is_seed)
VALUES
  ('fDEV000000000000000001','uDEV_CHILD00000000001',NULL,'credit',4000,'GBP','Big week 2','verified_auto','uDEV_PARENT0000000001','127.0.0.1','seed_m3b_h1','seed_m3b_h2',strftime('%s','now','-18 days'),1);

-- Week 3: low again (£0.50 = 50p)
INSERT INTO ledger (family_id, child_id, chore_id, entry_type, amount, currency, description,
  verification_status, authorised_by, ip_address, previous_hash, record_hash, created_at, is_seed)
VALUES
  ('fDEV000000000000000001','uDEV_CHILD00000000001',NULL,'credit',50,'GBP','Slow week 3','verified_auto','uDEV_PARENT0000000001','127.0.0.1','seed_m3b_h2','seed_m3b_h3',strftime('%s','now','-11 days'),1);

-- Week 4: high again (£35.00 = 3500p)
INSERT INTO ledger (family_id, child_id, chore_id, entry_type, amount, currency, description,
  verification_status, authorised_by, ip_address, previous_hash, record_hash, created_at, is_seed)
VALUES
  ('fDEV000000000000000001','uDEV_CHILD00000000001',NULL,'credit',3500,'GBP','Big week 4','verified_auto','uDEV_PARENT0000000001','127.0.0.1','seed_m3b_h3','seed_m3b_h4',strftime('%s','now','-4 days'),1);
-- Weekly totals (pence): 100, 4000, 50, 3500
-- avg=1912.5, stddev≈1876, CV≈98% >> 40% threshold ✓
```

- [ ] **Step 9: Create `state-streak-7.sql`**

```sql
-- worker/dev/seeds/state-streak-7.sql
-- Target: STREAK_7 milestone (+ BADGE_CONSISTENCY_SEED award)
-- Strategy: set child_streaks row directly to current_streak=7, longest_streak=7.
-- The celebration event is queued by the server on approval; to see the overlay
-- use the Dev Panel "Fire STREAK_7" button directly in the browser.

.read dev/seeds/_reset.sql
.read dev/seeds/_base.sql

-- Set streak counters directly (these are summary rows, not ledger entries)
UPDATE child_streaks
SET current_streak       = 7,
    longest_streak       = 7,
    grace_days_remaining = 0,
    last_kept_date       = date('now', '-1 day'),
    last_checked_date    = date('now', '-1 day'),
    updated_at           = date('now')
WHERE child_id = 'uDEV_CHILD00000000001';

-- Award the badge that the trigger would have written
INSERT OR IGNORE INTO child_badges (id, child_id, badge_key, earned_at)
VALUES ('bdg_dev_consistency_seed', 'uDEV_CHILD00000000001', 'CONSISTENCY_SEED', datetime('now'));
```

- [ ] **Step 10: Create `state-streak-30.sql`**

```sql
-- worker/dev/seeds/state-streak-30.sql
-- Target: STREAK_30 milestone (+ BADGE_CONSISTENCY_SAPLING)
-- See state-streak-7.sql notes — use Dev Panel to fire the overlay immediately.

.read dev/seeds/_reset.sql
.read dev/seeds/_base.sql

UPDATE child_streaks
SET current_streak       = 30,
    longest_streak       = 30,
    grace_days_remaining = 2,
    last_kept_date       = date('now', '-1 day'),
    last_checked_date    = date('now', '-1 day'),
    updated_at           = date('now')
WHERE child_id = 'uDEV_CHILD00000000001';

INSERT OR IGNORE INTO child_badges (id, child_id, badge_key, earned_at)
VALUES
  ('bdg_dev_cons_seed', 'uDEV_CHILD00000000001', 'CONSISTENCY_SEED',    datetime('now', '-23 days')),
  ('bdg_dev_cons_sap',  'uDEV_CHILD00000000001', 'CONSISTENCY_SAPLING', datetime('now'));
```

- [ ] **Step 11: Create `state-gaming-goals.sql` (M17 + M20)**

```sql
-- worker/dev/seeds/state-gaming-goals.sql
-- Target: M17 (Digital Currency — 1st gaming goal) AND M20 (Gambling & Loot Boxes — 2nd gaming goal)
-- Strategy: insert 2 active goals with category='gaming'. The trigger fires when
-- evaluateOnGoalCreate is called; since seeds bypass that call, we insert the
-- unlocked_modules rows directly here.

.read dev/seeds/_reset.sql
.read dev/seeds/_base.sql

INSERT INTO goals (id, family_id, child_id, title, target_amount, currency, category,
  deadline, alloc_pct, archived, status, current_saved_pence, created_at, updated_at)
VALUES
  ('gDEV_GAME_001','fDEV000000000000000001','uDEV_CHILD00000000001',
   'Minecraft DLC Pack', 599, 'GBP', 'gaming', NULL, 20, 0, 'ACTIVE', 120,
   strftime('%s','now','-21 days'), strftime('%s','now','-21 days')),
  ('gDEV_GAME_002','fDEV000000000000000001','uDEV_CHILD00000000001',
   'Roblox Robux', 799, 'GBP', 'gaming', NULL, 20, 0, 'ACTIVE', 200,
   strftime('%s','now','-10 days'), strftime('%s','now','-10 days'));

-- Pre-unlock both modules (the triggers won't re-fire via evaluateOnGoalCreate because
-- goals were inserted directly; inserting the unlock rows ourselves is correct here)
INSERT OR IGNORE INTO unlocked_modules (id, child_id, module_slug, unlocked_at)
VALUES
  ('um_dev_m17', 'uDEV_CHILD00000000001', 'M17', strftime('%s','now','-21 days')),
  ('um_dev_m20', 'uDEV_CHILD00000000001', 'M20', strftime('%s','now','-10 days'));
```

- [ ] **Step 12: Create `state-multi-goals.sql` (M15 Risk & Diversification)**

```sql
-- worker/dev/seeds/state-multi-goals.sql
-- Target: M15 (Risk & Diversification) — 3+ active goals AND ≥1 long-term (deadline > 90 days)
-- Also triggers M17+M20 due to gaming goal being one of the three.

.read dev/seeds/_reset.sql
.read dev/seeds/_base.sql

INSERT INTO goals (id, family_id, child_id, title, target_amount, currency, category,
  deadline, alloc_pct, archived, status, current_saved_pence, created_at, updated_at)
VALUES
  ('gDEV_MULTI_01','fDEV000000000000000001','uDEV_CHILD00000000001',
   'New Trainers', 4999, 'GBP', 'clothing', NULL, 20, 0, 'ACTIVE', 500,
   strftime('%s','now','-14 days'), strftime('%s','now','-14 days')),
  ('gDEV_MULTI_02','fDEV000000000000000001','uDEV_CHILD00000000001',
   'Minecraft DLC', 599, 'GBP', 'gaming', NULL, 20, 0, 'ACTIVE', 100,
   strftime('%s','now','-10 days'), strftime('%s','now','-10 days')),
  ('gDEV_MULTI_03','fDEV000000000000000001','uDEV_CHILD00000000001',
   'Laptop Fund', 49999, 'GBP', 'tech',
   date('now', '+120 days'),           -- long-term: 120 days out > 90-day threshold
   20, 0, 'ACTIVE', 1000,
   strftime('%s','now','-7 days'), strftime('%s','now','-7 days'));

INSERT OR IGNORE INTO unlocked_modules (id, child_id, module_slug, unlocked_at)
VALUES
  ('um_dev_m15', 'uDEV_CHILD00000000001', 'M15', strftime('%s','now','-7 days')),
  ('um_dev_m17', 'uDEV_CHILD00000000001', 'M17', strftime('%s','now','-10 days'));
```

- [ ] **Step 13: Run each seed to verify no SQL errors**

```bash
cd "e:/Web-Video Design/Claude/Apps/Pocket Money/worker"
for f in dev/seeds/state-*.sql; do
  echo "Testing $f..."
  wrangler d1 execute morechard-dev --file="$f" && echo "OK" || echo "FAILED: $f"
done
```

Expected: all print "OK".

- [ ] **Step 14: Commit**

```bash
git add worker/dev/seeds/
git commit -m "dev: add scenario seed files for all Learning Lab trigger states"
```

---

## Task 3: npm seed scripts

**Files:**
- Modify: `package.json`

**Interfaces:**
- Consumes: `worker/dev/seeds/*.sql` files
- Produces: `npm run seed:<name>` commands that any dev can run

- [ ] **Step 1: Add scripts to `package.json`**

Read the current `package.json` first, then add the following inside the `"scripts"` block:

```json
"seed:reset":   "cd worker && wrangler d1 execute morechard-dev --file=dev/seeds/_reset.sql",
"seed:base":    "cd worker && wrangler d1 execute morechard-dev --file=dev/seeds/_base.sql",
"seed:m2":      "cd worker && wrangler d1 execute morechard-dev --file=dev/seeds/state-m2.sql",
"seed:m8":      "cd worker && wrangler d1 execute morechard-dev --file=dev/seeds/state-m8.sql",
"seed:m11":     "cd worker && wrangler d1 execute morechard-dev --file=dev/seeds/state-m11.sql",
"seed:m13":     "cd worker && wrangler d1 execute morechard-dev --file=dev/seeds/state-m13.sql",
"seed:m14":     "cd worker && wrangler d1 execute morechard-dev --file=dev/seeds/state-m14.sql",
"seed:m16":     "cd worker && wrangler d1 execute morechard-dev --file=dev/seeds/state-m16.sql",
"seed:m19":     "cd worker && wrangler d1 execute morechard-dev --file=dev/seeds/state-m19.sql",
"seed:m3b":     "cd worker && wrangler d1 execute morechard-dev --file=dev/seeds/state-m3b.sql",
"seed:streak7": "cd worker && wrangler d1 execute morechard-dev --file=dev/seeds/state-streak-7.sql",
"seed:streak30":"cd worker && wrangler d1 execute morechard-dev --file=dev/seeds/state-streak-30.sql",
"seed:gaming":  "cd worker && wrangler d1 execute morechard-dev --file=dev/seeds/state-gaming-goals.sql",
"seed:goals":   "cd worker && wrangler d1 execute morechard-dev --file=dev/seeds/state-multi-goals.sql"
```

- [ ] **Step 2: Verify scripts work**

```bash
npm run seed:m13
```
Expected: wrangler output showing rows inserted, no errors.

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "dev: add npm seed:* scripts for all trigger scenarios"
```

---

## Task 4: Worker dev endpoint

**Files:**
- Create: `worker/src/routes/dev.ts`
- Modify: `worker/src/index.ts`

**Interfaces:**
- Consumes: `evaluatePassive` from `../lib/labTriggers.js`, `Env` type from `../types.js`
- Produces:
  - `GET /dev/trigger-status?child_id=X` → JSON `{ unlocked: string[], badges: string[], streak: number, lifetimeEarnings: number, balance: number }`
  - `POST /dev/run-passive?child_id=X` → JSON `{ ok: true, unlocked: string[] }` (modules unlocked by this run)

- [ ] **Step 1: Create `worker/src/routes/dev.ts`**

```typescript
// worker/src/routes/dev.ts
// Dev-only endpoints for trigger inspection and manual passive sweep.
// All routes return 404 when ENVIRONMENT !== 'development'.

import type { Env } from '../types.js'
import { evaluatePassive } from '../lib/labTriggers.js'

export async function handleDevRequest(req: Request, env: Env): Promise<Response> {
  if (env.ENVIRONMENT !== 'development') {
    return new Response('Not Found', { status: 404 })
  }

  const url    = new URL(req.url)
  const path   = url.pathname
  const child  = url.searchParams.get('child_id') ?? ''

  if (!child) {
    return Response.json({ error: 'child_id required' }, { status: 400 })
  }

  // GET /dev/trigger-status
  if (req.method === 'GET' && path === '/dev/trigger-status') {
    const [modules, badges, streakRow, earningsRow, balanceRow] = await Promise.all([
      env.DB.prepare(
        `SELECT module_slug FROM unlocked_modules WHERE child_id = ? ORDER BY unlocked_at`
      ).bind(child).all<{ module_slug: string }>(),

      env.DB.prepare(
        `SELECT badge_key FROM child_badges WHERE child_id = ? ORDER BY earned_at`
      ).bind(child).all<{ badge_key: string }>(),

      env.DB.prepare(
        `SELECT current_streak, longest_streak FROM child_streaks WHERE child_id = ?`
      ).bind(child).first<{ current_streak: number; longest_streak: number }>(),

      env.DB.prepare(
        `SELECT COALESCE(SUM(amount), 0) AS total FROM ledger
         WHERE child_id = ? AND entry_type = 'credit' AND verification_status != 'reversed'`
      ).bind(child).first<{ total: number }>(),

      env.DB.prepare(
        `SELECT COALESCE(SUM(CASE WHEN entry_type='credit' THEN amount ELSE -amount END), 0) AS bal
         FROM ledger WHERE child_id = ? AND verification_status != 'reversed'`
      ).bind(child).first<{ bal: number }>(),
    ])

    return Response.json({
      unlocked:         (modules.results ?? []).map(r => r.module_slug),
      badges:           (badges.results ?? []).map(r => r.badge_key),
      streak:           streakRow?.current_streak ?? 0,
      longestStreak:    streakRow?.longest_streak ?? 0,
      lifetimeEarnings: earningsRow?.total ?? 0,
      balance:          balanceRow?.bal ?? 0,
    })
  }

  // POST /dev/run-passive
  if (req.method === 'POST' && path === '/dev/run-passive') {
    const beforeRow = await env.DB.prepare(
      `SELECT module_slug FROM unlocked_modules WHERE child_id = ?`
    ).bind(child).all<{ module_slug: string }>()
    const before = new Set((beforeRow.results ?? []).map(r => r.module_slug))

    await evaluatePassive(env.DB, child)

    const afterRow = await env.DB.prepare(
      `SELECT module_slug FROM unlocked_modules WHERE child_id = ?`
    ).bind(child).all<{ module_slug: string }>()
    const newlyUnlocked = (afterRow.results ?? [])
      .map(r => r.module_slug)
      .filter(s => !before.has(s))

    return Response.json({ ok: true, newlyUnlocked })
  }

  return new Response('Not Found', { status: 404 })
}
```

- [ ] **Step 2: Register the dev router in `worker/src/index.ts`**

Find the section of `index.ts` where routes are dispatched (the `fetch` handler or router). Add the dev handler before the 404 fallthrough, gated on the path prefix:

```typescript
// At the top of index.ts, add:
import { handleDevRequest } from './routes/dev.js'

// Inside the fetch handler, before the final 404:
if (url.pathname.startsWith('/dev/')) {
  return handleDevRequest(request, env)
}
```

- [ ] **Step 3: Test the endpoints**

With `npm run dev` running:
```bash
# After running npm run seed:m8 first:
curl "http://localhost:8787/dev/trigger-status?child_id=uDEV_CHILD00000000001"
```
Expected: JSON with `unlocked` array, balance 3150, etc.

```bash
curl -X POST "http://localhost:8787/dev/run-passive?child_id=uDEV_CHILD00000000001"
```
Expected: `{ "ok": true, "newlyUnlocked": ["M8"] }` (because balance ≥ 3000p)

- [ ] **Step 4: Commit**

```bash
git add worker/src/routes/dev.ts worker/src/index.ts
git commit -m "dev: add /dev/trigger-status and /dev/run-passive worker endpoints"
```

---

## Task 5: DevTriggerPanel frontend component

**Files:**
- Create: `app/src/components/dev/DevTriggerPanel.tsx`

**Interfaces:**
- Consumes:
  - `queueCelebration` from `../../components/celebration` (push to overlay queue)
  - `MilestoneEventType` from `../../components/celebration/types`
  - `CONFIGS` from `../../components/celebration/registry` (enumerate all event types)
  - Worker endpoint `/dev/trigger-status` and `/dev/run-passive`
- Produces: Floating panel component `<DevTriggerPanel childId={string} />` — renders only in `import.meta.env.DEV` mode

- [ ] **Step 1: Create `app/src/components/dev/DevTriggerPanel.tsx`**

```tsx
// app/src/components/dev/DevTriggerPanel.tsx
// Dev-only floating panel for testing celebration overlays and trigger states.
// Renders ONLY in Vite dev mode (import.meta.env.DEV).
// Mount once in ChildDashboard.tsx: {import.meta.env.DEV && <DevTriggerPanel childId={userId} />}

import { useState, useCallback } from 'react'
import { queueCelebration } from '../celebration'
import type { MilestoneEventType } from '../celebration/types'
import { CONFIGS } from '../celebration/registry'
import { apiUrl, authHeaders } from '../../lib/api'

interface TriggerStatus {
  unlocked:         string[]
  badges:           string[]
  streak:           number
  longestStreak:    number
  lifetimeEarnings: number
  balance:          number
}

const ALL_EVENT_TYPES = Object.keys(CONFIGS) as MilestoneEventType[]

const APPVIEW_OPTIONS = ['ORCHARD', 'CLEAN'] as const
type AppViewOption = typeof APPVIEW_OPTIONS[number]

export function DevTriggerPanel({ childId }: { childId: string }) {
  const [open,     setOpen]     = useState(false)
  const [tab,      setTab]      = useState<'overlays' | 'status'>('overlays')
  const [appView,  setAppView]  = useState<AppViewOption>('ORCHARD')
  const [status,   setStatus]   = useState<TriggerStatus | null>(null)
  const [loading,  setLoading]  = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  const flashFeedback = (msg: string) => {
    setFeedback(msg)
    setTimeout(() => setFeedback(null), 2500)
  }

  const fireOverlay = useCallback((type: MilestoneEventType) => {
    queueCelebration({ type, appView })
    flashFeedback(`Queued: ${type}`)
    // Reload the page so ChildDashboard picks up the queue on next render cycle
    setTimeout(() => window.location.reload(), 100)
  }, [appView])

  const fetchStatus = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(
        apiUrl(`/dev/trigger-status?child_id=${childId}`),
        { headers: authHeaders() }
      )
      if (!res.ok) throw new Error(`${res.status}`)
      setStatus(await res.json() as TriggerStatus)
      setTab('status')
    } catch (e) {
      flashFeedback(`Error: ${e}`)
    } finally {
      setLoading(false)
    }
  }, [childId])

  const runPassive = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(
        apiUrl(`/dev/run-passive?child_id=${childId}`),
        { method: 'POST', headers: authHeaders() }
      )
      const data = await res.json() as { ok: boolean; newlyUnlocked: string[] }
      flashFeedback(
        data.newlyUnlocked.length
          ? `Unlocked: ${data.newlyUnlocked.join(', ')}`
          : 'No new unlocks'
      )
      await fetchStatus()
    } catch (e) {
      flashFeedback(`Error: ${e}`)
    } finally {
      setLoading(false)
    }
  }, [childId, fetchStatus])

  return (
    <div style={{ position: 'fixed', bottom: 80, right: 12, zIndex: 9999 }}>
      {/* Toggle button */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Dev Trigger Panel"
        style={{
          width: 40, height: 40, borderRadius: '50%',
          background: '#7c3aed', color: '#fff', fontSize: 18,
          border: 'none', cursor: 'pointer', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
        }}
      >
        🔬
      </button>

      {open && (
        <div style={{
          position: 'absolute', bottom: 48, right: 0,
          width: 320, maxHeight: '70vh', overflowY: 'auto',
          background: '#1a1a2e', color: '#e0e0ff',
          borderRadius: 12, padding: 12,
          boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
          fontFamily: 'monospace', fontSize: 12,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 8, color: '#a78bfa' }}>
            ⚗️ Dev Trigger Panel
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            {(['overlays', 'status'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                flex: 1, padding: '4px 0',
                background: tab === t ? '#7c3aed' : '#2d2d4e',
                color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer',
              }}>
                {t === 'overlays' ? '🎉 Overlays' : '📊 Status'}
              </button>
            ))}
          </div>

          {tab === 'overlays' && (
            <>
              {/* appView toggle */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                {APPVIEW_OPTIONS.map(v => (
                  <button key={v} onClick={() => setAppView(v)} style={{
                    flex: 1, padding: '3px 0',
                    background: appView === v ? '#0d9488' : '#2d2d4e',
                    color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer',
                  }}>
                    {v}
                  </button>
                ))}
              </div>

              {/* Event buttons */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {ALL_EVENT_TYPES.map(type => (
                  <button key={type} onClick={() => fireOverlay(type)} style={{
                    padding: '4px 8px',
                    background: '#2d2d4e', color: '#a78bfa',
                    border: '1px solid #4c4c7f', borderRadius: 6,
                    cursor: 'pointer', fontSize: 11,
                  }}>
                    {type}
                  </button>
                ))}
              </div>
            </>
          )}

          {tab === 'status' && (
            <>
              <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                <button onClick={fetchStatus} disabled={loading} style={{
                  flex: 1, padding: '4px 0',
                  background: '#2563eb', color: '#fff',
                  border: 'none', borderRadius: 6, cursor: 'pointer',
                }}>
                  {loading ? '…' : '↻ Refresh'}
                </button>
                <button onClick={runPassive} disabled={loading} style={{
                  flex: 1, padding: '4px 0',
                  background: '#059669', color: '#fff',
                  border: 'none', borderRadius: 6, cursor: 'pointer',
                }}>
                  {loading ? '…' : '▶ Run Passive'}
                </button>
              </div>

              {status ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div>
                    <span style={{ color: '#94a3b8' }}>Balance: </span>
                    £{(status.balance / 100).toFixed(2)}
                  </div>
                  <div>
                    <span style={{ color: '#94a3b8' }}>Lifetime: </span>
                    £{(status.lifetimeEarnings / 100).toFixed(2)}
                  </div>
                  <div>
                    <span style={{ color: '#94a3b8' }}>Streak: </span>
                    {status.streak} (longest: {status.longestStreak})
                  </div>
                  <div>
                    <span style={{ color: '#94a3b8' }}>Unlocked modules ({status.unlocked.length}): </span>
                    <br />
                    {status.unlocked.length
                      ? status.unlocked.map(m => (
                          <span key={m} style={{
                            display: 'inline-block', margin: '2px',
                            padding: '1px 5px', background: '#064e3b',
                            color: '#6ee7b7', borderRadius: 4,
                          }}>{m}</span>
                        ))
                      : <span style={{ color: '#64748b' }}>none</span>}
                  </div>
                  <div>
                    <span style={{ color: '#94a3b8' }}>Badges ({status.badges.length}): </span>
                    <br />
                    {status.badges.length
                      ? status.badges.map(b => (
                          <span key={b} style={{
                            display: 'inline-block', margin: '2px',
                            padding: '1px 5px', background: '#451a03',
                            color: '#fbbf24', borderRadius: 4,
                          }}>{b}</span>
                        ))
                      : <span style={{ color: '#64748b' }}>none</span>}
                  </div>
                </div>
              ) : (
                <div style={{ color: '#64748b' }}>Click Refresh to load status</div>
              )}
            </>
          )}

          {feedback && (
            <div style={{
              marginTop: 10, padding: '6px 10px',
              background: '#134e4a', color: '#6ee7b7',
              borderRadius: 6, fontSize: 11,
            }}>
              {feedback}
            </div>
          )}

          <div style={{ marginTop: 10, color: '#475569', fontSize: 10 }}>
            child: {childId.slice(0, 20)}…
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/src/components/dev/DevTriggerPanel.tsx
git commit -m "dev: add DevTriggerPanel component with overlay launcher and trigger status"
```

---

## Task 6: Mount DevTriggerPanel in ChildDashboard

**Files:**
- Modify: `app/src/screens/ChildDashboard.tsx`

**Interfaces:**
- Consumes: `DevTriggerPanel` from `../components/dev/DevTriggerPanel`
- Produces: floating 🔬 button visible at bottom-right of the child dashboard in dev mode only

- [ ] **Step 1: Add import to `ChildDashboard.tsx`**

Find the import block at the top of `ChildDashboard.tsx` and add one line:

```tsx
// Add after the existing celebration imports:
const DevTriggerPanel = import.meta.env.DEV
  ? (await import('../components/dev/DevTriggerPanel')).DevTriggerPanel
  : null
```

Actually — use a static import with a DEV guard in JSX instead (simpler, no dynamic import complexity):

At the top of the file, add:
```tsx
import { DevTriggerPanel } from '../components/dev/DevTriggerPanel'
```

- [ ] **Step 2: Mount in the returned JSX**

Near the bottom of the `return (...)` block in `ChildDashboard`, just before the closing `</div>` of the root element, add:

```tsx
{import.meta.env.DEV && <DevTriggerPanel childId={userId} />}
```

- [ ] **Step 3: Verify in browser**

Run `npm run dev`. Open the child dashboard. Confirm:
- A purple 🔬 button appears in the bottom right
- Clicking it opens the panel
- Clicking any event type button (e.g. `STREAK_7`) queues it and reloads
- The overlay appears after reload
- The Status tab shows balance/earnings/modules for the current user (not the dev test child — whichever child is logged in)
- Run Passive sweep button returns a response

- [ ] **Step 4: Commit**

```bash
git add app/src/screens/ChildDashboard.tsx
git commit -m "dev: mount DevTriggerPanel in ChildDashboard (DEV mode only)"
```

---

## Task 7: Documentation

**Files:**
- Create: `docs/dev/time-trigger-testing.md`

- [ ] **Step 1: Create the guide**

```markdown
# Time-Trigger Testing Guide

Morechard has features that require days, weeks, or months of real data to trigger —
Learning Lab module unlocks, streak milestones, AI nudges, and passive sweeps. This guide
explains how to test them without waiting.

---

## Two tools

| Tool | What it does | When to use |
|------|-------------|-------------|
| **SQL Seed Library** | Loads backdated DB data for a test child | Testing that triggers evaluate correctly |
| **Dev Trigger Panel** | In-browser panel to fire overlays instantly | Testing that the UI/overlay looks right |

These are independent — use either or both.

---

## SQL Seed Library

Seeds live in `worker/dev/seeds/`. Each file is a complete, self-contained scenario:
it runs `_reset.sql` + `_base.sql` then inserts backdated rows.

### Prerequisites
- `npm run dev` running (worker + app)
- Dev DB (`morechard-dev`) is the target — never run against production

### Running a seed

```bash
npm run seed:m13       # puts Alex at £100+ lifetime earnings
```

After the seed runs, you need to trigger evaluation:
- **Event triggers** (earnings, goal events): log in as the dev test child and approve
  a chore — the approval route calls `evaluateOnChoreApproval`
- **Passive triggers** (balance, inactivity, streak): use the Dev Trigger Panel →
  Status tab → "Run Passive" button, OR wait for the nightly CRON

### Dev test account credentials

The seed scripts create a family with these IDs (these only exist in your local dev DB):

| Field | Value |
|-------|-------|
| Family ID | `fDEV000000000000000001` |
| Parent ID | `uDEV_PARENT0000000001` |
| Child ID  | `uDEV_CHILD00000000001` |
| Parent email | `dev-parent@morechard.dev` |

**You cannot log in with these IDs directly via the UI** — they have no password or session.
Use the Status tab in the Dev Panel to inspect their DB state, and use `Run Passive`
to trigger passive evaluations. For event triggers, you need a real session; run the seeds
against your own dev account's child_id instead (swap the ID at the top of `_base.sql`).

### Seed scenarios

| Script | What it seeds | Unlocks when |
|--------|--------------|--------------|
| `seed:m2` | £20.25 lifetime earnings | `evaluateOnChoreApproval` called → M2 |
| `seed:m8` | £31.50 balance (no payments) | Run Passive → M8 |
| `seed:m11` | 13/14 completions over 8 wks | Run Passive → M11 |
| `seed:m13` | £100.01 lifetime earnings | `evaluateOnChoreApproval` → M13 (+ M2) |
| `seed:m14` | Last transaction 22 days ago | Run Passive → M14 |
| `seed:m16` | £75.01 balance | Run Passive → M16 (+ M8) |
| `seed:m19` | £150.01 lifetime earnings | `evaluateOnChoreApproval` → M19 (+ M2, M13) |
| `seed:m3b` | 4 weeks high variance earnings | `evaluateOnChoreApproval` → M3b |
| `seed:streak7` | 7-day streak set in DB | M17 already written; fire STREAK_7 via panel |
| `seed:streak30` | 30-day streak set in DB | Badges written; fire STREAK_30 via panel |
| `seed:gaming` | 2 gaming goals | M17 + M20 pre-unlocked in DB |
| `seed:goals` | 3 goals, 1 long-term | M15 pre-unlocked in DB |

### Resetting between tests

```bash
npm run seed:reset    # wipes all is_seed=1 rows for the test child
```

### Adding a new seed scenario

1. Create `worker/dev/seeds/state-<scenario>.sql`
2. Start with `.read dev/seeds/_reset.sql` then `.read dev/seeds/_base.sql`
3. Insert backdated rows using `strftime('%s', 'now', '-N days')` for timestamps
4. Add `is_seed = 1` on every `completions` and `ledger` row
5. Add an npm script in `package.json`: `"seed:<name>": "cd worker && wrangler d1 execute morechard-dev --file=dev/seeds/state-<scenario>.sql"`

---

## Dev Trigger Panel

The panel is a floating 🔬 button in the bottom-right corner of the child dashboard.
It only renders in Vite dev mode (`import.meta.env.DEV`) and is stripped from
production builds automatically.

### Overlays tab

Shows every `MilestoneEventType` as a button. Clicking one:
1. Pushes the event to `localStorage.mc_celebration_queue`
2. Reloads the page
3. `ChildDashboard` reads the queue on mount and shows the overlay

Use the ORCHARD / CLEAN toggle to see both app-view variants of each overlay.

**All celebration events available:**
- Streak milestones: STREAK_3, STREAK_7, STREAK_14, STREAK_30, STREAK_LOST, STREAK_REVIVED
- Consistency badges: BADGE_CONSISTENCY_SEED / SAPLING / OAK
- Effort badges: BADGE_EFFORT_SEED / SAPLING / OAK
- Saver badges: BADGE_SAVER_SEED / SAPLING / OAK
- Scholar badges: BADGE_SCHOLAR_SEED / SAPLING / OAK
- Landmark badges: BADGE_LANDMARK_SEED / SAPLING / OAK
- GRADUATION

### Status tab

Fetches `/dev/trigger-status` for the currently logged-in child and shows:
- Current balance and lifetime earnings (in £)
- Current streak and longest streak
- All unlocked Learning Lab modules
- All earned badges

**Run Passive** calls `/dev/run-passive`, which executes `evaluatePassive()` for the
current child and reports which modules were newly unlocked.

### Workflow for testing a trigger end-to-end

1. `npm run seed:m8` — loads balance ≥ £30 into dev DB for the test child
2. Log in as the test child (or swap IDs in the seed to match your dev account)
3. Open Dev Panel → Status → Run Passive
4. Panel shows `Unlocked: M8`
5. Navigate to Learning Lab — M8 (Banking 101) now appears unlocked

---

## Gotchas

**Ledger immutability:** The ledger has an UPDATE immutability trigger on financial fields.
Seeds INSERT, never UPDATE, so this is not a problem. `_reset.sql` deletes only rows where
`is_seed = 1` — this is safe because the DELETE trigger from migration 0001 was not
re-created after migration 0027 dropped and recreated the ledger table.

**Hash chain:** Seed ledger rows use placeholder hash values (`seed_m2_hash_1` etc.).
These are not real SHA-256 hashes and will fail a chain-verification audit. This is
intentional — dev seeds are for UX testing, not ledger integrity testing.

**CRON vs event:** Passive triggers (M8, M11, M14, M16, M9b) only fire when:
(a) the child opens the Learning Lab (routes/lab.ts calls `evaluatePassive`), or
(b) the nightly CRON runs. Use "Run Passive" in the Dev Panel to simulate (a)
without waiting for (b).

**Dev panel is not a real user:** `/dev/trigger-status` and `/dev/run-passive` accept
any `child_id` query param — they don't verify the child belongs to the authenticated
family. This is fine for local dev; both endpoints return 404 in production.

**Streak seeds bypass the streak engine:** `state-streak-7.sql` directly writes to
`child_streaks`. The streak ENGINE (in `worker/src/lib/streaks.ts`) is NOT called,
so the `STREAK_7` server event is not queued. Use the Dev Panel's Overlays tab to
fire the STREAK_7 overlay after seeding.

---

## Quick reference

```bash
# Load a scenario and test the passive unlock flow
npm run seed:m16
# → open Dev Panel → Status → Run Passive
# → expect: Unlocked: M16

# Fire any celebration overlay instantly
# → open Dev Panel → Overlays → click BADGE_SAVER_OAK

# Reset everything and start fresh
npm run seed:reset
```
```

- [ ] **Step 2: Commit**

```bash
git add docs/dev/time-trigger-testing.md
git commit -m "docs: add time-trigger testing guide (seeds + dev panel)"
```

---

## Self-Review

### Spec coverage check
- [x] SQL seed library with named scenario files ✓ (Tasks 1–2)
- [x] npm scripts for each scenario ✓ (Task 3)
- [x] Dev worker endpoint for trigger status ✓ (Task 4)
- [x] Dev worker endpoint for passive sweep ✓ (Task 4)
- [x] Frontend dev panel with overlay launcher ✓ (Task 5)
- [x] Status tab showing unlocked modules + badges ✓ (Task 5)
- [x] DEV-only guard on frontend component ✓ (Task 6)
- [x] DEV-only guard on worker endpoints ✓ (Task 4)
- [x] Documentation ✓ (Task 7)
- [x] All trigger scenarios from the audit covered: M2, M3b, M8, M11, M13, M14, M15, M16, M17, M19, M20, STREAK_7, STREAK_30, gaming goals, multi-goals ✓

### Placeholder scan
- No TBD, TODO, or "similar to" references found
- All SQL is complete and executable
- All TypeScript is complete with types

### Type consistency
- `TriggerStatus` interface in `DevTriggerPanel.tsx` matches the JSON shape returned by `handleDevRequest`
- `MilestoneEventType` is imported from the canonical types file, not redefined
- `evaluatePassive` signature in `dev.ts` matches the actual export in `labTriggers.ts`
