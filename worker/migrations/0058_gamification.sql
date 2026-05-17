-- 0058_gamification.sql
-- Gamification schema: child streaks, badges, and lesson tracking

-- child_streaks: one row per child, updated on every approval + balance load
CREATE TABLE IF NOT EXISTS child_streaks (
  child_id              TEXT    NOT NULL PRIMARY KEY REFERENCES users(id),
  current_streak        INTEGER NOT NULL DEFAULT 0,
  longest_streak        INTEGER NOT NULL DEFAULT 0,
  grace_days_remaining  INTEGER NOT NULL DEFAULT 0,
  last_kept_date        TEXT,                        -- ISO YYYY-MM-DD or NULL
  last_checked_date     TEXT,                        -- ISO YYYY-MM-DD or NULL
  updated_at            TEXT    NOT NULL
);

-- child_badges: one row per badge earned; UNIQUE prevents double-awards
CREATE TABLE IF NOT EXISTS child_badges (
  id          TEXT NOT NULL PRIMARY KEY,
  child_id    TEXT NOT NULL REFERENCES users(id),
  badge_key   TEXT NOT NULL,  -- e.g. 'CONSISTENCY_SEED', 'EFFORT_SAPLING'
  earned_at   TEXT NOT NULL,
  UNIQUE(child_id, badge_key)
);

CREATE INDEX IF NOT EXISTS idx_child_badges_child ON child_badges(child_id);

-- lesson_completions: populated by future Learning Lab feature; exists now so badge queries don't fail
CREATE TABLE IF NOT EXISTS lesson_completions (
  id          TEXT NOT NULL PRIMARY KEY,
  child_id    TEXT NOT NULL REFERENCES users(id),
  lesson_key  TEXT NOT NULL,
  completed_at TEXT NOT NULL,
  UNIQUE(child_id, lesson_key)
);

CREATE INDEX IF NOT EXISTS idx_lesson_completions_child ON lesson_completions(child_id);
