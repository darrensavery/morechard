-- 0068_jar_config.sql
CREATE TABLE IF NOT EXISTS jar_config (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id   TEXT    NOT NULL REFERENCES families(id),
  child_id    TEXT    NOT NULL REFERENCES users(id),
  enabled     INTEGER NOT NULL DEFAULT 0,
  spend_pct   INTEGER NOT NULL DEFAULT 70,
  save_pct    INTEGER NOT NULL DEFAULT 20,
  give_pct    INTEGER NOT NULL DEFAULT 10,
  updated_at  INTEGER NOT NULL,
  UNIQUE(family_id, child_id),
  CHECK(spend_pct + save_pct + give_pct = 100),
  CHECK(spend_pct >= 0 AND save_pct >= 0 AND give_pct >= 0)
);
