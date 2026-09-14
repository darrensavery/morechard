-- 0097_apple_oauth.sql
-- Apple identity column on users. No profile picture — Apple doesn't provide one.
-- Note: SQLite does not support ADD COLUMN ... UNIQUE; uniqueness is enforced via a partial index.
ALTER TABLE users ADD COLUMN apple_sub TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_apple_sub ON users (apple_sub) WHERE apple_sub IS NOT NULL;
