-- 0082_shared_expenses_is_seed.sql
--
-- Recreates shared_expenses.is_seed, missing from production despite being
-- added by 0050_demo_enrichment.sql (recorded as applied on 2026-05-04, same
-- day marketing_consents/email_sends vanished — see 0081's comment). Found
-- via a full schema audit (every ADD COLUMN / CREATE TABLE across all
-- migrations, cross-checked against actual production schema) triggered by
-- this bug crashing the nightly demo-reset cron step on every tick, which
-- blocked every later scheduled() step including the Zoho Desk poll.
--
-- The audit found exactly one other gap (user_settings.teen_mode), which is
-- a legacy column superseded by app_view (migration 0025) and already
-- fails gracefully where it's still read (worker/src/routes/insights.ts
-- wraps the query in .catch(() => null)) - not recreated here, left as a
-- separate, non-blocking follow-up.

ALTER TABLE shared_expenses ADD COLUMN is_seed INTEGER NOT NULL DEFAULT 0;
