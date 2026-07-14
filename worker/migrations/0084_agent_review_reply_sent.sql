-- 0084_agent_review_reply_sent.sql
-- Tracks whether a review item's draft_reply has been sent to the customer
-- via the /admin "Send Reply" button (routes/agentReview.ts). Deliberately
-- independent of `status` (which tracks the recommended AUTO-tool's
-- execution) — a reply can be sent with or without an AUTO tool having run.

ALTER TABLE agent_review_items ADD COLUMN reply_sent_at INTEGER;
