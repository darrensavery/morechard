-- IP-based abuse tracking for invite code peek/redeem endpoints.
-- Codes are 6 chars (~30 bits entropy) with a 72h TTL — without this, an
-- unauthenticated caller could grind through the keyspace.
CREATE TABLE IF NOT EXISTS invite_redeem_attempts (
  ip            TEXT    PRIMARY KEY,
  attempts      INTEGER NOT NULL DEFAULT 0,
  window_start  INTEGER NOT NULL,
  locked_until  INTEGER NOT NULL DEFAULT 0
);
