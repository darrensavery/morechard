-- 0034_shared_expense_settings.sql
-- Trust Threshold and default split for shared expense governance.

ALTER TABLE families ADD COLUMN shared_expense_threshold INTEGER NOT NULL DEFAULT 5000;
-- Expenses <= threshold → committed_auto (even in standard verify_mode).
-- Expenses > threshold + verify_mode='standard' → pending approval.
-- Stored in base currency minor units (pence/groszy/cents). Default: £50.00.

ALTER TABLE families ADD COLUMN shared_expense_split_bp INTEGER NOT NULL DEFAULT 5000;
-- Family-level default split in basis points. 5000 = 50/50.
-- Pre-populates the slider on each new expense entry. Per-transaction override allowed.
