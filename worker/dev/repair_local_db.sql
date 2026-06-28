-- worker/dev/repair_local_db.sql
-- One-time repair for the local D1 database.
--
-- Problem: migration 0001 created `chores` with 12 cols (no title/frequency/etc).
-- Migration 0009 tries to copy rows via SELECT * into a 16-col chores_new — fails.
--
-- Fix: drop the old schema-mismatch table, recreate with 0009's output schema,
-- mark 0009 as applied so wrangler skips it. Also skip the two non-standard
-- migrations (repair_production + seed_test_data_expand) which don't belong locally.
-- After running this file, execute: npx wrangler d1 migrations apply morechard-dev

PRAGMA foreign_keys = OFF;

DROP TABLE IF EXISTS chores;

CREATE TABLE chores (
  id              TEXT    PRIMARY KEY,
  family_id       TEXT    NOT NULL REFERENCES families(id),
  assigned_to     TEXT    NOT NULL REFERENCES users(id),
  created_by      TEXT    NOT NULL REFERENCES users(id),
  title           TEXT    NOT NULL,
  description     TEXT,
  reward_amount   INTEGER NOT NULL CHECK (reward_amount > 0),
  currency        TEXT    NOT NULL CHECK (currency IN ('GBP','PLN')),
  frequency       TEXT    NOT NULL DEFAULT 'as_needed'
                          CHECK (frequency IN (
                            'daily','weekly','bi_weekly','monthly',
                            'quarterly','as_needed','school_days'
                          )),
  due_date        TEXT,
  is_priority     INTEGER NOT NULL DEFAULT 0,
  is_flash        INTEGER NOT NULL DEFAULT 0,
  flash_deadline  TEXT,
  archived        INTEGER NOT NULL DEFAULT 0,
  created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at      INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_chores_family ON chores (family_id, archived, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chores_child  ON chores (assigned_to, archived);

-- Mark these as applied so wrangler skips them:
--   0009 — we just applied its DDL above
--   repair_production — production-only DDL, not needed locally
--   seed_test_data_expand — wrong test data, we use our own seed scripts
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0009_school_days_frequency.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('repair_production.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('seed_test_data_expand.sql');

PRAGMA foreign_keys = ON;
