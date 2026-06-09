-- 0063_review_prompts.sql

CREATE TABLE IF NOT EXISTS review_prompt_state (
  user_id                  TEXT    PRIMARY KEY,
  family_id                TEXT    NOT NULL,
  prompt_count             INTEGER NOT NULL DEFAULT 0,
  last_prompted_at         INTEGER,
  approvals_at_last_prompt INTEGER NOT NULL DEFAULT 0,
  last_outcome             TEXT,
  suppress_until           INTEGER,
  opted_out                INTEGER NOT NULL DEFAULT 0,
  created_at               INTEGER NOT NULL,
  updated_at               INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_review_state_family
  ON review_prompt_state (family_id, last_prompted_at);

CREATE TABLE IF NOT EXISTS review_feedback (
  id           TEXT    PRIMARY KEY,
  user_id      TEXT    NOT NULL,
  family_id    TEXT    NOT NULL,
  message      TEXT,
  app_platform TEXT    NOT NULL,
  app_version  TEXT    NOT NULL,
  created_at   INTEGER NOT NULL,
  emailed_at   INTEGER
);
