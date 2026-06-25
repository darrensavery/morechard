-- 0072_jar_movements_payout_kind.sql
-- Add 'payout' kind to jar_movements CHECK constraint.
-- SQLite cannot ALTER a CHECK constraint, so we recreate the table.

PRAGMA foreign_keys = OFF;

CREATE TABLE jar_movements_v2 (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id      TEXT    NOT NULL REFERENCES families(id),
  child_id       TEXT    NOT NULL REFERENCES users(id),
  jar            TEXT    NOT NULL CHECK(jar IN ('spend','save','give')),
  delta          INTEGER NOT NULL DEFAULT 0,
  earmark_pence  INTEGER,
  kind           TEXT    NOT NULL CHECK(kind IN (
                   'allocation','enable_seed','manual_move',
                   'spend','give_request','give_fulfilled','give_declined',
                   'goal_allocate','goal_deallocate','goal_purchase','payout'
                 )),
  ref_id         TEXT,
  goal_id        INTEGER REFERENCES goals(id),
  note           TEXT,
  created_at     INTEGER NOT NULL
);

INSERT INTO jar_movements_v2 SELECT * FROM jar_movements;
DROP TABLE jar_movements;
ALTER TABLE jar_movements_v2 RENAME TO jar_movements;

-- D1 does not always drop indexes when the parent table is dropped; be explicit.
DROP INDEX IF EXISTS idx_jar_movements_child_jar;
CREATE INDEX idx_jar_movements_child_jar
  ON jar_movements(family_id, child_id, jar);

DROP INDEX IF EXISTS idx_jar_movements_goal;
CREATE INDEX idx_jar_movements_goal
  ON jar_movements(goal_id) WHERE goal_id IS NOT NULL;

CREATE TRIGGER jar_movements_no_update
  BEFORE UPDATE ON jar_movements
BEGIN SELECT RAISE(ABORT,'jar_movements rows are immutable.'); END;

CREATE TRIGGER jar_movements_no_delete
  BEFORE DELETE ON jar_movements
BEGIN SELECT RAISE(ABORT,'jar_movements rows are immutable.'); END;

PRAGMA foreign_keys = ON;
