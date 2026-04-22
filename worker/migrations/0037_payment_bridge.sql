-- 0037_payment_bridge.sql
-- Payment Bridge V1: per-completion payout timestamp + per-user payment handles.
-- paid_out_at is delivery metadata; it does NOT affect the ledger hash chain.
-- Handle columns go on `users` because Morechard holds both parents and children
-- in that single table (role resolved via family_roles). Parent rows with these
-- columns NULL is harmless.

ALTER TABLE completions ADD COLUMN paid_out_at INTEGER;

ALTER TABLE users ADD COLUMN monzo_handle TEXT;
ALTER TABLE users ADD COLUMN revolut_handle TEXT;
ALTER TABLE users ADD COLUMN paypal_handle TEXT;
ALTER TABLE users ADD COLUMN venmo_handle TEXT;
