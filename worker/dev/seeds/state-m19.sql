-- worker/dev/seeds/state-m19.sql
-- Target: M19 (Pensions & The Long Game) — cumulative credits >= £150 (15000p)
-- Also unlocks M2, M13 as side effects.
-- After loading: call evaluateOnChoreApproval.


INSERT INTO ledger (family_id, child_id, chore_id, entry_type, amount, currency, description,
  verification_status, authorised_by, ip_address, previous_hash, record_hash, created_at, is_seed)
VALUES
  ('fDEV000000000000000001','uDEV_CHILD00000000001',NULL,'credit',3800,'GBP','Month 1','verified_auto','uDEV_PARENT0000000001','127.0.0.1','seed_m19_h0','seed_m19_h1',strftime('%s','now','-112 days'),1),
  ('fDEV000000000000000001','uDEV_CHILD00000000001',NULL,'credit',3800,'GBP','Month 2','verified_auto','uDEV_PARENT0000000001','127.0.0.1','seed_m19_h1','seed_m19_h2',strftime('%s','now','-84 days'),1),
  ('fDEV000000000000000001','uDEV_CHILD00000000001',NULL,'credit',3800,'GBP','Month 3','verified_auto','uDEV_PARENT0000000001','127.0.0.1','seed_m19_h2','seed_m19_h3',strftime('%s','now','-56 days'),1),
  ('fDEV000000000000000001','uDEV_CHILD00000000001',NULL,'credit',3601,'GBP','Month 4','verified_auto','uDEV_PARENT0000000001','127.0.0.1','seed_m19_h3','seed_m19_h4',strftime('%s','now','-28 days'),1);
-- Total: 3800*3 + 3601 = 11400 + 3601 = 15001p (£150.01) >= 15000p threshold ✓
