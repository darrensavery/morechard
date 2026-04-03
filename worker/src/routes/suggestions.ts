/**
 * Suggestions routes — child proposes a new job
 *
 * POST   /api/suggestions
 * GET    /api/suggestions?family_id=&status=
 * POST   /api/suggestions/:id/approve
 * POST   /api/suggestions/:id/reject
 */

import { Env } from '../types.js';
import { json, error } from '../lib/response.js';
import { nanoid } from '../lib/nanoid.js';
import { JwtPayload } from '../lib/jwt.js';

type AuthedRequest = Request & { auth: JwtPayload };

export async function handleSuggestionCreate(request: Request, env: Env): Promise<Response> {
  const auth = (request as AuthedRequest).auth;
  if (auth.role !== 'child') return error('Only children can suggest jobs', 403);

  const body = await parseBody(request);
  if (!body) return error('Invalid JSON');

  const { family_id, title, frequency, proposed_amount, reason } = body;
  if (!family_id || family_id !== auth.family_id) return error('Forbidden', 403);
  if (!title || typeof title !== 'string') return error('title required');
  if (!Number.isInteger(proposed_amount) || (proposed_amount as number) <= 0)
    return error('proposed_amount must be a positive integer');

  const id  = nanoid();
  const now = Math.floor(Date.now() / 1000);

  await env.DB.prepare(`
    INSERT INTO suggestions
      (id, family_id, child_id, title, frequency, proposed_amount, reason, submitted_at)
    VALUES (?,?,?,?,?,?,?,?)
  `).bind(
    id, family_id as string, auth.sub,
    (title as string).trim(),
    frequency ?? null,
    proposed_amount,
    reason ? String(reason).trim() : null,
    now,
  ).run();

  return json({ id, submitted_at: now }, 201);
}

export async function handleSuggestionList(request: Request, env: Env): Promise<Response> {
  const auth = (request as AuthedRequest).auth;
  const url = new URL(request.url);
  const family_id = url.searchParams.get('family_id');
  const status    = url.searchParams.get('status') ?? 'pending';
  if (!family_id || family_id !== auth.family_id) return error('Forbidden', 403);

  const child_id = auth.role === 'child' ? auth.sub : null;

  let stmt;
  if (child_id) {
    stmt = env.DB.prepare(
      `SELECT s.*, u.display_name AS child_name FROM suggestions s
       JOIN users u ON u.id = s.child_id
       WHERE s.family_id = ? AND s.child_id = ? AND s.status = ?
       ORDER BY s.submitted_at DESC`
    ).bind(family_id, child_id, status);
  } else {
    stmt = env.DB.prepare(
      `SELECT s.*, u.display_name AS child_name FROM suggestions s
       JOIN users u ON u.id = s.child_id
       WHERE s.family_id = ? AND s.status = ?
       ORDER BY s.submitted_at DESC`
    ).bind(family_id, status);
  }

  const { results } = await stmt.all();
  return json({ suggestions: results });
}

export async function handleSuggestionApprove(
  request: Request, env: Env, id: string,
): Promise<Response> {
  const auth = (request as AuthedRequest).auth;
  if (auth.role !== 'parent') return error('Only parents can approve suggestions', 403);

  const sug = await env.DB
    .prepare('SELECT * FROM suggestions WHERE id = ?')
    .bind(id).first<{ family_id: string; status: string; child_id: string; title: string;
      frequency: string | null; proposed_amount: number }>();
  if (!sug) return error('Suggestion not found', 404);
  if (sug.family_id !== auth.family_id) return error('Forbidden', 403);
  if (sug.status !== 'pending') return error(`Suggestion is already ${sug.status}`);

  const now = Math.floor(Date.now() / 1000);
  await env.DB
    .prepare(`UPDATE suggestions SET status = 'approved', resolved_at = ?, resolved_by = ? WHERE id = ?`)
    .bind(now, auth.sub, id).run();

  // Optionally auto-create the chore
  const choreId = nanoid();
  await env.DB.prepare(`
    INSERT INTO chores
      (id, family_id, assigned_to, created_by, title, reward_amount, currency, frequency, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)
  `).bind(
    choreId, sug.family_id, sug.child_id, auth.sub,
    sug.title, sug.proposed_amount, 'GBP',
    sug.frequency ?? 'as_needed', now, now,
  ).run();

  return json({ ok: true, chore_id: choreId });
}

export async function handleSuggestionReject(
  request: Request, env: Env, id: string,
): Promise<Response> {
  const auth = (request as AuthedRequest).auth;
  if (auth.role !== 'parent') return error('Only parents can reject suggestions', 403);

  const body = await parseBody(request);
  const rejection_note = body?.rejection_note ? String(body.rejection_note).trim() : null;

  const sug = await env.DB
    .prepare('SELECT family_id, status FROM suggestions WHERE id = ?')
    .bind(id).first<{ family_id: string; status: string }>();
  if (!sug) return error('Suggestion not found', 404);
  if (sug.family_id !== auth.family_id) return error('Forbidden', 403);
  if (sug.status !== 'pending') return error(`Suggestion is already ${sug.status}`);

  const now = Math.floor(Date.now() / 1000);
  await env.DB
    .prepare(`UPDATE suggestions SET status = 'rejected', rejection_note = ?, resolved_at = ?, resolved_by = ? WHERE id = ?`)
    .bind(rejection_note, now, auth.sub, id).run();

  return json({ ok: true });
}

async function parseBody(request: Request): Promise<Record<string, unknown> | null> {
  try { return await request.json() as Record<string, unknown>; }
  catch { return null; }
}
