-- Migration 0017: Add AI Executive Briefing columns to insight_snapshots
--
-- These three columns store the cached Orchard Lead mentor briefing.
-- They are NULL until the child exits the Discovery Phase and the first
-- AI inference completes. Subsequent loads within the same week return
-- the cached strings, bypassing the AI call entirely.

ALTER TABLE insight_snapshots ADD COLUMN observation      TEXT;
ALTER TABLE insight_snapshots ADD COLUMN behavioral_root  TEXT;
ALTER TABLE insight_snapshots ADD COLUMN the_nudge        TEXT;
