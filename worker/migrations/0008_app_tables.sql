-- Migration 0008: Full app tables
-- Adds chores, plans, goals, subscriptions, spending, payouts,
-- suggestions, child_logins, push_subscriptions, user_settings.
-- All currency values stored as INTEGER (pence/groszy). No floats.
-- All timestamps stored as INTEGER (unixepoch).

-- ============================================================
-- USER SETTINGS (avatar, preferences per user)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_settings (
  user_id       TEXT    PRIMARY KEY REFERENCES users(id),
  avatar_id     TEXT    NOT NULL DEFAULT 'bot',   -- matches AVATARS[].id in frontend
  theme         TEXT    NOT NULL DEFAULT 'system'
                        CHECK (theme IN ('light', 'dark', 'system')),
  locale        TEXT    NOT NULL DEFAULT 'en',
  updated_at    INTEGER NOT NULL DEFAULT (unixepoch())
);

-- ============================================================
-- CHORES (job definitions created by a parent)
-- ============================================================
CREATE TABLE IF NOT EXISTS chores (
  id              TEXT    PRIMARY KEY,
  family_id       TEXT    NOT NULL REFERENCES families(id),
  assigned_to     TEXT    NOT NULL REFERENCES users(id),   -- child
  created_by      TEXT    NOT NULL REFERENCES users(id),   -- parent
  title           TEXT    NOT NULL,
  description     TEXT,                                    -- optional instructions
  reward_amount   INTEGER NOT NULL CHECK (reward_amount > 0),
  currency        TEXT    NOT NULL CHECK (currency IN ('GBP','PLN')),
  frequency       TEXT    NOT NULL DEFAULT 'as_needed'
                          CHECK (frequency IN (
                            'daily','weekly','bi_weekly','monthly','quarterly','as_needed'
                          )),
  due_date        TEXT,                                    -- ISO date YYYY-MM-DD, nullable
  is_priority     INTEGER NOT NULL DEFAULT 0,              -- boolean
  is_flash        INTEGER NOT NULL DEFAULT 0,              -- boolean — time-limited job
  flash_deadline  TEXT,                                    -- datetime-local string
  archived        INTEGER NOT NULL DEFAULT 0,              -- soft delete
  created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at      INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_chores_family   ON chores (family_id, archived, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chores_child    ON chores (assigned_to, archived);

-- ============================================================
-- COMPLETIONS (child marks a chore done → pending ledger entry)
-- ============================================================
CREATE TABLE IF NOT EXISTS completions (
  id              TEXT    PRIMARY KEY,
  family_id       TEXT    NOT NULL REFERENCES families(id),
  chore_id        TEXT    NOT NULL REFERENCES chores(id),
  child_id        TEXT    NOT NULL REFERENCES users(id),
  note            TEXT,                                    -- optional note from child
  status          TEXT    NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','approved','rejected')),
  rejection_note  TEXT,                                    -- filled when rejected
  ledger_id       INTEGER REFERENCES ledger(id),          -- set when approved
  rating          INTEGER DEFAULT 0,                       -- 1 thumbs up / -1 thumbs down / 0 none
  submitted_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  resolved_at     INTEGER,
  resolved_by     TEXT    REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_completions_family  ON completions (family_id, status, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_completions_child   ON completions (child_id, submitted_at DESC);

-- ============================================================
-- SUGGESTIONS (child proposes a new job)
-- ============================================================
CREATE TABLE IF NOT EXISTS suggestions (
  id              TEXT    PRIMARY KEY,
  family_id       TEXT    NOT NULL REFERENCES families(id),
  child_id        TEXT    NOT NULL REFERENCES users(id),
  title           TEXT    NOT NULL,
  frequency       TEXT,
  proposed_amount INTEGER NOT NULL CHECK (proposed_amount > 0),
  reason          TEXT,
  status          TEXT    NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','approved','rejected')),
  rejection_note  TEXT,
  submitted_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  resolved_at     INTEGER,
  resolved_by     TEXT    REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_suggestions_family ON suggestions (family_id, status);

-- ============================================================
-- PLANS (child's weekly job planner — which days a job is scheduled)
-- ============================================================
CREATE TABLE IF NOT EXISTS plans (
  id          TEXT    PRIMARY KEY,
  family_id   TEXT    NOT NULL REFERENCES families(id),
  chore_id    TEXT    NOT NULL REFERENCES chores(id),
  child_id    TEXT    NOT NULL REFERENCES users(id),
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),  -- 0=Mon, 6=Sun
  week_start  TEXT    NOT NULL,  -- ISO date of the Monday of that week
  added_at    INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_plans_child_week ON plans (child_id, week_start);

-- ============================================================
-- GOALS (child savings goals — up to 5 per child)
-- ============================================================
CREATE TABLE IF NOT EXISTS goals (
  id            TEXT    PRIMARY KEY,
  family_id     TEXT    NOT NULL REFERENCES families(id),
  child_id      TEXT    NOT NULL REFERENCES users(id),
  title         TEXT    NOT NULL,
  target_amount INTEGER NOT NULL CHECK (target_amount > 0),
  currency      TEXT    NOT NULL CHECK (currency IN ('GBP','PLN')),
  category      TEXT    NOT NULL DEFAULT 'other',  -- emoji category id
  deadline      TEXT,                              -- ISO date, nullable
  alloc_pct     INTEGER NOT NULL DEFAULT 0
                        CHECK (alloc_pct BETWEEN 0 AND 100),  -- auto-save %
  match_rate    INTEGER NOT NULL DEFAULT 0
                        CHECK (match_rate IN (0,10,25,50,100)), -- parent match %
  sort_order    INTEGER NOT NULL DEFAULT 0,
  archived      INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at    INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_goals_child ON goals (child_id, archived, sort_order);

-- ============================================================
-- SPENDING (child purchases — debit from balance)
-- ============================================================
CREATE TABLE IF NOT EXISTS spending (
  id          TEXT    PRIMARY KEY,
  family_id   TEXT    NOT NULL REFERENCES families(id),
  child_id    TEXT    NOT NULL REFERENCES users(id),
  title       TEXT    NOT NULL,
  amount      INTEGER NOT NULL CHECK (amount > 0),
  currency    TEXT    NOT NULL CHECK (currency IN ('GBP','PLN')),
  note        TEXT,
  goal_id     TEXT    REFERENCES goals(id),   -- NULL unless goal spend
  spent_at    INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_spending_child ON spending (child_id, spent_at DESC);

-- ============================================================
-- PAYOUTS (parent pays child cash — credit outside ledger)
-- ============================================================
CREATE TABLE IF NOT EXISTS payouts (
  id          TEXT    PRIMARY KEY,
  family_id   TEXT    NOT NULL REFERENCES families(id),
  child_id    TEXT    NOT NULL REFERENCES users(id),
  paid_by     TEXT    NOT NULL REFERENCES users(id),   -- parent
  amount      INTEGER NOT NULL CHECK (amount > 0),
  currency    TEXT    NOT NULL CHECK (currency IN ('GBP','PLN')),
  note        TEXT,
  paid_at     INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_payouts_child ON payouts (child_id, paid_at DESC);

-- ============================================================
-- SUBSCRIPTIONS (recurring costs deducted from child balance)
-- ============================================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id          TEXT    PRIMARY KEY,
  family_id   TEXT    NOT NULL REFERENCES families(id),
  child_id    TEXT    NOT NULL REFERENCES users(id),
  title       TEXT    NOT NULL,
  category    TEXT    NOT NULL DEFAULT 'other',
  amount      INTEGER NOT NULL CHECK (amount > 0),
  currency    TEXT    NOT NULL CHECK (currency IN ('GBP','PLN')),
  frequency   TEXT    NOT NULL DEFAULT 'monthly'
              CHECK (frequency IN ('weekly','monthly','annual')),
  start_date  TEXT    NOT NULL,   -- ISO date
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_subs_child ON subscriptions (child_id, active);

-- ============================================================
-- BONUS PAYMENTS (parent awards extra payment)
-- ============================================================
CREATE TABLE IF NOT EXISTS bonus_payments (
  id          TEXT    PRIMARY KEY,
  family_id   TEXT    NOT NULL REFERENCES families(id),
  child_id    TEXT    NOT NULL REFERENCES users(id),
  paid_by     TEXT    NOT NULL REFERENCES users(id),
  amount      INTEGER NOT NULL CHECK (amount > 0),
  currency    TEXT    NOT NULL CHECK (currency IN ('GBP','PLN')),
  reason      TEXT    NOT NULL,
  ledger_id   INTEGER REFERENCES ledger(id),
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

-- ============================================================
-- CHILD LOGINS (audit log — login events per child)
-- ============================================================
CREATE TABLE IF NOT EXISTS child_logins (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id   TEXT    NOT NULL REFERENCES families(id),
  child_id    TEXT    NOT NULL REFERENCES users(id),
  ip_address  TEXT    NOT NULL,
  logged_at   INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_child_logins ON child_logins (child_id, logged_at DESC);

-- ============================================================
-- PUSH SUBSCRIPTIONS (Web Push VAPID — one per user device)
-- ============================================================
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      TEXT    NOT NULL REFERENCES users(id),
  family_id    TEXT    NOT NULL REFERENCES families(id),
  endpoint     TEXT    NOT NULL UNIQUE,
  p256dh       TEXT    NOT NULL,   -- client public key
  auth_key     TEXT    NOT NULL,   -- client auth secret
  user_agent   TEXT,
  created_at   INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions (user_id);

-- ============================================================
-- PARENT MESSAGE (one active message per parent per child)
-- ============================================================
CREATE TABLE IF NOT EXISTS parent_messages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id   TEXT    NOT NULL REFERENCES families(id),
  from_user   TEXT    NOT NULL REFERENCES users(id),  -- parent
  to_child    TEXT    NOT NULL REFERENCES users(id),  -- child
  message     TEXT    NOT NULL,
  expires_at  INTEGER NOT NULL,                       -- created_at + 7 days
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE (from_user, to_child)   -- one active message per pair, upserted
);

-- ============================================================
-- ACCOUNT LOCKS (parent can lock child login temporarily)
-- ============================================================
CREATE TABLE IF NOT EXISTS account_locks (
  user_id     TEXT    PRIMARY KEY REFERENCES users(id),
  locked_by   TEXT    NOT NULL REFERENCES users(id),
  locked_until INTEGER NOT NULL,
  reason      TEXT,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
