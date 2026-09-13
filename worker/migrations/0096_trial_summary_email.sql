-- 0096_trial_summary_email.sql
--
-- Tracks whether a family has already been sent their end-of-trial usage
-- summary email, so the daily cron job is idempotent across retries/reruns.

ALTER TABLE families ADD COLUMN trial_summary_sent_at INTEGER DEFAULT NULL;
