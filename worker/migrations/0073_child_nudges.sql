-- child_nudges: AI Mentor nudge cards delivered inline to children.
-- One active nudge per screen context per child (earn / money / goals).
-- Event-triggered (task rejection, streak milestones, goal events, jar raids)
-- and background-checked (weekly CRON sweep for pattern-based nudges).

CREATE TABLE IF NOT EXISTS child_nudges (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  child_id       TEXT    NOT NULL REFERENCES users(id),
  family_id      TEXT    NOT NULL REFERENCES families(id),
  trigger_type   TEXT    NOT NULL,
  screen_context TEXT    NOT NULL CHECK (screen_context IN ('earn', 'money', 'goals')),
  orchard_text   TEXT    NOT NULL,
  clean_text     TEXT    NOT NULL,
  pillar         TEXT    NOT NULL,
  tone           TEXT    NOT NULL CHECK (tone IN ('encouraging', 'celebratory', 'honest', 'accountability')),
  parent_summary TEXT    NOT NULL,
  is_dismissed   INTEGER NOT NULL DEFAULT 0,
  source         TEXT    NOT NULL DEFAULT 'rule_based' CHECK (source IN ('rule_based', 'ai')),
  trigger_meta   TEXT,          -- JSON blob: { goal_title, streak_length, etc. }
  created_at     INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at     INTEGER NOT NULL  -- nudge auto-expires after 7 days
);

CREATE INDEX IF NOT EXISTS idx_child_nudges_active
  ON child_nudges (child_id, screen_context, is_dismissed, expires_at);
