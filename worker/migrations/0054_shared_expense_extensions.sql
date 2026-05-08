-- 0050_shared_expense_extensions.sql
-- Adds receipt storage, hash versioning, and void-and-re-log support to shared_expenses.
--
-- Because D1 does not support ALTER COLUMN or CHECK constraint changes,
-- we rebuild the table via RENAME → CREATE NEW → INSERT → DROP OLD.
-- All existing data is preserved; all triggers and indexes are recreated.

-- Step 1: drop triggers that reference the old table name (they will be recreated)
DROP TRIGGER IF EXISTS shared_expenses_immutable_fields;
DROP TRIGGER IF EXISTS shared_expenses_committed_immutable;
DROP TRIGGER IF EXISTS shared_expenses_no_delete;

-- Step 2: rename old table
ALTER TABLE shared_expenses RENAME TO shared_expenses_old;

-- Step 3: create new table with extended schema
CREATE TABLE shared_expenses (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id             TEXT    NOT NULL REFERENCES families(id),
  logged_by             TEXT    NOT NULL REFERENCES users(id),
  authorised_by         TEXT    REFERENCES users(id),
  description           TEXT    NOT NULL,
  category              TEXT    NOT NULL
                                CHECK (category IN (
                                  'education','health','clothing','travel','activities',
                                  'childcare','food','tech','gifts','other'
                                )),
  total_amount          INTEGER NOT NULL CHECK (total_amount > 0),
  currency              TEXT    NOT NULL CHECK (currency IN ('GBP', 'PLN', 'USD')),
  split_bp              INTEGER NOT NULL DEFAULT 5000
                                CHECK (split_bp BETWEEN 0 AND 10000),
  verification_status   TEXT    NOT NULL DEFAULT 'pending'
                                CHECK (verification_status IN (
                                  'committed_auto',
                                  'pending',
                                  'committed_manual',
                                  'rejected',
                                  'voided',
                                  'reversed'
                                )),
  attachment_key        TEXT,
  settlement_period     TEXT,
  reconciled_at         INTEGER,
  reconciled_by         TEXT    REFERENCES users(id),

  -- Hash chain (hash_version=1 = legacy, hash_version=2 = extended)
  hash_version          INTEGER NOT NULL DEFAULT 1,
  previous_hash         TEXT    NOT NULL,
  record_hash           TEXT    NOT NULL,
  ip_address            TEXT    NOT NULL,
  created_at            INTEGER NOT NULL DEFAULT (unixepoch()),
  deleted_at            INTEGER,

  -- New in 0050: date + note fields
  expense_date          TEXT,           -- ISO date string e.g. '2026-05-04'; null = use created_at
  note                  TEXT,           -- optional free-text; included in hash v2

  -- New in 0050: receipt attachment (dedicated RECEIPTS R2 bucket)
  receipt_r2_key        TEXT,           -- {family_id}/{id}/{timestamp}.{ext}
  receipt_hash          TEXT,           -- SHA-256 hex of original receipt bytes; included in hash v2
  receipt_uploaded_at   INTEGER,        -- unix seconds; null until receipt attached

  -- New in 0050: void-and-re-log
  voided_at             INTEGER,        -- unix seconds; null = active
  voided_by             TEXT,           -- user_id of voiding parent
  voids_id              INTEGER REFERENCES shared_expenses(id)  -- FK to row this replaces; null on originals
);

-- Step 4: copy existing data (new columns get their DEFAULT values / NULL)
INSERT INTO shared_expenses (
  id, family_id, logged_by, authorised_by, description, category,
  total_amount, currency, split_bp, verification_status,
  attachment_key, settlement_period, reconciled_at, reconciled_by,
  hash_version, previous_hash, record_hash, ip_address, created_at, deleted_at
)
SELECT
  id, family_id, logged_by, authorised_by, description, category,
  total_amount, currency, split_bp, verification_status,
  attachment_key, settlement_period, reconciled_at, reconciled_by,
  1 AS hash_version, previous_hash, record_hash, ip_address, created_at, deleted_at
FROM shared_expenses_old;

-- Step 5: drop the old table
DROP TABLE shared_expenses_old;

-- Step 6: recreate indexes
CREATE INDEX IF NOT EXISTS idx_shared_exp_family ON shared_expenses (family_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shared_exp_period ON shared_expenses (family_id, settlement_period);
CREATE INDEX IF NOT EXISTS idx_shared_exp_active
  ON shared_expenses (family_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- Step 7: recreate triggers (field-level immutability)
CREATE TRIGGER IF NOT EXISTS shared_expenses_immutable_fields
  BEFORE UPDATE ON shared_expenses
  WHEN NEW.total_amount   != OLD.total_amount
    OR NEW.currency       != OLD.currency
    OR NEW.ip_address     != OLD.ip_address
    OR NEW.created_at     != OLD.created_at
    OR NEW.family_id      != OLD.family_id
    OR NEW.logged_by      != OLD.logged_by
BEGIN
  SELECT RAISE(ABORT, 'Immutable shared_expense fields cannot be changed after insert.');
END;

CREATE TRIGGER IF NOT EXISTS shared_expenses_committed_immutable
  BEFORE UPDATE ON shared_expenses
  WHEN (OLD.verification_status IN ('committed_auto', 'committed_manual', 'reversed')
        AND NEW.verification_status != OLD.verification_status)
BEGIN
  SELECT RAISE(ABORT, 'Committed shared_expense rows are immutable. Use a reversal entry.');
END;

CREATE TRIGGER IF NOT EXISTS shared_expenses_no_delete
  BEFORE DELETE ON shared_expenses
BEGIN
  SELECT RAISE(ABORT, 'shared_expense rows cannot be deleted. Use deleted_at for soft-delete.');
END;
