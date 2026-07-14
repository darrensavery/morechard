/**
 * Orchestrator. Runs the full diagnosis pipeline for one incident and
 * writes the outcome to agent_review_items. Still never sends a customer
 * message and never executes a GATED tool — but for the single AUTO-tier
 * tool that exists (resend_magic_link), an eligible diagnosis gets a
 * one-tap "Approve" link in the review email (reviewNotify.ts). The tool
 * itself only ever fires when that link is clicked — nothing in this file
 * calls invokeAutoTool directly. A human still taps approve every time;
 * the AI does everything up to that point. See gating.ts's docstring for
 * why: "never whether something executes without a human."
 */
import { Env } from '../../types.js';
import { nanoid } from '../nanoid.js';
import { resolveFamilyIdentity } from './identity.js';
import { invokeReadTool } from './registry.js';
import { registerReadTools } from './tools/readTools.js';
import { registerAutoTools } from './tools/autoTools.js';
import { getPlaybookBundle } from './playbook.js';
import { writeAgentActionLogEntry } from './actionLog.js';
import { runTriage } from './triage.js';
import { runDiagnosis } from './diagnose.js';
import { notifyNewReviewItem } from './reviewNotify.js';
import { generateApprovalToken } from './approvalTokens.js';
import { countDistinctMagicLinkTriggerTickets, classifyHarassmentSignal } from './harassmentWatch.js';
import { computeDeterministicPayloadHash } from './gating.js';

let toolsRegistered = false;
function ensureToolsRegistered(): void {
  if (toolsRegistered) return;
  registerReadTools();
  registerAutoTools();
  toolsRegistered = true;
}

export interface OneTapEligibilityInput {
  recommendedTool: string | null;
  queueBucket: 'recommended_approve' | 'needs_review';
  resolvedEmail: string | null;
  harassmentSignalTripped: boolean;
}

/**
 * Whether a diagnosis qualifies for the one-tap "Approve" link. Deliberately
 * narrow: only the one AUTO-tier tool that exists, only the confidence
 * bucket gating.ts already reserves for pre-filled approval, only when a
 * real identity was resolved (never act on an unresolved email), and never
 * when the harassment-watch signal is tripped for this email (routes to a
 * normal human-reviewed item instead — the signal is a passive routing
 * hint, never a hard block, per harassmentWatch.ts's own design note).
 */
export function isOneTapEligible(input: OneTapEligibilityInput): boolean {
  if (input.recommendedTool !== 'resend_magic_link') return false;
  if (input.queueBucket !== 'recommended_approve') return false;
  if (!input.resolvedEmail) return false;
  if (input.harassmentSignalTripped) return false;
  return true;
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
  status: string;
}

export async function processIncident(env: Env, incidentId: string): Promise<void> {
  ensureToolsRegistered();

  const incident = await env.DB
    .prepare('SELECT id, source, source_ref, user_facing, raw_payload, status FROM agent_incidents WHERE id = ?')
    .bind(incidentId)
    .first<IncidentRow>();
  if (!incident) return; // dedup or a race — nothing to process
  if (incident.status === 'escalated') return; // already fully processed by a prior attempt (queue retry) — avoid duplicate review items/action-log entries/Claude calls

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

  // For resend_magic_link specifically, the EXECUTION payload is always
  // code-constructed from the deterministically-resolved identity, never
  // from the model's recommended_payload — the model's output there is
  // display-only. Without a resolved identity, this tool can never be
  // one-tap eligible, regardless of what the model claimed.
  let recommendedPayload = diagnosis.recommendedPayload;
  let payloadHash = diagnosis.payloadHash;
  let queueBucket = diagnosis.queueBucket;
  if (diagnosis.recommendedTool === 'resend_magic_link') {
    if (resolved) {
      recommendedPayload = { email: resolved.email };
      payloadHash = await computeDeterministicPayloadHash(recommendedPayload);
    } else {
      recommendedPayload = null;
      payloadHash = null;
      queueBucket = 'needs_review';
    }
  }

  const harassmentSignalTripped = resolved
    ? classifyHarassmentSignal(await countDistinctMagicLinkTriggerTickets(env, resolved.email))
    : false;

  const oneTapEligible = isOneTapEligible({
    recommendedTool: diagnosis.recommendedTool,
    queueBucket,
    resolvedEmail: resolved?.email ?? null,
    harassmentSignalTripped,
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
      recommendedPayload ? JSON.stringify(recommendedPayload) : null,
      payloadHash,
      // A draft is still stored for reviewer validation, but ONLY when the
      // source incident is user_facing (Sentry incidents never get one).
      incident.user_facing === 1 ? diagnosis.draftReply : null,
      diagnosis.confidence, diagnosis.category, queueBucket,
    )
    .run();

  await env.DB.prepare('UPDATE agent_incidents SET status = ?, resolved_at = unixepoch() WHERE id = ?')
    .bind('escalated', incidentId)
    .run();

  // Immediate, per-item notification — not a scheduled digest. Best-effort:
  // notifyNewReviewItem never throws, so a mail failure can't undo the
  // review item already written above.
  const approveToken = oneTapEligible ? await generateApprovalToken(env, reviewItemId) : null;
  await notifyNewReviewItem(env, {
    incidentId,
    source: incident.source,
    category: diagnosis.category,
    confidence: diagnosis.confidence,
    queueBucket,
    diagnosis: diagnosis.diagnosis,
    approveUrl: approveToken
      ? `${env.WORKER_URL}/api/support-agent/review/${reviewItemId}/approve?token=${approveToken}`
      : null,
  });
}
