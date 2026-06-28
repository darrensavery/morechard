-- worker/dev/seeds/state-m11.sql
-- Target: M11 (Credit Scores & Reliability) — >=90% pass rate over last 8 weeks,
-- minimum 10 completions total.
-- Strategy: 13 completed + 1 rejected = 92.9% rate, 14 total completions.
-- After loading: call /dev/run-passive to trigger passive evaluation.

.read dev/seeds/_reset.sql
.read dev/seeds/_base.sql

INSERT INTO completions (id, family_id, chore_id, child_id, status, attempt_count,
  submitted_at, resolved_at, resolved_by, is_seed)
VALUES
  ('cmp_m11_01','fDEV000000000000000001','cDEV_BINS000000000001','uDEV_CHILD00000000001','completed',1,strftime('%s','now','-55 days'),strftime('%s','now','-55 days'),'uDEV_PARENT0000000001',1),
  ('cmp_m11_02','fDEV000000000000000001','cDEV_ROOM000000000001','uDEV_CHILD00000000001','completed',1,strftime('%s','now','-50 days'),strftime('%s','now','-50 days'),'uDEV_PARENT0000000001',1),
  ('cmp_m11_03','fDEV000000000000000001','cDEV_WASH000000000001','uDEV_CHILD00000000001','rejected', 2,strftime('%s','now','-48 days'),strftime('%s','now','-47 days'),'uDEV_PARENT0000000001',1),
  ('cmp_m11_04','fDEV000000000000000001','cDEV_WALK000000000001','uDEV_CHILD00000000001','completed',1,strftime('%s','now','-45 days'),strftime('%s','now','-45 days'),'uDEV_PARENT0000000001',1),
  ('cmp_m11_05','fDEV000000000000000001','cDEV_DISH000000000001','uDEV_CHILD00000000001','completed',1,strftime('%s','now','-42 days'),strftime('%s','now','-42 days'),'uDEV_PARENT0000000001',1),
  ('cmp_m11_06','fDEV000000000000000001','cDEV_VACU000000000001','uDEV_CHILD00000000001','completed',1,strftime('%s','now','-36 days'),strftime('%s','now','-36 days'),'uDEV_PARENT0000000001',1),
  ('cmp_m11_07','fDEV000000000000000001','cDEV_LAWN000000000001','uDEV_CHILD00000000001','completed',1,strftime('%s','now','-30 days'),strftime('%s','now','-30 days'),'uDEV_PARENT0000000001',1),
  ('cmp_m11_08','fDEV000000000000000001','cDEV_SHOP000000000001','uDEV_CHILD00000000001','completed',1,strftime('%s','now','-24 days'),strftime('%s','now','-24 days'),'uDEV_PARENT0000000001',1),
  ('cmp_m11_09','fDEV000000000000000001','cDEV_COOK000000000001','uDEV_CHILD00000000001','completed',1,strftime('%s','now','-18 days'),strftime('%s','now','-18 days'),'uDEV_PARENT0000000001',1),
  ('cmp_m11_10','fDEV000000000000000001','cDEV_WIPE000000000001','uDEV_CHILD00000000001','completed',1,strftime('%s','now','-12 days'),strftime('%s','now','-12 days'),'uDEV_PARENT0000000001',1),
  ('cmp_m11_11','fDEV000000000000000001','cDEV_BINS000000000001','uDEV_CHILD00000000001','completed',1,strftime('%s','now','-9 days'),strftime('%s','now','-9 days'),'uDEV_PARENT0000000001',1),
  ('cmp_m11_12','fDEV000000000000000001','cDEV_ROOM000000000001','uDEV_CHILD00000000001','completed',1,strftime('%s','now','-6 days'),strftime('%s','now','-6 days'),'uDEV_PARENT0000000001',1),
  ('cmp_m11_13','fDEV000000000000000001','cDEV_WALK000000000001','uDEV_CHILD00000000001','completed',1,strftime('%s','now','-3 days'),strftime('%s','now','-3 days'),'uDEV_PARENT0000000001',1),
  ('cmp_m11_14','fDEV000000000000000001','cDEV_DISH000000000001','uDEV_CHILD00000000001','completed',1,strftime('%s','now','-1 days'),strftime('%s','now','-1 days'),'uDEV_PARENT0000000001',1);
-- 13 completed / 14 total = 92.9% >= 90%, total >= 10 ✓
-- Note: completions query checks within 8 weeks — all entries above are within 56 days ✓

-- Ledger credits for each completed chore (trigger queries SUM of credits)
INSERT INTO ledger (family_id, child_id, chore_id, entry_type, amount, currency, description,
  verification_status, authorised_by, ip_address, previous_hash, record_hash, created_at, is_seed)
VALUES
  ('fDEV000000000000000001','uDEV_CHILD00000000001',NULL,'credit',100,'GBP','Take Out the Bins','verified_auto','uDEV_PARENT0000000001','127.0.0.1','seed_m11_h0','seed_m11_h1',strftime('%s','now','-55 days'),1),
  ('fDEV000000000000000001','uDEV_CHILD00000000001',NULL,'credit',110,'GBP','Tidy the Room','verified_auto','uDEV_PARENT0000000001','127.0.0.1','seed_m11_h1','seed_m11_h2',strftime('%s','now','-50 days'),1),
  ('fDEV000000000000000001','uDEV_CHILD00000000001',NULL,'credit',200,'GBP','Walk the Dog','verified_auto','uDEV_PARENT0000000001','127.0.0.1','seed_m11_h2','seed_m11_h3',strftime('%s','now','-45 days'),1),
  ('fDEV000000000000000001','uDEV_CHILD00000000001',NULL,'credit',75,'GBP','Load Dishwasher','verified_auto','uDEV_PARENT0000000001','127.0.0.1','seed_m11_h3','seed_m11_h4',strftime('%s','now','-42 days'),1),
  ('fDEV000000000000000001','uDEV_CHILD00000000001',NULL,'credit',150,'GBP','Vacuum Lounge','verified_auto','uDEV_PARENT0000000001','127.0.0.1','seed_m11_h4','seed_m11_h5',strftime('%s','now','-36 days'),1),
  ('fDEV000000000000000001','uDEV_CHILD00000000001',NULL,'credit',350,'GBP','Mow the Lawn','verified_auto','uDEV_PARENT0000000001','127.0.0.1','seed_m11_h5','seed_m11_h6',strftime('%s','now','-30 days'),1),
  ('fDEV000000000000000001','uDEV_CHILD00000000001',NULL,'credit',250,'GBP','Help with Shopping','verified_auto','uDEV_PARENT0000000001','127.0.0.1','seed_m11_h6','seed_m11_h7',strftime('%s','now','-24 days'),1),
  ('fDEV000000000000000001','uDEV_CHILD00000000001',NULL,'credit',175,'GBP','Help Cook Dinner','verified_auto','uDEV_PARENT0000000001','127.0.0.1','seed_m11_h7','seed_m11_h8',strftime('%s','now','-18 days'),1),
  ('fDEV000000000000000001','uDEV_CHILD00000000001',NULL,'credit',125,'GBP','Wipe Down Kitchen','verified_auto','uDEV_PARENT0000000001','127.0.0.1','seed_m11_h8','seed_m11_h9',strftime('%s','now','-12 days'),1),
  ('fDEV000000000000000001','uDEV_CHILD00000000001',NULL,'credit',100,'GBP','Take Out the Bins','verified_auto','uDEV_PARENT0000000001','127.0.0.1','seed_m11_h9','seed_m11_h10',strftime('%s','now','-9 days'),1),
  ('fDEV000000000000000001','uDEV_CHILD00000000001',NULL,'credit',110,'GBP','Tidy the Room','verified_auto','uDEV_PARENT0000000001','127.0.0.1','seed_m11_h10','seed_m11_h11',strftime('%s','now','-6 days'),1),
  ('fDEV000000000000000001','uDEV_CHILD00000000001',NULL,'credit',200,'GBP','Walk the Dog','verified_auto','uDEV_PARENT0000000001','127.0.0.1','seed_m11_h11','seed_m11_h12',strftime('%s','now','-3 days'),1),
  ('fDEV000000000000000001','uDEV_CHILD00000000001',NULL,'credit',75,'GBP','Load Dishwasher','verified_auto','uDEV_PARENT0000000001','127.0.0.1','seed_m11_h12','seed_m11_h13',strftime('%s','now','-1 days'),1);
-- 13 ledger credits (one per completed chore, rejected row has no credit) ✓
