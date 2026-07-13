/**
 * Phase 0 orchestrator. Runs the full diagnosis pipeline for one incident
 * and writes the outcome to agent_review_items. NEVER executes an AUTO or
 * GATED tool, and NEVER sends a customer message — Phase 0 is shadow mode
 * (design spec §9). Only invokeReadTool is ever called.
 */
import { Env } from '../../types.js';
import { nanoid } from '../nanoid.js';
import { resolveFamilyIdentity } from './identity.js';
import { invokeReadTool } from './registry.js';
import { registerReadTools } from './tools/readTools.js';
import { getPlaybookBundle } from './playbook.js';
import { writeAgentActionLogEntry } from './actionLog.js';
import { runTriage } from './triage.js';
import { runDiagnosis } from './diagnose.js';

let readToolsRegistered = false;
function ensureReadToolsRegistered(): void {
  if (readToolsRegistered) return;
  registerReadTools();
  readToolsRegistered = true;
}

/**
 * Extracts the body of a top-level (#) markdown section matching the given
 * category slug. Matches on the LEADING NUMBER (e.g. '06' from
 * '06-billing-payments-stripe'), not fuzzy text containment — every
 * docs/support/*.md file's H1 heading starts with the same two-digit
 * number as its filename, so number matching is exact and unambiguous,
 * unlike substring matching (which can false-positive across sections
 * sharing a common word, or fail to match at all if the heading text is
 * shorter than the full slug).
 */
export function extractPlaybookSection(bundle: string, categorySlug: string): string {
  if (categorySlug === 'novel') return '(no matching playbook section — novel incident)';

  const slugNumberMatch = categorySlug.match(/^(\d+)-/);
  if (!slugNumberMatch) return '(no matching playbook section — novel incident)';
  const slugNumber = slugNumberMatch[1];

  const lines = bundle.split('\n');
  const sectionStarts: number[] = [];
  lines.forEach((line, i) => { if (/^# /.test(line)) sectionStarts.push(i); });

  for (let s = 0; s < sectionStarts.length; s++) {
    const start = sectionStarts[s];
    const headingNumberMatch = lines[start].match(/^#\s*(\d+)/);
    if (headingNumberMatch && headingNumberMatch[1] === slugNumber) {
      const end = s + 1 < sectionStarts.length ? sectionStarts[s + 1] : lines.length;
      return lines.slice(start, end).join('\n').trim();
    }
  }
  return '(no matching playbook section — novel incident)';
}

interface IncidentRow {
  id: string;
  source: string;
  source_ref: string;
  user_facing: number;
  raw_payload: string;
}

export async function processIncident(env: Env, incidentId: string): Promise<void> {
  ensureReadToolsRegistered();

  const incident = await env.DB
    .prepare('SELECT id, source, source_ref, user_facing, raw_payload FROM agent_incidents WHERE id = ?')
    .bind(incidentId)
    .first<IncidentRow>();
  if (!incident) return; // dedup or a race — nothing to process

  await env.DB.prepare('UPDATE agent_incidents SET status = ? WHERE id = ?').bind('diagnosing', incidentId).run();

  const bundle = await getPlaybookBundle(env);
  const playbookToc = bundle
    ? bundle.content.split('\n').filter(l => /^# /.test(l)).join('\n')
    : '(playbook not yet seeded — see docs/dev/support-agent-runbook.md)';

  const incidentText = incident.raw_payload;

  // ── Triage: candidate identifiers are RAW TEXT ONLY at this point ──────
  const triage = await runTriage(env, playbookToc, incidentText);

  // ── Deterministic identity resolution — the only path to a family_id ───
  const resolved = triage.candidateEmail
    ? await resolveFamilyIdentity(env.DB, triage.candidateEmail)
    : null;

  if (resolved) {
    await env.DB.prepare('UPDATE agent_incidents SET family_id = ? WHERE id = ?').bind(resolved.familyId, incidentId).run();
  }

  // ── READ-tier tools only — Phase 0 never calls invokeAutoTool/invokeGatedTool (they don't exist yet) ──
  const readToolResults: Record<string, unknown> = {};
  if (resolved) {
    const toolCalls: Array<[string, Record<string, unknown>]> = [
      ['get_family_license_state', { familyId: resolved.familyId }],
      ['get_family_members', { familyId: resolved.familyId }],
      ['get_payment_audit_log', { familyId: resolved.familyId }],
      ['get_ledger_tail', { familyId: resolved.familyId }],
      ['get_login_attempt_state', { email: resolved.email }],
      ['get_active_sessions', { userId: resolved.userId }],
    ];
    for (const [toolName, payload] of toolCalls) {
      const result = await invokeReadTool(toolName, env, payload);
      readToolResults[toolName] = result;
      await writeAgentActionLogEntry(env.DB, {
        incidentId, actor: 'agent', toolName, tier: 'read', payload, result,
      });
    }
  }

  const playbookSection = extractPlaybookSection(bundle?.content ?? '', triage.category);

  const diagnosis = await runDiagnosis(env, {
    playbookSection,
    resolvedFamilyId: resolved?.familyId ?? null,
    readToolResults,
    incidentText,
  });

  const reviewItemId = nanoid();
  await env.DB
    .prepare(`
      INSERT INTO agent_review_items
        (id, incident_id, diagnosis, recommended_tier, recommended_tool, recommended_payload,
         payload_hash, draft_reply, confidence, category, queue_bucket)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
    `)
    .bind(
      reviewItemId, incidentId, diagnosis.diagnosis, diagnosis.recommendedTier, diagnosis.recommendedTool,
      diagnosis.recommendedPayload ? JSON.stringify(diagnosis.recommendedPayload) : null,
      diagnosis.payloadHash,
      // Phase 0 never sends a reply — a draft is still stored for reviewer validation,
      // but ONLY when the source incident is user_facing (Sentry incidents never get one).
      incident.user_facing === 1 ? diagnosis.draftReply : null,
      diagnosis.confidence, diagnosis.category, diagnosis.queueBucket,
    )
    .run();

  await env.DB.prepare('UPDATE agent_incidents SET status = ?, resolved_at = unixepoch() WHERE id = ?')
    .bind('escalated', incidentId)
    .run();
}
