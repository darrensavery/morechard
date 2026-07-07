-- 0077_discovery_briefings.sql
-- AI-generated Discovery Phase card content (parent Insights tab),
-- cached one row per child, regenerated when setup_signature changes.

CREATE TABLE IF NOT EXISTS discovery_briefings (
  child_id         TEXT PRIMARY KEY REFERENCES users(id),
  family_id        TEXT NOT NULL REFERENCES families(id),
  setup_signature  TEXT NOT NULL,
  intro            TEXT NOT NULL,
  actions          TEXT NOT NULL,   -- JSON array of strings
  source           TEXT NOT NULL DEFAULT 'rule_based' CHECK (source IN ('rule_based','ai')),
  created_at       INTEGER NOT NULL DEFAULT (unixepoch())
);
