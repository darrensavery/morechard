-- 0078_agent_support_system.sql
-- Autonomous Support Agent (Phase 0 — shadow mode). See design spec:
-- docs/superpowers/specs/2026-07-13-autonomous-support-agent-design.md

CREATE TABLE IF NOT EXISTS agent_incidents (
  id                   TEXT PRIMARY KEY,
  source               TEXT NOT NULL CHECK (source IN ('freshdesk','sentry','in_app','stripe')),
  source_ref           TEXT NOT NULL,
  user_facing          INTEGER NOT NULL CHECK (user_facing IN (0,1)),
  family_id            TEXT,
  related_incident_id  TEXT REFERENCES agent_incidents(id),
  raw_payload          TEXT NOT NULL,
  occurrence_count     INTEGER NOT NULL DEFAULT 1,
  status               TEXT NOT NULL DEFAULT 'received'
                       CHECK (status IN ('received','diagnosing','resolved_auto','escalated','approved','declined','failed')),
  created_at           INTEGER NOT NULL DEFAULT (unixepoch()),
  resolved_at          INTEGER
);

-- Enforces the Sentry burst-dedup lookup (Task 16) atomically: at most one
-- open (non-terminal) incident per (source, source_ref) at a time.
CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_incidents_open_source_ref
  ON agent_incidents (source, source_ref)
  WHERE status IN ('received','diagnosing','escalated');

CREATE INDEX IF NOT EXISTS idx_agent_incidents_family
  ON agent_incidents (family_id);

CREATE TABLE IF NOT EXISTS agent_action_log (
  id             INTEGER PRIMARY KEY,
  incident_id    TEXT NOT NULL REFERENCES agent_incidents(id),
  actor          TEXT NOT NULL,
  tool_name      TEXT NOT NULL,
  tier           TEXT NOT NULL CHECK (tier IN ('read','auto','gated')),
  payload        TEXT NOT NULL,
  result         TEXT,
  previous_hash  TEXT NOT NULL,
  record_hash    TEXT NOT NULL,
  created_at     INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_agent_action_log_incident
  ON agent_action_log (incident_id);

CREATE TABLE IF NOT EXISTS agent_review_items (
  id                   TEXT PRIMARY KEY,
  incident_id          TEXT NOT NULL REFERENCES agent_incidents(id),
  diagnosis            TEXT NOT NULL,
  recommended_tier     TEXT CHECK (recommended_tier IN ('auto','gated')),
  recommended_tool     TEXT,
  recommended_payload  TEXT,
  payload_hash         TEXT,
  draft_reply          TEXT,
  confidence           REAL NOT NULL,
  category             TEXT,
  queue_bucket         TEXT NOT NULL DEFAULT 'needs_review'
                       CHECK (queue_bucket IN ('recommended_approve','needs_review')),
  status               TEXT NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','approved','edited_approved','declined','executed')),
  decided_by           TEXT,
  decided_at           INTEGER,
  decision_note        TEXT,
  created_at           INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_agent_review_items_status
  ON agent_review_items (status, queue_bucket);

CREATE TABLE IF NOT EXISTS playbook_sync (
  doc_path        TEXT PRIMARY KEY,
  content_hash    TEXT NOT NULL,
  last_synced_at  INTEGER NOT NULL
);
