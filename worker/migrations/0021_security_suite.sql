-- Migration 0021: Security Suite
--
-- parent_pin_hash   — parent's own 4-digit PIN (separate from child pin_hash)
-- pin_attempt_count — tracks consecutive wrong PINs (server-side lockout)
-- pin_locked_until  — unixepoch timestamp; NULL = not locked
-- sessions.user_agent — stored at login time for the Active Sessions display

ALTER TABLE users ADD COLUMN parent_pin_hash   TEXT;
ALTER TABLE users ADD COLUMN pin_attempt_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN pin_locked_until  INTEGER;

ALTER TABLE sessions ADD COLUMN user_agent TEXT;
