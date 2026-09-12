CREATE TABLE products (
  sku               TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  stripe_product_id TEXT NOT NULL,
  stripe_price_id   TEXT NOT NULL,
  unit_amount_pence INTEGER NOT NULL,
  currency          TEXT NOT NULL DEFAULT 'GBP',
  active            INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE checkout_intents (
  stripe_session_id     TEXT PRIMARY KEY,
  family_id             TEXT NOT NULL REFERENCES families(id),
  sku                   TEXT NOT NULL,
  stripe_price_id       TEXT NOT NULL,
  expected_amount_pence INTEGER NOT NULL,
  currency              TEXT NOT NULL DEFAULT 'GBP',
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_checkout_intents_family ON checkout_intents (family_id);
