-- Migration: 0001_base_schema.sql
-- Base schema for MoneySteps. Run this BEFORE 0002_trial_and_payments.sql.
-- All currency stored as integers (pence / groszy). No deletes permitted on ledger.

-- ── Families ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS families (
    id          TEXT PRIMARY KEY,
    verify_mode TEXT NOT NULL DEFAULT 'amicable' CHECK(verify_mode IN ('amicable', 'standard')),
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── Users ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id               TEXT PRIMARY KEY,
    family_id        TEXT NOT NULL,
    display_name     TEXT NOT NULL,
    email            TEXT UNIQUE NOT NULL,
    locale           TEXT NOT NULL DEFAULT 'en' CHECK(locale IN ('en', 'pl')),
    password_hash    TEXT,
    pin_hash         TEXT,
    email_verified   INTEGER NOT NULL DEFAULT 0,
    created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (family_id) REFERENCES families(id)
);

-- ── Family roles (parent / child) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS family_roles (
    user_id    TEXT NOT NULL,
    family_id  TEXT NOT NULL,
    role       TEXT NOT NULL CHECK(role IN ('parent', 'child')),
    PRIMARY KEY (user_id, family_id),
    FOREIGN KEY (user_id)   REFERENCES users(id),
    FOREIGN KEY (family_id) REFERENCES families(id)
);

-- ── Sessions ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
    jti         TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    family_id   TEXT NOT NULL,
    role        TEXT NOT NULL CHECK(role IN ('parent', 'child')),
    expires_at  INTEGER NOT NULL,
    revoked_at  INTEGER,
    ip_address  TEXT,
    FOREIGN KEY (user_id)   REFERENCES users(id),
    FOREIGN KEY (family_id) REFERENCES families(id)
);

-- ── Magic link tokens ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS magic_link_tokens (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    token_hash  TEXT UNIQUE NOT NULL,
    user_id     TEXT NOT NULL,
    expires_at  INTEGER NOT NULL,
    used_at     INTEGER,
    request_ip  TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ── Immutable ledger ─────────────────────────────────────────────────────────
-- No DELETE is ever permitted. Errors require reversal entries.
CREATE TABLE IF NOT EXISTS ledger (
    id                  INTEGER NOT NULL,
    family_id           TEXT NOT NULL,
    child_id            TEXT NOT NULL,
    chore_id            TEXT,
    entry_type          TEXT NOT NULL CHECK(entry_type IN ('credit', 'reversal', 'payment')),
    amount              INTEGER NOT NULL,          -- pence or groszy, never floats
    currency            TEXT NOT NULL CHECK(currency IN ('GBP', 'PLN')),
    description         TEXT NOT NULL,
    receipt_id          TEXT,
    category            TEXT,
    verification_status TEXT NOT NULL DEFAULT 'pending'
                            CHECK(verification_status IN
                                ('pending','verified_auto','verified_manual','disputed','reversed')),
    authorised_by       TEXT,
    verified_at         INTEGER,
    verified_by         TEXT,
    dispute_code        TEXT,
    dispute_before      INTEGER,
    previous_hash       TEXT NOT NULL,
    record_hash         TEXT NOT NULL,
    ip_address          TEXT,
    created_at          INTEGER NOT NULL DEFAULT (unixepoch()),
    PRIMARY KEY (id, family_id),
    FOREIGN KEY (family_id) REFERENCES families(id),
    FOREIGN KEY (child_id)  REFERENCES users(id)
);

-- ── Ledger status log (audit trail for status transitions) ──────────────────
CREATE TABLE IF NOT EXISTS ledger_status_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    ledger_id   INTEGER NOT NULL,
    from_status TEXT NOT NULL,
    to_status   TEXT NOT NULL,
    actor_id    TEXT NOT NULL,
    dispute_code TEXT,
    ip_address  TEXT,
    created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

-- ── Governance log (mutual-consent handshake) ────────────────────────────────
-- All outcomes retained permanently — part of the legal audit trail.
CREATE TABLE IF NOT EXISTS family_governance_log (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    family_id     TEXT NOT NULL,
    requested_by  TEXT NOT NULL,
    confirmed_by  TEXT,
    old_mode      TEXT NOT NULL,
    new_mode      TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'pending'
                      CHECK(status IN ('pending', 'confirmed', 'rejected', 'expired')),
    requested_at  INTEGER NOT NULL,
    expires_at    INTEGER NOT NULL,
    confirmed_at  INTEGER,
    request_ip    TEXT,
    confirm_ip    TEXT,
    FOREIGN KEY (family_id) REFERENCES families(id)
);

-- ── Indices ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ledger_family     ON ledger(family_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_child      ON ledger(child_id);
CREATE INDEX IF NOT EXISTS idx_sessions_jti      ON sessions(jti);
CREATE INDEX IF NOT EXISTS idx_gov_family_status ON family_governance_log(family_id, status);
