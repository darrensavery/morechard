-- Migration 0004: Relax ledger UPDATE trigger
--
-- The original blanket BEFORE UPDATE trigger blocks ALL updates, including
-- legitimate status transitions (pending → verified_manual, pending → disputed).
-- Immutability of financial fields (amount, currency, entry_type, record_hash,
-- previous_hash, ip_address, created_at) is enforced at the application layer —
-- these fields are never included in UPDATE statements issued by the API.
--
-- We drop the blanket trigger and replace it with field-level guards for the
-- fields that must never change after insert.

DROP TRIGGER IF EXISTS ledger_no_update;

-- Guard the fields that constitute the financial record and hash chain.
-- Any attempt to change amount, currency, entry_type, record_hash, previous_hash,
-- ip_address, or created_at will abort with an error.
CREATE TRIGGER IF NOT EXISTS ledger_immutable_fields
  BEFORE UPDATE ON ledger
  WHEN NEW.amount        != OLD.amount
    OR NEW.currency      != OLD.currency
    OR NEW.entry_type    != OLD.entry_type
    OR NEW.record_hash   != OLD.record_hash
    OR NEW.previous_hash != OLD.previous_hash
    OR NEW.ip_address    != OLD.ip_address
    OR NEW.created_at    != OLD.created_at
BEGIN
  SELECT RAISE(ABORT, 'Immutable ledger fields cannot be changed after insert.');
END;
