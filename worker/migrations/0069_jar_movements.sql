-- 0069_jar_movements.sql
CREATE TABLE IF NOT EXISTS jar_movements (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id      TEXT    NOT NULL REFERENCES families(id),
  child_id       TEXT    NOT NULL REFERENCES users(id),
  jar            TEXT    NOT NULL CHECK(jar IN ('spend','save','give')),
  delta          INTEGER NOT NULL DEFAULT 0,
  earmark_pence  INTEGER,
  kind           TEXT    NOT NULL CHECK(kind IN (
                   'allocation','enable_seed','manual_move',
                   'spend','give_request','give_fulfilled','give_declined',
                   'goal_allocate','goal_deallocate','goal_purchase'
                 )),
  ref_id         TEXT,
  goal_id        INTEGER REFERENCES goals(id),
  note           TEXT,
  created_at     INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_jar_movements_child_jar
  ON jar_movements(family_id, child_id, jar);

CREATE INDEX IF NOT EXISTS idx_jar_movements_goal
  ON jar_movements(goal_id) WHERE goal_id IS NOT NULL;

CREATE TRIGGER IF NOT EXISTS jar_movements_no_update
  BEFORE UPDATE ON jar_movements
BEGIN SELECT RAISE(ABORT,'jar_movements rows are immutable.'); END;

CREATE TRIGGER IF NOT EXISTS jar_movements_no_delete
  BEFORE DELETE ON jar_movements
BEGIN SELECT RAISE(ABORT,'jar_movements rows are immutable.'); END;
