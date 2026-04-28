-- Migration 0047: marketing consent + email send log

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

CREATE TABLE IF NOT EXISTS email_sends (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id             TEXT    NOT NULL REFERENCES users(id),
  family_id           TEXT    NOT NULL REFERENCES families(id),
  template_id         TEXT    NOT NULL,
  status              TEXT    NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'sent', 'failed')),
  provider_message_id TEXT,
  created_at          INTEGER NOT NULL DEFAULT (unixepoch()),
  sent_at             INTEGER
);

CREATE INDEX IF NOT EXISTS idx_email_sends_family_template
  ON email_sends (family_id, template_id);
