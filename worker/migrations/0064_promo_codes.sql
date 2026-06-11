-- One promo code per school/partner — shared with all families at that org.
-- Stripe enforces max_redemptions; we track which families redeemed it.

CREATE TABLE promo_codes (
  id                    TEXT    PRIMARY KEY,
  stripe_promo_code_id  TEXT    NOT NULL UNIQUE,  -- Stripe promo_... ID
  code                  TEXT    NOT NULL UNIQUE,  -- code shared with the school e.g. 'SPRINGFIELD2024'
  label                 TEXT    NOT NULL,          -- human label e.g. 'Springfield Primary School'
  coupon_id             TEXT    NOT NULL,          -- Stripe coupon ID
  max_redemptions       INTEGER NOT NULL,          -- cap set on the Stripe promo code
  created_at            INTEGER NOT NULL
);

-- One row per family that redeems the code
CREATE TABLE promo_code_redemptions (
  id                TEXT    PRIMARY KEY,
  promo_code_id     TEXT    NOT NULL REFERENCES promo_codes(id),
  family_id         TEXT    NOT NULL,
  stripe_session_id TEXT    NOT NULL,
  redeemed_at       INTEGER NOT NULL,
  UNIQUE (promo_code_id, family_id)   -- one redemption per family per code
);

CREATE INDEX idx_promo_redemptions_code   ON promo_code_redemptions(promo_code_id);
CREATE INDEX idx_promo_code_stripe        ON promo_codes(stripe_promo_code_id);
