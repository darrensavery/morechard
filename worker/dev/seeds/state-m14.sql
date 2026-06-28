-- worker/dev/seeds/state-m14.sql
-- Target: M14 (Inflation & Purchasing Power) — no ledger entry for 21+ days.
-- Strategy: a few credits 30+ days ago, nothing recent.
-- After loading: call /dev/run-passive — the nightly CRON condition fires.

.read dev/seeds/_reset.sql
.read dev/seeds/_base.sql

INSERT INTO ledger (family_id, child_id, chore_id, entry_type, amount, currency, description,
  verification_status, authorised_by, ip_address, previous_hash, record_hash, created_at, is_seed)
VALUES
  ('fDEV000000000000000001','uDEV_CHILD00000000001',NULL,'credit',500,'GBP','Old earnings w1','verified_auto','uDEV_PARENT0000000001','127.0.0.1','seed_m14_h0','seed_m14_h1',strftime('%s','now','-45 days'),1),
  ('fDEV000000000000000001','uDEV_CHILD00000000001',NULL,'credit',500,'GBP','Old earnings w2','verified_auto','uDEV_PARENT0000000001','127.0.0.1','seed_m14_h1','seed_m14_h2',strftime('%s','now','-38 days'),1),
  ('fDEV000000000000000001','uDEV_CHILD00000000001',NULL,'credit',300,'GBP','Old earnings w3','verified_auto','uDEV_PARENT0000000001','127.0.0.1','seed_m14_h2','seed_m14_h3',strftime('%s','now','-22 days'),1);
-- Last entry: 22 days ago -> > 21 day threshold ✓
-- Balance: 1300p (£13.00) — child has some balance, scenario = "money sitting idle"
