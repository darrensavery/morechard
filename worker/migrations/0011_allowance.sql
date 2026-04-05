-- Migration 0011: Weekly allowance support
--
-- Adds per-child allowance settings and an idempotency log for the
-- Saturday payday cron so retries never double-pay.
--
-- allowance_amount : pence / groszy (0 = no allowance)
-- allowance_day    : ISO weekday the parent prefers payment (0=Mon … 6=Sun)
--                    Worker always pays on Saturday (6) unless overridden.

ALTER TABLE users ADD COLUMN allowance_amount INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN allowance_day    INTEGER NOT NULL DEFAULT 6
  CHECK (allowance_day BETWEEN 0 AND 6);

-- ============================================================
-- PAYDAY LOG  — one row per child per week_start
-- UNIQUE constraint is the idempotency key.
-- ============================================================
CREATE TABLE IF NOT EXISTS payday_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id   TEXT    NOT NULL REFERENCES families(id),
  child_id    TEXT    NOT NULL REFERENCES users(id),
  week_start  TEXT    NOT NULL,   -- ISO date of the Monday of that week (YYYY-MM-DD)
  ledger_id   INTEGER NOT NULL REFERENCES ledger(id),
  paid_at     INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE (child_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_payday_child ON payday_log (child_id, week_start DESC);
