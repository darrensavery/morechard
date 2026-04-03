-- Migration: 0004_invite_codes_and_currency.sql
-- Adds:
--   1. base_currency and parenting_mode to families
--   2. invite_codes table (typed: child | co-parent, single-use, 72h TTL)
--   3. registration_progress table (preserves mid-flow state in D1)
-- Firebase inviteCodes collection is superseded by this table.

-- 1. Family columns
ALTER TABLE families ADD COLUMN base_currency TEXT NOT NULL DEFAULT 'GBP'
  CHECK(base_currency IN ('GBP','PLN'));

ALTER TABLE families ADD COLUMN parenting_mode TEXT NOT NULL DEFAULT 'single'
  CHECK(parenting_mode IN ('single','co-parenting'));

-- 2. Invite codes
--    role: 'child' → grants Learner access (PIN auth)
--    role: 'co-parent' → grants Custodian access (email auth required)
CREATE TABLE IF NOT EXISTS invite_codes (
  code        TEXT PRIMARY KEY,                  -- 6 uppercase alphanumeric chars
  family_id   TEXT NOT NULL,
  created_by  TEXT NOT NULL,                     -- parent user_id who generated
  role        TEXT NOT NULL CHECK(role IN ('child','co-parent')),
  redeemed_by TEXT DEFAULT NULL,                 -- user_id of redeemer, NULL = unused
  redeemed_at INTEGER DEFAULT NULL,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at  INTEGER NOT NULL,                  -- unixepoch + 72h
  FOREIGN KEY (family_id)  REFERENCES families(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- 3. Registration progress (allows resuming a mid-flow session)
--    Keyed by family_id; overwritten on each step save.
CREATE TABLE IF NOT EXISTS registration_progress (
  family_id   TEXT PRIMARY KEY,
  last_step   INTEGER NOT NULL DEFAULT 1,
  step_data   TEXT NOT NULL DEFAULT '{}',        -- JSON blob
  updated_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (family_id) REFERENCES families(id)
);

-- 4. Indices
CREATE INDEX IF NOT EXISTS idx_invite_family  ON invite_codes(family_id);
CREATE INDEX IF NOT EXISTS idx_invite_expires ON invite_codes(expires_at);
