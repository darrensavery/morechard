-- 0071_insight_snapshot_jars.sql
-- jar_snapshot was added to production directly before this migration was formalised.
-- The column is now included in 0016_insight_snapshots.sql for fresh installs.
-- This migration is intentionally a no-op so the tracker marks it applied.
SELECT 1;
