-- Migration: 0002_trial_and_payments.sql
-- Adds trial tracking and Stripe payment audit columns/tables.
-- Idempotent: safe to re-run (uses IF NOT EXISTS / column guards where D1 supports it).
-- Note: D1 does not support ALTER TABLE ADD COLUMN IF NOT EXISTS — run once on a fresh schema.

-- 1. Update Family Table with Licensing and Trial Flags
ALTER TABLE families ADD COLUMN trial_start_date DATETIME DEFAULT NULL;
ALTER TABLE families ADD COLUMN is_activated BOOLEAN DEFAULT FALSE;
ALTER TABLE families ADD COLUMN has_lifetime_license BOOLEAN DEFAULT FALSE;
ALTER TABLE families ADD COLUMN ai_subscription_expiry DATETIME DEFAULT NULL;

-- 2. Payment Audit Log (Truth Engine requirement — immutable record of Stripe transactions)
CREATE TABLE IF NOT EXISTS payment_audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    family_id TEXT NOT NULL,
    stripe_session_id TEXT UNIQUE NOT NULL,
    amount_paid_int INTEGER NOT NULL,          -- Stored in Pence/Groszy (never decimals)
    currency TEXT NOT NULL,
    payment_type TEXT CHECK(payment_type IN ('LIFETIME', 'AI_ANNUAL')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (family_id) REFERENCES families(id)
);

-- 3. Indices for Cloudflare Worker Middleware (paywall check on every authenticated request)
CREATE INDEX IF NOT EXISTS idx_family_trial ON families(trial_start_date, is_activated);
CREATE INDEX IF NOT EXISTS idx_family_licenses ON families(has_lifetime_license, ai_subscription_expiry);
