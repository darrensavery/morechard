-- 0051_demo_expenses.sql
-- Fixes and expands the Thomson demo shared expenses.
-- The 0050 migration used 'approved' which failed the CHECK constraint,
-- leaving only the pending/Q2 row. This migration deletes that row and
-- inserts a rich set of expenses with correct statuses.
--
-- verification_status valid values: committed_auto, pending, committed_manual,
--   rejected, voided, reversed
-- category valid values: education, health, clothing, travel, activities, other
--
-- Open (no settlement_period):   committed_manual or pending → shows in Open/Pending sections
-- History (settlement_period set): any committed status → shows in History section

-- Soft-delete the stale row from 0050 (wrong status + wrong settlement_period/pending combo)
UPDATE shared_expenses SET deleted_at = unixepoch() WHERE family_id = 'demo-family-thomson';

-- ── Settled history — Q4 2025 ────────────────────────────────────────────────
INSERT INTO shared_expenses (
  family_id, logged_by, authorised_by, description, category,
  total_amount, currency, split_bp, verification_status,
  settlement_period, previous_hash, record_hash, ip_address, expense_date, is_seed
) VALUES
('demo-family-thomson','demo-user-sarah','demo-user-mark',
 'Ellie school uniform & PE kit','clothing',
 13500,'GBP',5000,'committed_manual',
 '2025-Q4',
 'aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899',
 '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff',
 '127.0.0.1','2025-10-03',1),

('demo-family-thomson','demo-user-mark','demo-user-sarah',
 'Jake new school shoes','clothing',
 6500,'GBP',5000,'committed_manual',
 '2025-Q4',
 '11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff',
 'aa00bb11cc22dd33ee44ff55aa00bb11cc22dd33ee44ff55aa00bb11cc22dd33',
 '127.0.0.1','2025-10-17',1),

('demo-family-thomson','demo-user-sarah','demo-user-mark',
 'After-school football club (Jake, Autumn term)','activities',
 12000,'GBP',5000,'committed_manual',
 '2025-Q4',
 'bb11cc22dd33ee44ff55aa00bb11cc22dd33ee44ff55aa00bb11cc22dd33ee44',
 'cc22dd33ee44ff55aa00bb11cc22dd33ee44ff55aa00bb11cc22dd33ee44ff55',
 '127.0.0.1','2025-09-05',1),

('demo-family-thomson','demo-user-mark','demo-user-sarah',
 'Ellie GP visit + blood test referral','health',
 3500,'GBP',5000,'committed_manual',
 '2025-Q4',
 'dd33ee44ff55aa00bb11cc22dd33ee44ff55aa00bb11cc22dd33ee44ff55aa00',
 'ee44ff55aa00bb11cc22dd33ee44ff55aa00bb11cc22dd33ee44ff55aa00bb11',
 '127.0.0.1','2025-11-12',1);

-- ── Settled history — Q1 2026 ────────────────────────────────────────────────
INSERT INTO shared_expenses (
  family_id, logged_by, authorised_by, description, category,
  total_amount, currency, split_bp, verification_status,
  settlement_period, previous_hash, record_hash, ip_address, expense_date, is_seed
) VALUES
('demo-family-thomson','demo-user-sarah','demo-user-mark',
 'Year 9 school trip to Paris (Ellie)','education',
 89500,'GBP',5000,'committed_manual',
 '2026-Q1',
 'ff55aa00bb11cc22dd33ee44ff55aa00bb11cc22dd33ee44ff55aa00bb11cc22',
 '0011223344556677889900112233445566778899001122334455667788990011',
 '127.0.0.1','2026-01-15',1),

('demo-family-thomson','demo-user-mark','demo-user-sarah',
 'Jake dental check-up + filling','health',
 8500,'GBP',5000,'committed_manual',
 '2026-Q1',
 '1122334455667788990011223344556677889900112233445566778899001122',
 '2233445566778899001122334455667788990011223344556677889900112233',
 '127.0.0.1','2026-01-28',1),

('demo-family-thomson','demo-user-sarah','demo-user-mark',
 'Ellie art supplies (school project)','education',
 4200,'GBP',5000,'committed_manual',
 '2026-Q1',
 '3344556677889900112233445566778899001122334455667788990011223344',
 '4455667788990011223344556677889900112233445566778899001122334455',
 '127.0.0.1','2026-02-10',1),

('demo-family-thomson','demo-user-mark','demo-user-sarah',
 'Jake GP appointment + prescription','health',
 2500,'GBP',5000,'committed_manual',
 '2026-Q1',
 '5566778899001122334455667788990011223344556677889900112233445566',
 '6677889900112233445566778899001122334455667788990011223344556677',
 '127.0.0.1','2026-02-18',1),

('demo-family-thomson','demo-user-sarah','demo-user-mark',
 'Swimming lessons (Jake, Spring block)','activities',
 9000,'GBP',5000,'committed_manual',
 '2026-Q1',
 '7788990011223344556677889900112233445566778899001122334455667788',
 '8899001122334455667788990011223344556677889900112233445566778899',
 '127.0.0.1','2026-03-01',1);

-- ── Open (Q2 2026, not yet settled) ──────────────────────────────────────────
INSERT INTO shared_expenses (
  family_id, logged_by, authorised_by, description, category,
  total_amount, currency, split_bp, verification_status,
  previous_hash, record_hash, ip_address, expense_date, is_seed
) VALUES
('demo-family-thomson','demo-user-sarah','demo-user-mark',
 'After-school drama club (Ellie, Summer term)','activities',
 18000,'GBP',5000,'committed_manual',
 '9900112233445566778899001122334455667788990011223344556677889900',
 'aa11bb22cc33dd44ee55ff66aa11bb22cc33dd44ee55ff66aa11bb22cc33dd44',
 '127.0.0.1','2026-04-07',1),

('demo-family-thomson','demo-user-mark','demo-user-sarah',
 'Jake school trip (local farm visit)','education',
 3500,'GBP',5000,'committed_manual',
 'bb22cc33dd44ee55ff66aa11bb22cc33dd44ee55ff66aa11bb22cc33dd44ee55',
 'cc33dd44ee55ff66aa11bb22cc33dd44ee55ff66aa11bb22cc33dd44ee55ff66',
 '127.0.0.1','2026-04-22',1);

-- ── Pending (awaiting Mark's authorisation) ───────────────────────────────────
INSERT INTO shared_expenses (
  family_id, logged_by, description, category,
  total_amount, currency, split_bp, verification_status,
  previous_hash, record_hash, ip_address, expense_date, is_seed
) VALUES
('demo-family-thomson','demo-user-sarah',
 'Ellie new trainers (for PE — both parents agreed)','clothing',
 7500,'GBP',5000,'pending',
 'dd44ee55ff66aa11bb22cc33dd44ee55ff66aa11bb22cc33dd44ee55ff66aa11',
 'ee55ff66aa11bb22cc33dd44ee55ff66aa11bb22cc33dd44ee55ff66aa11bb22',
 '127.0.0.1','2026-05-01',1);
