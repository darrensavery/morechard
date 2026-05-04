-- 0050_demo_enrichment.sql
-- Enriches the Thomson demo family with 6 months of chore history,
-- overdue chores, shared expenses, spending records, and updated
-- insight snapshots — so the Insights tab shows real KPIs instead
-- of the discovery-phase blank state.
--
-- All Unix timestamps computed relative to 2026-05-03 00:00 UTC = 1746230400
-- 1 day = 86400 seconds

-- ── 0. Add is_seed columns needed for nightly reset scoping ──────────────────
ALTER TABLE completions    ADD COLUMN is_seed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE spending       ADD COLUMN is_seed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE shared_expenses ADD COLUMN is_seed INTEGER NOT NULL DEFAULT 0;

-- ── 1. Add license_type column (used by insights route for Learning Lab gate) ─
-- The families table uses has_ai_mentor/has_shield flags but insights.ts queries
-- license_type with a .catch() fallback to 'core'. We add the column here.
ALTER TABLE families ADD COLUMN license_type TEXT NOT NULL DEFAULT 'core';

-- Set the Thomson demo family to 'core_ai' so Learning Lab is visible
UPDATE families
SET license_type = 'core_ai'
WHERE id = 'demo-family-thomson';

-- ── 2. Ledger entries for the new completions (must insert before completions) ─
-- Ellie completions ledger: IDs 13–42  (30 entries × ~3 chores)
-- Jake completions ledger:  IDs 43–62  (20 entries)
-- We use specific IDs to allow FK-style references from completions.

INSERT OR IGNORE INTO ledger (id, family_id, child_id, chore_id, entry_type, amount, currency, description, verification_status, authorised_by, verified_at, verified_by, previous_hash, record_hash, ip_address, created_at, is_seed)
VALUES
-- ── Ellie — 6 months of approved chore payments ──────────────────────────────
-- Week 1 (6 months ago ~1730390400)
(13,'demo-family-thomson','demo-child-ellie','demo-chore-e1','credit',300,'GBP','Tidy bedroom','verified_manual','demo-user-sarah',1730390400,'demo-user-sarah','0000000000000000000000000000000000000000000000000000000000000000','a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2','127.0.0.1',1730390400,1),
(14,'demo-family-thomson','demo-child-ellie','demo-chore-e2','credit',200,'GBP','Wash up after dinner','verified_manual','demo-user-sarah',1730476800,'demo-user-sarah','a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2','b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3','127.0.0.1',1730476800,1),
-- Week 2
(15,'demo-family-thomson','demo-child-ellie','demo-chore-e3','credit',400,'GBP','Hoover living room','verified_manual','demo-user-mark',1731081600,'demo-user-mark','b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3','c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4','127.0.0.1',1731081600,1),
(16,'demo-family-thomson','demo-child-ellie','demo-chore-e4','credit',250,'GBP','Walk the dog','verified_manual','demo-user-sarah',1731168000,'demo-user-sarah','c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4','d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5','127.0.0.1',1731168000,1),
-- Week 3
(17,'demo-family-thomson','demo-child-ellie','demo-chore-e1','credit',300,'GBP','Tidy bedroom','verified_manual','demo-user-sarah',1731686400,'demo-user-sarah','d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5','e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6','127.0.0.1',1731686400,1),
(18,'demo-family-thomson','demo-child-ellie','demo-chore-e2','credit',200,'GBP','Wash up after dinner','verified_manual','demo-user-mark',1731772800,'demo-user-mark','e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6','f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1','127.0.0.1',1731772800,1),
-- Week 4
(19,'demo-family-thomson','demo-child-ellie','demo-chore-e5','credit',150,'GBP','Take out recycling','verified_manual','demo-user-sarah',1732291200,'demo-user-sarah','f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1','a1b3c5d7e9f1a1b3c5d7e9f1a1b3c5d7e9f1a1b3c5d7e9f1a1b3c5d7e9f1a1b3','127.0.0.1',1732291200,1),
(20,'demo-family-thomson','demo-child-ellie','demo-chore-e3','credit',400,'GBP','Hoover living room','verified_manual','demo-user-sarah',1732377600,'demo-user-sarah','a1b3c5d7e9f1a1b3c5d7e9f1a1b3c5d7e9f1a1b3c5d7e9f1a1b3c5d7e9f1a1b3','b2c4d6e8f0a2b4c6d8e0f2a4b6c8d0e2f4a6b8c0d2e4f6a8b0c2d4e6f8a0b2c4','127.0.0.1',1732377600,1),
-- Week 5
(21,'demo-family-thomson','demo-child-ellie','demo-chore-e4','credit',250,'GBP','Walk the dog','verified_manual','demo-user-mark',1732896000,'demo-user-mark','b2c4d6e8f0a2b4c6d8e0f2a4b6c8d0e2f4a6b8c0d2e4f6a8b0c2d4e6f8a0b2c4','c3d5e7f9a1c3d5e7f9a1c3d5e7f9a1c3d5e7f9a1c3d5e7f9a1c3d5e7f9a1c3d5','127.0.0.1',1732896000,1),
(22,'demo-family-thomson','demo-child-ellie','demo-chore-e1','credit',300,'GBP','Tidy bedroom','verified_manual','demo-user-sarah',1732982400,'demo-user-sarah','c3d5e7f9a1c3d5e7f9a1c3d5e7f9a1c3d5e7f9a1c3d5e7f9a1c3d5e7f9a1c3d5','d4e6f8a0b2d4e6f8a0b2d4e6f8a0b2d4e6f8a0b2d4e6f8a0b2d4e6f8a0b2d4e6','127.0.0.1',1732982400,1),
-- Week 6
(23,'demo-family-thomson','demo-child-ellie','demo-chore-e2','credit',200,'GBP','Wash up after dinner','verified_manual','demo-user-sarah',1733500800,'demo-user-sarah','d4e6f8a0b2d4e6f8a0b2d4e6f8a0b2d4e6f8a0b2d4e6f8a0b2d4e6f8a0b2d4e6','e5f7a9b1c3e5f7a9b1c3e5f7a9b1c3e5f7a9b1c3e5f7a9b1c3e5f7a9b1c3e5f7','127.0.0.1',1733500800,1),
(24,'demo-family-thomson','demo-child-ellie','demo-chore-e5','credit',150,'GBP','Take out recycling','verified_manual','demo-user-mark',1733587200,'demo-user-mark','e5f7a9b1c3e5f7a9b1c3e5f7a9b1c3e5f7a9b1c3e5f7a9b1c3e5f7a9b1c3e5f7','f6a8b0c2d4f6a8b0c2d4f6a8b0c2d4f6a8b0c2d4f6a8b0c2d4f6a8b0c2d4f6a8','127.0.0.1',1733587200,1),
-- Weeks 7–10 (month 2)
(25,'demo-family-thomson','demo-child-ellie','demo-chore-e3','credit',400,'GBP','Hoover living room','verified_manual','demo-user-sarah',1734192000,'demo-user-sarah','f6a8b0c2d4f6a8b0c2d4f6a8b0c2d4f6a8b0c2d4f6a8b0c2d4f6a8b0c2d4f6a8','a7b9c1d3e5a7b9c1d3e5a7b9c1d3e5a7b9c1d3e5a7b9c1d3e5a7b9c1d3e5a7b9','127.0.0.1',1734192000,1),
(26,'demo-family-thomson','demo-child-ellie','demo-chore-e4','credit',250,'GBP','Walk the dog','verified_manual','demo-user-sarah',1734278400,'demo-user-sarah','a7b9c1d3e5a7b9c1d3e5a7b9c1d3e5a7b9c1d3e5a7b9c1d3e5a7b9c1d3e5a7b9','b8c0d2e4f6b8c0d2e4f6b8c0d2e4f6b8c0d2e4f6b8c0d2e4f6b8c0d2e4f6b8c0','127.0.0.1',1734278400,1),
(27,'demo-family-thomson','demo-child-ellie','demo-chore-e1','credit',300,'GBP','Tidy bedroom','verified_manual','demo-user-mark',1734883200,'demo-user-mark','b8c0d2e4f6b8c0d2e4f6b8c0d2e4f6b8c0d2e4f6b8c0d2e4f6b8c0d2e4f6b8c0','c9d1e3f5a7c9d1e3f5a7c9d1e3f5a7c9d1e3f5a7c9d1e3f5a7c9d1e3f5a7c9d1','127.0.0.1',1734883200,1),
(28,'demo-family-thomson','demo-child-ellie','demo-chore-e2','credit',200,'GBP','Wash up after dinner','verified_manual','demo-user-sarah',1734969600,'demo-user-sarah','c9d1e3f5a7c9d1e3f5a7c9d1e3f5a7c9d1e3f5a7c9d1e3f5a7c9d1e3f5a7c9d1','d0e2f4a6b8d0e2f4a6b8d0e2f4a6b8d0e2f4a6b8d0e2f4a6b8d0e2f4a6b8d0e2','127.0.0.1',1734969600,1),
-- Weeks 11–14 (month 3)
(29,'demo-family-thomson','demo-child-ellie','demo-chore-e3','credit',400,'GBP','Hoover living room','verified_manual','demo-user-sarah',1735574400,'demo-user-sarah','d0e2f4a6b8d0e2f4a6b8d0e2f4a6b8d0e2f4a6b8d0e2f4a6b8d0e2f4a6b8d0e2','e1f3a5b7c9e1f3a5b7c9e1f3a5b7c9e1f3a5b7c9e1f3a5b7c9e1f3a5b7c9e1f3','127.0.0.1',1735574400,1),
(30,'demo-family-thomson','demo-child-ellie','demo-chore-e5','credit',150,'GBP','Take out recycling','verified_manual','demo-user-mark',1735660800,'demo-user-mark','e1f3a5b7c9e1f3a5b7c9e1f3a5b7c9e1f3a5b7c9e1f3a5b7c9e1f3a5b7c9e1f3','f2a4b6c8d0f2a4b6c8d0f2a4b6c8d0f2a4b6c8d0f2a4b6c8d0f2a4b6c8d0f2a4','127.0.0.1',1735660800,1),
(31,'demo-family-thomson','demo-child-ellie','demo-chore-e4','credit',250,'GBP','Walk the dog','verified_manual','demo-user-sarah',1736265600,'demo-user-sarah','f2a4b6c8d0f2a4b6c8d0f2a4b6c8d0f2a4b6c8d0f2a4b6c8d0f2a4b6c8d0f2a4','a3b5c7d9e1a3b5c7d9e1a3b5c7d9e1a3b5c7d9e1a3b5c7d9e1a3b5c7d9e1a3b5','127.0.0.1',1736265600,1),
(32,'demo-family-thomson','demo-child-ellie','demo-chore-e1','credit',300,'GBP','Tidy bedroom','verified_manual','demo-user-sarah',1736352000,'demo-user-sarah','a3b5c7d9e1a3b5c7d9e1a3b5c7d9e1a3b5c7d9e1a3b5c7d9e1a3b5c7d9e1a3b5','b4c6d8e0f2b4c6d8e0f2b4c6d8e0f2b4c6d8e0f2b4c6d8e0f2b4c6d8e0f2b4c6','127.0.0.1',1736352000,1),
-- Weeks 15–18 (month 4)
(33,'demo-family-thomson','demo-child-ellie','demo-chore-e2','credit',200,'GBP','Wash up after dinner','verified_manual','demo-user-mark',1736956800,'demo-user-mark','b4c6d8e0f2b4c6d8e0f2b4c6d8e0f2b4c6d8e0f2b4c6d8e0f2b4c6d8e0f2b4c6','c5d7e9f1a3c5d7e9f1a3c5d7e9f1a3c5d7e9f1a3c5d7e9f1a3c5d7e9f1a3c5d7','127.0.0.1',1736956800,1),
(34,'demo-family-thomson','demo-child-ellie','demo-chore-e3','credit',400,'GBP','Hoover living room','verified_manual','demo-user-sarah',1737043200,'demo-user-sarah','c5d7e9f1a3c5d7e9f1a3c5d7e9f1a3c5d7e9f1a3c5d7e9f1a3c5d7e9f1a3c5d7','d6e8f0a2b4d6e8f0a2b4d6e8f0a2b4d6e8f0a2b4d6e8f0a2b4d6e8f0a2b4d6e8','127.0.0.1',1737043200,1),
(35,'demo-family-thomson','demo-child-ellie','demo-chore-e5','credit',150,'GBP','Take out recycling','verified_manual','demo-user-sarah',1737648000,'demo-user-sarah','d6e8f0a2b4d6e8f0a2b4d6e8f0a2b4d6e8f0a2b4d6e8f0a2b4d6e8f0a2b4d6e8','e7f9a1b3c5e7f9a1b3c5e7f9a1b3c5e7f9a1b3c5e7f9a1b3c5e7f9a1b3c5e7f9','127.0.0.1',1737648000,1),
-- Last 4 weeks (recent history for sparklines/consistency)
(36,'demo-family-thomson','demo-child-ellie','demo-chore-e1','credit',300,'GBP','Tidy bedroom','verified_manual','demo-user-sarah',1744243200,'demo-user-sarah','e7f9a1b3c5e7f9a1b3c5e7f9a1b3c5e7f9a1b3c5e7f9a1b3c5e7f9a1b3c5e7f9','f8a0b2c4d6f8a0b2c4d6f8a0b2c4d6f8a0b2c4d6f8a0b2c4d6f8a0b2c4d6f8a0','127.0.0.1',1744243200,1),
(37,'demo-family-thomson','demo-child-ellie','demo-chore-e2','credit',200,'GBP','Wash up after dinner','verified_manual','demo-user-mark',1744329600,'demo-user-mark','f8a0b2c4d6f8a0b2c4d6f8a0b2c4d6f8a0b2c4d6f8a0b2c4d6f8a0b2c4d6f8a0','a9b1c3d5e7a9b1c3d5e7a9b1c3d5e7a9b1c3d5e7a9b1c3d5e7a9b1c3d5e7a9b1','127.0.0.1',1744329600,1),
(38,'demo-family-thomson','demo-child-ellie','demo-chore-e3','credit',400,'GBP','Hoover living room','verified_manual','demo-user-sarah',1744848000,'demo-user-sarah','a9b1c3d5e7a9b1c3d5e7a9b1c3d5e7a9b1c3d5e7a9b1c3d5e7a9b1c3d5e7a9b1','b0c2d4e6f8b0c2d4e6f8b0c2d4e6f8b0c2d4e6f8b0c2d4e6f8b0c2d4e6f8b0c2','127.0.0.1',1744848000,1),
(39,'demo-family-thomson','demo-child-ellie','demo-chore-e4','credit',250,'GBP','Walk the dog','verified_manual','demo-user-sarah',1744934400,'demo-user-sarah','b0c2d4e6f8b0c2d4e6f8b0c2d4e6f8b0c2d4e6f8b0c2d4e6f8b0c2d4e6f8b0c2','c1d3e5f7a9c1d3e5f7a9c1d3e5f7a9c1d3e5f7a9c1d3e5f7a9c1d3e5f7a9c1d3','127.0.0.1',1744934400,1),
(40,'demo-family-thomson','demo-child-ellie','demo-chore-e5','credit',150,'GBP','Take out recycling','verified_manual','demo-user-sarah',1745539200,'demo-user-sarah','c1d3e5f7a9c1d3e5f7a9c1d3e5f7a9c1d3e5f7a9c1d3e5f7a9c1d3e5f7a9c1d3','d2e4f6a8b0d2e4f6a8b0d2e4f6a8b0d2e4f6a8b0d2e4f6a8b0d2e4f6a8b0d2e4','127.0.0.1',1745539200,1),
(41,'demo-family-thomson','demo-child-ellie','demo-chore-e1','credit',300,'GBP','Tidy bedroom','verified_manual','demo-user-mark',1745625600,'demo-user-mark','d2e4f6a8b0d2e4f6a8b0d2e4f6a8b0d2e4f6a8b0d2e4f6a8b0d2e4f6a8b0d2e4','e3f5a7b9c1e3f5a7b9c1e3f5a7b9c1e3f5a7b9c1e3f5a7b9c1e3f5a7b9c1e3f5','127.0.0.1',1745625600,1),
(42,'demo-family-thomson','demo-child-ellie','demo-chore-e2','credit',200,'GBP','Wash up after dinner','verified_manual','demo-user-sarah',1746144000,'demo-user-sarah','e3f5a7b9c1e3f5a7b9c1e3f5a7b9c1e3f5a7b9c1e3f5a7b9c1e3f5a7b9c1e3f5','f4a6b8c0d2f4a6b8c0d2f4a6b8c0d2f4a6b8c0d2f4a6b8c0d2f4a6b8c0d2f4a6','127.0.0.1',1746144000,1),

-- ── Jake ledger entries ───────────────────────────────────────────────────────
(43,'demo-family-thomson','demo-child-jake','demo-chore-j1','credit',200,'GBP','Tidy bedroom','verified_manual','demo-user-sarah',1730390400,'demo-user-sarah','1111111111111111111111111111111111111111111111111111111111111111','2222222222222222222222222222222222222222222222222222222222222222','127.0.0.1',1730390400,1),
(44,'demo-family-thomson','demo-child-jake','demo-chore-j2','credit',175,'GBP','Set the table','verified_manual','demo-user-mark',1730476800,'demo-user-mark','2222222222222222222222222222222222222222222222222222222222222222','3333333333333333333333333333333333333333333333333333333333333333','127.0.0.1',1730476800,1),
(45,'demo-family-thomson','demo-child-jake','demo-chore-j3','credit',150,'GBP','Feed the cat','verified_manual','demo-user-sarah',1731081600,'demo-user-sarah','3333333333333333333333333333333333333333333333333333333333333333','4444444444444444444444444444444444444444444444444444444444444444','127.0.0.1',1731081600,1),
(46,'demo-family-thomson','demo-child-jake','demo-chore-j4','credit',175,'GBP','Bring in shopping','verified_manual','demo-user-sarah',1731168000,'demo-user-sarah','4444444444444444444444444444444444444444444444444444444444444444','5555555555555555555555555555555555555555555555555555555555555555','127.0.0.1',1731168000,1),
(47,'demo-family-thomson','demo-child-jake','demo-chore-j1','credit',200,'GBP','Tidy bedroom','verified_manual','demo-user-mark',1731686400,'demo-user-mark','5555555555555555555555555555555555555555555555555555555555555555','6666666666666666666666666666666666666666666666666666666666666666','127.0.0.1',1731686400,1),
(48,'demo-family-thomson','demo-child-jake','demo-chore-j2','credit',175,'GBP','Set the table','verified_manual','demo-user-sarah',1731772800,'demo-user-sarah','6666666666666666666666666666666666666666666666666666666666666666','7777777777777777777777777777777777777777777777777777777777777777','127.0.0.1',1731772800,1),
(49,'demo-family-thomson','demo-child-jake','demo-chore-j3','credit',150,'GBP','Feed the cat','verified_manual','demo-user-sarah',1732291200,'demo-user-sarah','7777777777777777777777777777777777777777777777777777777777777777','8888888888888888888888888888888888888888888888888888888888888888','127.0.0.1',1732291200,1),
(50,'demo-family-thomson','demo-child-jake','demo-chore-j1','credit',200,'GBP','Tidy bedroom','verified_manual','demo-user-mark',1732377600,'demo-user-mark','8888888888888888888888888888888888888888888888888888888888888888','9999999999999999999999999999999999999999999999999999999999999999','127.0.0.1',1732377600,1),
(51,'demo-family-thomson','demo-child-jake','demo-chore-j4','credit',175,'GBP','Bring in shopping','verified_manual','demo-user-sarah',1732896000,'demo-user-sarah','9999999999999999999999999999999999999999999999999999999999999999','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','127.0.0.1',1732896000,1),
(52,'demo-family-thomson','demo-child-jake','demo-chore-j2','credit',175,'GBP','Set the table','verified_manual','demo-user-sarah',1732982400,'demo-user-sarah','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb','127.0.0.1',1732982400,1),
(53,'demo-family-thomson','demo-child-jake','demo-chore-j3','credit',150,'GBP','Feed the cat','verified_manual','demo-user-mark',1733500800,'demo-user-mark','bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb','cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc','127.0.0.1',1733500800,1),
(54,'demo-family-thomson','demo-child-jake','demo-chore-j1','credit',200,'GBP','Tidy bedroom','verified_manual','demo-user-sarah',1733587200,'demo-user-sarah','cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc','dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd','127.0.0.1',1733587200,1),
(55,'demo-family-thomson','demo-child-jake','demo-chore-j2','credit',175,'GBP','Set the table','verified_manual','demo-user-sarah',1734192000,'demo-user-sarah','dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd','eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee','127.0.0.1',1734192000,1),
(56,'demo-family-thomson','demo-child-jake','demo-chore-j4','credit',175,'GBP','Bring in shopping','verified_manual','demo-user-mark',1734278400,'demo-user-mark','eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee','ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff','127.0.0.1',1734278400,1),
-- Jake last 4 weeks
(57,'demo-family-thomson','demo-child-jake','demo-chore-j1','credit',200,'GBP','Tidy bedroom','verified_manual','demo-user-sarah',1744243200,'demo-user-sarah','1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b','2a3b4c5d6e7f2a3b4c5d6e7f2a3b4c5d6e7f2a3b4c5d6e7f2a3b4c5d6e7f2a3b','127.0.0.1',1744243200,1),
(58,'demo-family-thomson','demo-child-jake','demo-chore-j2','credit',175,'GBP','Set the table','verified_manual','demo-user-mark',1744329600,'demo-user-mark','2a3b4c5d6e7f2a3b4c5d6e7f2a3b4c5d6e7f2a3b4c5d6e7f2a3b4c5d6e7f2a3b','3a4b5c6d7e8f3a4b5c6d7e8f3a4b5c6d7e8f3a4b5c6d7e8f3a4b5c6d7e8f3a4b','127.0.0.1',1744329600,1),
(59,'demo-family-thomson','demo-child-jake','demo-chore-j3','credit',150,'GBP','Feed the cat','verified_manual','demo-user-sarah',1744848000,'demo-user-sarah','3a4b5c6d7e8f3a4b5c6d7e8f3a4b5c6d7e8f3a4b5c6d7e8f3a4b5c6d7e8f3a4b','4a5b6c7d8e9f4a5b6c7d8e9f4a5b6c7d8e9f4a5b6c7d8e9f4a5b6c7d8e9f4a5b','127.0.0.1',1744848000,1),
(60,'demo-family-thomson','demo-child-jake','demo-chore-j4','credit',175,'GBP','Bring in shopping','verified_manual','demo-user-sarah',1744934400,'demo-user-sarah','4a5b6c7d8e9f4a5b6c7d8e9f4a5b6c7d8e9f4a5b6c7d8e9f4a5b6c7d8e9f4a5b','5a6b7c8d9e0f5a6b7c8d9e0f5a6b7c8d9e0f5a6b7c8d9e0f5a6b7c8d9e0f5a6b','127.0.0.1',1744934400,1),
(61,'demo-family-thomson','demo-child-jake','demo-chore-j1','credit',200,'GBP','Tidy bedroom','verified_manual','demo-user-mark',1745539200,'demo-user-mark','5a6b7c8d9e0f5a6b7c8d9e0f5a6b7c8d9e0f5a6b7c8d9e0f5a6b7c8d9e0f5a6b','6a7b8c9d0e1f6a7b8c9d0e1f6a7b8c9d0e1f6a7b8c9d0e1f6a7b8c9d0e1f6a7b','127.0.0.1',1745539200,1),
(62,'demo-family-thomson','demo-child-jake','demo-chore-j2','credit',175,'GBP','Set the table','verified_manual','demo-user-sarah',1746144000,'demo-user-sarah','6a7b8c9d0e1f6a7b8c9d0e1f6a7b8c9d0e1f6a7b8c9d0e1f6a7b8c9d0e1f6a7b','7a8b9c0d1e2f7a8b9c0d1e2f7a8b9c0d1e2f7a8b9c0d1e2f7a8b9c0d1e2f7a8b','127.0.0.1',1746144000,1);

-- ── 3. Completion records ─────────────────────────────────────────────────────
-- Ellie: 30 completions across 6 months, mostly first-time passes (attempt_count=1)
-- A few with attempt_count=2 to show some revision history
INSERT OR IGNORE INTO completions (id, family_id, chore_id, child_id, status, attempt_count, ledger_id, rating, submitted_at, resolved_at, resolved_by, is_seed)
VALUES
-- Early history (6 months ago, exits discovery phase)
('demo-comp-e01','demo-family-thomson','demo-chore-e1','demo-child-ellie','completed',1,13,5,1730304000,1730390400,'demo-user-sarah',1),
('demo-comp-e02','demo-family-thomson','demo-chore-e2','demo-child-ellie','completed',1,14,4,1730390400,1730476800,'demo-user-sarah',1),
('demo-comp-e03','demo-family-thomson','demo-chore-e3','demo-child-ellie','completed',1,15,5,1731081600,1731081600,'demo-user-mark',1),
('demo-comp-e04','demo-family-thomson','demo-chore-e4','demo-child-ellie','completed',2,16,4,1731081600,1731168000,'demo-user-sarah',1),
('demo-comp-e05','demo-family-thomson','demo-chore-e1','demo-child-ellie','completed',1,17,5,1731600000,1731686400,'demo-user-sarah',1),
('demo-comp-e06','demo-family-thomson','demo-chore-e2','demo-child-ellie','completed',1,18,4,1731686400,1731772800,'demo-user-mark',1),
('demo-comp-e07','demo-family-thomson','demo-chore-e5','demo-child-ellie','completed',1,19,5,1732204800,1732291200,'demo-user-sarah',1),
('demo-comp-e08','demo-family-thomson','demo-chore-e3','demo-child-ellie','completed',1,20,5,1732291200,1732377600,'demo-user-sarah',1),
('demo-comp-e09','demo-family-thomson','demo-chore-e4','demo-child-ellie','completed',1,21,4,1732809600,1732896000,'demo-user-mark',1),
('demo-comp-e10','demo-family-thomson','demo-chore-e1','demo-child-ellie','completed',1,22,5,1732896000,1732982400,'demo-user-sarah',1),
('demo-comp-e11','demo-family-thomson','demo-chore-e2','demo-child-ellie','completed',2,23,3,1733414400,1733500800,'demo-user-sarah',1),
('demo-comp-e12','demo-family-thomson','demo-chore-e5','demo-child-ellie','completed',1,24,5,1733500800,1733587200,'demo-user-mark',1),
('demo-comp-e13','demo-family-thomson','demo-chore-e3','demo-child-ellie','completed',1,25,5,1734105600,1734192000,'demo-user-sarah',1),
('demo-comp-e14','demo-family-thomson','demo-chore-e4','demo-child-ellie','completed',1,26,4,1734192000,1734278400,'demo-user-sarah',1),
('demo-comp-e15','demo-family-thomson','demo-chore-e1','demo-child-ellie','completed',1,27,5,1734796800,1734883200,'demo-user-mark',1),
('demo-comp-e16','demo-family-thomson','demo-chore-e2','demo-child-ellie','completed',1,28,4,1734883200,1734969600,'demo-user-sarah',1),
('demo-comp-e17','demo-family-thomson','demo-chore-e3','demo-child-ellie','completed',1,29,5,1735488000,1735574400,'demo-user-sarah',1),
('demo-comp-e18','demo-family-thomson','demo-chore-e5','demo-child-ellie','completed',1,30,5,1735574400,1735660800,'demo-user-mark',1),
('demo-comp-e19','demo-family-thomson','demo-chore-e4','demo-child-ellie','completed',1,31,4,1736179200,1736265600,'demo-user-sarah',1),
('demo-comp-e20','demo-family-thomson','demo-chore-e1','demo-child-ellie','completed',1,32,5,1736265600,1736352000,'demo-user-sarah',1),
('demo-comp-e21','demo-family-thomson','demo-chore-e2','demo-child-ellie','completed',1,33,4,1736870400,1736956800,'demo-user-mark',1),
('demo-comp-e22','demo-family-thomson','demo-chore-e3','demo-child-ellie','completed',1,34,5,1736956800,1737043200,'demo-user-sarah',1),
('demo-comp-e23','demo-family-thomson','demo-chore-e5','demo-child-ellie','completed',1,35,5,1737561600,1737648000,'demo-user-sarah',1),
-- Last 4 weeks — fills 28-day consistency buckets
('demo-comp-e24','demo-family-thomson','demo-chore-e1','demo-child-ellie','completed',1,36,5,1744156800,1744243200,'demo-user-sarah',1),
('demo-comp-e25','demo-family-thomson','demo-chore-e2','demo-child-ellie','completed',1,37,4,1744243200,1744329600,'demo-user-mark',1),
('demo-comp-e26','demo-family-thomson','demo-chore-e3','demo-child-ellie','completed',1,38,5,1744761600,1744848000,'demo-user-sarah',1),
('demo-comp-e27','demo-family-thomson','demo-chore-e4','demo-child-ellie','completed',1,39,4,1744848000,1744934400,'demo-user-sarah',1),
('demo-comp-e28','demo-family-thomson','demo-chore-e5','demo-child-ellie','completed',1,40,5,1745452800,1745539200,'demo-user-mark',1),
('demo-comp-e29','demo-family-thomson','demo-chore-e1','demo-child-ellie','completed',1,41,5,1745539200,1745625600,'demo-user-sarah',1),
('demo-comp-e30','demo-family-thomson','demo-chore-e2','demo-child-ellie','completed',1,42,4,1746057600,1746144000,'demo-user-sarah',1),

-- Jake: 20 completions across 6 months
('demo-comp-j01','demo-family-thomson','demo-chore-j1','demo-child-jake','completed',1,43,4,1730304000,1730390400,'demo-user-sarah',1),
('demo-comp-j02','demo-family-thomson','demo-chore-j2','demo-child-jake','completed',1,44,4,1730390400,1730476800,'demo-user-mark',1),
('demo-comp-j03','demo-family-thomson','demo-chore-j3','demo-child-jake','completed',2,45,3,1731081600,1731081600,'demo-user-sarah',1),
('demo-comp-j04','demo-family-thomson','demo-chore-j4','demo-child-jake','completed',1,46,4,1731081600,1731168000,'demo-user-sarah',1),
('demo-comp-j05','demo-family-thomson','demo-chore-j1','demo-child-jake','completed',1,47,5,1731600000,1731686400,'demo-user-mark',1),
('demo-comp-j06','demo-family-thomson','demo-chore-j2','demo-child-jake','completed',1,48,4,1731686400,1731772800,'demo-user-sarah',1),
('demo-comp-j07','demo-family-thomson','demo-chore-j3','demo-child-jake','completed',1,49,4,1732204800,1732291200,'demo-user-sarah',1),
('demo-comp-j08','demo-family-thomson','demo-chore-j1','demo-child-jake','completed',2,50,3,1732291200,1732377600,'demo-user-mark',1),
('demo-comp-j09','demo-family-thomson','demo-chore-j4','demo-child-jake','completed',1,51,4,1732809600,1732896000,'demo-user-sarah',1),
('demo-comp-j10','demo-family-thomson','demo-chore-j2','demo-child-jake','completed',1,52,4,1732896000,1732982400,'demo-user-sarah',1),
('demo-comp-j11','demo-family-thomson','demo-chore-j3','demo-child-jake','completed',1,53,4,1733414400,1733500800,'demo-user-mark',1),
('demo-comp-j12','demo-family-thomson','demo-chore-j1','demo-child-jake','completed',1,54,5,1733500800,1733587200,'demo-user-sarah',1),
('demo-comp-j13','demo-family-thomson','demo-chore-j2','demo-child-jake','completed',1,55,4,1734105600,1734192000,'demo-user-sarah',1),
('demo-comp-j14','demo-family-thomson','demo-chore-j4','demo-child-jake','completed',1,56,4,1734192000,1734278400,'demo-user-mark',1),
-- Jake last 4 weeks
('demo-comp-j15','demo-family-thomson','demo-chore-j1','demo-child-jake','completed',1,57,5,1744156800,1744243200,'demo-user-sarah',1),
('demo-comp-j16','demo-family-thomson','demo-chore-j2','demo-child-jake','completed',1,58,4,1744243200,1744329600,'demo-user-mark',1),
('demo-comp-j17','demo-family-thomson','demo-chore-j3','demo-child-jake','completed',1,59,4,1744761600,1744848000,'demo-user-sarah',1),
('demo-comp-j18','demo-family-thomson','demo-chore-j4','demo-child-jake','completed',1,60,4,1744848000,1744934400,'demo-user-sarah',1),
('demo-comp-j19','demo-family-thomson','demo-chore-j1','demo-child-jake','completed',1,61,5,1745452800,1745539200,'demo-user-mark',1),
('demo-comp-j20','demo-family-thomson','demo-chore-j2','demo-child-jake','completed',1,62,4,1746057600,1746144000,'demo-user-sarah',1);

-- ── 4. Overdue chores — past due_date with no completion ─────────────────────
-- A chore is "overdue" when due_date is in the past and no completed/awaiting_review
-- completion exists. The status field is on completions, not chores.
INSERT OR IGNORE INTO chores (id, family_id, assigned_to, created_by, title, description, reward_amount, currency, frequency, due_date, is_seed, created_at)
VALUES
('demo-chore-e-overdue1','demo-family-thomson','demo-child-ellie','demo-user-sarah',
 'Hoover upstairs','Hoover all upstairs bedrooms and hallway',350,'GBP',
 'weekly','2026-04-12',1,strftime('%s','2026-04-05')),
('demo-chore-j-overdue1','demo-family-thomson','demo-child-jake','demo-user-sarah',
 'Tidy toy cupboard','Sort and tidy the toy cupboard in the playroom',200,'GBP',
 'weekly','2026-04-19',1,strftime('%s','2026-04-12'));

-- ── 5. Spending records ───────────────────────────────────────────────────────
-- Ellie: bought art supplies; Jake: bought a book
INSERT OR IGNORE INTO spending (id, family_id, child_id, title, amount, currency, note, spent_at, is_seed)
VALUES
('demo-spend-e1','demo-family-thomson','demo-child-ellie','Art supplies',850,'GBP','Watercolour set from The Works',1738857600,1),
('demo-spend-e2','demo-family-thomson','demo-child-ellie','Music download',199,'GBP','Album from Bandcamp',1741536000,1),
('demo-spend-e3','demo-family-thomson','demo-child-ellie','Charity donation',100,'GBP','RSPCA donation',1744214400,1),
('demo-spend-j1','demo-family-thomson','demo-child-jake','Comic book',350,'GBP','Beano annual',1738857600,1),
('demo-spend-j2','demo-family-thomson','demo-child-jake','Sticker pack',125,'GBP','Football stickers',1741536000,1),
('demo-spend-j3','demo-family-thomson','demo-child-jake','Pocket trading cards',299,'GBP','Pokémon booster pack',1744214400,1);

-- ── 6. Shared expenses (co-parenting) ────────────────────────────────────────
-- Hashes are dummy values (demo only — not part of verified chain)
INSERT OR IGNORE INTO shared_expenses (
  family_id, logged_by, authorised_by, description, category,
  total_amount, currency, split_bp, verification_status,
  settlement_period, previous_hash, record_hash, ip_address, expense_date, is_seed
) VALUES
('demo-family-thomson','demo-user-sarah','demo-user-mark',
 'Year 9 school trip to Paris','education',
 89500,'GBP',5000,'approved',
 '2026-Q1',
 'aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899',
 '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff',
 '127.0.0.1','2026-01-15',1),

('demo-family-thomson','demo-user-mark','demo-user-sarah',
 'Ellie school uniform & PE kit','clothing',
 13500,'GBP',5000,'approved',
 '2026-Q1',
 '11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff',
 'aa00bb11cc22dd33ee44ff55aa00bb11cc22dd33ee44ff55aa00bb11cc22dd33',
 '127.0.0.1','2026-02-03',1),

('demo-family-thomson','demo-user-sarah','demo-user-mark',
 'Jake GP appointment + prescription','medical',
 2500,'GBP',5000,'approved',
 '2026-Q1',
 'ff00ee11dd22cc33bb44aa55ff00ee11dd22cc33bb44aa55ff00ee11dd22cc33',
 '99887766554433221100ffeeddccbbaa99887766554433221100ffeeddccbbaa',
 '127.0.0.1','2026-02-18',1),

('demo-family-thomson','demo-user-sarah','demo-user-mark',
 'After-school drama club (Ellie, Spring term)','activities',
 18000,'GBP',5000,'pending',
 '2026-Q2',
 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
 '9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba',
 '127.0.0.1','2026-04-01',1);

-- ── 7. Update insight_snapshots W19 with real scores and pre-cached briefings ─
-- This prevents the live AI call on first demo load and shows meaningful trends.
-- Scores computed to match the completions data above:
--   Ellie: consistency ~85 (very steady, 2–3 tasks/week), responsibility ~87 (27/30 first-time)
--   Jake:  consistency ~72 (slightly less regular), responsibility ~80 (16/20 first-time)

UPDATE insight_snapshots
SET
  consistency_score    = 85,
  responsibility_score = 87,
  planning_horizon     = 72,
  total_earned_pence   = 27500,
  observation          = 'Ellie has completed 30 chores over 6 months with a first-time pass rate of 87% — she rarely needs to redo work. Her consistency score of 85 reflects steady, predictable weekly effort.',
  behavioral_root      = 'Pillar 2 (Deferred Gratification) — Ellie demonstrates patient, goal-directed earning. Every penny earned is tracked against her trainers goal and she has not dipped into savings once.',
  the_nudge            = 'Ellie is on track to reach her trainers goal within 3 weeks at current pace. A small parent match of £5 on the final stretch would reinforce that consistent effort earns meaningful rewards.'
WHERE child_id = 'demo-child-ellie' AND snapshot_date = '2026-W19';

UPDATE insight_snapshots
SET
  consistency_score    = 72,
  responsibility_score = 80,
  planning_horizon     = 45,
  total_earned_pence   = 16750,
  observation          = 'Jake has completed 20 chores over 6 months with a first-time pass rate of 80%. His consistency score of 72 shows he is generally reliable but has occasional quiet weeks.',
  behavioral_root      = 'Pillar 1 (Earning & Effort) — Jake understands the earning loop and responds well to clear, concrete chore assignments. He is building the habit of regular contribution.',
  the_nudge            = 'Jake has £15.30 saved toward his gaming headset — he is 21% of the way there. Setting a visible countdown (e.g. a sticker chart or app goal progress) could boost his motivation over the next month.'
WHERE child_id = 'demo-child-jake' AND snapshot_date = '2026-W19';

-- Also update W18 snapshots so trend deltas are meaningful (prior week scores slightly lower)
UPDATE insight_snapshots
SET
  consistency_score    = 78,
  responsibility_score = 83,
  planning_horizon     = 68,
  total_earned_pence   = 24800
WHERE child_id = 'demo-child-ellie' AND snapshot_date = '2026-W18';

UPDATE insight_snapshots
SET
  consistency_score    = 68,
  responsibility_score = 76,
  planning_horizon     = 40,
  total_earned_pence   = 14200
WHERE child_id = 'demo-child-jake' AND snapshot_date = '2026-W18';
