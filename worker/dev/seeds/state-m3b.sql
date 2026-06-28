-- worker/dev/seeds/state-m3b.sql
-- Target: M3b (The Gig Trap — Income Volatility) — weekly earnings stddev/avg > 40% over 4 weeks.
-- Strategy: wildly uneven weeks: 100p / 4000p / 50p / 3500p
-- Weekly totals (pence): 100, 4000, 50, 3500 → avg=1912.5, stddev≈1876, CV≈98% >> 40% ✓
-- The query groups by strftime('%Y-%W') so entries must span 4 distinct calendar weeks.
-- After loading: call evaluateOnChoreApproval.

.read dev/seeds/_reset.sql
.read dev/seeds/_base.sql

-- Week 1: low earnings (£1.00 = 100p) — 25 days ago
INSERT INTO ledger (family_id, child_id, chore_id, entry_type, amount, currency, description,
  verification_status, authorised_by, ip_address, previous_hash, record_hash, created_at, is_seed)
VALUES
  ('fDEV000000000000000001','uDEV_CHILD00000000001',NULL,'credit',100,'GBP','Slow week 1','verified_auto','uDEV_PARENT0000000001','127.0.0.1','seed_m3b_h0','seed_m3b_h1',strftime('%s','now','-25 days'),1);

-- Week 2: high earnings (£40.00 = 4000p) — 18 days ago
INSERT INTO ledger (family_id, child_id, chore_id, entry_type, amount, currency, description,
  verification_status, authorised_by, ip_address, previous_hash, record_hash, created_at, is_seed)
VALUES
  ('fDEV000000000000000001','uDEV_CHILD00000000001',NULL,'credit',4000,'GBP','Big week 2','verified_auto','uDEV_PARENT0000000001','127.0.0.1','seed_m3b_h1','seed_m3b_h2',strftime('%s','now','-18 days'),1);

-- Week 3: low again (£0.50 = 50p) — 11 days ago
INSERT INTO ledger (family_id, child_id, chore_id, entry_type, amount, currency, description,
  verification_status, authorised_by, ip_address, previous_hash, record_hash, created_at, is_seed)
VALUES
  ('fDEV000000000000000001','uDEV_CHILD00000000001',NULL,'credit',50,'GBP','Slow week 3','verified_auto','uDEV_PARENT0000000001','127.0.0.1','seed_m3b_h2','seed_m3b_h3',strftime('%s','now','-11 days'),1);

-- Week 4: high again (£35.00 = 3500p) — 4 days ago
INSERT INTO ledger (family_id, child_id, chore_id, entry_type, amount, currency, description,
  verification_status, authorised_by, ip_address, previous_hash, record_hash, created_at, is_seed)
VALUES
  ('fDEV000000000000000001','uDEV_CHILD00000000001',NULL,'credit',3500,'GBP','Big week 4','verified_auto','uDEV_PARENT0000000001','127.0.0.1','seed_m3b_h3','seed_m3b_h4',strftime('%s','now','-4 days'),1);
-- Weekly totals: 100, 4000, 50, 3500
-- avg=1912.5, stddev≈1876, CV≈98% >> 40% threshold ✓
