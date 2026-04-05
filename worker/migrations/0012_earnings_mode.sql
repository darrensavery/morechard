-- Migration 0012: Earnings mode + allowance frequency
--
-- earnings_mode controls how a child earns money:
--   ALLOWANCE  — fixed recurring deposit only (cron pays, chores not rewarded)
--   CHORES     — task-based only (cron skips this child)
--   HYBRID     — base allowance + chore rewards (default for new families)
--
-- allowance_frequency controls the payday cadence:
--   WEEKLY     — every Saturday (default, matches existing cron)
--   BI_WEEKLY  — every other Saturday
--   MONTHLY    — first Saturday of the month

ALTER TABLE users ADD COLUMN earnings_mode TEXT NOT NULL DEFAULT 'HYBRID'
  CHECK (earnings_mode IN ('ALLOWANCE', 'CHORES', 'HYBRID'));

ALTER TABLE users ADD COLUMN allowance_frequency TEXT NOT NULL DEFAULT 'WEEKLY'
  CHECK (allowance_frequency IN ('WEEKLY', 'BI_WEEKLY', 'MONTHLY'));
