-- Migration 0055: email_verify_tokens
--
-- Stores short-lived tokens used to confirm a new email address
-- before it replaces the existing one. Each row is single-use and
-- expires after 24 hours.

CREATE TABLE IF NOT EXISTS email_verify_tokens (
  id         INTEGER  PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT     NOT NULL UNIQUE,
  new_email  TEXT     NOT NULL,
  expires_at INTEGER  NOT NULL,  -- unix timestamp
  used_at    INTEGER             -- set on consumption; NULL = unused
);

CREATE INDEX IF NOT EXISTS idx_evt_token   ON email_verify_tokens (token);
CREATE INDEX IF NOT EXISTS idx_evt_user_id ON email_verify_tokens (user_id);
