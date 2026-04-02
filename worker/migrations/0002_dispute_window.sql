-- Migration 0002: Add dispute window to ledger
--
-- dispute_before: Unix timestamp 48h after creation, set only on verified_auto rows.
-- NULL on pending / verified_manual / reversed rows — no dispute window applies.
-- Once the window passes, the column value is retained for audit purposes.

ALTER TABLE ledger ADD COLUMN dispute_before INTEGER;
