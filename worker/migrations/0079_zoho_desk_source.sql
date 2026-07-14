-- 0079_zoho_desk_source.sql
-- Rebuilds agent_incidents to swap the 'freshdesk' source enum value for
-- 'zoho_desk' (Freshdesk → Zoho Desk migration, see
-- docs/superpowers/plans/2026-07-14-freshdesk-to-zoho-desk-migration.md).
-- SQLite has no ALTER TABLE ... DROP CONSTRAINT, so this is a table
-- rebuild. Confirmed zero 'freshdesk' rows exist before this migration.

CREATE TABLE agent_incidents_new (
  id                   TEXT PRIMARY KEY,
  source               TEXT NOT NULL CHECK (source IN ('zoho_desk','sentry','in_app','stripe')),
  source_ref           TEXT NOT NULL,
  user_facing          INTEGER NOT NULL CHECK (user_facing IN (0,1)),
  family_id            TEXT,
  related_incident_id  TEXT REFERENCES agent_incidents_new(id),
  raw_payload          TEXT NOT NULL,
  occurrence_count     INTEGER NOT NULL DEFAULT 1,
  status               TEXT NOT NULL DEFAULT 'received'
                       CHECK (status IN ('received','diagnosing','resolved_auto','escalated','approved','declined','failed')),
  created_at           INTEGER NOT NULL DEFAULT (unixepoch()),
  resolved_at          INTEGER
);

INSERT INTO agent_incidents_new SELECT * FROM agent_incidents;

DROP TABLE agent_incidents;
ALTER TABLE agent_incidents_new RENAME TO agent_incidents;

CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_incidents_open_source_ref
  ON agent_incidents (source, source_ref)
  WHERE status IN ('received','diagnosing','escalated');

CREATE INDEX IF NOT EXISTS idx_agent_incidents_family
  ON agent_incidents (family_id);
