/**
 * Per-child controls — Approval Mode override, Pocket Money Status (pause),
 * and Safety Net (overdraft) override.
 *
 * GET    /api/child-controls/:child_id             Current effective + override state
 * PATCH  /api/child-controls/:child_id/pause        Pause/resume this child's allowance — ungated,
 *                                                    reversible, any parent can flip it immediately.
 *
 * Approval Mode and Safety Net changes affect dispute resolution / debt
 * exposure, so — like the existing family-wide verify_mode — they go
 * through a mutual-consent handshake in co-parenting families:
 *
 * POST   /api/child-governance/request              Parent A requests a change
 * POST   /api/child-governance/:id/confirm           Parent B approves
 * POST   /api/child-governance/:id/reject            Parent B declines
 * GET    /api/child-governance?child_id=             Log for one child (pending + history)
 *
 * In a family with only one parent, the change is applied immediately (there
 * is no one to confirm it with) and logged as self-confirmed for the audit
 * trail, mirroring how /api/governance/request behaves for the family-wide
 * setting once a second parent exists — see family_governance_log.
 */

import { Env } from '../types.js';
import { json, error, clientIp } from '../lib/response.js';
import type { JwtPayload } from '../lib/jwt.js';
import { z } from 'zod';
import { parseValidatedBody } from '../lib/validate.js';

type AuthedRequest = Request & { auth: JwtPayload };

const EXPIRY_SECONDS = 72 * 60 * 60; // 72 hours, matches family_governance_log

interface ChildRow {
  id: string;
  family_id: string;
  verify_mode_override: 'amicable' | 'standard' | null;
  allowance_paused: number;
  overdraft_enabled_override: number | null;
  overdraft_limit_pence_override: number | null;
}

async function loadChild(env: Env, childId: string, familyId: string): Promise<ChildRow | null> {
  return env.DB.prepare(`
    SELECT u.id, u.family_id, u.verify_mode_override, u.allowance_paused,
           u.overdraft_enabled_override, u.overdraft_limit_pence_override
    FROM users u JOIN family_roles fr ON fr.user_id = u.id
    WHERE u.id = ? AND fr.family_id = ? AND fr.role = 'child'
  `).bind(childId, familyId).first<ChildRow>();
}

// Any parent besides the caller currently in this family — used to decide
// whether a change needs the mutual-consent handshake or can apply now.
async function hasOtherParent(env: Env, familyId: string, callerId: string): Promise<boolean> {
  const row = await env.DB.prepare(`
    SELECT 1 FROM family_roles WHERE family_id = ? AND role = 'parent' AND user_id != ? LIMIT 1
  `).bind(familyId, callerId).first();
  return !!row;
}

// ----------------------------------------------------------------
// GET /api/child-controls/:child_id
// ----------------------------------------------------------------
export async function handleChildControlsGet(
  request: Request, env: Env, childId: string,
): Promise<Response> {
  const auth = (request as AuthedRequest).auth;
  if (auth.role !== 'parent') return error('Only parents can read child controls', 403);

  const child = await loadChild(env, childId, auth.family_id);
  if (!child) return error('Child not found', 404);

  const family = await env.DB.prepare('SELECT verify_mode, overdraft_enabled, overdraft_limit_pence FROM families WHERE id = ?')
    .bind(auth.family_id)
    .first<{ verify_mode: 'amicable' | 'standard'; overdraft_enabled: number; overdraft_limit_pence: number }>();
  if (!family) return error('Family not found', 404);

  const pendingRow = await env.DB.prepare(`
    SELECT id FROM child_governance_log WHERE child_id = ? AND status = 'pending' LIMIT 1
  `).bind(childId).first();

  return json({
    family_verify_mode: family.verify_mode,
    verify_mode_override: child.verify_mode_override,
    effective_verify_mode: child.verify_mode_override ?? family.verify_mode,

    allowance_paused: !!child.allowance_paused,

    family_overdraft_enabled: !!family.overdraft_enabled,
    family_overdraft_limit_pence: family.overdraft_limit_pence,
    overdraft_enabled_override: child.overdraft_enabled_override === null ? null : !!child.overdraft_enabled_override,
    overdraft_limit_pence_override: child.overdraft_limit_pence_override,
    effective_overdraft_enabled: child.overdraft_enabled_override === null
      ? !!family.overdraft_enabled
      : !!child.overdraft_enabled_override,
    effective_overdraft_limit_pence: child.overdraft_limit_pence_override ?? family.overdraft_limit_pence,

    has_pending_request: !!pendingRow,
  });
}

// ----------------------------------------------------------------
// PATCH /api/child-controls/:child_id/pause
// Body: { paused: boolean }
// Ungated — reversible, operational, no debt/dispute exposure — so either
// parent can flip it immediately, same as toggling a child's App View.
// ----------------------------------------------------------------
const pauseSchema = z.object({ paused: z.boolean() });

export async function handleChildAllowancePauseUpdate(
  request: Request, env: Env, childId: string,
): Promise<Response> {
  const auth = (request as AuthedRequest).auth;
  if (auth.role !== 'parent') return error('Only parents can update this', 403);

  const parsed = await parseValidatedBody(request, pauseSchema);
  if (parsed instanceof Response) return parsed;

  const child = await loadChild(env, childId, auth.family_id);
  if (!child) return error('Child not found', 404);

  await env.DB.prepare('UPDATE users SET allowance_paused = ? WHERE id = ?')
    .bind(parsed.paused ? 1 : 0, childId)
    .run();

  await env.CACHE.delete(`user:settings:${childId}`);

  return json({ ok: true, allowance_paused: parsed.paused });
}

// ----------------------------------------------------------------
// POST /api/child-governance/request
// Body: { child_id, setting: 'verify_mode' | 'overdraft', new_value }
//   verify_mode new_value: 'amicable' | 'standard' | 'inherit' (inherit clears the override)
//   overdraft   new_value: { enabled: boolean; limit_pence: number } | 'inherit'
// ----------------------------------------------------------------
const governanceRequestSchema = z.object({
  child_id: z.string().min(1),
  setting:  z.enum(['verify_mode', 'overdraft']),
  new_value: z.union([
    z.enum(['amicable', 'standard', 'inherit']),
    z.object({ enabled: z.boolean(), limit_pence: z.number().int().min(0) }),
  ]),
});

function applyChildSettingSql(setting: 'verify_mode' | 'overdraft', newValue: unknown): { sql: string; args: unknown[] } {
  if (setting === 'verify_mode') {
    const v = newValue === 'inherit' ? null : newValue as string;
    return { sql: 'UPDATE users SET verify_mode_override = ? WHERE id = ?', args: [v] };
  }
  if (newValue === 'inherit') {
    return { sql: 'UPDATE users SET overdraft_enabled_override = NULL, overdraft_limit_pence_override = NULL WHERE id = ?', args: [] };
  }
  const { enabled, limit_pence } = newValue as { enabled: boolean; limit_pence: number };
  return { sql: 'UPDATE users SET overdraft_enabled_override = ?, overdraft_limit_pence_override = ? WHERE id = ?', args: [enabled ? 1 : 0, limit_pence] };
}

function currentValueFor(setting: 'verify_mode' | 'overdraft', child: ChildRow): string {
  if (setting === 'verify_mode') return child.verify_mode_override ?? 'inherit';
  if (child.overdraft_enabled_override === null) return 'inherit';
  return JSON.stringify({ enabled: !!child.overdraft_enabled_override, limit_pence: child.overdraft_limit_pence_override ?? 0 });
}

function encodeNewValue(setting: 'verify_mode' | 'overdraft', newValue: unknown): string {
  if (setting === 'verify_mode') return newValue as string;
  return newValue === 'inherit' ? 'inherit' : JSON.stringify(newValue);
}

export async function handleChildGovernanceRequest(request: Request, env: Env): Promise<Response> {
  const auth = (request as AuthedRequest).auth;
  if (auth.role !== 'parent') return error('Only parents can change this', 403);

  const parsed = await parseValidatedBody(request, governanceRequestSchema);
  if (parsed instanceof Response) return parsed;
  const { child_id, setting, new_value } = parsed;

  const child = await loadChild(env, child_id, auth.family_id);
  if (!child) return error('Child not found', 404);

  const currentValue = currentValueFor(setting, child);
  const newValueEncoded = encodeNewValue(setting, new_value);
  if (currentValue === newValueEncoded) return error('Child is already set to that value');

  const now = Math.floor(Date.now() / 1000);
  const ip  = clientIp(request);

  const needsConsent = await hasOtherParent(env, auth.family_id, auth.sub);

  if (!needsConsent) {
    // Solo parent — nothing to reach consensus with, apply now.
    const { sql, args } = applyChildSettingSql(setting, new_value);
    await env.DB.batch([
      env.DB.prepare(sql).bind(...args, child_id),
      env.DB.prepare(`
        INSERT INTO child_governance_log
          (family_id, child_id, requested_by, confirmed_by, setting, old_value, new_value, status, requested_at, expires_at, confirmed_at, request_ip, confirm_ip)
        VALUES (?,?,?,?,?,?,?,'confirmed',?,?,?,?,?)
      `).bind(auth.family_id, child_id, auth.sub, auth.sub, setting, currentValue, newValueEncoded, now, now + EXPIRY_SECONDS, now, ip, ip),
    ]);
    await env.CACHE.delete(`user:settings:${child_id}`);
    return json({ status: 'confirmed' }, 200);
  }

  // Block if a pending request already exists for this (child, setting) pair
  const existing = await env.DB.prepare(`
    SELECT id FROM child_governance_log WHERE child_id = ? AND setting = ? AND status = 'pending' LIMIT 1
  `).bind(child_id, setting).first();
  if (existing) return error('A pending request already exists for this setting', 409);

  const result = await env.DB.prepare(`
    INSERT INTO child_governance_log
      (family_id, child_id, requested_by, setting, old_value, new_value, status, requested_at, expires_at, request_ip)
    VALUES (?,?,?,?,?,?,'pending',?,?,?)
  `).bind(auth.family_id, child_id, auth.sub, setting, currentValue, newValueEncoded, now, now + EXPIRY_SECONDS, ip).run();

  return json({ governance_request_id: result.meta.last_row_id, expires_at: now + EXPIRY_SECONDS }, 201);
}

interface ChildGovRow {
  id: number; family_id: string; child_id: string; requested_by: string;
  setting: 'verify_mode' | 'overdraft'; new_value: string;
  status: string; expires_at: number;
}

export async function handleChildGovernanceConfirm(request: Request, env: Env, requestId: string): Promise<Response> {
  const auth = (request as AuthedRequest).auth;
  if (auth.role !== 'parent') return error('Only parents can confirm this', 403);
  const confirmed_by = auth.sub;
  const now = Math.floor(Date.now() / 1000);
  const ip  = clientIp(request);

  const row = await env.DB.prepare('SELECT * FROM child_governance_log WHERE id = ?')
    .bind(requestId).first<ChildGovRow>();
  if (!row) return error('Request not found', 404);
  if (row.family_id !== auth.family_id) return error('Request not found', 404);
  if (row.status !== 'pending') return error(`Request is already ${row.status}`);
  if (now > row.expires_at) return error('Request has expired');
  if (row.requested_by === confirmed_by) return error('The requesting parent cannot confirm their own request');

  const decodedValue: unknown = row.setting === 'overdraft' && row.new_value !== 'inherit'
    ? JSON.parse(row.new_value) : row.new_value;
  const { sql, args } = applyChildSettingSql(row.setting, decodedValue);

  await env.DB.batch([
    env.DB.prepare(sql).bind(...args, row.child_id),
    env.DB.prepare(`
      UPDATE child_governance_log SET status = 'confirmed', confirmed_by = ?, confirmed_at = ?, confirm_ip = ? WHERE id = ?
    `).bind(confirmed_by, now, ip, requestId),
  ]);
  await env.CACHE.delete(`user:settings:${row.child_id}`);

  return json({ status: 'confirmed' });
}

export async function handleChildGovernanceReject(request: Request, env: Env, requestId: string): Promise<Response> {
  const auth = (request as AuthedRequest).auth;
  if (auth.role !== 'parent') return error('Only parents can reject this', 403);
  const rejected_by = auth.sub;
  const now = Math.floor(Date.now() / 1000);
  const ip  = clientIp(request);

  const row = await env.DB.prepare('SELECT family_id, status FROM child_governance_log WHERE id = ?')
    .bind(requestId).first<{ family_id: string; status: string }>();
  if (!row) return error('Request not found', 404);
  if (row.family_id !== auth.family_id) return error('Request not found', 404);
  if (row.status !== 'pending') return error(`Request is already ${row.status}`);

  await env.DB.prepare(`
    UPDATE child_governance_log SET status = 'rejected', confirmed_by = ?, confirmed_at = ?, confirm_ip = ? WHERE id = ?
  `).bind(rejected_by, now, ip, requestId).run();

  return json({ status: 'rejected' });
}

// ----------------------------------------------------------------
// GET /api/child-governance?child_id=
// ----------------------------------------------------------------
export async function handleChildGovernanceGet(request: Request, env: Env): Promise<Response> {
  const auth = (request as AuthedRequest).auth;
  if (auth.role !== 'parent') return error('Only parents can read this', 403);
  const url = new URL(request.url);
  const child_id = url.searchParams.get('child_id');
  if (!child_id) return error('child_id required');

  const { results } = await env.DB.prepare(`
    SELECT * FROM child_governance_log WHERE child_id = ? AND family_id = ? ORDER BY id DESC
  `).bind(child_id, auth.family_id).all();

  return json({ log: results });
}
