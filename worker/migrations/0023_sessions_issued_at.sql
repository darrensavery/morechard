-- Migration 0023: Add issued_at column to sessions table
-- issued_at was in the original schema but missing from the live DB.
-- SQLite requires a constant default for ADD COLUMN; existing rows get 0.

ALTER TABLE sessions ADD COLUMN issued_at INTEGER NOT NULL DEFAULT 0;
