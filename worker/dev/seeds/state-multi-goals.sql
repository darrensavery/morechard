-- worker/dev/seeds/state-multi-goals.sql
-- Target: M15 (Risk & Diversification) — 3+ active goals AND >=1 long-term (deadline > 90 days)
-- Also triggers M17+M20 due to gaming goal being one of the three.

.read dev/seeds/_reset.sql
.read dev/seeds/_base.sql

INSERT INTO goals (id, family_id, child_id, title, target_amount, currency, category,
  deadline, alloc_pct, archived, status, current_saved_pence, created_at, updated_at)
VALUES
  ('gDEV_MULTI_01','fDEV000000000000000001','uDEV_CHILD00000000001',
   'New Trainers', 4999, 'GBP', 'clothing', NULL, 20, 0, 'ACTIVE', 500,
   strftime('%s','now','-14 days'), strftime('%s','now','-14 days')),
  ('gDEV_MULTI_02','fDEV000000000000000001','uDEV_CHILD00000000001',
   'Minecraft DLC', 599, 'GBP', 'gaming', NULL, 20, 0, 'ACTIVE', 100,
   strftime('%s','now','-10 days'), strftime('%s','now','-10 days')),
  ('gDEV_MULTI_03','fDEV000000000000000001','uDEV_CHILD00000000001',
   'Laptop Fund', 49999, 'GBP', 'tech',
   date('now', '+120 days'),
   20, 0, 'ACTIVE', 1000,
   strftime('%s','now','-7 days'), strftime('%s','now','-7 days'));
-- 3 active goals ✓, 1 long-term (deadline 120 days out > 90-day threshold) ✓

INSERT OR IGNORE INTO unlocked_modules (id, child_id, module_slug, unlocked_at)
VALUES
  ('um_dev_m15', 'uDEV_CHILD00000000001', 'M15', strftime('%s','now','-7 days')),
  ('um_dev_m17', 'uDEV_CHILD00000000001', 'M17', strftime('%s','now','-10 days'));
