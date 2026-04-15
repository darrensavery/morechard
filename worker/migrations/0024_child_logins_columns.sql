-- Migration 0024: Add user_agent and session_jti to child_logins
--
-- user_agent   — raw UA string captured at child login time
-- session_jti  — FK to sessions.jti; used to determine is_current (active session check)

ALTER TABLE child_logins ADD COLUMN user_agent  TEXT;
ALTER TABLE child_logins ADD COLUMN session_jti TEXT REFERENCES sessions(jti);
