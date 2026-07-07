-- 0076_family_audit_snapshots.sql
-- Monthly, family-wide AI spending/earning/saving rollup — cache-on-read,
-- one row per family per calendar month (mirrors insight_snapshots).

CREATE TABLE IF NOT EXISTS family_audit_snapshots (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id           TEXT NOT NULL REFERENCES families(id),
  month_key           TEXT NOT NULL,  -- 'YYYY-MM'
  total_earned_pence  INTEGER NOT NULL DEFAULT 0,
  total_spent_pence   INTEGER NOT NULL DEFAULT 0,
  total_saved_pence   INTEGER NOT NULL DEFAULT 0,
  total_given_pence   INTEGER NOT NULL DEFAULT 0,
  flagged_child_id    TEXT REFERENCES users(id),
  flagged_pillar      TEXT,
  observation         TEXT,
  behavioral_root     TEXT,
  the_action          TEXT,
  source              TEXT NOT NULL DEFAULT 'rule_based' CHECK (source IN ('rule_based','ai')),
  created_at          INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_family_audit_month
  ON family_audit_snapshots (family_id, month_key);
