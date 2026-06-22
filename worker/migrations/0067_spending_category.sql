-- Migration 0067: categorise spending so families can track what children
-- buy over time. Nullable — existing rows stay uncategorised ('other' at read
-- time); the Spend Guide sets it on every new entry going forward.
ALTER TABLE spending ADD COLUMN category TEXT;

-- Supports per-family category breakdowns (spend-over-time analytics).
CREATE INDEX IF NOT EXISTS idx_spending_category ON spending (family_id, category, spent_at DESC);
