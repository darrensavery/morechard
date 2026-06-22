-- 0070_give_requests.sql
CREATE TABLE IF NOT EXISTS give_requests (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id     TEXT    NOT NULL REFERENCES families(id),
  child_id      TEXT    NOT NULL REFERENCES users(id),
  cause         TEXT    NOT NULL,
  amount        INTEGER NOT NULL,
  currency      TEXT    NOT NULL,
  status        TEXT    NOT NULL DEFAULT 'requested'
                  CHECK(status IN ('requested','fulfilled','declined')),
  requested_at  INTEGER NOT NULL,
  fulfilled_at  INTEGER,
  parent_note   TEXT,
  jar_movement_id INTEGER REFERENCES jar_movements(id)
);
