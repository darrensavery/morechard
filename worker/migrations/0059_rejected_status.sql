-- Add 'rejected' as a valid completion status.
-- SQLite doesn't support ALTER COLUMN, so we recreate the table.

PRAGMA foreign_keys = OFF;

CREATE TABLE completions_new (
  id                      TEXT    PRIMARY KEY,
  family_id               TEXT    NOT NULL,
  chore_id                TEXT    NOT NULL,
  child_id                TEXT    NOT NULL,
  note                    TEXT,
  status                  TEXT    NOT NULL DEFAULT 'awaiting_review'
                          CHECK(status IN ('available','awaiting_review','completed','needs_revision','rejected')),
  proof_url               TEXT,
  parent_notes            TEXT,
  attempt_count           INTEGER NOT NULL DEFAULT 1,
  ledger_id               INTEGER,
  rating                  INTEGER          DEFAULT 0,
  submitted_at            INTEGER NOT NULL DEFAULT (unixepoch()),
  resolved_at             INTEGER,
  resolved_by             TEXT,
  proof_hash              TEXT,
  proof_exif              TEXT,
  system_verify           TEXT,
  verification_confidence TEXT,
  paid_out_at             INTEGER,
  is_seed                 INTEGER NOT NULL DEFAULT 0
);

INSERT INTO completions_new SELECT * FROM completions;

DROP TABLE completions;
ALTER TABLE completions_new RENAME TO completions;

PRAGMA foreign_keys = ON;
