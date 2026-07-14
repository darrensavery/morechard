-- 0081_marketing_consents.sql
--
-- Recreates marketing_consents (originally created by 0047_marketing_consent.sql,
-- which was dropped outside the migration system at some point after 2026-05-04
-- with no record of why - discovered while debugging a silent scheduled() crash).
--
-- email_sends (0047's other table) is intentionally NOT recreated: it backed
-- a Resend-based trial re-engagement email cron (worker/src/cron/marketing-emails.ts)
-- that was superseded by Brevo in May 2026 and is being removed in this same
-- change, not resurrected. marketing_consents itself IS still needed - it's
-- the first-party consent record for the registration opt-in checkbox
-- (POST /api/consent/marketing), which now also syncs the choice to Brevo
-- list 5.

CREATE TABLE IF NOT EXISTS marketing_consents (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         TEXT    NOT NULL REFERENCES users(id),
  consented       INTEGER NOT NULL CHECK (consented IN (0, 1)),
  consent_version TEXT    NOT NULL,
  ip_address      TEXT    NOT NULL,
  consented_at    INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_marketing_consents_user
  ON marketing_consents (user_id, consented_at DESC);
