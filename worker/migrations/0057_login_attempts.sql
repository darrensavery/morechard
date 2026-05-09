-- Rate-limit table for parent email+password login.
-- Tracks failed attempts per normalised email within a sliding window.
CREATE TABLE IF NOT EXISTS login_attempts (
  email        TEXT    PRIMARY KEY,
  attempts     INTEGER NOT NULL DEFAULT 0,
  window_start INTEGER NOT NULL,
  locked_until INTEGER NOT NULL DEFAULT 0
);
