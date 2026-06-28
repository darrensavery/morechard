-- worker/dev/seeds/state-m2.sql
-- Target: M2 (Taxes & Net Pay) — cumulative credits >= £20 (2000p)
-- Strategy: 10 completions + 2 bonus credits totalling £20.25 (2025p)
-- After loading: call evaluateOnChoreApproval or open Learning Lab to trigger unlock.


INSERT INTO completions (id, family_id, chore_id, child_id, note, status, attempt_count,
  submitted_at, resolved_at, resolved_by, is_seed)
VALUES
  ('cmp_m2_01','fDEV000000000000000001','cDEV_BINS000000000001','uDEV_CHILD00000000001',NULL,'completed',1,strftime('%s','now','-70 days'),strftime('%s','now','-70 days'),'uDEV_PARENT0000000001',1),
  ('cmp_m2_02','fDEV000000000000000001','cDEV_ROOM000000000001','uDEV_CHILD00000000001',NULL,'completed',1,strftime('%s','now','-63 days'),strftime('%s','now','-63 days'),'uDEV_PARENT0000000001',1),
  ('cmp_m2_03','fDEV000000000000000001','cDEV_WASH000000000001','uDEV_CHILD00000000001',NULL,'completed',1,strftime('%s','now','-56 days'),strftime('%s','now','-56 days'),'uDEV_PARENT0000000001',1),
  ('cmp_m2_04','fDEV000000000000000001','cDEV_WALK000000000001','uDEV_CHILD00000000001',NULL,'completed',1,strftime('%s','now','-49 days'),strftime('%s','now','-49 days'),'uDEV_PARENT0000000001',1),
  ('cmp_m2_05','fDEV000000000000000001','cDEV_DISH000000000001','uDEV_CHILD00000000001',NULL,'completed',1,strftime('%s','now','-42 days'),strftime('%s','now','-42 days'),'uDEV_PARENT0000000001',1),
  ('cmp_m2_06','fDEV000000000000000001','cDEV_VACU000000000001','uDEV_CHILD00000000001',NULL,'completed',1,strftime('%s','now','-35 days'),strftime('%s','now','-35 days'),'uDEV_PARENT0000000001',1),
  ('cmp_m2_07','fDEV000000000000000001','cDEV_LAWN000000000001','uDEV_CHILD00000000001',NULL,'completed',1,strftime('%s','now','-28 days'),strftime('%s','now','-28 days'),'uDEV_PARENT0000000001',1),
  ('cmp_m2_08','fDEV000000000000000001','cDEV_SHOP000000000001','uDEV_CHILD00000000001',NULL,'completed',1,strftime('%s','now','-21 days'),strftime('%s','now','-21 days'),'uDEV_PARENT0000000001',1),
  ('cmp_m2_09','fDEV000000000000000001','cDEV_COOK000000000001','uDEV_CHILD00000000001',NULL,'completed',1,strftime('%s','now','-14 days'),strftime('%s','now','-14 days'),'uDEV_PARENT0000000001',1),
  ('cmp_m2_10','fDEV000000000000000001','cDEV_WIPE000000000001','uDEV_CHILD00000000001',NULL,'completed',1,strftime('%s','now','-7 days'),strftime('%s','now','-7 days'),'uDEV_PARENT0000000001',1);

-- 10 chore credits: 100+110+90+200+75+150+350+250+175+125 = 1625p
INSERT INTO ledger (family_id, child_id, chore_id, entry_type, amount, currency, description,
  verification_status, authorised_by, ip_address, previous_hash, record_hash, created_at, is_seed)
VALUES
  ('fDEV000000000000000001','uDEV_CHILD00000000001','cDEV_BINS000000000001','credit',100,'GBP','Take Out the Bins','verified_auto','uDEV_PARENT0000000001','127.0.0.1','seed_m2_hash_0','seed_m2_hash_1',strftime('%s','now','-70 days'),1),
  ('fDEV000000000000000001','uDEV_CHILD00000000001','cDEV_ROOM000000000001','credit',110,'GBP','Tidy the Room','verified_auto','uDEV_PARENT0000000001','127.0.0.1','seed_m2_hash_1','seed_m2_hash_2',strftime('%s','now','-63 days'),1),
  ('fDEV000000000000000001','uDEV_CHILD00000000001','cDEV_WASH000000000001','credit',90,'GBP','Hang the Washing','verified_auto','uDEV_PARENT0000000001','127.0.0.1','seed_m2_hash_2','seed_m2_hash_3',strftime('%s','now','-56 days'),1),
  ('fDEV000000000000000001','uDEV_CHILD00000000001','cDEV_WALK000000000001','credit',200,'GBP','Walk the Dog','verified_auto','uDEV_PARENT0000000001','127.0.0.1','seed_m2_hash_3','seed_m2_hash_4',strftime('%s','now','-49 days'),1),
  ('fDEV000000000000000001','uDEV_CHILD00000000001','cDEV_DISH000000000001','credit',75,'GBP','Load Dishwasher','verified_auto','uDEV_PARENT0000000001','127.0.0.1','seed_m2_hash_4','seed_m2_hash_5',strftime('%s','now','-42 days'),1),
  ('fDEV000000000000000001','uDEV_CHILD00000000001','cDEV_VACU000000000001','credit',150,'GBP','Vacuum Lounge','verified_auto','uDEV_PARENT0000000001','127.0.0.1','seed_m2_hash_5','seed_m2_hash_6',strftime('%s','now','-35 days'),1),
  ('fDEV000000000000000001','uDEV_CHILD00000000001','cDEV_LAWN000000000001','credit',350,'GBP','Mow the Lawn','verified_auto','uDEV_PARENT0000000001','127.0.0.1','seed_m2_hash_6','seed_m2_hash_7',strftime('%s','now','-28 days'),1),
  ('fDEV000000000000000001','uDEV_CHILD00000000001','cDEV_SHOP000000000001','credit',250,'GBP','Help with Shopping','verified_auto','uDEV_PARENT0000000001','127.0.0.1','seed_m2_hash_7','seed_m2_hash_8',strftime('%s','now','-21 days'),1),
  ('fDEV000000000000000001','uDEV_CHILD00000000001','cDEV_COOK000000000001','credit',175,'GBP','Help Cook Dinner','verified_auto','uDEV_PARENT0000000001','127.0.0.1','seed_m2_hash_8','seed_m2_hash_9',strftime('%s','now','-14 days'),1),
  ('fDEV000000000000000001','uDEV_CHILD00000000001','cDEV_WIPE000000000001','credit',125,'GBP','Wipe Down Kitchen','verified_auto','uDEV_PARENT0000000001','127.0.0.1','seed_m2_hash_9','seed_m2_hash_10',strftime('%s','now','-7 days'),1);

-- Running total after above: 1625p — still below £20 threshold.
-- 2 bonus credits to breach 2000p:
INSERT INTO ledger (family_id, child_id, chore_id, entry_type, amount, currency, description,
  verification_status, authorised_by, ip_address, previous_hash, record_hash, created_at, is_seed)
VALUES
  ('fDEV000000000000000001','uDEV_CHILD00000000001',NULL,'credit',200,'GBP','Bonus: extra job','verified_auto','uDEV_PARENT0000000001','127.0.0.1','seed_m2_hash_10','seed_m2_hash_11',strftime('%s','now','-6 days'),1),
  ('fDEV000000000000000001','uDEV_CHILD00000000001',NULL,'credit',200,'GBP','Bonus: extra job','verified_auto','uDEV_PARENT0000000001','127.0.0.1','seed_m2_hash_11','seed_m2_hash_12',strftime('%s','now','-5 days'),1);
-- Running total: 1625 + 200 + 200 = 2025p (£20.25) >= 2000p threshold ✓
