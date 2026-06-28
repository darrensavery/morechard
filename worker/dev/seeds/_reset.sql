-- worker/dev/seeds/_reset.sql
-- Wipes ALL data for the dev test family so seeds are idempotent.
-- Run this before any state-*.sql seed.
-- WARNING: dev only — never run against morechard (production DB).

-- Delete in dependency order (children before parents)
DELETE FROM child_nudges        WHERE child_id  = 'uDEV_CHILD00000000001';
DELETE FROM unlocked_modules    WHERE child_id  = 'uDEV_CHILD00000000001';
DELETE FROM child_badges        WHERE child_id  = 'uDEV_CHILD00000000001';
DELETE FROM lesson_completions  WHERE child_id  = 'uDEV_CHILD00000000001';
DELETE FROM child_streaks       WHERE child_id  = 'uDEV_CHILD00000000001';
DELETE FROM jar_config          WHERE child_id  = 'uDEV_CHILD00000000001';
DELETE FROM jar_movements       WHERE child_id  = 'uDEV_CHILD00000000001';
DELETE FROM insight_snapshots   WHERE child_id  = 'uDEV_CHILD00000000001';
DELETE FROM goals               WHERE child_id  = 'uDEV_CHILD00000000001';
DELETE FROM completions         WHERE is_seed = 1 AND child_id = 'uDEV_CHILD00000000001';
DELETE FROM ledger              WHERE is_seed = 1 AND child_id = 'uDEV_CHILD00000000001';
DELETE FROM chores              WHERE family_id = 'fDEV000000000000000001';
DELETE FROM user_settings       WHERE user_id   = 'uDEV_CHILD00000000001';
DELETE FROM user_settings       WHERE user_id   = 'uDEV_PARENT0000000001';
DELETE FROM family_roles        WHERE family_id = 'fDEV000000000000000001';
DELETE FROM users               WHERE family_id = 'fDEV000000000000000001';
DELETE FROM families            WHERE id        = 'fDEV000000000000000001';
