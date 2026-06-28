-- =============================================================================
-- bootstrap_dev_db.sql
-- =============================================================================
-- Initialises a fresh Cloudflare D1 (SQLite) database called `morechard-dev`
-- with the exact same schema as the production `morechard` database.
--
-- Usage:
--   wrangler d1 execute morechard-dev --file=worker/dev/bootstrap_dev_db.sql
--
-- Safe to re-run: all statements use IF NOT EXISTS / INSERT OR IGNORE.
-- After this file completes, run seed files to populate test data.
-- =============================================================================

PRAGMA foreign_keys = OFF;

-- ---------------------------------------------------------------------------
-- DROP all existing tables (safe because FK checks are OFF)
-- This handles the case where a previous partial bootstrap left stale tables.
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS give_requests;
DROP TABLE IF EXISTS jar_movements;
DROP TABLE IF EXISTS jar_config;
DROP TABLE IF EXISTS spending;
DROP TABLE IF EXISTS subscriptions;
DROP TABLE IF EXISTS plans;
DROP TABLE IF EXISTS suggestions;
DROP TABLE IF EXISTS payouts;
DROP TABLE IF EXISTS bonus_payments;
DROP TABLE IF EXISTS payday_log;
DROP TABLE IF EXISTS currency_snapshots;
DROP TABLE IF EXISTS completions;
DROP TABLE IF EXISTS ledger_status_log;
DROP TABLE IF EXISTS ledger_prune_archive;
DROP TABLE IF EXISTS ledger;
DROP TABLE IF EXISTS chores;
DROP TABLE IF EXISTS goals;
DROP TABLE IF EXISTS insight_snapshots;
DROP TABLE IF EXISTS child_nudges;
DROP TABLE IF EXISTS child_streaks;
DROP TABLE IF EXISTS child_badges;
DROP TABLE IF EXISTS unlocked_modules;
DROP TABLE IF EXISTS module_act_progress;
DROP TABLE IF EXISTS lesson_completions;
DROP TABLE IF EXISTS chat_history;
DROP TABLE IF EXISTS chat_rate_limits;
DROP TABLE IF EXISTS push_subscriptions;
DROP TABLE IF EXISTS parent_messages;
DROP TABLE IF EXISTS shared_expenses;
DROP TABLE IF EXISTS family_governance_log;
DROP TABLE IF EXISTS payment_audit_log;
DROP TABLE IF EXISTS promo_code_redemptions;
DROP TABLE IF EXISTS promo_codes;
DROP TABLE IF EXISTS referral_clicks;
DROP TABLE IF EXISTS referral_conversions;
DROP TABLE IF EXISTS review_feedback;
DROP TABLE IF EXISTS review_prompt_state;
DROP TABLE IF EXISTS analytics_consents;
DROP TABLE IF EXISTS email_verify_tokens;
DROP TABLE IF EXISTS account_locks;
DROP TABLE IF EXISTS login_attempts;
DROP TABLE IF EXISTS magic_link_attempts;
DROP TABLE IF EXISTS slt_attempts;
DROP TABLE IF EXISTS slt_tokens;
DROP TABLE IF EXISTS child_logins;
DROP TABLE IF EXISTS upgrade_interest;
DROP TABLE IF EXISTS demo_registrations;
DROP TABLE IF EXISTS registration_progress;
DROP TABLE IF EXISTS bilingual_labels;
DROP TABLE IF EXISTS market_rates;
DROP TABLE IF EXISTS chore_promotion_candidates;
DROP TABLE IF EXISTS user_settings;
DROP TABLE IF EXISTS invite_codes;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS family_roles;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS families;
DROP TABLE IF EXISTS d1_migrations;

-- ---------------------------------------------------------------------------
-- TABLES (ordered so that referenced tables are created before referencing ones)
-- ---------------------------------------------------------------------------

-- d1_migrations tracking table (wrangler creates this automatically, but we
-- create it here so the INSERT OR IGNORE statements below work on a blank DB)
CREATE TABLE IF NOT EXISTS d1_migrations (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  name      TEXT UNIQUE NOT NULL,
  applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS families (
  id                          TEXT    PRIMARY KEY,
  name                        TEXT    NOT NULL DEFAULT '',
  currency                    TEXT    NOT NULL DEFAULT 'GBP' CHECK(currency IN ('GBP','PLN')),
  verify_mode                 TEXT    NOT NULL DEFAULT 'amicable' CHECK(verify_mode IN ('amicable', 'standard')),
  created_at                  DATETIME DEFAULT CURRENT_TIMESTAMP,
  base_currency               TEXT    NOT NULL DEFAULT 'GBP' CHECK(base_currency IN ('GBP','PLN')),
  parenting_mode              TEXT    NOT NULL DEFAULT 'single' CHECK(parenting_mode IN ('single','co-parenting')),
  deleted_at                  INTEGER,
  trial_start_date            DATETIME DEFAULT NULL,
  is_activated                BOOLEAN DEFAULT FALSE,
  has_lifetime_license        BOOLEAN DEFAULT FALSE,
  ai_subscription_expiry      DATETIME DEFAULT NULL,
  fast_track_enabled          INTEGER NOT NULL DEFAULT 0,
  shared_expense_threshold    INTEGER NOT NULL DEFAULT 5000,
  shared_expense_split_bp     INTEGER NOT NULL DEFAULT 5000,
  has_shield                  INTEGER NOT NULL DEFAULT 0,
  home_lat                    REAL,
  home_lng                    REAL,
  referral_code               TEXT,
  referred_by_code            TEXT,
  has_ai_mentor               INTEGER NOT NULL DEFAULT 0,
  is_demo                     INTEGER NOT NULL DEFAULT 0,
  license_type                TEXT    NOT NULL DEFAULT 'core',
  pocket_money_day            INTEGER NOT NULL DEFAULT 6 CHECK (pocket_money_day BETWEEN 0 AND 6),
  overdraft_enabled           INTEGER NOT NULL DEFAULT 0,
  overdraft_limit_pence       INTEGER NOT NULL DEFAULT 0 CHECK (overdraft_limit_pence >= 0),
  child_analytics_consent     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS users (
  id                  TEXT    PRIMARY KEY,
  family_id           TEXT    NOT NULL REFERENCES families(id),
  display_name        TEXT    NOT NULL,
  email               TEXT    UNIQUE,
  locale              TEXT    NOT NULL DEFAULT 'en' CHECK(locale IN ('en', 'pl')),
  password_hash       TEXT,
  pin_hash            TEXT,
  email_verified      INTEGER NOT NULL DEFAULT 0,
  created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
  firebase_uid        TEXT    DEFAULT NULL,
  allowance_amount    INTEGER NOT NULL DEFAULT 0,
  allowance_day       INTEGER NOT NULL DEFAULT 6 CHECK (allowance_day BETWEEN 0 AND 6),
  earnings_mode       TEXT    NOT NULL DEFAULT 'HYBRID' CHECK (earnings_mode IN ('ALLOWANCE', 'CHORES', 'HYBRID')),
  allowance_frequency TEXT    NOT NULL DEFAULT 'WEEKLY' CHECK (allowance_frequency IN ('WEEKLY', 'BI_WEEKLY', 'MONTHLY')),
  teen_mode           INTEGER NOT NULL DEFAULT 0 CHECK (teen_mode IN (0,1)),
  email_pending       TEXT,
  parent_pin_hash     TEXT,
  pin_attempt_count   INTEGER NOT NULL DEFAULT 0,
  pin_locked_until    INTEGER,
  google_sub          TEXT,
  google_picture      TEXT,
  monzo_handle        TEXT,
  revolut_handle      TEXT,
  paypal_handle       TEXT,
  venmo_handle        TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  jti         TEXT    PRIMARY KEY,
  user_id     TEXT    NOT NULL REFERENCES users(id),
  family_id   TEXT    NOT NULL REFERENCES families(id),
  role        TEXT    NOT NULL CHECK(role IN ('parent', 'child')),
  expires_at  INTEGER NOT NULL,
  revoked_at  INTEGER,
  ip_address  TEXT,
  user_agent  TEXT,
  issued_at   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS family_roles (
  user_id     TEXT NOT NULL REFERENCES users(id),
  family_id   TEXT NOT NULL REFERENCES families(id),
  role        TEXT NOT NULL CHECK(role IN ('parent', 'child')),
  parent_role TEXT CHECK (parent_role IN ('lead', 'co_parent')),
  PRIMARY KEY (user_id, family_id)
);

CREATE TABLE IF NOT EXISTS invite_codes (
  code        TEXT    PRIMARY KEY,
  family_id   TEXT    NOT NULL REFERENCES families(id),
  created_by  TEXT    NOT NULL REFERENCES users(id),
  role        TEXT    NOT NULL CHECK(role IN ('child','co-parent')),
  redeemed_by TEXT    DEFAULT NULL,
  redeemed_at INTEGER DEFAULT NULL,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at  INTEGER NOT NULL,
  child_id    TEXT    DEFAULT NULL REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS user_settings (
  user_id   TEXT    PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  avatar_id TEXT    NOT NULL DEFAULT 'bottts:spark',
  theme     TEXT    NOT NULL DEFAULT 'system' CHECK (theme IN ('light','dark','system')),
  locale    TEXT    NOT NULL DEFAULT 'en' CHECK (locale IN ('en','en-GB','en-US','pl')),
  app_view  TEXT    NOT NULL DEFAULT 'ORCHARD' CHECK (app_view IN ('ORCHARD','CLEAN')),
  updated_at INTEGER NOT NULL DEFAULT 0,
  age_level INTEGER NOT NULL DEFAULT 2
);

CREATE TABLE IF NOT EXISTS account_locks (
  user_id      TEXT    PRIMARY KEY REFERENCES users(id),
  locked_by    TEXT    NOT NULL REFERENCES users(id),
  locked_until INTEGER NOT NULL,
  reason       TEXT,
  created_at   INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS magic_link_tokens (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash  TEXT    UNIQUE NOT NULL,
  user_id     TEXT    NOT NULL REFERENCES users(id),
  expires_at  INTEGER NOT NULL,
  used_at     INTEGER,
  request_ip  TEXT
);

CREATE TABLE IF NOT EXISTS magic_link_attempts (
  email        TEXT    PRIMARY KEY,
  attempts     INTEGER NOT NULL DEFAULT 0,
  window_start INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS login_attempts (
  email        TEXT    PRIMARY KEY,
  attempts     INTEGER NOT NULL DEFAULT 0,
  window_start INTEGER NOT NULL,
  locked_until INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS email_verify_tokens (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id   TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token     TEXT    NOT NULL UNIQUE,
  new_email TEXT    NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at   INTEGER
);

CREATE TABLE IF NOT EXISTS registration_progress (
  family_id  TEXT    PRIMARY KEY REFERENCES families(id),
  last_step  INTEGER NOT NULL DEFAULT 1,
  step_data  TEXT    NOT NULL DEFAULT '{}',
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS analytics_consents (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id          TEXT    NOT NULL REFERENCES users(id),
  consented        INTEGER NOT NULL CHECK (consented IN (0, 1)),
  consent_version  TEXT    NOT NULL,
  ip_address       TEXT    NOT NULL,
  consented_at     INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS child_logins (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id    TEXT    NOT NULL REFERENCES families(id),
  child_id     TEXT    NOT NULL REFERENCES users(id),
  ip_address   TEXT    NOT NULL,
  logged_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  user_agent   TEXT,
  session_jti  TEXT    REFERENCES sessions(jti),
  app_view     TEXT    NOT NULL DEFAULT 'ORCHARD' CHECK (app_view IN ('ORCHARD', 'CLEAN'))
);

CREATE TABLE IF NOT EXISTS slt_tokens (
  token       TEXT    PRIMARY KEY,
  user_id     TEXT    NOT NULL,
  expires_at  INTEGER NOT NULL,
  ip_address  TEXT,
  user_agent  TEXT
);

CREATE TABLE IF NOT EXISTS slt_attempts (
  ip           TEXT    PRIMARY KEY,
  attempts     INTEGER NOT NULL DEFAULT 0,
  blocked_until INTEGER
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT    NOT NULL REFERENCES users(id),
  family_id  TEXT    NOT NULL REFERENCES families(id),
  endpoint   TEXT    NOT NULL UNIQUE,
  p256dh     TEXT    NOT NULL,
  auth_key   TEXT    NOT NULL,
  user_agent TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS ledger (
  id                    INTEGER PRIMARY KEY,
  family_id             TEXT    NOT NULL,
  child_id              TEXT,
  chore_id              TEXT,
  entry_type            TEXT    NOT NULL CHECK (entry_type IN ('credit', 'reversal', 'payment', 'system_note')),
  amount                INTEGER NOT NULL CHECK (amount >= 0),
  currency              TEXT    NOT NULL CHECK (currency IN ('GBP', 'PLN')),
  description           TEXT    NOT NULL,
  receipt_id            TEXT,
  category              TEXT,
  verification_status   TEXT    NOT NULL CHECK (verification_status IN ('pending','verified_auto','verified_manual','disputed','reversed')),
  authorised_by         TEXT,
  verified_at           INTEGER,
  verified_by           TEXT,
  dispute_code          TEXT,
  dispute_before        INTEGER,
  previous_hash         TEXT    NOT NULL,
  record_hash           TEXT    NOT NULL,
  ip_address            TEXT    NOT NULL,
  created_at            INTEGER NOT NULL DEFAULT (unixepoch()),
  pruned_at             INTEGER,
  is_seed               INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS ledger_prune_archive (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  ledger_id     INTEGER NOT NULL,
  record_hash   TEXT    NOT NULL,
  previous_hash TEXT    NOT NULL,
  archived_at   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS ledger_status_log (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  ledger_id    INTEGER NOT NULL,
  from_status  TEXT    NOT NULL,
  to_status    TEXT    NOT NULL,
  actor_id     TEXT    NOT NULL,
  dispute_code TEXT,
  ip_address   TEXT,
  created_at   INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS currency_snapshots (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ledger_id  INTEGER NOT NULL,
  base       TEXT    NOT NULL CHECK (base IN ('GBP', 'PLN')),
  quote      TEXT    NOT NULL CHECK (quote IN ('GBP', 'PLN')),
  rate_bp    INTEGER NOT NULL CHECK (rate_bp > 0),
  captured_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS chores (
  id             TEXT    PRIMARY KEY,
  family_id      TEXT    NOT NULL REFERENCES families(id),
  assigned_to    TEXT    NOT NULL REFERENCES users(id),
  created_by     TEXT    NOT NULL REFERENCES users(id),
  title          TEXT    NOT NULL,
  description    TEXT,
  reward_amount  INTEGER NOT NULL CHECK (reward_amount > 0),
  currency       TEXT    NOT NULL CHECK (currency IN ('GBP','PLN')),
  frequency      TEXT    NOT NULL DEFAULT 'as_needed' CHECK (frequency IN ('daily','weekly','bi_weekly','monthly','quarterly','as_needed','school_days')),
  due_date       TEXT,
  is_priority    INTEGER NOT NULL DEFAULT 0,
  is_flash       INTEGER NOT NULL DEFAULT 0,
  flash_deadline TEXT,
  archived       INTEGER NOT NULL DEFAULT 0,
  created_at     INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at     INTEGER NOT NULL DEFAULT (unixepoch()),
  proof_required INTEGER NOT NULL DEFAULT 0,
  auto_approve   INTEGER NOT NULL DEFAULT 0,
  is_seed        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS completions (
  id                      TEXT    PRIMARY KEY,
  family_id               TEXT    NOT NULL,
  chore_id                TEXT    NOT NULL,
  child_id                TEXT    NOT NULL,
  note                    TEXT,
  status                  TEXT    NOT NULL DEFAULT 'awaiting_review' CHECK(status IN ('available','awaiting_review','completed','needs_revision','rejected')),
  proof_url               TEXT,
  parent_notes            TEXT,
  attempt_count           INTEGER NOT NULL DEFAULT 1,
  ledger_id               INTEGER,
  rating                  INTEGER DEFAULT 0,
  submitted_at            INTEGER NOT NULL DEFAULT (unixepoch()),
  resolved_at             INTEGER,
  resolved_by             TEXT,
  proof_hash              TEXT,
  proof_exif              TEXT,
  system_verify           TEXT,
  verification_confidence TEXT,
  paid_out_at             INTEGER,
  is_seed                 INTEGER NOT NULL DEFAULT 0,
  verified_at             INTEGER,
  haversine_km            REAL,
  network_city            TEXT,
  network_ip              TEXT,
  device_model            TEXT,
  user_agent              TEXT,
  device_fingerprint      TEXT
);

CREATE TABLE IF NOT EXISTS goals (
  id                        TEXT    PRIMARY KEY,
  family_id                 TEXT    NOT NULL REFERENCES families(id),
  child_id                  TEXT    NOT NULL REFERENCES users(id),
  title                     TEXT    NOT NULL,
  target_amount             INTEGER NOT NULL CHECK (target_amount > 0),
  currency                  TEXT    NOT NULL CHECK (currency IN ('GBP','PLN')),
  category                  TEXT    NOT NULL DEFAULT 'other',
  deadline                  TEXT,
  alloc_pct                 INTEGER NOT NULL DEFAULT 0 CHECK (alloc_pct BETWEEN 0 AND 100),
  match_rate                INTEGER NOT NULL DEFAULT 0 CHECK (match_rate IN (0,10,25,50,100)),
  sort_order                INTEGER NOT NULL DEFAULT 0,
  archived                  INTEGER NOT NULL DEFAULT 0,
  status                    TEXT    NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','REACHED','ARCHIVED')),
  current_saved_pence       INTEGER NOT NULL DEFAULT 0,
  product_url               TEXT,
  parent_match_pct          INTEGER NOT NULL DEFAULT 0 CHECK (parent_match_pct BETWEEN 0 AND 100),
  parent_fixed_contribution INTEGER NOT NULL DEFAULT 0,
  created_at                INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at                INTEGER NOT NULL DEFAULT (unixepoch()),
  is_seed                   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS jar_config (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id  TEXT    NOT NULL REFERENCES families(id),
  child_id   TEXT    NOT NULL REFERENCES users(id),
  enabled    INTEGER NOT NULL DEFAULT 0,
  spend_pct  INTEGER NOT NULL DEFAULT 70,
  save_pct   INTEGER NOT NULL DEFAULT 20,
  give_pct   INTEGER NOT NULL DEFAULT 10,
  updated_at INTEGER NOT NULL,
  UNIQUE(family_id, child_id),
  CHECK(spend_pct + save_pct + give_pct = 100),
  CHECK(spend_pct >= 0 AND save_pct >= 0 AND give_pct >= 0)
);

CREATE TABLE IF NOT EXISTS jar_movements (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id     TEXT    NOT NULL REFERENCES families(id),
  child_id      TEXT    NOT NULL REFERENCES users(id),
  jar           TEXT    NOT NULL CHECK(jar IN ('spend','save','give')),
  delta         INTEGER NOT NULL DEFAULT 0,
  earmark_pence INTEGER,
  kind          TEXT    NOT NULL CHECK(kind IN ('allocation','enable_seed','manual_move','spend','give_request','give_fulfilled','give_declined','goal_allocate','goal_deallocate','goal_purchase','payout')),
  ref_id        TEXT,
  goal_id       INTEGER REFERENCES goals(id),
  note          TEXT,
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS give_requests (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id       TEXT    NOT NULL REFERENCES families(id),
  child_id        TEXT    NOT NULL REFERENCES users(id),
  cause           TEXT    NOT NULL,
  amount          INTEGER NOT NULL,
  currency        TEXT    NOT NULL,
  status          TEXT    NOT NULL DEFAULT 'requested' CHECK(status IN ('requested','fulfilled','declined')),
  requested_at    INTEGER NOT NULL,
  fulfilled_at    INTEGER,
  parent_note     TEXT,
  jar_movement_id INTEGER REFERENCES jar_movements(id)
);

CREATE TABLE IF NOT EXISTS spending (
  id        TEXT    PRIMARY KEY,
  family_id TEXT    NOT NULL REFERENCES families(id),
  child_id  TEXT    NOT NULL REFERENCES users(id),
  title     TEXT    NOT NULL,
  amount    INTEGER NOT NULL CHECK (amount > 0),
  currency  TEXT    NOT NULL CHECK (currency IN ('GBP','PLN')),
  note      TEXT,
  goal_id   TEXT    REFERENCES goals(id),
  spent_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  is_seed   INTEGER NOT NULL DEFAULT 0,
  category  TEXT
);

CREATE TABLE IF NOT EXISTS payouts (
  id        TEXT    PRIMARY KEY,
  family_id TEXT    NOT NULL REFERENCES families(id),
  child_id  TEXT    NOT NULL REFERENCES users(id),
  paid_by   TEXT    NOT NULL REFERENCES users(id),
  amount    INTEGER NOT NULL CHECK (amount > 0),
  currency  TEXT    NOT NULL CHECK (currency IN ('GBP','PLN')),
  note      TEXT,
  paid_at   INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS bonus_payments (
  id        TEXT    PRIMARY KEY,
  family_id TEXT    NOT NULL REFERENCES families(id),
  child_id  TEXT    NOT NULL REFERENCES users(id),
  paid_by   TEXT    NOT NULL REFERENCES users(id),
  amount    INTEGER NOT NULL CHECK (amount > 0),
  currency  TEXT    NOT NULL CHECK (currency IN ('GBP','PLN')),
  reason    TEXT    NOT NULL,
  ledger_id INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id         TEXT    PRIMARY KEY,
  family_id  TEXT    NOT NULL REFERENCES families(id),
  child_id   TEXT    NOT NULL REFERENCES users(id),
  title      TEXT    NOT NULL,
  category   TEXT    NOT NULL DEFAULT 'other',
  amount     INTEGER NOT NULL CHECK (amount > 0),
  currency   TEXT    NOT NULL CHECK (currency IN ('GBP','PLN')),
  frequency  TEXT    NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('weekly','monthly','annual')),
  start_date TEXT    NOT NULL,
  active     INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS plans (
  id           TEXT    PRIMARY KEY,
  family_id    TEXT    NOT NULL REFERENCES families(id),
  chore_id     TEXT    NOT NULL REFERENCES chores(id),
  child_id     TEXT    NOT NULL REFERENCES users(id),
  day_of_week  INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  week_start   TEXT    NOT NULL,
  added_at     INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS suggestions (
  id              TEXT    PRIMARY KEY,
  family_id       TEXT    NOT NULL REFERENCES families(id),
  child_id        TEXT    NOT NULL REFERENCES users(id),
  title           TEXT    NOT NULL,
  frequency       TEXT,
  proposed_amount INTEGER NOT NULL CHECK (proposed_amount > 0),
  reason          TEXT,
  status          TEXT    NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  rejection_note  TEXT,
  submitted_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  resolved_at     INTEGER,
  resolved_by     TEXT    REFERENCES users(id),
  due_date        TEXT
);

CREATE TABLE IF NOT EXISTS insight_snapshots (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  child_id             TEXT    NOT NULL REFERENCES users(id),
  family_id            TEXT    NOT NULL REFERENCES families(id),
  snapshot_date        TEXT    NOT NULL,
  consistency_score    INTEGER,
  responsibility_score INTEGER,
  planning_horizon     INTEGER,
  total_earned_pence   INTEGER NOT NULL DEFAULT 0,
  created_at           INTEGER NOT NULL DEFAULT (unixepoch()),
  observation          TEXT,
  behavioral_root      TEXT,
  the_nudge            TEXT,
  jar_snapshot         TEXT
);

CREATE TABLE IF NOT EXISTS child_nudges (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  child_id        TEXT    NOT NULL REFERENCES users(id),
  family_id       TEXT    NOT NULL REFERENCES families(id),
  trigger_type    TEXT    NOT NULL,
  screen_context  TEXT    NOT NULL CHECK (screen_context IN ('earn', 'money', 'goals')),
  orchard_text    TEXT    NOT NULL,
  clean_text      TEXT    NOT NULL,
  pillar          TEXT    NOT NULL,
  tone            TEXT    NOT NULL CHECK (tone IN ('encouraging', 'celebratory', 'honest', 'accountability')),
  parent_summary  TEXT    NOT NULL,
  is_dismissed    INTEGER NOT NULL DEFAULT 0,
  source          TEXT    NOT NULL DEFAULT 'rule_based' CHECK (source IN ('rule_based', 'ai')),
  trigger_meta    TEXT,
  created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at      INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS child_streaks (
  child_id              TEXT    NOT NULL PRIMARY KEY REFERENCES users(id),
  current_streak        INTEGER NOT NULL DEFAULT 0,
  longest_streak        INTEGER NOT NULL DEFAULT 0,
  grace_days_remaining  INTEGER NOT NULL DEFAULT 0,
  last_kept_date        TEXT,
  last_checked_date     TEXT,
  updated_at            TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS child_badges (
  id        TEXT NOT NULL PRIMARY KEY,
  child_id  TEXT NOT NULL REFERENCES users(id),
  badge_key TEXT NOT NULL,
  earned_at TEXT NOT NULL,
  UNIQUE(child_id, badge_key)
);

CREATE TABLE IF NOT EXISTS parent_messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id  TEXT    NOT NULL REFERENCES families(id),
  from_user  TEXT    NOT NULL REFERENCES users(id),
  to_child   TEXT    NOT NULL REFERENCES users(id),
  message    TEXT    NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE (from_user, to_child)
);

CREATE TABLE IF NOT EXISTS shared_expenses (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id            TEXT    NOT NULL REFERENCES families(id),
  logged_by            TEXT    NOT NULL REFERENCES users(id),
  authorised_by        TEXT    REFERENCES users(id),
  description          TEXT    NOT NULL,
  category             TEXT    NOT NULL CHECK (category IN ('education','health','clothing','travel','activities','childcare','food','tech','gifts','other')),
  total_amount         INTEGER NOT NULL CHECK (total_amount > 0),
  currency             TEXT    NOT NULL CHECK (currency IN ('GBP', 'PLN', 'USD')),
  split_bp             INTEGER NOT NULL DEFAULT 5000 CHECK (split_bp BETWEEN 0 AND 10000),
  verification_status  TEXT    NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('committed_auto','pending','committed_manual','rejected','voided','reversed')),
  attachment_key       TEXT,
  settlement_period    TEXT,
  reconciled_at        INTEGER,
  reconciled_by        TEXT    REFERENCES users(id),
  hash_version         INTEGER NOT NULL DEFAULT 1,
  previous_hash        TEXT    NOT NULL,
  record_hash          TEXT    NOT NULL,
  ip_address           TEXT    NOT NULL,
  created_at           INTEGER NOT NULL DEFAULT (unixepoch()),
  deleted_at           INTEGER,
  expense_date         TEXT,
  note                 TEXT,
  receipt_r2_key       TEXT,
  receipt_hash         TEXT,
  receipt_uploaded_at  INTEGER,
  voided_at            INTEGER,
  voided_by            TEXT,
  voids_id             INTEGER REFERENCES shared_expenses(id)
);

CREATE TABLE IF NOT EXISTS family_governance_log (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id    TEXT    NOT NULL REFERENCES families(id),
  requested_by TEXT    NOT NULL REFERENCES users(id),
  confirmed_by TEXT    REFERENCES users(id),
  old_mode     TEXT    NOT NULL CHECK(old_mode IN ('amicable', 'standard')),
  new_mode     TEXT    NOT NULL CHECK(new_mode IN ('amicable', 'standard')),
  status       TEXT    NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'confirmed', 'rejected', 'expired')),
  requested_at INTEGER NOT NULL,
  expires_at   INTEGER NOT NULL,
  confirmed_at INTEGER,
  request_ip   TEXT,
  confirm_ip   TEXT
);

CREATE TABLE IF NOT EXISTS market_rates (
  id               TEXT    PRIMARY KEY,
  canonical_name   TEXT    NOT NULL UNIQUE,
  category         TEXT    NOT NULL,
  synonyms         TEXT    NOT NULL DEFAULT '[]',
  uk_median_pence  INTEGER,
  us_median_cents  INTEGER,
  pl_median_grosz  INTEGER,
  data_source      TEXT    NOT NULL DEFAULT 'industry_seed' CHECK(data_source IN ('industry_seed', 'community_median')),
  sample_count     INTEGER NOT NULL DEFAULT 0,
  is_orchard_8     INTEGER NOT NULL DEFAULT 0,
  sort_order       INTEGER NOT NULL DEFAULT 99,
  created_at       INTEGER NOT NULL,
  updated_at       INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS chore_promotion_candidates (
  id               TEXT    PRIMARY KEY,
  normalized_key   TEXT    NOT NULL,
  locale           TEXT    NOT NULL,
  display_name     TEXT    NOT NULL,
  category         TEXT    NOT NULL DEFAULT 'Good Habits',
  distinct_families INTEGER NOT NULL DEFAULT 0,
  suggestion_count INTEGER NOT NULL DEFAULT 0,
  median_amount    INTEGER,
  sample_titles    TEXT    NOT NULL DEFAULT '[]',
  status           TEXT    NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','promoted','dismissed')),
  emailed_at       INTEGER,
  reviewed_at      INTEGER,
  market_rate_id   TEXT,
  first_seen_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  last_seen_at     INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at       INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS bilingual_labels (
  code     TEXT PRIMARY KEY,
  label_en TEXT NOT NULL,
  label_pl TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_history (
  id          TEXT    PRIMARY KEY,
  child_id    TEXT    NOT NULL REFERENCES users(id),
  message     TEXT    NOT NULL,
  reply       TEXT    NOT NULL,
  pillar      TEXT    NOT NULL,
  unlock_slug TEXT,
  app_view    TEXT    NOT NULL,
  locale      TEXT    NOT NULL,
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_rate_limits (
  child_id     TEXT    PRIMARY KEY,
  attempts     INTEGER NOT NULL DEFAULT 0,
  window_start INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS lesson_completions (
  id           TEXT NOT NULL PRIMARY KEY,
  child_id     TEXT NOT NULL REFERENCES users(id),
  lesson_key   TEXT NOT NULL,
  completed_at TEXT NOT NULL,
  UNIQUE(child_id, lesson_key)
);

CREATE TABLE IF NOT EXISTS unlocked_modules (
  id          TEXT    PRIMARY KEY,
  child_id    TEXT    NOT NULL REFERENCES users(id),
  module_slug TEXT    NOT NULL,
  unlocked_at INTEGER NOT NULL,
  is_seed     INTEGER NOT NULL DEFAULT 0,
  UNIQUE (child_id, module_slug)
);

CREATE TABLE IF NOT EXISTS module_act_progress (
  id          TEXT    NOT NULL PRIMARY KEY,
  child_id    TEXT    NOT NULL REFERENCES users(id),
  module_slug TEXT    NOT NULL,
  act_num     INTEGER NOT NULL CHECK (act_num BETWEEN 1 AND 4),
  completed_at INTEGER NOT NULL,
  UNIQUE (child_id, module_slug, act_num)
);

CREATE TABLE IF NOT EXISTS payment_audit_log (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id        TEXT    NOT NULL REFERENCES families(id),
  stripe_session_id TEXT   NOT NULL UNIQUE,
  amount_paid_int  INTEGER NOT NULL,
  currency         TEXT    NOT NULL,
  payment_type     TEXT    CHECK(payment_type IN ('LIFETIME','AI_ANNUAL','COMPLETE','COMPLETE_AI','SHIELD_AI','AI_UPGRADE','SHIELD')),
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  refunded_at      DATETIME DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS promo_codes (
  id                   TEXT    PRIMARY KEY,
  stripe_promo_code_id TEXT    NOT NULL UNIQUE,
  code                 TEXT    NOT NULL UNIQUE,
  label                TEXT    NOT NULL,
  coupon_id            TEXT    NOT NULL,
  max_redemptions      INTEGER NOT NULL,
  created_at           INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS promo_code_redemptions (
  id                TEXT    PRIMARY KEY,
  promo_code_id     TEXT    NOT NULL REFERENCES promo_codes(id),
  family_id         TEXT    NOT NULL,
  stripe_session_id TEXT    NOT NULL,
  redeemed_at       INTEGER NOT NULL,
  UNIQUE (promo_code_id, family_id)
);

CREATE TABLE IF NOT EXISTS referral_clicks (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  referral_code TEXT    NOT NULL,
  clicked_at    INTEGER NOT NULL,
  user_agent    TEXT,
  ip_hash       TEXT
);

CREATE TABLE IF NOT EXISTS referral_conversions (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  referral_code     TEXT    NOT NULL,
  referred_family   TEXT    NOT NULL,
  payment_type      TEXT    NOT NULL,
  stripe_session_id TEXT    NOT NULL UNIQUE,
  converted_at      INTEGER NOT NULL,
  reward_granted    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS payday_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id  TEXT    NOT NULL REFERENCES families(id),
  child_id   TEXT    NOT NULL REFERENCES users(id),
  week_start TEXT    NOT NULL,
  ledger_id  INTEGER NOT NULL,
  paid_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE (child_id, week_start)
);

CREATE TABLE IF NOT EXISTS review_feedback (
  id           TEXT    PRIMARY KEY,
  user_id      TEXT    NOT NULL,
  family_id    TEXT    NOT NULL,
  message      TEXT,
  app_platform TEXT    NOT NULL,
  app_version  TEXT    NOT NULL,
  created_at   INTEGER NOT NULL,
  emailed_at   INTEGER
);

CREATE TABLE IF NOT EXISTS review_prompt_state (
  user_id                   TEXT    PRIMARY KEY,
  family_id                 TEXT    NOT NULL,
  prompt_count              INTEGER NOT NULL DEFAULT 0,
  last_prompted_at          INTEGER,
  approvals_at_last_prompt  INTEGER NOT NULL DEFAULT 0,
  last_outcome              TEXT,
  suppress_until            INTEGER,
  opted_out                 INTEGER NOT NULL DEFAULT 0,
  created_at                INTEGER NOT NULL,
  updated_at                INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS demo_registrations (
  id               TEXT    PRIMARY KEY,
  name             TEXT    NOT NULL,
  email            TEXT    NOT NULL,
  user_type        TEXT    NOT NULL CHECK (user_type IN ('professional', 'demo_parent')),
  marketing_consent INTEGER NOT NULL DEFAULT 0,
  registered_at    INTEGER NOT NULL,
  last_active_at   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS upgrade_interest (
  id            TEXT    PRIMARY KEY,
  user_id       TEXT    NOT NULL,
  feature       TEXT    NOT NULL CHECK (feature IN ('shield', 'ai_mentor', 'learning_lab')),
  registered_at INTEGER NOT NULL,
  UNIQUE (user_id, feature)
);

-- ---------------------------------------------------------------------------
-- INDEXES
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_chores_family    ON chores (family_id, archived, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chores_child     ON chores (assigned_to, archived);
CREATE INDEX IF NOT EXISTS idx_completions_family ON completions (family_id, status, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_completions_child  ON completions (child_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_goals_child      ON goals (child_id, archived, sort_order);
CREATE INDEX IF NOT EXISTS idx_ledger_family    ON ledger (family_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_child     ON ledger (child_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_jti     ON sessions (jti);
CREATE INDEX IF NOT EXISTS idx_sessions_user    ON sessions (user_id, revoked_at);
CREATE INDEX IF NOT EXISTS idx_invite_family    ON invite_codes (family_id);
CREATE INDEX IF NOT EXISTS idx_invite_expires   ON invite_codes (expires_at);
CREATE INDEX IF NOT EXISTS idx_child_logins     ON child_logins (child_id, logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_push_user        ON push_subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_spending_child   ON spending (child_id, spent_at DESC);
CREATE INDEX IF NOT EXISTS idx_payouts_child    ON payouts (child_id, paid_at DESC);
CREATE INDEX IF NOT EXISTS idx_subs_child       ON subscriptions (child_id, active);
CREATE INDEX IF NOT EXISTS idx_plans_child_week ON plans (child_id, week_start);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email      ON users (email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_sub ON users (google_sub) WHERE google_sub IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_demo_registrations_email ON demo_registrations (email);

-- ---------------------------------------------------------------------------
-- MARK ALL MIGRATIONS AS APPLIED
-- Prevents wrangler from re-running any migration against this fresh DB.
-- ---------------------------------------------------------------------------

INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0001_initial_schema.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0002_dispute_window.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0003_proof_of_contribution.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0004_relax_ledger_update_trigger.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0005_add_disputed_status.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0006_auth.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0007_invite_codes_and_currency.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0008_app_tables.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0009_school_days_frequency.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0010_teen_mode.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0011_allowance.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0012_earnings_mode.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0013_savings_grove.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0014_transaction_loop.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0015_available_status.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0016_insight_snapshots.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0017_snapshot_briefing_columns.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0018_invite_child_id.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0019_system_note_entry_type.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0020_parent_role_and_family_soft_delete.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0021_security_suite.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0022_google_oauth.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0023_sessions_issued_at.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0024_child_logins_columns.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0025_app_view.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0026_child_logins_app_view.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0027_global_foundations.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0028_learning_lab.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0029_market_rates.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0030_evidence_verification.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0031_market_rates_global_seed.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0032_bilingual_labels_repair.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0033_shared_expenses.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0034_shared_expense_settings.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0035_shared_expense_field_guards.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0037_payment_bridge.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0038_shield_sku.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0039_prune_archive.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0040_widen_locale_constraint.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0041_families_home_coords.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0042_referral_system.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0043_pricing_pivot.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0044_payment_audit_log.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0045_fix_payment_audit_log_constraint.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0046_payment_audit_log_refunded_at.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0047_marketing_consent.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0048_demo_account.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0049_demo_seed.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0050_demo_enrichment.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0051_demo_expenses.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0052_demo_learning_lab.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0053_family_global_rules.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0054_shared_expense_extensions.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0055_email_verify_tokens.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0056_chat_rate_limits.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0057_login_attempts.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0058_gamification.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0059_rejected_status.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0060_magic_link_attempts.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0061_lab_progress.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0062_analytics_consent.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0063_review_prompts.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0064_promo_codes.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0065_suggestions_due_date.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0066_chore_promotion_candidates.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0067_spending_category.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0068_jar_config.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0069_jar_movements.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0070_give_requests.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0071_insight_snapshot_jars.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0072_jar_movements_payout_kind.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0073_child_nudges.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0074_forensic_completion_columns.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('repair_production.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('seed_test_data_expand.sql');

-- ---------------------------------------------------------------------------

PRAGMA foreign_keys = ON;
