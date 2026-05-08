-- ── Expand test data: add co-parent Sarah + Henry chore history + more expenses ──

-- 1. Add co-parent Sarah Mitchell to the family
INSERT OR IGNORE INTO users (
  id, family_id, display_name, email, locale,
  email_verified, created_at, earnings_mode, allowance_frequency,
  allowance_amount, allowance_day, pin_attempt_count
) VALUES (
  'uSARAH_MITCHELL_001',
  'fvhwT74Rgms5NZM6ODOC6',
  'Sarah',
  'sarah.mitchell.test@morechard.dev',
  'en',
  1,
  strftime('%s', '2026-04-06 09:00:00'),
  'HYBRID', 'WEEKLY', 0, 6, 0
);

INSERT OR IGNORE INTO family_roles (user_id, family_id, role, parent_role)
VALUES ('uSARAH_MITCHELL_001', 'fvhwT74Rgms5NZM6ODOC6', 'parent', 'partner');

-- 2. Switch family to co-parenting mode
UPDATE families SET parenting_mode = 'co-parenting' WHERE id = 'fvhwT74Rgms5NZM6ODOC6';

-- 3. Chore completions for Henry — April 2026
INSERT INTO completions (family_id, chore_id, child_id, note, status, attempt_count,
  submitted_at, resolved_at, resolved_by, is_seed)
VALUES
  ('fvhwT74Rgms5NZM6ODOC6','LR1xvQsukOnWsBQsDHyAJ','CVQc43P0ivuYK9HRwH0P9',
   'Done before school','completed',1,
   strftime('%s','2026-04-07'),strftime('%s','2026-04-07'),'uOI25P2gaWld0wttYaEIu',1),
  ('fvhwT74Rgms5NZM6ODOC6','UUPxjI8EzGjUNGKVvVGfW','CVQc43P0ivuYK9HRwH0P9',
   'Room looks great!','completed',1,
   strftime('%s','2026-04-09'),strftime('%s','2026-04-09'),'uOI25P2gaWld0wttYaEIu',1),
  ('fvhwT74Rgms5NZM6ODOC6','OvRcQT8hYHjhyyUyqHNHK','CVQc43P0ivuYK9HRwH0P9',
   NULL,'completed',1,
   strftime('%s','2026-04-11'),strftime('%s','2026-04-11'),'uOI25P2gaWld0wttYaEIu',1),
  ('fvhwT74Rgms5NZM6ODOC6','LR1xvQsukOnWsBQsDHyAJ','CVQc43P0ivuYK9HRwH0P9',
   NULL,'completed',1,
   strftime('%s','2026-04-14'),strftime('%s','2026-04-14'),'uOI25P2gaWld0wttYaEIu',1),
  ('fvhwT74Rgms5NZM6ODOC6','QX09UgoiusOGMwBaUSQFp','CVQc43P0ivuYK9HRwH0P9',
   'Took Buddy to the park','completed',1,
   strftime('%s','2026-04-16'),strftime('%s','2026-04-16'),'uOI25P2gaWld0wttYaEIu',1),
  ('fvhwT74Rgms5NZM6ODOC6','LR1xvQsukOnWsBQsDHyAJ','CVQc43P0ivuYK9HRwH0P9',
   NULL,'completed',1,
   strftime('%s','2026-04-21'),strftime('%s','2026-04-21'),'uOI25P2gaWld0wttYaEIu',1),
  ('fvhwT74Rgms5NZM6ODOC6','UUPxjI8EzGjUNGKVvVGfW','CVQc43P0ivuYK9HRwH0P9',
   NULL,'completed',2,
   strftime('%s','2026-04-23'),strftime('%s','2026-04-24'),'uOI25P2gaWld0wttYaEIu',1),
  ('fvhwT74Rgms5NZM6ODOC6','QX09UgoiusOGMwBaUSQFp','CVQc43P0ivuYK9HRwH0P9',
   NULL,'completed',1,
   strftime('%s','2026-04-28'),strftime('%s','2026-04-28'),'uOI25P2gaWld0wttYaEIu',1);

-- Ledger credits — April 2026 chore earnings
INSERT INTO ledger (family_id, child_id, entry_type, amount, currency, description,
  verification_status, authorised_by, verified_at, ip_address, previous_hash, record_hash, created_at, is_seed)
VALUES
  ('fvhwT74Rgms5NZM6ODOC6','CVQc43P0ivuYK9HRwH0P9','credit',100,'GBP',
   'Take Out the Bins','verified_auto','uOI25P2gaWld0wttYaEIu',
   strftime('%s','2026-04-07'),'127.0.0.1','hash_seed_71','hash_seed_72',strftime('%s','2026-04-07'),1),
  ('fvhwT74Rgms5NZM6ODOC6','CVQc43P0ivuYK9HRwH0P9','credit',110,'GBP',
   'Tidy the Room','verified_auto','uOI25P2gaWld0wttYaEIu',
   strftime('%s','2026-04-09'),'127.0.0.1','hash_seed_72','hash_seed_73',strftime('%s','2026-04-09'),1),
  ('fvhwT74Rgms5NZM6ODOC6','CVQc43P0ivuYK9HRwH0P9','credit',90,'GBP',
   'Hang the Washing','verified_auto','uOI25P2gaWld0wttYaEIu',
   strftime('%s','2026-04-11'),'127.0.0.1','hash_seed_73','hash_seed_74',strftime('%s','2026-04-11'),1),
  ('fvhwT74Rgms5NZM6ODOC6','CVQc43P0ivuYK9HRwH0P9','credit',100,'GBP',
   'Take Out the Bins','verified_auto','uOI25P2gaWld0wttYaEIu',
   strftime('%s','2026-04-14'),'127.0.0.1','hash_seed_74','hash_seed_75',strftime('%s','2026-04-14'),1),
  ('fvhwT74Rgms5NZM6ODOC6','CVQc43P0ivuYK9HRwH0P9','credit',200,'GBP',
   'Walk the Dog','verified_auto','uOI25P2gaWld0wttYaEIu',
   strftime('%s','2026-04-16'),'127.0.0.1','hash_seed_75','hash_seed_76',strftime('%s','2026-04-16'),1),
  ('fvhwT74Rgms5NZM6ODOC6','CVQc43P0ivuYK9HRwH0P9','credit',100,'GBP',
   'Take Out the Bins','verified_auto','uOI25P2gaWld0wttYaEIu',
   strftime('%s','2026-04-21'),'127.0.0.1','hash_seed_76','hash_seed_77',strftime('%s','2026-04-21'),1),
  ('fvhwT74Rgms5NZM6ODOC6','CVQc43P0ivuYK9HRwH0P9','credit',110,'GBP',
   'Tidy the Room','verified_auto','uOI25P2gaWld0wttYaEIu',
   strftime('%s','2026-04-24'),'127.0.0.1','hash_seed_77','hash_seed_78',strftime('%s','2026-04-24'),1),
  ('fvhwT74Rgms5NZM6ODOC6','CVQc43P0ivuYK9HRwH0P9','credit',200,'GBP',
   'Walk the Dog','verified_auto','uOI25P2gaWld0wttYaEIu',
   strftime('%s','2026-04-28'),'127.0.0.1','hash_seed_78','hash_seed_79',strftime('%s','2026-04-28'),1);

-- Ledger payments (spending) — April 2026
INSERT INTO ledger (family_id, child_id, entry_type, amount, currency, description,
  verification_status, ip_address, previous_hash, record_hash, created_at, is_seed)
VALUES
  ('fvhwT74Rgms5NZM6ODOC6','CVQc43P0ivuYK9HRwH0P9','payment',350,'GBP',
   'Minecraft skin pack','verified_auto','127.0.0.1','hash_seed_79','hash_seed_80',strftime('%s','2026-04-13'),1),
  ('fvhwT74Rgms5NZM6ODOC6','CVQc43P0ivuYK9HRwH0P9','payment',199,'GBP',
   'Stationery for school','verified_auto','127.0.0.1','hash_seed_80','hash_seed_81',strftime('%s','2026-04-20'),1);

-- Completions — May 2026
INSERT INTO completions (family_id, chore_id, child_id, note, status, attempt_count,
  submitted_at, resolved_at, resolved_by, is_seed)
VALUES
  ('fvhwT74Rgms5NZM6ODOC6','LR1xvQsukOnWsBQsDHyAJ','CVQc43P0ivuYK9HRwH0P9',
   NULL,'completed',1,
   strftime('%s','2026-05-05'),strftime('%s','2026-05-05'),'uOI25P2gaWld0wttYaEIu',1),
  ('fvhwT74Rgms5NZM6ODOC6','QX09UgoiusOGMwBaUSQFp','CVQc43P0ivuYK9HRwH0P9',
   'Both dogs today!','completed',1,
   strftime('%s','2026-05-06'),strftime('%s','2026-05-06'),'uOI25P2gaWld0wttYaEIu',1);

-- Ledger credits — May 2026
INSERT INTO ledger (family_id, child_id, entry_type, amount, currency, description,
  verification_status, authorised_by, verified_at, ip_address, previous_hash, record_hash, created_at, is_seed)
VALUES
  ('fvhwT74Rgms5NZM6ODOC6','CVQc43P0ivuYK9HRwH0P9','credit',100,'GBP',
   'Take Out the Bins','verified_auto','uOI25P2gaWld0wttYaEIu',
   strftime('%s','2026-05-05'),'127.0.0.1','hash_seed_81','hash_seed_82',strftime('%s','2026-05-05'),1),
  ('fvhwT74Rgms5NZM6ODOC6','CVQc43P0ivuYK9HRwH0P9','credit',200,'GBP',
   'Walk the Dog','verified_auto','uOI25P2gaWld0wttYaEIu',
   strftime('%s','2026-05-06'),'127.0.0.1','hash_seed_82','hash_seed_83',strftime('%s','2026-05-06'),1);

-- ── 4. Shared expenses — archive + open, logged by both parents ──

-- April 2026 archive
INSERT INTO shared_expenses (
  family_id, logged_by, authorised_by, description, category,
  total_amount, split_bp, currency, verification_status,
  settlement_period, hash_version, previous_hash, record_hash, ip_address, created_at
) VALUES
  ('fvhwT74Rgms5NZM6ODOC6','uOI25P2gaWld0wttYaEIu','uSARAH_MITCHELL_001',
   'Henry dentist appointment','health',
   8500,5000,'GBP','committed_manual',
   '2026-04',1,'seed_se_01','seed_se_02','127.0.0.1',strftime('%s','2026-04-03')),
  ('fvhwT74Rgms5NZM6ODOC6','uSARAH_MITCHELL_001','uOI25P2gaWld0wttYaEIu',
   'Summer holiday deposit — Center Parcs','travel',
   45000,5000,'GBP','committed_manual',
   '2026-04',1,'seed_se_02','seed_se_03','127.0.0.1',strftime('%s','2026-04-10')),
  ('fvhwT74Rgms5NZM6ODOC6','uOI25P2gaWld0wttYaEIu','uSARAH_MITCHELL_001',
   'School book fair','education',
   1250,5000,'GBP','committed_manual',
   '2026-04',1,'seed_se_03','seed_se_04','127.0.0.1',strftime('%s','2026-04-17'));

-- March 2026 archive
INSERT INTO shared_expenses (
  family_id, logged_by, authorised_by, description, category,
  total_amount, split_bp, currency, verification_status,
  settlement_period, hash_version, previous_hash, record_hash, ip_address, created_at
) VALUES
  ('fvhwT74Rgms5NZM6ODOC6','uSARAH_MITCHELL_001','uOI25P2gaWld0wttYaEIu',
   'Spring term activities — gymnastics','activities',
   9600,5000,'GBP','committed_manual',
   '2026-03',1,'seed_se_04','seed_se_05','127.0.0.1',strftime('%s','2026-03-04')),
  ('fvhwT74Rgms5NZM6ODOC6','uOI25P2gaWld0wttYaEIu','uSARAH_MITCHELL_001',
   'New school bag & PE trainers','clothing',
   5800,5000,'GBP','committed_manual',
   '2026-03',1,'seed_se_05','seed_se_06','127.0.0.1',strftime('%s','2026-03-18')),
  ('fvhwT74Rgms5NZM6ODOC6','uSARAH_MITCHELL_001','uOI25P2gaWld0wttYaEIu',
   'Henry birthday cake & decorations','food',
   3400,5000,'GBP','committed_manual',
   '2026-03',1,'seed_se_06','seed_se_07','127.0.0.1',strftime('%s','2026-03-22'));

-- February 2026 archive
INSERT INTO shared_expenses (
  family_id, logged_by, authorised_by, description, category,
  total_amount, split_bp, currency, verification_status,
  settlement_period, hash_version, previous_hash, record_hash, ip_address, created_at
) VALUES
  ('fvhwT74Rgms5NZM6ODOC6','uSARAH_MITCHELL_001','uOI25P2gaWld0wttYaEIu',
   'Half-term cinema & bowling','activities',
   4200,5000,'GBP','committed_manual',
   '2026-02',1,'seed_se_07','seed_se_08','127.0.0.1',strftime('%s','2026-02-17')),
  ('fvhwT74Rgms5NZM6ODOC6','uOI25P2gaWld0wttYaEIu','uSARAH_MITCHELL_001',
   'Prescription antibiotic x1','health',
   925,5000,'GBP','committed_manual',
   '2026-02',1,'seed_se_08','seed_se_09','127.0.0.1',strftime('%s','2026-02-24'));

-- Open May 2026 — pending approval by Darren (Sarah logged)
INSERT INTO shared_expenses (
  family_id, logged_by, description, category,
  total_amount, split_bp, currency, verification_status,
  settlement_period, hash_version, previous_hash, record_hash, ip_address, created_at
) VALUES
  ('fvhwT74Rgms5NZM6ODOC6','uSARAH_MITCHELL_001',
   'After-school coding club — Summer term','activities',
   14400,5000,'GBP','pending',
   NULL,1,'seed_se_09','seed_se_10','127.0.0.1',strftime('%s','2026-05-07')),
  ('fvhwT74Rgms5NZM6ODOC6','uSARAH_MITCHELL_001',
   'Henry new football boots','clothing',
   5999,5000,'GBP','pending',
   NULL,1,'seed_se_10','seed_se_11','127.0.0.1',strftime('%s','2026-05-08'));
