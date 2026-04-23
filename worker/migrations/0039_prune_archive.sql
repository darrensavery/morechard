-- Migration 0039: Ledger prune archive + targeted immutability trigger
--
-- 1. Stores record_hash + previous_hash before PII scrub (hash-chain integrity).
-- 2. Adds pruned_at column so the UI can detect archived rows.
-- 3. Replaces the blanket BEFORE UPDATE trigger with one that only protects
--    hash-chain columns, allowing the prune UPDATE to zero PII columns.

CREATE TABLE IF NOT EXISTS ledger_prune_archive (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  ledger_id     INTEGER NOT NULL,
  record_hash   TEXT    NOT NULL,
  previous_hash TEXT    NOT NULL,
  archived_at   INTEGER NOT NULL
);

ALTER TABLE ledger ADD COLUMN pruned_at INTEGER;

-- Drop the blanket immutability trigger from 0001_initial_schema.sql
DROP TRIGGER IF EXISTS ledger_no_update;

-- Replace with a targeted trigger that only guards hash-chain integrity columns.
-- Updates to description, ip_address, receipt_id, pruned_at are permitted.
CREATE TRIGGER IF NOT EXISTS ledger_no_update_chain
  BEFORE UPDATE OF record_hash, previous_hash, amount, currency, entry_type ON ledger
BEGIN
  SELECT RAISE(ABORT, 'Ledger hash-chain columns are immutable.');
END;
