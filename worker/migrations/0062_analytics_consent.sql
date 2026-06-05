-- Migration 0062: analytics consent (per-parent log + family-effective child flag)
--
-- Analytics (PostHog + Sentry replay) is non-essential, so it runs only with
-- consent. Adults consent for their own device. A CHILD's analytics is governed
-- by a family-effective flag computed with a VETO rule:
--
--   child_analytics_consent = (at least one parent opted IN) AND (no parent opted OUT)
--
-- Any parent's opt-out is a hard veto. The flag is recomputed by the worker on
-- every parent consent write and read by child/co-parent devices at join + boot.

CREATE TABLE IF NOT EXISTS analytics_consents (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         TEXT    NOT NULL REFERENCES users(id),
  consented       INTEGER NOT NULL CHECK (consented IN (0, 1)),
  consent_version TEXT    NOT NULL,
  ip_address      TEXT    NOT NULL,
  consented_at    INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_analytics_consents_user
  ON analytics_consents (user_id, consented_at DESC);

-- Family-effective child analytics flag. 0 = off (default until a parent opts in).
ALTER TABLE families ADD COLUMN child_analytics_consent INTEGER NOT NULL DEFAULT 0;
