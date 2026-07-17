-- Migration 0088: DSAR self-service portal
--
-- Adds the dsar_requests table backing the public (unauthenticated) DSAR
-- portal, and a purge_pending_at tombstone marker on users for single-child
-- erasure requests (mirrors families.deleted_at's role for whole-family
-- erasure — set immediately at verification, swept by the T+30 cron in
-- worker/src/jobs/familyPurge.ts::runChildDsarPurge).
--
-- See docs/superpowers/specs/2026-07-17-dsar-portal-design.md

CREATE TABLE dsar_requests (
  id                     TEXT PRIMARY KEY,
  request_type           TEXT NOT NULL CHECK (request_type IN ('access', 'erasure')),
  scope                  TEXT NOT NULL CHECK (scope IN ('family', 'child')),
  target_family_id       TEXT NOT NULL REFERENCES families(id),
  target_child_name_raw  TEXT,
  requester_email        TEXT NOT NULL,
  matched_user_id        TEXT NOT NULL REFERENCES users(id),
  token_hash             TEXT NOT NULL UNIQUE,
  status                 TEXT NOT NULL DEFAULT 'pending_verification'
                            CHECK (status IN ('pending_verification', 'processing', 'completed', 'expired', 'needs_clarification')),
  created_at             INTEGER NOT NULL,
  verified_at            INTEGER,
  executed_at            INTEGER
);

CREATE INDEX idx_dsar_requests_token ON dsar_requests(token_hash);

ALTER TABLE users ADD COLUMN purge_pending_at INTEGER;
