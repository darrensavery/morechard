-- worker/dev/seeds/state-m16.sql
-- Target: M16 (Insurance & Protection) — balance >= £75 (7500p)
-- Also unlocks M2 and M8 as side effects.
-- After loading: call /dev/run-passive.


INSERT INTO ledger (family_id, child_id, chore_id, entry_type, amount, currency, description,
  verification_status, authorised_by, ip_address, previous_hash, record_hash, created_at, is_seed)
VALUES
  ('fDEV000000000000000001','uDEV_CHILD00000000001',NULL,'credit',2500,'GBP','Month 1','verified_auto','uDEV_PARENT0000000001','127.0.0.1','seed_m16_h0','seed_m16_h1',strftime('%s','now','-56 days'),1),
  ('fDEV000000000000000001','uDEV_CHILD00000000001',NULL,'credit',2500,'GBP','Month 2','verified_auto','uDEV_PARENT0000000001','127.0.0.1','seed_m16_h1','seed_m16_h2',strftime('%s','now','-28 days'),1),
  ('fDEV000000000000000001','uDEV_CHILD00000000001',NULL,'credit',2501,'GBP','Month 3','verified_auto','uDEV_PARENT0000000001','127.0.0.1','seed_m16_h2','seed_m16_h3',strftime('%s','now','-7 days'),1);
-- Balance: 2500+2500+2501 = 7501p (£75.01) >= 7500p threshold ✓
