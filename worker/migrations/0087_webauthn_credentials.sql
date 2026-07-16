-- Migration 0087: WebAuthn credentials
--
-- Stores server-verified WebAuthn (web, type='webauthn') and native ECDSA
-- (Capacitor app, type='native-ecdsa') public keys for real biometric/
-- passkey login + device-unlock verification. Replaces the previous
-- client-side-only check in app/src/lib/biometrics.ts, which only stored a
-- credential ID and never verified a signature.
--
-- See docs/superpowers/specs/2026-07-16-webauthn-verification-design.md

CREATE TABLE webauthn_credentials (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id),
  role          TEXT NOT NULL CHECK (role IN ('parent', 'child')),
  credential_id TEXT NOT NULL UNIQUE,
  public_key    TEXT NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('webauthn', 'native-ecdsa')),
  counter       INTEGER NOT NULL DEFAULT 0,
  device_label  TEXT,
  created_at    INTEGER NOT NULL,
  last_used_at  INTEGER
);

CREATE INDEX idx_webauthn_credentials_user ON webauthn_credentials(user_id);
