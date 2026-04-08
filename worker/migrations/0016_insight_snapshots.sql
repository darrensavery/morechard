-- Migration 0016: Insight snapshots for temporal trend tracking
--
-- Stores weekly KPI snapshots per child so the AI mentor can
-- compare current performance against prior periods (delta analysis).
-- One snapshot per child per week; the worker upserts on first call each week.

CREATE TABLE IF NOT EXISTS insight_snapshots (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  child_id              TEXT    NOT NULL REFERENCES users(id),
  family_id             TEXT    NOT NULL REFERENCES families(id),
  snapshot_date         TEXT    NOT NULL,  -- ISO date string, e.g. '2026-04-08'
  consistency_score     INTEGER,           -- 0–100 | NULL (discovery phase)
  responsibility_score  INTEGER,           -- first_time_pass_rate proxy, 0–100 | NULL
  planning_horizon      INTEGER,           -- 0–100 | NULL
  total_earned_pence    INTEGER NOT NULL DEFAULT 0,
  created_at            INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_insight_snapshots_week
  ON insight_snapshots (child_id, snapshot_date);

CREATE INDEX IF NOT EXISTS idx_insight_snapshots_child
  ON insight_snapshots (child_id, created_at DESC);
