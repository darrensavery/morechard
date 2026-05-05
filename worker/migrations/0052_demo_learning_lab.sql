-- 0052_demo_learning_lab.sql
-- Seeds unlocked Learning Lab modules for Ellie Thomson in the demo family.
-- Ellie (age 13, 6 months of chore history) has worked through 3 modules.
--
-- Timestamps relative to 2026-05-05 (today):
--   ~16 weeks ago = 1746230400 - (16 * 7 * 86400) = ~1736518400  (Jan 2026)
--   ~10 weeks ago = 1746230400 - (10 * 7 * 86400) = ~1740443200  (Feb 2026)
--   ~4 weeks ago  = 1746230400 - (4  * 7 * 86400) = ~1743638400  (Apr 2026)

INSERT OR IGNORE INTO unlocked_modules (id, child_id, module_slug, unlocked_at)
VALUES
  ('demo-mod-ellie-1', 'demo-child-ellie', 'patience-tree',     1736518400),
  ('demo-mod-ellie-2', 'demo-child-ellie', 'compound-interest', 1740443200),
  ('demo-mod-ellie-3', 'demo-child-ellie', 'effort-vs-reward',  1743638400);
