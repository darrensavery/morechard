-- Migration 0006: Auth layer
--
-- Adds password_hash, pin_hash, email_verified to users.
-- Adds magic_link_tokens table for passwordless login.
-- Adds sessions table for JWT revocation (optional hard-logout).

ALTER TABLE users ADD COLUMN password_hash  TEXT;     -- PBKDF2 hash, NULL for magic-link-only parents
ALTER TABLE users ADD COLUMN pin_hash       TEXT;     -- PBKDF2 hash, only set for child accounts
ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0;

-- ----------------------------------------------------------------
-- Magic link tokens (single-use, 15-minute expiry)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS magic_link_tokens (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash  TEXT    NOT NULL UNIQUE,   -- SHA-256 of the raw token sent in the email
  user_id     TEXT    NOT NULL REFERENCES users(id),
  expires_at  INTEGER NOT NULL,          -- unixepoch() + 900 (15 minutes)
  used_at     INTEGER,                   -- NULL until consumed
  request_ip  TEXT    NOT NULL,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_magic_link_token  ON magic_link_tokens (token_hash);
CREATE INDEX IF NOT EXISTS idx_magic_link_user   ON magic_link_tokens (user_id, created_at DESC);

-- ----------------------------------------------------------------
-- Sessions (allows server-side JWT revocation / hard logout)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  jti         TEXT    NOT NULL UNIQUE,   -- JWT ID claim — random nanoid per token issued
  user_id     TEXT    NOT NULL REFERENCES users(id),
  family_id   TEXT    NOT NULL REFERENCES families(id),
  role        TEXT    NOT NULL CHECK (role IN ('parent', 'child')),
  issued_at   INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at  INTEGER NOT NULL,
  revoked_at  INTEGER,                   -- NULL until logged out
  ip_address  TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_jti     ON sessions (jti);
CREATE INDEX IF NOT EXISTS idx_sessions_user    ON sessions (user_id, revoked_at);
