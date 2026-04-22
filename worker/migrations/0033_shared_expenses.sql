-- 0033_shared_expenses.sql
-- Parallel immutable ledger for parent-to-parent shared costs.
-- Anchored to family_id (not child_id). Children never see this table.

CREATE TABLE IF NOT EXISTS shared_expenses (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id           TEXT    NOT NULL REFERENCES families(id),
  logged_by           TEXT    NOT NULL REFERENCES users(id),
  authorised_by       TEXT    REFERENCES users(id),
  description         TEXT    NOT NULL,
  category            TEXT    NOT NULL
                              CHECK (category IN ('education','health','clothing','travel','activities','other')),
  total_amount        INTEGER NOT NULL CHECK (total_amount > 0),
  currency            TEXT    NOT NULL CHECK (currency IN ('GBP', 'PLN', 'USD')),
  -- logged_by's share in basis points (0–10000). 5000 = 50/50.
  -- Other parent's share = 10000 - split_bp.
  split_bp            INTEGER NOT NULL DEFAULT 5000
                              CHECK (split_bp BETWEEN 0 AND 10000),
  verification_status TEXT    NOT NULL DEFAULT 'pending'
                              CHECK (verification_status IN (
                                'committed_auto',
                                'pending',
                                'committed_manual',
                                'rejected',
                                'voided',
                                'reversed'
                              )),
  attachment_key      TEXT,
  settlement_period   TEXT,
  reconciled_at       INTEGER,
  reconciled_by       TEXT    REFERENCES users(id),
  -- SHA-256 chain. Hash written at commit time only; pending rows carry 'PENDING'.
  previous_hash       TEXT    NOT NULL,
  record_hash         TEXT    NOT NULL,
  ip_address          TEXT    NOT NULL,
  created_at          INTEGER NOT NULL DEFAULT (unixepoch()),
  deleted_at          INTEGER
);

-- Committed rows are immutable. Pending/rejected/voided may transition.
CREATE TRIGGER IF NOT EXISTS shared_expenses_no_update
  BEFORE UPDATE ON shared_expenses
  WHEN OLD.verification_status IN ('committed_auto', 'committed_manual', 'reversed')
BEGIN
  SELECT RAISE(ABORT, 'Committed shared_expense rows are immutable. Use a reversal entry.');
END;

CREATE TRIGGER IF NOT EXISTS shared_expenses_no_delete
  BEFORE DELETE ON shared_expenses
BEGIN
  SELECT RAISE(ABORT, 'shared_expense rows cannot be deleted. Use deleted_at for soft-delete.');
END;

CREATE INDEX IF NOT EXISTS idx_shared_exp_family ON shared_expenses (family_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shared_exp_period ON shared_expenses (family_id, settlement_period);
