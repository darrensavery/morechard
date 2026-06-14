/**
 * Suggestions routes — child proposes a new job
 *
 * POST   /api/suggestions
 * GET    /api/suggestions?family_id=&status=
 * POST   /api/suggestions/:id/approve   (body: optional overrides — title, proposed_amount, frequency, due_date)
 * POST   /api/suggestions/:id/reject    (body: { rejection_note: string } — required)
 */

import { Env } from '../types.js';

import { json, error, parseBody } from '../lib/response.js';
import { nanoid } from '../lib/nanoid.js';
import { JwtPayload } from '../lib/jwt.js';

type AuthedRequest = Request & { auth: JwtPayload };

const VALID_FREQUENCY = new Set([
  'daily', 'weekly', 'bi_weekly', 'monthly', 'quarterly', 'as_needed', 'school_days',
]);

export async function handleSuggestionCreate(request: Request, env: Env): Promise<Response> {
  const auth = (request as AuthedRequest).auth;
  if (auth.role !== 'child') return error('Only children can suggest jobs', 403);

  const body = await parseBody(request);
  if (!body) return error('Invalid JSON');

  const { family_id, title, frequency, proposed_amount, reason, due_date } = body;
  if (!family_id || family_id !== auth.family_id) return error('Forbidden', 403);
  if (!title || typeof title !== 'string' || !(title as string).trim()) return error('title required');
  if (!Number.isInteger(proposed_amount) || (proposed_amount as number) <= 0)
    return error('proposed_amount must be a positive integer');

  const id  = nanoid();
  const now = Math.floor(Date.now() / 1000);

  await env.DB.prepare(`
    INSERT INTO suggestions
      (id, family_id, child_id, title, frequency, proposed_amount, reason, due_date, submitted_at)
    VALUES (?,?,?,?,?,?,?,?,?)
  `).bind(
    id, family_id as string, auth.sub,
    (title as string).trim(),
    frequency ?? null,
    proposed_amount,
    reason ? String(reason).trim() : null,
    due_date ? String(due_date).trim() : null,
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
    .bind(id).first<{
      family_id: string; status: string; child_id: string;
      title: string; frequency: string | null;
      proposed_amount: number; due_date: string | null;
    }>();
  if (!sug) return error('Suggestion not found', 404);
  if (sug.family_id !== auth.family_id) return error('Forbidden', 403);
  if (sug.status !== 'pending') return error(`Suggestion is already ${sug.status}`);

  // Parent may override title, amount, frequency, due_date before approving
  const body = await parseBody(request);
  const finalTitle     = (body?.title && typeof body.title === 'string' && (body.title as string).trim())
    ? (body.title as string).trim()
    : sug.title;
  const finalAmount    = (body?.proposed_amount && Number.isInteger(body.proposed_amount) && (body.proposed_amount as number) > 0)
    ? body.proposed_amount as number
    : sug.proposed_amount;
  const rawFreq        = body?.frequency ? String(body.frequency) : (sug.frequency ?? 'as_needed');
  const finalFrequency = VALID_FREQUENCY.has(rawFreq) ? rawFreq : 'as_needed';
  const finalDueDate   = body?.due_date != null
    ? (String(body.due_date).trim() || null)
    : sug.due_date;

  // Fetch family currency
  const family = await env.DB
    .prepare('SELECT currency FROM families WHERE id = ?')
    .bind(sug.family_id).first<{ currency: string }>();
  const currency = family?.currency ?? 'GBP';

  const now = Math.floor(Date.now() / 1000);
  await env.DB
    .prepare(`UPDATE suggestions SET status = 'approved', resolved_at = ?, resolved_by = ? WHERE id = ?`)
    .bind(now, auth.sub, id).run();

  const choreId = nanoid();
  await env.DB.prepare(`
    INSERT INTO chores
      (id, family_id, assigned_to, created_by, title, reward_amount, currency, frequency, due_date, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
  `).bind(
    choreId, sug.family_id, sug.child_id, auth.sub,
    finalTitle, finalAmount, currency,
    finalFrequency, finalDueDate ?? null,
    now, now,
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
  if (!rejection_note) return error('rejection_note is required', 400);

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
