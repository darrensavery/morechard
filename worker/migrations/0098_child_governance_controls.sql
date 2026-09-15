-- 0098_child_governance_controls.sql
-- Per-child overrides for Approval Mode (verify_mode), pocket money pause,
-- and Safety Net (overdraft) — plus the mutual-consent governance log used
-- to change Approval Mode / Safety Net in co-parenting families, mirroring
-- family_governance_log's existing pattern but scoped to a single child.
--
-- NULL override columns mean "inherit the family-wide default". Governance
-- is only required for changes that affect dispute resolution / debt
-- exposure (verify_mode, overdraft) — allowance_paused is a reversible,
-- ungated operational toggle any parent can flip directly.

ALTER TABLE users ADD COLUMN verify_mode_override TEXT CHECK(verify_mode_override IN ('amicable', 'standard'));
ALTER TABLE users ADD COLUMN allowance_paused INTEGER NOT NULL DEFAULT 0 CHECK(allowance_paused IN (0, 1));
ALTER TABLE users ADD COLUMN overdraft_enabled_override INTEGER CHECK(overdraft_enabled_override IN (0, 1));
ALTER TABLE users ADD COLUMN overdraft_limit_pence_override INTEGER CHECK(overdraft_limit_pence_override >= 0);

CREATE TABLE IF NOT EXISTS child_governance_log (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id    TEXT    NOT NULL REFERENCES families(id),
  child_id     TEXT    NOT NULL REFERENCES users(id),
  requested_by TEXT    NOT NULL REFERENCES users(id),
  confirmed_by TEXT    REFERENCES users(id),
  setting      TEXT    NOT NULL CHECK(setting IN ('verify_mode', 'overdraft')),
  old_value    TEXT    NOT NULL,
  new_value    TEXT    NOT NULL,
  status       TEXT    NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'confirmed', 'rejected', 'expired')),
  requested_at INTEGER NOT NULL,
  expires_at   INTEGER NOT NULL,
  confirmed_at INTEGER,
  request_ip   TEXT,
  confirm_ip   TEXT
);

CREATE INDEX IF NOT EXISTS idx_child_governance_log_family ON child_governance_log(family_id);
CREATE INDEX IF NOT EXISTS idx_child_governance_log_child  ON child_governance_log(child_id);
