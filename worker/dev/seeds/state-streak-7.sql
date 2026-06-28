-- worker/dev/seeds/state-streak-7.sql
-- Target: STREAK_7 milestone (+ BADGE_CONSISTENCY_SEED award)
-- Strategy: set child_streaks row directly to current_streak=7, longest_streak=7.
-- The celebration event is queued by the server on approval; to see the overlay
-- use the Dev Panel "Fire STREAK_7" button directly in the browser.

.read dev/seeds/_reset.sql
.read dev/seeds/_base.sql

-- Set streak counters directly (these are summary rows, not ledger entries)
UPDATE child_streaks
SET current_streak       = 7,
    longest_streak       = 7,
    grace_days_remaining = 0,
    last_kept_date       = date('now', '-1 day'),
    last_checked_date    = date('now', '-1 day'),
    updated_at           = date('now')
WHERE child_id = 'uDEV_CHILD00000000001';

-- Award the badge that the trigger would have written
INSERT OR IGNORE INTO child_badges (id, child_id, badge_key, earned_at)
VALUES ('bdg_dev_consistency_seed', 'uDEV_CHILD00000000001', 'CONSISTENCY_SEED', datetime('now'));
