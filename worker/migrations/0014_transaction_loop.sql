-- Migration 0014: Transaction Loop — Phase 3
--
-- 1. Chores: add proof_required + auto_approve flags
-- 2. Completions: rename status values to match business language:
--      pending        → awaiting_review
--      approved       → completed
--      rejected       → needs_revision
--    Add proof_url, parent_notes, attempt_count columns.
-- 3. Drop old CHECK constraint and re-add with new values (SQLite workaround
--    via recreate — D1 supports CREATE TABLE … AS SELECT).
--
-- NOTE: SQLite does not support DROP CONSTRAINT or ALTER COLUMN.
-- Strategy: rename old table, create new table with correct schema, copy data.

-- ============================================================
-- CHORES — add proof_required and auto_approve
-- ============================================================
ALTER TABLE chores ADD COLUMN proof_required INTEGER NOT NULL DEFAULT 0;
ALTER TABLE chores ADD COLUMN auto_approve    INTEGER NOT NULL DEFAULT 0;

-- ============================================================
-- COMPLETIONS — full recreate to rename status enum values
-- ============================================================

-- Step 1: rename existing table
ALTER TABLE completions RENAME TO completions_old;

-- Step 2: create new table with correct status enum + new columns
CREATE TABLE completions (
  id              TEXT    PRIMARY KEY,
  family_id       TEXT    NOT NULL REFERENCES families(id),
  chore_id        TEXT    NOT NULL REFERENCES chores(id),
  child_id        TEXT    NOT NULL REFERENCES users(id),
  note            TEXT,                                        -- optional note from child
  status          TEXT    NOT NULL DEFAULT 'awaiting_review'
                          CHECK (status IN (
                            'awaiting_review',   -- child submitted, parent to review
                            'completed',         -- approved, ledger written
                            'needs_revision'     -- parent sent back with notes
                          )),
  proof_url       TEXT,                                        -- R2 object key (not public URL)
  parent_notes    TEXT,                                        -- filled on needs_revision
  attempt_count   INTEGER NOT NULL DEFAULT 1,                  -- increments on each resubmit
  ledger_id       INTEGER REFERENCES ledger(id),              -- set when completed
  rating          INTEGER DEFAULT 0,                           -- 1 thumbs up / -1 thumbs down / 0 none
  submitted_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  resolved_at     INTEGER,
  resolved_by     TEXT    REFERENCES users(id)
);

-- Step 3: copy data, mapping old status values to new
INSERT INTO completions
  (id, family_id, chore_id, child_id, note, status,
   proof_url, parent_notes, attempt_count,
   ledger_id, rating, submitted_at, resolved_at, resolved_by)
SELECT
  id, family_id, chore_id, child_id, note,
  CASE status
    WHEN 'pending'   THEN 'awaiting_review'
    WHEN 'approved'  THEN 'completed'
    WHEN 'rejected'  THEN 'needs_revision'
    ELSE 'awaiting_review'
  END,
  NULL,        -- proof_url
  rejection_note,  -- parent_notes (repurposed)
  1,           -- attempt_count default
  ledger_id, rating, submitted_at, resolved_at, resolved_by
FROM completions_old;

-- Step 4: drop old table
DROP TABLE completions_old;

-- Step 5: restore indexes
CREATE INDEX IF NOT EXISTS idx_completions_family  ON completions (family_id, status, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_completions_child   ON completions (child_id, submitted_at DESC);
