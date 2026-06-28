-- worker/dev/seeds/state-streak-30.sql
-- Target: STREAK_30 milestone (+ BADGE_CONSISTENCY_SAPLING)
-- See state-streak-7.sql notes — use Dev Panel to fire the overlay immediately.


UPDATE child_streaks
SET current_streak       = 30,
    longest_streak       = 30,
    grace_days_remaining = 2,
    last_kept_date       = date('now', '-1 day'),
    last_checked_date    = date('now', '-1 day'),
    updated_at           = date('now')
WHERE child_id = 'uDEV_CHILD00000000001';

INSERT OR IGNORE INTO child_badges (id, child_id, badge_key, earned_at)
VALUES
  ('bdg_dev_cons_seed', 'uDEV_CHILD00000000001', 'CONSISTENCY_SEED',    datetime('now', '-23 days')),
  ('bdg_dev_cons_sap',  'uDEV_CHILD00000000001', 'CONSISTENCY_SAPLING', datetime('now'));
