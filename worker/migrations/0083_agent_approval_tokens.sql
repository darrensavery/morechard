-- 0083_agent_approval_tokens.sql
--
-- Single-use, time-limited tokens for the one-tap "Approve" link sent in
-- the review-item email (worker/src/lib/agent/reviewNotify.ts) for the
-- first AUTO-tier tool, resend_magic_link. Mirrors magic_link_tokens'
-- hash-only-stored pattern: the raw token only ever exists in the email
-- link, never persisted.
--
-- This is a one-tap APPROVAL primitive, not the magic-link auth flow
-- itself — deliberately separate from magic_link_tokens/auth.ts, which
-- has zero test coverage and is the single most critical path in the app.

CREATE TABLE IF NOT EXISTS agent_approval_tokens (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash     TEXT    NOT NULL UNIQUE,
  review_item_id TEXT    NOT NULL REFERENCES agent_review_items(id),
  expires_at     INTEGER NOT NULL,
  used_at        INTEGER,
  created_at     INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_agent_approval_tokens_review_item
  ON agent_approval_tokens (review_item_id);
