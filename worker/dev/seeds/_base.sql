-- worker/dev/seeds/_base.sql
-- Creates the canonical dev test family with a parent, a child, and 10 chores.
-- No completions or ledger entries — call state-*.sql after this to add history.
-- Always run _reset.sql first to avoid duplicate-key errors.

INSERT INTO families (id, name, currency, base_currency, verify_mode, parenting_mode, created_at)
VALUES ('fDEV000000000000000001', 'Dev Test Family', 'GBP', 'GBP', 'standard', 'single',
        strftime('%s', 'now', '-90 days'));

INSERT INTO users (id, family_id, display_name, email, locale, email_verified,
                   earnings_mode, allowance_frequency, allowance_amount, allowance_day,
                   pin_attempt_count, created_at)
VALUES
  ('uDEV_PARENT0000000001', 'fDEV000000000000000001', 'Dev Parent',
   'dev-parent@morechard.dev', 'en', 1, 'HYBRID', 'WEEKLY', 0, 6, 0,
   strftime('%s', 'now', '-90 days')),
  ('uDEV_CHILD00000000001', 'fDEV000000000000000001', 'Alex',
   NULL, 'en', 1, 'CHORES', 'WEEKLY', 0, 6, 0,
   strftime('%s', 'now', '-90 days'));

INSERT INTO family_roles (user_id, family_id, role, granted_at)
VALUES
  ('uDEV_PARENT0000000001', 'fDEV000000000000000001', 'parent', strftime('%s', 'now', '-90 days')),
  ('uDEV_CHILD00000000001', 'fDEV000000000000000001', 'child',  strftime('%s', 'now', '-90 days'));

INSERT INTO user_settings (user_id, avatar_id, theme, locale, updated_at)
VALUES
  ('uDEV_PARENT0000000001', 'bottts:bolt', 'system', 'en', strftime('%s', 'now')),
  ('uDEV_CHILD00000000001', 'bottts:spark', 'system', 'en', strftime('%s', 'now'));

INSERT INTO child_streaks (child_id, current_streak, longest_streak, grace_days_remaining,
                           last_kept_date, last_checked_date, updated_at)
VALUES ('uDEV_CHILD00000000001', 0, 0, 0, NULL, NULL, date('now'));

-- 10 distinct chores (10 different chore_ids = prerequisite for M3 Entrepreneurship)
INSERT INTO chores (id, family_id, assigned_to, created_by, title, reward_amount,
                    currency, frequency, archived, created_at, updated_at)
VALUES
  ('cDEV_BINS000000000001','fDEV000000000000000001','uDEV_CHILD00000000001','uDEV_PARENT0000000001',
   'Take Out the Bins',100,'GBP','weekly',0,strftime('%s','now','-90 days'),strftime('%s','now','-90 days')),
  ('cDEV_ROOM000000000001','fDEV000000000000000001','uDEV_CHILD00000000001','uDEV_PARENT0000000001',
   'Tidy the Room',110,'GBP','weekly',0,strftime('%s','now','-90 days'),strftime('%s','now','-90 days')),
  ('cDEV_WASH000000000001','fDEV000000000000000001','uDEV_CHILD00000000001','uDEV_PARENT0000000001',
   'Hang the Washing',90,'GBP','weekly',0,strftime('%s','now','-90 days'),strftime('%s','now','-90 days')),
  ('cDEV_WALK000000000001','fDEV000000000000000001','uDEV_CHILD00000000001','uDEV_PARENT0000000001',
   'Walk the Dog',200,'GBP','weekly',0,strftime('%s','now','-90 days'),strftime('%s','now','-90 days')),
  ('cDEV_DISH000000000001','fDEV000000000000000001','uDEV_CHILD00000000001','uDEV_PARENT0000000001',
   'Load Dishwasher',75,'GBP','daily',0,strftime('%s','now','-90 days'),strftime('%s','now','-90 days')),
  ('cDEV_VACU000000000001','fDEV000000000000000001','uDEV_CHILD00000000001','uDEV_PARENT0000000001',
   'Vacuum Lounge',150,'GBP','weekly',0,strftime('%s','now','-90 days'),strftime('%s','now','-90 days')),
  ('cDEV_LAWN000000000001','fDEV000000000000000001','uDEV_CHILD00000000001','uDEV_PARENT0000000001',
   'Mow the Lawn',350,'GBP','monthly',0,strftime('%s','now','-90 days'),strftime('%s','now','-90 days')),
  ('cDEV_SHOP000000000001','fDEV000000000000000001','uDEV_CHILD00000000001','uDEV_PARENT0000000001',
   'Help with Shopping',250,'GBP','weekly',0,strftime('%s','now','-90 days'),strftime('%s','now','-90 days')),
  ('cDEV_COOK000000000001','fDEV000000000000000001','uDEV_CHILD00000000001','uDEV_PARENT0000000001',
   'Help Cook Dinner',175,'GBP','weekly',0,strftime('%s','now','-90 days'),strftime('%s','now','-90 days')),
  ('cDEV_WIPE000000000001','fDEV000000000000000001','uDEV_CHILD00000000001','uDEV_PARENT0000000001',
   'Wipe Down Kitchen',125,'GBP','weekly',0,strftime('%s','now','-90 days'),strftime('%s','now','-90 days'));
