-- locale_multipliers: PPP-adjusted price multipliers relative to GBP pence.
-- These are manually maintained by admin — they reflect fair chore pay in each
-- country, not live forex. Admin can update via PUT /api/admin/exchange-rates/:locale.

CREATE TABLE locale_multipliers (
  locale      TEXT    PRIMARY KEY,  -- 'en-GB' | 'en-US' | 'pl'
  currency    TEXT    NOT NULL,     -- 'GBP' | 'USD' | 'PLN'
  multiplier  REAL    NOT NULL,     -- factor applied to uk_median_pence to get local amount
  label       TEXT    NOT NULL,     -- human-readable currency name
  updated_at  INTEGER NOT NULL
);

INSERT INTO locale_multipliers (locale, currency, multiplier, label, updated_at) VALUES
  ('en-GB', 'GBP', 1.0,  'British Pound',  unixepoch()),
  ('en-US', 'USD', 1.27, 'US Dollar',      unixepoch()),
  ('pl',    'PLN', 5.0,  'Polish Zloty',   unixepoch());
