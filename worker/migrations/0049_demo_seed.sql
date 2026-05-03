-- 0049_demo_seed.sql
-- Thomson family demo seed data
--
-- Fixed IDs:
--   family:  'demo-family-thomson'
--   sarah:   'demo-user-sarah'   (lead parent)
--   mark:    'demo-user-mark'    (co-parent)
--   ellie:   'demo-child-ellie'  (age 13, Oak / level 3)
--   jake:    'demo-child-jake'   (age 10, Sapling / level 2)
--
-- Column names verified against PRAGMA table_info for each table.

-- ── Family ────────────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO families (
  id, name, currency, verify_mode, parenting_mode,
  has_ai_mentor, has_shield, is_demo, created_at
) VALUES (
  'demo-family-thomson', 'Thomson', 'GBP', 'amicable', 'co-parenting',
  1, 1, 1, strftime('%s', '2025-11-01')
);

-- ── Parent users ──────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO users (id, family_id, display_name, email, locale, created_at)
VALUES ('demo-user-sarah', 'demo-family-thomson', 'Sarah Thomson', 'sarah.thomson@demo.morechard.com', 'en', strftime('%s', '2025-11-01'));

INSERT OR IGNORE INTO users (id, family_id, display_name, email, locale, created_at)
VALUES ('demo-user-mark', 'demo-family-thomson', 'Mark Thomson', 'mark.thomson@demo.morechard.com', 'en', strftime('%s', '2025-11-01'));

-- ── Family roles ──────────────────────────────────────────────────────────────
-- family_roles columns: user_id, family_id, role, granted_at, granted_by, parent_role
INSERT OR IGNORE INTO family_roles (user_id, family_id, role, parent_role, granted_at, granted_by)
VALUES ('demo-user-sarah', 'demo-family-thomson', 'parent', 'lead',   strftime('%s', '2025-11-01'), 'demo-user-sarah');

INSERT OR IGNORE INTO family_roles (user_id, family_id, role, parent_role, granted_at, granted_by)
VALUES ('demo-user-mark',  'demo-family-thomson', 'parent', 'second', strftime('%s', '2025-11-03'), 'demo-user-sarah');

-- ── Child users ───────────────────────────────────────────────────────────────
-- Children are users with role='child' in family_roles.
INSERT OR IGNORE INTO users (id, family_id, display_name, locale, earnings_mode, created_at)
VALUES ('demo-child-ellie', 'demo-family-thomson', 'Ellie', 'en', 'HYBRID', strftime('%s', '2025-11-01'));

INSERT OR IGNORE INTO users (id, family_id, display_name, locale, earnings_mode, created_at)
VALUES ('demo-child-jake', 'demo-family-thomson', 'Jake', 'en', 'HYBRID', strftime('%s', '2025-11-01'));

INSERT OR IGNORE INTO family_roles (user_id, family_id, role, granted_at, granted_by)
VALUES ('demo-child-ellie', 'demo-family-thomson', 'child', strftime('%s', '2025-11-01'), 'demo-user-sarah');

INSERT OR IGNORE INTO family_roles (user_id, family_id, role, granted_at, granted_by)
VALUES ('demo-child-jake', 'demo-family-thomson', 'child', strftime('%s', '2025-11-01'), 'demo-user-sarah');

-- ── Chores ────────────────────────────────────────────────────────────────────
-- NOT NULL cols: family_id, assigned_to, created_by, title, reward_amount,
--   currency, frequency, is_priority, is_flash, archived, created_at, updated_at, is_seed

INSERT OR IGNORE INTO chores (id, family_id, assigned_to, created_by, title, reward_amount, currency, frequency, is_priority, is_flash, archived, is_seed, created_at, updated_at)
VALUES ('demo-chore-e1', 'demo-family-thomson', 'demo-child-ellie', 'demo-user-sarah', 'Tidy bedroom',         300, 'GBP', 'weekly',    0, 0, 0, 1, strftime('%s', '2025-11-01'), strftime('%s', '2025-11-01'));

INSERT OR IGNORE INTO chores (id, family_id, assigned_to, created_by, title, reward_amount, currency, frequency, is_priority, is_flash, archived, is_seed, created_at, updated_at)
VALUES ('demo-chore-e2', 'demo-family-thomson', 'demo-child-ellie', 'demo-user-sarah', 'Wash up after dinner', 200, 'GBP', 'daily',     0, 0, 0, 1, strftime('%s', '2025-11-01'), strftime('%s', '2025-11-01'));

INSERT OR IGNORE INTO chores (id, family_id, assigned_to, created_by, title, reward_amount, currency, frequency, is_priority, is_flash, archived, is_seed, created_at, updated_at)
VALUES ('demo-chore-e3', 'demo-family-thomson', 'demo-child-ellie', 'demo-user-sarah', 'Hoover living room',   400, 'GBP', 'weekly',    0, 0, 0, 1, strftime('%s', '2025-11-01'), strftime('%s', '2025-11-01'));

INSERT OR IGNORE INTO chores (id, family_id, assigned_to, created_by, title, reward_amount, currency, frequency, is_priority, is_flash, archived, is_seed, created_at, updated_at)
VALUES ('demo-chore-e4', 'demo-family-thomson', 'demo-child-ellie', 'demo-user-mark',  'Walk the dog',         250, 'GBP', 'daily',     0, 0, 0, 1, strftime('%s', '2025-11-03'), strftime('%s', '2025-11-03'));

INSERT OR IGNORE INTO chores (id, family_id, assigned_to, created_by, title, reward_amount, currency, frequency, is_priority, is_flash, archived, is_seed, created_at, updated_at)
VALUES ('demo-chore-e5', 'demo-family-thomson', 'demo-child-ellie', 'demo-user-mark',  'Take out recycling',   150, 'GBP', 'weekly',    0, 0, 0, 1, strftime('%s', '2025-11-03'), strftime('%s', '2025-11-03'));

INSERT OR IGNORE INTO chores (id, family_id, assigned_to, created_by, title, reward_amount, currency, frequency, is_priority, is_flash, archived, is_seed, created_at, updated_at)
VALUES ('demo-chore-j1', 'demo-family-thomson', 'demo-child-jake',  'demo-user-sarah', 'Tidy bedroom',         200, 'GBP', 'weekly',    0, 0, 0, 1, strftime('%s', '2025-11-01'), strftime('%s', '2025-11-01'));

INSERT OR IGNORE INTO chores (id, family_id, assigned_to, created_by, title, reward_amount, currency, frequency, is_priority, is_flash, archived, is_seed, created_at, updated_at)
VALUES ('demo-chore-j2', 'demo-family-thomson', 'demo-child-jake',  'demo-user-sarah', 'Set the table',        100, 'GBP', 'daily',     0, 0, 0, 1, strftime('%s', '2025-11-01'), strftime('%s', '2025-11-01'));

INSERT OR IGNORE INTO chores (id, family_id, assigned_to, created_by, title, reward_amount, currency, frequency, is_priority, is_flash, archived, is_seed, created_at, updated_at)
VALUES ('demo-chore-j3', 'demo-family-thomson', 'demo-child-jake',  'demo-user-sarah', 'Feed the cat',         150, 'GBP', 'daily',     0, 0, 0, 1, strftime('%s', '2025-11-01'), strftime('%s', '2025-11-01'));

INSERT OR IGNORE INTO chores (id, family_id, assigned_to, created_by, title, reward_amount, currency, frequency, is_priority, is_flash, archived, is_seed, created_at, updated_at)
VALUES ('demo-chore-j4', 'demo-family-thomson', 'demo-child-jake',  'demo-user-mark',  'Bring in shopping',    175, 'GBP', 'as_needed', 0, 0, 0, 1, strftime('%s', '2025-11-03'), strftime('%s', '2025-11-03'));

-- ── Ledger ────────────────────────────────────────────────────────────────────
-- id is INTEGER (autoincrement) — omit to let DB assign.
-- NOT NULL: family_id, entry_type, amount, currency, description,
--   verification_status, previous_hash, record_hash, ip_address, created_at, is_seed
-- 3 disputed entries, 2 late approvals (>48hr gap).

INSERT OR IGNORE INTO ledger (family_id, child_id, chore_id, entry_type, amount, currency, description, verification_status, authorised_by, verified_at, previous_hash, record_hash, ip_address, created_at, is_seed)
VALUES ('demo-family-thomson','demo-child-ellie','demo-chore-e1','credit',300,'GBP','Tidy bedroom','verified_manual','demo-user-sarah',strftime('%s','2025-11-08T19:00:00'),'0000000000000000000000000000000000000000000000000000000000000000','demo-hash-001','127.0.0.1',strftime('%s','2025-11-08T18:00:00'),1);

INSERT OR IGNORE INTO ledger (family_id, child_id, chore_id, entry_type, amount, currency, description, verification_status, authorised_by, verified_at, previous_hash, record_hash, ip_address, created_at, is_seed)
VALUES ('demo-family-thomson','demo-child-ellie','demo-chore-e2','credit',200,'GBP','Wash up after dinner','verified_manual','demo-user-sarah',strftime('%s','2025-11-09T19:00:00'),'demo-hash-001','demo-hash-002','127.0.0.1',strftime('%s','2025-11-09T18:30:00'),1);

INSERT OR IGNORE INTO ledger (family_id, child_id, chore_id, entry_type, amount, currency, description, verification_status, authorised_by, verified_at, previous_hash, record_hash, ip_address, created_at, is_seed)
VALUES ('demo-family-thomson','demo-child-ellie','demo-chore-e3','credit',400,'GBP','Hoover living room','verified_manual','demo-user-sarah',strftime('%s','2025-11-10T15:30:00'),'demo-hash-002','demo-hash-003','127.0.0.1',strftime('%s','2025-11-10T15:00:00'),1);

-- Disputed entry 1 — Walk the dog, Mark raised dispute (not_completed)
INSERT OR IGNORE INTO ledger (family_id, child_id, chore_id, entry_type, amount, currency, description, verification_status, authorised_by, dispute_code, previous_hash, record_hash, ip_address, created_at, is_seed)
VALUES ('demo-family-thomson','demo-child-ellie','demo-chore-e4','credit',250,'GBP','Walk the dog — disputed by Mark','disputed','demo-user-mark','not_completed','demo-hash-003','demo-hash-d1','127.0.0.1',strftime('%s','2025-12-05T17:00:00'),1);

-- Late approval 1 — Tidy bedroom Jake, submitted Fri, approved Mon (72hr gap)
INSERT OR IGNORE INTO ledger (family_id, child_id, chore_id, entry_type, amount, currency, description, verification_status, authorised_by, verified_at, previous_hash, record_hash, ip_address, created_at, is_seed)
VALUES ('demo-family-thomson','demo-child-jake','demo-chore-j1','credit',200,'GBP','Tidy bedroom (late approval — 72hr)','verified_manual','demo-user-sarah',strftime('%s','2025-12-15T09:00:00'),'demo-hash-d1','demo-hash-l1','127.0.0.1',strftime('%s','2025-12-12T17:00:00'),1);

-- Disputed entry 2 — Tidy bedroom Ellie, Mark disputes withheld payment
INSERT OR IGNORE INTO ledger (family_id, child_id, chore_id, entry_type, amount, currency, description, verification_status, authorised_by, dispute_code, previous_hash, record_hash, ip_address, created_at, is_seed)
VALUES ('demo-family-thomson','demo-child-ellie','demo-chore-e1','credit',300,'GBP','Tidy bedroom — Mark disputes payment was withheld','disputed','demo-user-mark','withheld_payment','demo-hash-l1','demo-hash-d2','127.0.0.1',strftime('%s','2026-01-09T18:00:00'),1);

-- Late approval 2 — Wash up Ellie, submitted Wed, approved Sat (60hr gap)
INSERT OR IGNORE INTO ledger (family_id, child_id, chore_id, entry_type, amount, currency, description, verification_status, authorised_by, verified_at, previous_hash, record_hash, ip_address, created_at, is_seed)
VALUES ('demo-family-thomson','demo-child-ellie','demo-chore-e2','credit',200,'GBP','Wash up after dinner (late approval — 60hr)','verified_manual','demo-user-sarah',strftime('%s','2026-01-17T06:00:00'),'demo-hash-d2','demo-hash-l2','127.0.0.1',strftime('%s','2026-01-14T18:00:00'),1);

-- Disputed entry 3 — Bring in shopping Jake, Sarah disputes chore assignment
INSERT OR IGNORE INTO ledger (family_id, child_id, chore_id, entry_type, amount, currency, description, verification_status, authorised_by, dispute_code, previous_hash, record_hash, ip_address, created_at, is_seed)
VALUES ('demo-family-thomson','demo-child-jake','demo-chore-j4','credit',175,'GBP','Bring in shopping — Sarah disputes chore assignment','disputed','demo-user-sarah','not_agreed','demo-hash-l2','demo-hash-d3','127.0.0.1',strftime('%s','2026-02-14T10:00:00'),1);

-- ── Goals ─────────────────────────────────────────────────────────────────────
-- NOT NULL: family_id, child_id, title, target_amount, currency, category,
--   alloc_pct, match_rate, sort_order, archived, status, current_saved_pence,
--   parent_match_pct, parent_fixed_contribution, created_at, updated_at, is_seed

INSERT OR IGNORE INTO goals (id, family_id, child_id, title, target_amount, currency, category, alloc_pct, match_rate, sort_order, archived, status, current_saved_pence, parent_match_pct, parent_fixed_contribution, is_seed, created_at, updated_at)
VALUES ('demo-goal-e1', 'demo-family-thomson', 'demo-child-ellie', 'New trainers', 6000, 'GBP', 'clothing', 100, 0, 1, 0, 'ACTIVE', 4080, 0, 0, 1, strftime('%s', '2025-12-01'), strftime('%s', '2025-12-01'));

INSERT OR IGNORE INTO goals (id, family_id, child_id, title, target_amount, currency, category, alloc_pct, match_rate, sort_order, archived, status, current_saved_pence, parent_match_pct, parent_fixed_contribution, is_seed, created_at, updated_at)
VALUES ('demo-goal-j1', 'demo-family-thomson', 'demo-child-jake', 'Football', 2500, 'GBP', 'sports', 100, 0, 1, 0, 'REACHED', 2500, 0, 0, 1, strftime('%s', '2025-11-15'), strftime('%s', '2026-01-20'));

INSERT OR IGNORE INTO goals (id, family_id, child_id, title, target_amount, currency, category, alloc_pct, match_rate, sort_order, archived, status, current_saved_pence, parent_match_pct, parent_fixed_contribution, is_seed, created_at, updated_at)
VALUES ('demo-goal-j2', 'demo-family-thomson', 'demo-child-jake', 'Gaming headset', 4500, 'GBP', 'tech', 100, 0, 2, 0, 'ACTIVE', 1530, 0, 0, 1, strftime('%s', '2026-02-01'), strftime('%s', '2026-02-01'));

-- ── Learning Lab — unlocked_modules ──────────────────────────────────────────
-- Columns: id, child_id, module_slug, unlocked_at, is_seed

-- Ellie (13, Oak / Lvl 3) — 15 modules unlocked, M18b in progress
INSERT OR IGNORE INTO unlocked_modules (id, child_id, module_slug, unlocked_at, is_seed) VALUES
('demo-ul-e-m2',   'demo-child-ellie', 'M2',   strftime('%s', '2025-11-15'), 1),
('demo-ul-e-m3',   'demo-child-ellie', 'M3',   strftime('%s', '2025-12-01'), 1),
('demo-ul-e-m3b',  'demo-child-ellie', 'M3b',  strftime('%s', '2025-12-15'), 1),
('demo-ul-e-m5',   'demo-child-ellie', 'M5',   strftime('%s', '2025-11-20'), 1),
('demo-ul-e-m6',   'demo-child-ellie', 'M6',   strftime('%s', '2026-01-05'), 1),
('demo-ul-e-m8',   'demo-child-ellie', 'M8',   strftime('%s', '2025-11-25'), 1),
('demo-ul-e-m9',   'demo-child-ellie', 'M9',   strftime('%s', '2026-01-20'), 1),
('demo-ul-e-m9b',  'demo-child-ellie', 'M9b',  strftime('%s', '2025-12-10'), 1),
('demo-ul-e-m10',  'demo-child-ellie', 'M10',  strftime('%s', '2026-02-01'), 1),
('demo-ul-e-m11',  'demo-child-ellie', 'M11',  strftime('%s', '2026-02-15'), 1),
('demo-ul-e-m12',  'demo-child-ellie', 'M12',  strftime('%s', '2026-03-01'), 1),
('demo-ul-e-m14',  'demo-child-ellie', 'M14',  strftime('%s', '2026-01-10'), 1),
('demo-ul-e-m17',  'demo-child-ellie', 'M17',  strftime('%s', '2025-12-20'), 1),
('demo-ul-e-m18',  'demo-child-ellie', 'M18',  strftime('%s', '2026-03-15'), 1),
('demo-ul-e-m18b', 'demo-child-ellie', 'M18b', strftime('%s', '2026-04-01'), 1);

-- Jake (10, Sapling / Lvl 2) — 3 modules, M9b in progress
INSERT OR IGNORE INTO unlocked_modules (id, child_id, module_slug, unlocked_at, is_seed) VALUES
('demo-ul-j-m2',  'demo-child-jake', 'M2',  strftime('%s', '2025-11-20'), 1),
('demo-ul-j-m5',  'demo-child-jake', 'M5',  strftime('%s', '2025-12-10'), 1),
('demo-ul-j-m8',  'demo-child-jake', 'M8',  strftime('%s', '2026-01-15'), 1),
('demo-ul-j-m9b', 'demo-child-jake', 'M9b', strftime('%s', '2026-02-10'), 1);

-- ── Pre-seeded AI Mentor briefings (insight_snapshots) ────────────────────────
-- The app caches briefings as observation/behavioral_root/the_nudge on the
-- insight_snapshots row. Seeding these prevents a live AI call for demo viewers.
-- snapshot_date matches the ISO week key format used by the app (e.g. '2026-W18').

INSERT OR IGNORE INTO insight_snapshots
  (child_id, family_id, snapshot_date, consistency_score, responsibility_score,
   planning_horizon, total_earned_pence, observation, behavioral_root, the_nudge, created_at)
VALUES (
  'demo-child-ellie', 'demo-family-thomson', '2026-W18',
  82, 79, 68, 24800,
  'Ellie has completed 15 financial literacy modules — including Good vs Bad Debt (Pillar 4) and Money & Mental Health (Pillar 6). Her trainers goal is 68% funded and she has not withdrawn from it once in 6 months.',
  'Pillar 3 (Opportunity Cost) — Ellie demonstrates deliberate saving over impulse spending. Every £ earned goes toward a declared goal.',
  'Ellie is 3 weeks from her trainers goal at current pace. Consider a small parent match on the final stretch to reinforce that planning pays off.',
  strftime('%s', 'now')
);

INSERT OR IGNORE INTO insight_snapshots
  (child_id, family_id, snapshot_date, consistency_score, responsibility_score,
   planning_horizon, total_earned_pence, observation, behavioral_root, the_nudge, created_at)
VALUES (
  'demo-child-jake', 'demo-family-thomson', '2026-W18',
  74, 71, 34, 11200,
  'Jake has completed 3 modules including Banking 101 and is mid-way through The Snowball (M9b). His gaming headset goal is 34% funded. He has submitted every assigned chore for 4 consecutive weeks.',
  'Pillar 1 (Labour Value) — Jake is building consistent work habits. His streak suggests the chore routine is becoming self-sustaining.',
  'Jake is on a 4-week streak. This is the moment to introduce compound interest through M9b — The Snowball — which he is already progressing through.',
  strftime('%s', 'now')
);
