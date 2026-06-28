-- worker/dev/seeds/state-gaming-goals.sql
-- Target: M17 (Digital Currency — 1st gaming goal) AND M20 (Gambling & Loot Boxes — 2nd gaming goal)
-- Strategy: insert 2 active goals with category='gaming'. The trigger fires when
-- evaluateOnGoalCreate is called; since seeds bypass that call, we insert the
-- unlocked_modules rows directly here.


INSERT INTO goals (id, family_id, child_id, title, target_amount, currency, category,
  deadline, alloc_pct, archived, status, current_saved_pence, created_at, updated_at)
VALUES
  ('gDEV_GAME_001','fDEV000000000000000001','uDEV_CHILD00000000001',
   'Minecraft DLC Pack', 599, 'GBP', 'gaming', NULL, 20, 0, 'ACTIVE', 120,
   strftime('%s','now','-21 days'), strftime('%s','now','-21 days')),
  ('gDEV_GAME_002','fDEV000000000000000001','uDEV_CHILD00000000001',
   'Roblox Robux', 799, 'GBP', 'gaming', NULL, 20, 0, 'ACTIVE', 200,
   strftime('%s','now','-10 days'), strftime('%s','now','-10 days'));

-- Pre-unlock both modules (the triggers won't re-fire via evaluateOnGoalCreate because
-- goals were inserted directly; inserting the unlock rows ourselves is correct here)
INSERT OR IGNORE INTO unlocked_modules (id, child_id, module_slug, unlocked_at)
VALUES
  ('um_dev_m17', 'uDEV_CHILD00000000001', 'M17', strftime('%s','now','-21 days')),
  ('um_dev_m20', 'uDEV_CHILD00000000001', 'M20', strftime('%s','now','-10 days'));
