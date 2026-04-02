-- Migration 0003: Proof-of-Contribution engine
--
-- 1. Extend ledger with metadata fields (receipt_id, category, dispute_code, verified_at)
-- 2. Add 'disputed' to verification_status via a new shadow column + CHECK
--    SQLite cannot ALTER a CHECK constraint, so we use a new column approach:
--    verification_status remains for existing rows; we ADD verified_at and dispute_code.
-- 3. Add ledger_status_log for immutable state transition audit trail.
-- 4. Add bilingual_labels reference table.

-- ----------------------------------------------------------------
-- Extend ledger with metadata columns
-- ----------------------------------------------------------------
ALTER TABLE ledger ADD COLUMN receipt_id    TEXT;      -- external receipt/document reference
ALTER TABLE ledger ADD COLUMN category      TEXT;      -- standardised category code (see below)
ALTER TABLE ledger ADD COLUMN dispute_code  TEXT;      -- NULL unless status = 'disputed'
ALTER TABLE ledger ADD COLUMN verified_at   INTEGER;   -- server timestamp when status → verified
ALTER TABLE ledger ADD COLUMN verified_by   TEXT REFERENCES users(id);  -- parent who verified

-- ----------------------------------------------------------------
-- Ledger status transition log (immutable — triggers below)
-- Records every status change with actor, timestamp, and IP.
-- Satisfies: "Status Transitions must be logged"
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ledger_status_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ledger_id   INTEGER NOT NULL REFERENCES ledger(id),
  from_status TEXT    NOT NULL,
  to_status   TEXT    NOT NULL,
  actor_id    TEXT    NOT NULL REFERENCES users(id),
  dispute_code TEXT,                                   -- populated when to_status = 'disputed'
  ip_address  TEXT    NOT NULL,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TRIGGER IF NOT EXISTS ledger_status_log_no_update
  BEFORE UPDATE ON ledger_status_log
BEGIN
  SELECT RAISE(ABORT, 'ledger_status_log rows are immutable.');
END;

CREATE TRIGGER IF NOT EXISTS ledger_status_log_no_delete
  BEFORE DELETE ON ledger_status_log
BEGIN
  SELECT RAISE(ABORT, 'ledger_status_log rows cannot be deleted.');
END;

-- ----------------------------------------------------------------
-- Bilingual labels
-- Stores EN/PL display strings for categories and dispute codes.
-- Used by the export engine — avoids hardcoding in application code.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bilingual_labels (
  code        TEXT PRIMARY KEY,
  label_en    TEXT NOT NULL,
  label_pl    TEXT NOT NULL
);

-- Category codes
INSERT INTO bilingual_labels (code, label_en, label_pl) VALUES
  ('CAT_EDUCATION',    'Education',              'Edukacja'),
  ('CAT_MEDICAL',      'Medical',                'Opieka medyczna'),
  ('CAT_CLOTHING',     'Clothing',               'Odzież'),
  ('CAT_ACTIVITIES',   'Activities & Sport',     'Zajęcia i sport'),
  ('CAT_TRAVEL',       'Travel',                 'Podróże'),
  ('CAT_CHILDCARE',    'Childcare',              'Opieka nad dzieckiem'),
  ('CAT_MAINTENANCE',  'General Maintenance',    'Utrzymanie ogólne'),
  ('CAT_OTHER',        'Other',                  'Inne');

-- Dispute reason codes (RODO/GDPR — no free-text conflict content)
INSERT INTO bilingual_labels (code, label_en, label_pl) VALUES
  ('ERR_NO_CONSENT',    'Expense made without required prior agreement',  'Wydatek bez wymaganej zgody'),
  ('ERR_NO_PROOF',      'Missing or invalid receipt / documentation',     'Brak lub nieprawidłowy dowód zakupu'),
  ('ERR_OUT_OF_SCOPE',  'Covered by standard maintenance agreement',      'Objęte standardowym alimentem'),
  ('ERR_SPLIT_MISMATCH','Incorrect split percentage or calculation',       'Błędny podział procentowy'),
  ('ERR_DUPLICATE',     'Transaction already exists',                     'Transakcja już istnieje');

CREATE INDEX IF NOT EXISTS idx_ledger_status_log ON ledger_status_log (ledger_id, created_at DESC);
