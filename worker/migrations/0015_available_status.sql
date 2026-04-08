-- Migration 0015: Add 'available' status to completions
--
-- 'available' = lazy-generated record for a recurring chore period.
-- The child must tap "Done" to move it to 'awaiting_review'.
-- This keeps the parent's approval queue focused on work actually performed.
--
-- SQLite does not support ALTER COLUMN, so we recreate the table.
-- Strategy: rename → create → copy → drop → restore indexes.

-- Step 1: rename old table
ALTER TABLE completions RENAME TO completions_old;

-- Step 2: create new table with 'available' added to status CHECK
CREATE TABLE completions (
  id              TEXT    PRIMARY KEY,
  family_id       TEXT    NOT NULL REFERENCES families(id),
  chore_id        TEXT    NOT NULL REFERENCES chores(id),
  child_id        TEXT    NOT NULL REFERENCES users(id),
  note            TEXT,
  status          TEXT    NOT NULL DEFAULT 'awaiting_review'
                          CHECK (status IN (
                            'available',         -- lazy-generated, not yet submitted by child
                            'awaiting_review',   -- child submitted, parent to review
                            'completed',         -- approved, ledger written
                            'needs_revision'     -- parent sent back with notes
                          )),
  proof_url       TEXT,
  parent_notes    TEXT,
  attempt_count   INTEGER NOT NULL DEFAULT 1,
  ledger_id       INTEGER,
  rating          INTEGER DEFAULT 0,
  submitted_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  resolved_at     INTEGER,
  resolved_by     TEXT    REFERENCES users(id)
);

-- Step 3: copy all existing data (no status values change — available is new)
INSERT INTO completions
  SELECT * FROM completions_old;

-- Step 4: drop old table
DROP TABLE completions_old;

-- Step 5: restore indexes
CREATE INDEX IF NOT EXISTS idx_completions_family  ON completions (family_id, status, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_completions_child   ON completions (child_id, submitted_at DESC);
-- Index for lazy-gen lookup: recurring chore × child × status × period
CREATE INDEX IF NOT EXISTS idx_completions_lazy
  ON completions (chore_id, child_id, status, submitted_at DESC);
