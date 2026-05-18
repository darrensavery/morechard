-- Rate-limit table for magic-link email requests.
-- Prevents inbox-flooding attacks on known email addresses.
CREATE TABLE IF NOT EXISTS magic_link_attempts (
  email        TEXT    PRIMARY KEY,
  attempts     INTEGER NOT NULL DEFAULT 0,
  window_start INTEGER NOT NULL
);
