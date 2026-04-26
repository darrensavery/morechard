-- Migration 0043: pricing pivot
-- Adds has_ai_mentor (one-time unlock) to replace ai_subscription_expiry (annual sub).
-- ai_subscription_expiry is retained so existing payment_audit_log webhook idempotency
-- records remain valid; it is no longer written by new payment flows.
--
-- The back-fill UPDATE is omitted here because ai_subscription_expiry may not exist
-- in all environments (it was added directly to production schema, not via migration).
-- Production back-fill: run manually if needed —
--   UPDATE families SET has_ai_mentor = 1
--   WHERE ai_subscription_expiry IS NOT NULL
--     AND ai_subscription_expiry > datetime('now');

ALTER TABLE families ADD COLUMN has_ai_mentor INTEGER NOT NULL DEFAULT 0;
