// worker/src/routes/dsar.ts
//
// Public (unauthenticated) DSAR portal routes.
// See docs/superpowers/specs/2026-07-17-dsar-portal-design.md

import type { Env } from '../types.js';
import { json, error, parseBody } from '../lib/response.js';
import { sha256 } from '../lib/hash.js';
import { nanoid } from '../lib/nanoid.js';
import {
  sendDsarVerificationEmail,
  sendDsarClarificationEmail,
  sendDsarAccessLinkEmail,
} from '../lib/dsarEmail.js';
import {
  resolveChildByName,
  executeFamilyErasureSoleParent,
  executeFamilyErasureLeadWithCoparent,
  executeFamilyErasureNonLeadCoparent,
  executeChildErasure,
} from '../lib/dsarExecution.js';
import { handleExportJson } from './export.js';

export const DSAR_TOKEN_EXPIRY_S = 60 * 60; // 1 hour

const GENERIC_RESPONSE = {
  ok: true,
  message: 'If that email is on an account, you will receive a verification link shortly.',
};

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function handleDsarRequest(request: Request, env: Env): Promise<Response> {
  const body = await parseBody(request);
  if (!body) return error('Invalid request body', 400);

  const email = String(body.email ?? '').trim().toLowerCase();
  const requestType = body.request_type;
  const scope = body.scope;
  const childName = typeof body.child_name === 'string' ? body.child_name.trim() : undefined;

  if (!isValidEmail(email)) return error('A valid email address is required', 400);
  if (requestType !== 'access' && requestType !== 'erasure') {
    return error('request_type must be "access" or "erasure"', 400);
  }
  if (scope !== 'family' && scope !== 'child') return error('scope must be "family" or "child"', 400);
  if (scope === 'child' && !childName) return error('child_name is required when scope is "child"', 400);

  const parent = await env.DB
    .prepare(
      `SELECT u.id AS user_id, u.family_id FROM users u JOIN family_roles fr ON fr.user_id = u.id AND fr.family_id = u.family_id WHERE u.email = ? AND fr.role = 'parent'`,
    )
    .bind(email)
    .first<{ user_id: string; family_id: string }>();

  if (!parent) return json(GENERIC_RESPONSE);

  const rawToken = nanoid(32);
  const tokenHash = await sha256(rawToken);
  const now = Math.floor(Date.now() / 1000);
  const id = nanoid(21);

  await env.DB
    .prepare(
      `INSERT INTO dsar_requests
         (id, request_type, scope, target_family_id, target_child_name_raw, requester_email, matched_user_id, token_hash, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending_verification', ?)`,
    )
    .bind(id, requestType, scope, parent.family_id, scope === 'child' ? childName : null, email, parent.user_id, tokenHash, now)
    .run();

  const link = `${env.APP_URL}/api/dsar/verify?token=${rawToken}`;
  await sendDsarVerificationEmail(email, link, requestType, env);

  return json(GENERIC_RESPONSE);
}

interface DsarRequestRow {
  id: string;
  request_type: 'access' | 'erasure';
  scope: 'family' | 'child';
  target_family_id: string;
  target_child_name_raw: string | null;
  requester_email: string;
  matched_user_id: string;
}

function htmlResult(message: string, success: boolean): Response {
  return new Response(
    `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:480px;margin:80px auto;text-align:center;">
      <h2>${success ? 'Request received' : 'Unable to process request'}</h2>
      <p>${message}</p>
    </body></html>`,
    { status: success ? 200 : 400, headers: { 'Content-Type': 'text/html' } },
  );
}

export async function handleDsarVerify(request: Request, env: Env): Promise<Response> {
  const token = new URL(request.url).searchParams.get('token');
  if (!token) return htmlResult('Missing verification token.', false);

  const tokenHash = await sha256(token);
  const now = Math.floor(Date.now() / 1000);

  // Atomic claim — first statement, before any other work. Prevents a
  // double-click or email-prefetch from running execution twice: only the
  // instance that flips 0 pending_verification rows to processing loses.
  const claim = await env.DB
    .prepare(
      `UPDATE dsar_requests SET status = 'processing', verified_at = ?
       WHERE token_hash = ? AND status = 'pending_verification' AND created_at > ?`,
    )
    .bind(now, tokenHash, now - DSAR_TOKEN_EXPIRY_S)
    .run();

  if (!claim.meta.changes) {
    return htmlResult('This link has already been used or has expired. Please submit a new request.', false);
  }

  const dsarRequest = await env.DB
    .prepare(`SELECT id, request_type, scope, target_family_id, target_child_name_raw, requester_email, matched_user_id FROM dsar_requests WHERE token_hash = ?`)
    .bind(tokenHash)
    .first<DsarRequestRow>();

  if (!dsarRequest) return htmlResult('Request not found.', false);

  try {
    if (dsarRequest.request_type === 'erasure') {
      await executeErasure(env, dsarRequest);
    } else {
      await executeAccess(env, dsarRequest);
    }
  } catch (err) {
    console.error('[dsar] execution failed', err);
    return htmlResult('Something went wrong processing your request. Please contact support@morechard.com.', false);
  }

  return htmlResult('Your request has been processed. Check your email for confirmation.', true);
}

async function executeErasure(env: Env, req: DsarRequestRow): Promise<void> {
  if (req.scope === 'family') {
    const roleRow = await env.DB
      .prepare(`SELECT parent_role FROM family_roles WHERE family_id = ? AND user_id = ? AND role = 'parent'`)
      .bind(req.target_family_id, req.matched_user_id)
      .first<{ parent_role: string | null }>();

    const otherParents = await env.DB
      .prepare(`SELECT COUNT(*) AS cnt FROM family_roles WHERE family_id = ? AND role = 'parent' AND user_id != ?`)
      .bind(req.target_family_id, req.matched_user_id)
      .first<{ cnt: number }>();

    if ((otherParents?.cnt ?? 0) === 0) {
      await executeFamilyErasureSoleParent(env, req.target_family_id);
    } else if (roleRow?.parent_role === 'lead') {
      await executeFamilyErasureLeadWithCoparent(env, req.target_family_id, req.matched_user_id);
    } else {
      await executeFamilyErasureNonLeadCoparent(env, req.target_family_id, req.matched_user_id);
    }
  } else {
    const match = await resolveChildByName(env, req.target_family_id, req.target_child_name_raw ?? '');
    if (match.matched !== 'one') {
      await env.DB.prepare(`UPDATE dsar_requests SET status = 'needs_clarification' WHERE id = ?`).bind(req.id).run();
      await sendDsarClarificationEmail(req.requester_email, env);
      return;
    }
    await executeChildErasure(env, match.childId as string);
  }

  await env.DB
    .prepare(`UPDATE dsar_requests SET status = 'completed', executed_at = unixepoch() WHERE id = ?`)
    .bind(req.id)
    .run();
}

async function executeAccess(env: Env, req: DsarRequestRow): Promise<void> {
  const exportResponse = await handleExportJson(
    new Request(`https://internal/api/export/json?family_id=${req.target_family_id}`),
    env,
  );
  const payload = await exportResponse.text();
  const key = `dsar-exports/${req.id}.json`;
  await env.DSAR_EXPORTS.put(key, payload, { httpMetadata: { contentType: 'application/json' } });

  // createSignedUrl is a Cloudflare R2 runtime method not yet fully typed in
  // workers-types — same pattern as worker/src/routes/sharedExpenseReceipt.ts.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const url: string = await (env.DSAR_EXPORTS as unknown as any).createSignedUrl(key, { expiresIn: 3600 });

  await sendDsarAccessLinkEmail(req.requester_email, url, env);

  await env.DB
    .prepare(`UPDATE dsar_requests SET status = 'completed', executed_at = unixepoch() WHERE id = ?`)
    .bind(req.id)
    .run();
}
