-- MoneySteps D1 Schema — v1
-- All currency stored as INTEGER (pence / groszy). No floats permitted.
-- All timestamps stored as INTEGER (Unix epoch seconds) via unixepoch().
-- Ledger rows are IMMUTABLE. Errors are corrected via Reversal entries.

-- ============================================================
-- FAMILIES
-- ============================================================
CREATE TABLE IF NOT EXISTS families (
  id          TEXT    PRIMARY KEY,               -- nanoid, generated server-side
  name        TEXT    NOT NULL,
  currency    TEXT    NOT NULL CHECK (currency IN ('GBP', 'PLN')),
  -- 'amicable' = Auto-Verify; 'standard' = Manual-Approval
  verify_mode TEXT    NOT NULL DEFAULT 'standard'
                      CHECK (verify_mode IN ('amicable', 'standard')),
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id           TEXT    PRIMARY KEY,              -- nanoid
  family_id    TEXT    NOT NULL REFERENCES families(id),
  display_name TEXT    NOT NULL,
  email        TEXT    UNIQUE,                   -- NULL for child accounts
  -- hashed password / session token handled by auth layer (not stored here)
  locale       TEXT    NOT NULL DEFAULT 'en'
                       CHECK (locale IN ('en', 'pl')),
  created_at   INTEGER NOT NULL DEFAULT (unixepoch())
);

-- ============================================================
-- FAMILY ROLES  (join table — supports blended households)
-- ============================================================
CREATE TABLE IF NOT EXISTS family_roles (
  user_id     TEXT    NOT NULL REFERENCES users(id),
  family_id   TEXT    NOT NULL REFERENCES families(id),
  role        TEXT    NOT NULL CHECK (role IN ('parent', 'child')),
  granted_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  granted_by  TEXT    REFERENCES users(id),      -- NULL for founding parent
  PRIMARY KEY (user_id, family_id, role)
);

-- ============================================================
-- CHORES
-- ============================================================
CREATE TABLE IF NOT EXISTS chores (
  id            TEXT    PRIMARY KEY,
  family_id     TEXT    NOT NULL REFERENCES families(id),
  assigned_to   TEXT    NOT NULL REFERENCES users(id),  -- child
  created_by    TEXT    NOT NULL REFERENCES users(id),  -- parent
  description   TEXT    NOT NULL,
  reward_amount INTEGER NOT NULL CHECK (reward_amount > 0),  -- pence / groszy
  currency      TEXT    NOT NULL CHECK (currency IN ('GBP', 'PLN')),
  status        TEXT    NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'submitted', 'approved', 'rejected')),
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  submitted_at  INTEGER,
  resolved_at   INTEGER,
  resolved_by   TEXT    REFERENCES users(id)
);

-- ============================================================
-- LEDGER  (immutable — no UPDATE or DELETE permitted on this table)
-- ============================================================
CREATE TABLE IF NOT EXISTS ledger (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id           TEXT    NOT NULL REFERENCES families(id),
  child_id            TEXT    NOT NULL REFERENCES users(id),
  chore_id            TEXT    REFERENCES chores(id),        -- NULL for manual entries
  entry_type          TEXT    NOT NULL
                              CHECK (entry_type IN ('credit', 'reversal', 'payment')),
  amount              INTEGER NOT NULL CHECK (amount > 0),  -- always positive; type encodes direction
  currency            TEXT    NOT NULL CHECK (currency IN ('GBP', 'PLN')),
  description         TEXT    NOT NULL,
  verification_status TEXT    NOT NULL
                              CHECK (verification_status IN ('pending', 'verified_auto', 'verified_manual', 'reversed')),
  authorised_by       TEXT    REFERENCES users(id),         -- NULL until verified
  -- Chain-of-Trust
  previous_hash       TEXT    NOT NULL,                     -- hash of row (id-1); genesis = '0000000000000000'
  record_hash         TEXT    NOT NULL,                     -- SHA-256(id||family_id||child_id||amount||currency||entry_type||previous_hash)
  -- Audit
  ip_address          TEXT    NOT NULL,
  created_at          INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Enforce immutability at DB level via trigger
CREATE TRIGGER IF NOT EXISTS ledger_no_update
  BEFORE UPDATE ON ledger
BEGIN
  SELECT RAISE(ABORT, 'Ledger rows are immutable. Use a reversal entry.');
END;

CREATE TRIGGER IF NOT EXISTS ledger_no_delete
  BEFORE DELETE ON ledger
BEGIN
  SELECT RAISE(ABORT, 'Ledger rows cannot be deleted.');
END;

-- ============================================================
-- FAMILY GOVERNANCE LOG
-- Tracks verification_mode change requests and their lifecycle.
-- ============================================================
CREATE TABLE IF NOT EXISTS family_governance_log (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id      TEXT    NOT NULL REFERENCES families(id),
  requested_by   TEXT    NOT NULL REFERENCES users(id),
  confirmed_by   TEXT    REFERENCES users(id),              -- NULL until confirmed
  old_mode       TEXT    NOT NULL CHECK (old_mode IN ('amicable', 'standard')),
  new_mode       TEXT    NOT NULL CHECK (new_mode IN ('amicable', 'standard')),
  status         TEXT    NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'confirmed', 'rejected', 'expired')),
  requested_at   INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at     INTEGER NOT NULL,                          -- requested_at + 259200 (72 hours)
  confirmed_at   INTEGER,
  request_ip     TEXT    NOT NULL,
  confirm_ip     TEXT
);

-- ============================================================
-- CURRENCY SNAPSHOTS
-- Exchange rate captured at moment of verification (for GBP/PLN dual-currency).
-- ============================================================
CREATE TABLE IF NOT EXISTS currency_snapshots (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  ledger_id    INTEGER NOT NULL REFERENCES ledger(id),
  base         TEXT    NOT NULL CHECK (base IN ('GBP', 'PLN')),
  quote        TEXT    NOT NULL CHECK (quote IN ('GBP', 'PLN')),
  -- Rate stored as INTEGER basis points (e.g. 503 = 5.03 PLN per GBP)
  rate_bp      INTEGER NOT NULL CHECK (rate_bp > 0),
  captured_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_ledger_family    ON ledger (family_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_child     ON ledger (child_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chores_family    ON chores (family_id, status);
CREATE INDEX IF NOT EXISTS idx_governance_family ON family_governance_log (family_id, status);
