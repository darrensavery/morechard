-- worker/migrations/0066_chore_promotion_candidates.sql
-- Item 8: promote popular child suggestions into the app-wide market_rates library.
--
-- The weekly aggregation job clusters novel child suggestions (ones NOT already
-- in market_rates) by a normalised title key + locale, counts DISTINCT FAMILIES
-- (not raw suggestions — one keen child can't manufacture a trend), and parks any
-- cluster that clears the promotion threshold here as a PENDING candidate for
-- manual operator review. Promotion into market_rates is a deliberate, human step.
--
-- Lifecycle:  pending → promoted  (operator approved → row inserted into market_rates)
--             pending → dismissed (operator rejected → never resurfaced)
-- A dismissed cluster is remembered so the job does not re-surface it every week.

CREATE TABLE chore_promotion_candidates (
  id                TEXT    PRIMARY KEY,

  -- Clustering identity
  normalized_key    TEXT    NOT NULL,   -- lowercased/trimmed/whitespace-collapsed title
  locale            TEXT    NOT NULL,   -- 'en-GB' | 'en-US' | 'pl' (derived from family currency)
  display_name      TEXT    NOT NULL,   -- most common raw title in the cluster (Title Cased)
  category          TEXT    NOT NULL DEFAULT 'Good Habits',

  -- Signal
  distinct_families INTEGER NOT NULL DEFAULT 0,  -- the promotion gate
  suggestion_count  INTEGER NOT NULL DEFAULT 0,  -- total raw suggestions in cluster
  median_amount     INTEGER,                     -- trimmed median proposed amount, minor units
  sample_titles     TEXT    NOT NULL DEFAULT '[]', -- JSON: example raw titles for review context

  -- Review state
  status            TEXT    NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending','promoted','dismissed')),
  emailed_at        INTEGER,            -- set once included in an operator digest (don't re-alert)
  reviewed_at       INTEGER,
  market_rate_id    TEXT,               -- FK into market_rates once promoted

  first_seen_at     INTEGER NOT NULL DEFAULT (unixepoch()),
  last_seen_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at        INTEGER NOT NULL DEFAULT (unixepoch())
);

-- One row per cluster per locale. The job UPSERTs on this key as counts grow.
CREATE UNIQUE INDEX idx_promotion_candidates_key
  ON chore_promotion_candidates (normalized_key, locale);

-- Fast lookups for the operator review queue and the digest.
CREATE INDEX idx_promotion_candidates_status
  ON chore_promotion_candidates (status, distinct_families DESC);
