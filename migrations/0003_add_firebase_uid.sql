-- Migration: 0003_add_firebase_uid.sql
-- Adds firebase_uid to users table for Firebase→Worker JWT exchange.
-- Nullable: existing email/password users have no Firebase UID.
-- Unique: one Firebase identity maps to exactly one D1 user row (no double-identity).

ALTER TABLE users ADD COLUMN firebase_uid TEXT DEFAULT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid) WHERE firebase_uid IS NOT NULL;