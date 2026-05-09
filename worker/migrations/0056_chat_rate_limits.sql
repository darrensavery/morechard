-- Chat AI rate limiting: max 20 messages per child per rolling hour
CREATE TABLE IF NOT EXISTS chat_rate_limits (
  child_id     TEXT    PRIMARY KEY,
  attempts     INTEGER NOT NULL DEFAULT 0,
  window_start INTEGER NOT NULL  -- Unix epoch seconds
);
