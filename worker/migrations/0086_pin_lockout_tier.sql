-- Escalating PIN lockout. A flat 30s lockout after 5 fails on a 4-digit PIN
-- (10,000 combinations) is grindable within a day. This tier doubles the
-- lockout duration each time a user is locked out again, capped at 24h.
ALTER TABLE users ADD COLUMN pin_lockout_tier INTEGER NOT NULL DEFAULT 0;
