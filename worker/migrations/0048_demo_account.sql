-- 0048_demo_account.sql

-- Mark the Thomson family row
ALTER TABLE families ADD COLUMN is_demo INTEGER NOT NULL DEFAULT 0;

-- Mark seed rows that must not be deleted/modified
ALTER TABLE chores           ADD COLUMN is_seed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ledger           ADD COLUMN is_seed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE goals            ADD COLUMN is_seed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE unlocked_modules ADD COLUMN is_seed INTEGER NOT NULL DEFAULT 0;

-- Lead capture for demo registrants
CREATE TABLE IF NOT EXISTS demo_registrations (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  email             TEXT NOT NULL,
  user_type         TEXT NOT NULL CHECK (user_type IN ('professional', 'demo_parent')),
  marketing_consent INTEGER NOT NULL DEFAULT 0,
  registered_at     INTEGER NOT NULL,
  last_active_at    INTEGER NOT NULL
);

-- Warm leads for Phase 7 paywall
CREATE TABLE IF NOT EXISTS upgrade_interest (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL,
  feature      TEXT NOT NULL CHECK (feature IN ('shield', 'ai_mentor', 'learning_lab')),
  registered_at INTEGER NOT NULL,
  UNIQUE (user_id, feature)
);

-- Prevent duplicate registrations from the same email
CREATE UNIQUE INDEX IF NOT EXISTS idx_demo_registrations_email
  ON demo_registrations (email);
