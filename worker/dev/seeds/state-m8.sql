-- worker/dev/seeds/state-m8.sql
-- Target: M8 (Banking 101) — current balance >= £30 (3000p) with no payments
-- Strategy: £31.50 of credits, no payment entries
-- After loading: open Learning Lab or call /dev/run-passive to trigger unlock.


INSERT INTO ledger (family_id, child_id, chore_id, entry_type, amount, currency, description,
  verification_status, authorised_by, ip_address, previous_hash, record_hash, created_at, is_seed)
VALUES
  ('fDEV000000000000000001','uDEV_CHILD00000000001',NULL,'credit',700,'GBP','Week 1 earnings','verified_auto','uDEV_PARENT0000000001','127.0.0.1','seed_m8_h0','seed_m8_h1',strftime('%s','now','-28 days'),1),
  ('fDEV000000000000000001','uDEV_CHILD00000000001',NULL,'credit',800,'GBP','Week 2 earnings','verified_auto','uDEV_PARENT0000000001','127.0.0.1','seed_m8_h1','seed_m8_h2',strftime('%s','now','-21 days'),1),
  ('fDEV000000000000000001','uDEV_CHILD00000000001',NULL,'credit',900,'GBP','Week 3 earnings','verified_auto','uDEV_PARENT0000000001','127.0.0.1','seed_m8_h2','seed_m8_h3',strftime('%s','now','-14 days'),1),
  ('fDEV000000000000000001','uDEV_CHILD00000000001',NULL,'credit',750,'GBP','Week 4 earnings','verified_auto','uDEV_PARENT0000000001','127.0.0.1','seed_m8_h3','seed_m8_h4',strftime('%s','now','-7 days'),1);
-- Balance: 700+800+900+750 = 3150p (£31.50) >= 3000p threshold ✓
