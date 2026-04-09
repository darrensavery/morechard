-- Migration: 0018_invite_child_id.sql
-- Adds child_id to invite_codes so that when a parent pre-creates a child
-- via /auth/child/add, the pre-created user_id is stored on the invite.
-- When the child redeems the invite, the existing user record is updated
-- rather than a duplicate being created.

ALTER TABLE invite_codes ADD COLUMN child_id TEXT DEFAULT NULL
  REFERENCES users(id);
