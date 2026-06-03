-- 0061_lab_progress.sql
-- Learning Lab: act-level progress tracking + child age level

-- Add age_level to user_settings (1=Sprout/Phase2, 2=Sapling, 3=Oak, 4=Canopy)
-- Default 2 (Sapling / Foundation) — parent can update via PATCH /api/settings
ALTER TABLE user_settings ADD COLUMN age_level INTEGER NOT NULL DEFAULT 2;

-- module_act_progress: tracks which acts a child has completed within a module.
-- act_num: 1=Hook, 2=Lesson, 3=Lab, 4=Quiz
-- completed_at is a Unix timestamp (seconds) — always populated via Math.floor(Date.now() / 1000)
CREATE TABLE IF NOT EXISTS module_act_progress (
  id           TEXT    NOT NULL PRIMARY KEY,
  child_id     TEXT    NOT NULL REFERENCES users(id),
  module_slug  TEXT    NOT NULL,
  act_num      INTEGER NOT NULL CHECK (act_num BETWEEN 1 AND 4),
  completed_at INTEGER NOT NULL,
  UNIQUE (child_id, module_slug, act_num)
);

-- Single composite index satisfies both child-only and child+module queries in SQLite
CREATE INDEX IF NOT EXISTS idx_map_child_module ON module_act_progress(child_id, module_slug);
