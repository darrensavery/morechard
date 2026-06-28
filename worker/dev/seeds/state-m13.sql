-- worker/dev/seeds/state-m13.sql
-- Target: M13 (Stocks & Shares) — cumulative credits >= £100 (10000p)
-- Also unlocks M2 (£20) and M8 (£30 balance) as side effects.
-- After loading: call evaluateOnChoreApproval or open Learning Lab.


INSERT INTO ledger (family_id, child_id, chore_id, entry_type, amount, currency, description,
  verification_status, authorised_by, ip_address, previous_hash, record_hash, created_at, is_seed)
VALUES
  ('fDEV000000000000000001','uDEV_CHILD00000000001',NULL,'credit',2500,'GBP','Month 1 earnings','verified_auto','uDEV_PARENT0000000001','127.0.0.1','seed_m13_h0','seed_m13_h1',strftime('%s','now','-84 days'),1),
  ('fDEV000000000000000001','uDEV_CHILD00000000001',NULL,'credit',2500,'GBP','Month 2 earnings','verified_auto','uDEV_PARENT0000000001','127.0.0.1','seed_m13_h1','seed_m13_h2',strftime('%s','now','-56 days'),1),
  ('fDEV000000000000000001','uDEV_CHILD00000000001',NULL,'credit',2500,'GBP','Month 3 earnings','verified_auto','uDEV_PARENT0000000001','127.0.0.1','seed_m13_h2','seed_m13_h3',strftime('%s','now','-28 days'),1),
  ('fDEV000000000000000001','uDEV_CHILD00000000001',NULL,'credit',2501,'GBP','Month 4 earnings','verified_auto','uDEV_PARENT0000000001','127.0.0.1','seed_m13_h3','seed_m13_h4',strftime('%s','now','-7 days'),1);
-- Total: 2500+2500+2500+2501 = 10001p (£100.01) >= 10000p threshold ✓
