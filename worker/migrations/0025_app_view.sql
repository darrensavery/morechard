-- Migration 0025: Add app_view TEXT ENUM to user_settings, populated from teen_mode.
-- SQLite cannot rename or drop columns, so the old teen_mode column stays but is ignored.
-- ORCHARD = former teen_mode 0 (default child view — nature metaphors)
-- CLEAN   = former teen_mode 1 (professional view — financial terms)

ALTER TABLE user_settings ADD COLUMN app_view TEXT NOT NULL DEFAULT 'ORCHARD'
  CHECK (app_view IN ('ORCHARD', 'CLEAN'));

UPDATE user_settings SET app_view = CASE
  WHEN teen_mode = 1 THEN 'CLEAN'
  ELSE 'ORCHARD'
END;
