-- 0037_payment_bridge.sql
-- Payment Bridge V1: per-completion payout timestamp + per-child payment handles.
-- paid_out_at is delivery metadata; it does NOT affect the ledger hash chain.

ALTER TABLE completions ADD COLUMN paid_out_at INTEGER;

ALTER TABLE children ADD COLUMN monzo_handle TEXT;
ALTER TABLE children ADD COLUMN revolut_handle TEXT;
ALTER TABLE children ADD COLUMN paypal_handle TEXT;
ALTER TABLE children ADD COLUMN venmo_handle TEXT;
