-- 0080_fix_ledger_old_fk.sql
--
-- Fixes a dangling foreign key left over from migration 0019's ledger
-- rebuild. 0019 renamed `ledger` -> `ledger_old` as an intermediate step
-- of its own CREATE-new/COPY/DROP-old/RENAME dance, then renamed the new
-- table back to `ledger`. Three tables created after 0019 -
-- currency_snapshots, payday_log, bonus_payments - were defined with
-- `REFERENCES "ledger_old"(id)` instead of the final table name `ledger`.
-- `ledger_old` no longer exists, and any D1 operation that triggers
-- foreign-key resolution against these three tables fails with
-- "no such table: main.ledger_old" - this was silently crashing every
-- scheduled() cron invocation (payday sweep, GDPR purge, and the Zoho
-- Desk poll all run in the same handler), discovered via Cloudflare
-- Workers Observability while verifying the Zoho Desk migration.
--
-- SQLite cannot ALTER a REFERENCES clause directly - standard rebuild:
-- create new -> copy -> drop old -> rename. No other table references
-- these three (confirmed via sqlite_master before writing this migration).

-- 1. currency_snapshots
CREATE TABLE currency_snapshots_new (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  ledger_id    INTEGER NOT NULL REFERENCES ledger(id),
  base         TEXT    NOT NULL CHECK (base IN ('GBP', 'PLN')),
  quote        TEXT    NOT NULL CHECK (quote IN ('GBP', 'PLN')),
  rate_bp      INTEGER NOT NULL CHECK (rate_bp > 0),
  captured_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
INSERT INTO currency_snapshots_new SELECT id, ledger_id, base, quote, rate_bp, captured_at FROM currency_snapshots;
DROP TABLE currency_snapshots;
ALTER TABLE currency_snapshots_new RENAME TO currency_snapshots;

-- 2. payday_log
CREATE TABLE payday_log_new (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id   TEXT    NOT NULL REFERENCES families(id),
  child_id    TEXT    NOT NULL REFERENCES users(id),
  week_start  TEXT    NOT NULL,
  ledger_id   INTEGER NOT NULL REFERENCES ledger(id),
  paid_at     INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE (child_id, week_start)
);
INSERT INTO payday_log_new SELECT id, family_id, child_id, week_start, ledger_id, paid_at FROM payday_log;
DROP TABLE payday_log;
ALTER TABLE payday_log_new RENAME TO payday_log;
CREATE INDEX IF NOT EXISTS idx_payday_child ON payday_log (child_id, week_start DESC);

-- 3. bonus_payments
CREATE TABLE bonus_payments_new (
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
INSERT INTO bonus_payments_new SELECT id, family_id, child_id, paid_by, amount, currency, reason, ledger_id, created_at FROM bonus_payments;
DROP TABLE bonus_payments;
ALTER TABLE bonus_payments_new RENAME TO bonus_payments;
