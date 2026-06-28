-- Migration 0074: Forensic export columns for completions
--
-- Adds device/location/timing columns queried by the forensic PDF export route.
-- These were applied to local dev in a previous session but never migrated to production.
-- All columns are nullable — existing rows remain NULL until new completions are submitted.

ALTER TABLE completions ADD COLUMN verified_at         INTEGER;
ALTER TABLE completions ADD COLUMN haversine_km        REAL;
ALTER TABLE completions ADD COLUMN network_city        TEXT;
ALTER TABLE completions ADD COLUMN network_ip          TEXT;
ALTER TABLE completions ADD COLUMN device_model        TEXT;
ALTER TABLE completions ADD COLUMN user_agent          TEXT;
ALTER TABLE completions ADD COLUMN device_fingerprint  TEXT;
