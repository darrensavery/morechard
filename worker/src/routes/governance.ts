/**
 * Governance routes — Mutual Consent Handshake for verify_mode changes.
 *
 * Flow:
 *   1. Parent A  → POST /api/governance/request   (initiates mode change)
 *   2. Parent B  → POST /api/governance/:id/confirm  (approves)
 *            or → POST /api/governance/:id/reject    (rejects)
 *   3. Cron / request middleware → POST /api/governance/expire  (marks stale requests)
 *
 * A request expires after 72 hours if not actioned by the second parent.
 * ALL outcomes (confirmed, rejected, expired) are retained in the log — they
 * are part of the legal audit trail and must never be deleted.
 */

import { Env } from '../types.js';
import { json, error, clientIp } from '../lib/response.js';

const EXPIRY_SECONDS = 72 * 60 * 60; // 72 hours

// ----------------------------------------------------------------
// POST /api/governance/request
// Body: { family_id, requested_by, new_mode }
// ----------------------------------------------------------------
export async function handleGovernanceRequest(request: Request, env: Env): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return error('Invalid JSON body');
  }

  const { family_id, requested_by, new_mode } = body;
  if (!family_id   || typeof family_id   !== 'string') return error('family_id required');
  if (!requested_by || typeof requested_by !== 'string') return error('requested_by required');
  if (!new_mode || !['amicable','standard'].includes(new_mode as string)) return error('Invalid new_mode');

  // Fetch current mode
  const family = await env.DB
    .prepare('SELECT verify_mode FROM families WHERE id = ?')
    .bind(family_id)
    .first<{ verify_mode: string }>();
  if (!family) return error('Family not found', 404);

  if (family.verify_mode === new_mode) return error('Family is already in that mode');

  // Block if a pending request already exists for this family
  const existing = await env.DB
    .prepare(`SELECT id FROM family_governance_log
              WHERE family_id = ? AND status = 'pending' LIMIT 1`)
    .bind(family_id)
    .first<{ id: number }>();
  if (existing) return error('A pending governance request already exists for this family', 409);

  const now = Math.floor(Date.now() / 1000);
  const ip  = clientIp(request);

  const result = await env.DB
    .prepare(`
      INSERT INTO family_governance_log
        (family_id, requested_by, old_mode, new_mode, status, requested_at, expires_at, request_ip)
      VALUES (?,?,?,?,?,?,?,?)
    `)
    .bind(family_id, requested_by, family.verify_mode, new_mode, 'pending', now, now + EXPIRY_SECONDS, ip)
    .run();

  return json({ governance_request_id: result.meta.last_row_id, expires_at: now + EXPIRY_SECONDS }, 201);
}

// ----------------------------------------------------------------
// POST /api/governance/:id/confirm
// Body: { confirmed_by }
// ----------------------------------------------------------------
export async function handleGovernanceConfirm(
  request: Request,
  env: Env,
  requestId: string,
): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return error('Invalid JSON body');
  }

  const { confirmed_by } = body;
  if (!confirmed_by || typeof confirmed_by !== 'string') return error('confirmed_by required');

  const now = Math.floor(Date.now() / 1000);
  const ip  = clientIp(request);

  const govRow = await env.DB
    .prepare('SELECT * FROM family_governance_log WHERE id = ?')
    .bind(requestId)
    .first<{
      id: number; family_id: string; requested_by: string;
      new_mode: string; status: string; expires_at: number;
    }>();

  if (!govRow) return error('Governance request not found', 404);
  if (govRow.status !== 'pending')  return error(`Request is already ${govRow.status}`);
  if (now > govRow.expires_at)      return error('Request has expired');
  if (govRow.requested_by === confirmed_by) return error('The requesting parent cannot confirm their own request');

  // Atomic: update governance log + apply mode change to family
  await env.DB.batch([
    env.DB.prepare(`
      UPDATE family_governance_log
      SET status = 'confirmed', confirmed_by = ?, confirmed_at = ?, confirm_ip = ?
      WHERE id = ?
    `).bind(confirmed_by, now, ip, requestId),

    env.DB.prepare(`
      UPDATE families SET verify_mode = ? WHERE id = ?
    `).bind(govRow.new_mode, govRow.family_id),
  ]);

  return json({ status: 'confirmed', new_mode: govRow.new_mode });
}

// ----------------------------------------------------------------
// POST /api/governance/:id/reject
// Body: { rejected_by }
// ----------------------------------------------------------------
export async function handleGovernanceReject(
  request: Request,
  env: Env,
  requestId: string,
): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return error('Invalid JSON body');
  }

  const { rejected_by } = body;
  if (!rejected_by || typeof rejected_by !== 'string') return error('rejected_by required');

  const now = Math.floor(Date.now() / 1000);
  const ip  = clientIp(request);

  const govRow = await env.DB
    .prepare('SELECT status, expires_at, requested_by FROM family_governance_log WHERE id = ?')
    .bind(requestId)
    .first<{ status: string; expires_at: number; requested_by: string }>();

  if (!govRow) return error('Governance request not found', 404);
  if (govRow.status !== 'pending') return error(`Request is already ${govRow.status}`);

  await env.DB
    .prepare(`
      UPDATE family_governance_log
      SET status = 'rejected', confirmed_by = ?, confirmed_at = ?, confirm_ip = ?
      WHERE id = ?
    `)
    .bind(rejected_by, now, ip, requestId)
    .run();

  return json({ status: 'rejected' });
}

// ----------------------------------------------------------------
// POST /api/governance/expire
// Called by a Cloudflare Cron Trigger (or manually) to expire stale requests.
// ----------------------------------------------------------------
export async function handleGovernanceExpire(_request: Request, env: Env): Promise<Response> {
  const now = Math.floor(Date.now() / 1000);

  const result = await env.DB
    .prepare(`
      UPDATE family_governance_log
      SET status = 'expired'
      WHERE status = 'pending' AND expires_at < ?
    `)
    .bind(now)
    .run();

  return json({ expired: result.meta.changes });
}

// ----------------------------------------------------------------
// GET /api/governance?family_id=
// ----------------------------------------------------------------
export async function handleGovernanceGet(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const family_id = url.searchParams.get('family_id');
  if (!family_id) return error('family_id required');

  const { results } = await env.DB
    .prepare('SELECT * FROM family_governance_log WHERE family_id = ? ORDER BY id DESC')
    .bind(family_id)
    .all();

  // Attach human-readable action_taken label for PDF export / UI display
  const log = (results as Array<Record<string, unknown>>).map(row => ({
    ...row,
    action_taken: row['new_mode'] === 'amicable'
      ? 'Enabled Auto-Verify (Amicable Mode)'
      : 'Enabled Manual Approval (Standard Mode)',
  }));

  return json({ log });
}
