/**
 * Chores routes
 *
 * POST   /api/chores                  Parent creates a job
 * GET    /api/chores                  List jobs (family_id, child_id?, archived?)
 * PATCH  /api/chores/:id              Parent edits a job
 * DELETE /api/chores/:id              Parent archives a job (soft delete)
 * POST   /api/chores/:id/submit       Child marks job done → pending completion
 * POST   /api/chores/:id/restore      Parent restores an archived job
 */

import { Env } from '../types.js';
import { json, error } from '../lib/response.js';
import { nanoid } from '../lib/nanoid.js';
import { JwtPayload } from '../lib/jwt.js';

type AuthedRequest = Request & { auth: JwtPayload };

const VALID_FREQUENCIES = ['daily','weekly','bi_weekly','monthly','quarterly','as_needed'];

// ----------------------------------------------------------------
// POST /api/chores
// Parent creates a job definition.
// Body: { family_id, assigned_to, title, reward_amount, currency,
//         frequency?, due_date?, description?, is_priority?, is_flash?,
//         flash_deadline? }
// ----------------------------------------------------------------
export async function handleChoreCreate(request: Request, env: Env): Promise<Response> {
  const auth = (request as AuthedRequest).auth;
  const body = await parseBody(request);
  if (!body) return error('Invalid JSON');

  const {
    family_id, assigned_to, title, reward_amount, currency,
    frequency, due_date, description, is_priority, is_flash, flash_deadline,
  } = body;

  if (!family_id   || typeof family_id   !== 'string') return error('family_id required');
  if (!assigned_to || typeof assigned_to !== 'string') return error('assigned_to required');
  if (!title       || typeof title       !== 'string') return error('title required');
  if (!currency    || !['GBP','PLN'].includes(currency as string)) return error('Invalid currency');
  if (!Number.isInteger(reward_amount) || (reward_amount as number) <= 0)
    return error('reward_amount must be a positive integer (pence/groszy)');

  if (family_id !== auth.family_id) return error('Forbidden', 403);

  if (frequency && !VALID_FREQUENCIES.includes(frequency as string))
    return error(`frequency must be one of: ${VALID_FREQUENCIES.join(', ')}`);

  // Verify assigned_to is a child in this family
  const child = await env.DB
    .prepare(`SELECT u.id FROM users u JOIN family_roles fr ON fr.user_id = u.id
              WHERE u.id = ? AND fr.family_id = ? AND fr.role = 'child'`)
    .bind(assigned_to, family_id).first<{ id: string }>();
  if (!child) return error('Child not found in this family', 404);

  const id = nanoid();
  const now = Math.floor(Date.now() / 1000);

  await env.DB.prepare(`
    INSERT INTO chores
      (id, family_id, assigned_to, created_by, title, description, reward_amount,
       currency, frequency, due_date, is_priority, is_flash, flash_deadline, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).bind(
    id, family_id, assigned_to, auth.sub,
    (title as string).trim(),
    description ? (description as string).trim() : null,
    reward_amount,
    currency,
    frequency ?? 'as_needed',
    due_date ?? null,
    is_priority ? 1 : 0,
    is_flash ? 1 : 0,
    flash_deadline ?? null,
    now, now,
  ).run();

  const chore = await env.DB.prepare('SELECT * FROM chores WHERE id = ?').bind(id).first();
  return json(chore, 201);
}

// ----------------------------------------------------------------
// GET /api/chores?family_id=&child_id=&archived=
// ----------------------------------------------------------------
export async function handleChoreList(request: Request, env: Env): Promise<Response> {
  const auth = (request as AuthedRequest).auth;
  const url = new URL(request.url);
  const family_id = url.searchParams.get('family_id');
  const child_id  = url.searchParams.get('child_id');
  const archived  = url.searchParams.get('archived') === '1' ? 1 : 0;

  if (!family_id) return error('family_id required');
  if (family_id !== auth.family_id) return error('Forbidden', 403);

  // Children can only see their own chores
  const effectiveChildId = auth.role === 'child' ? auth.sub : (child_id ?? null);

  let stmt;
  if (effectiveChildId) {
    stmt = env.DB.prepare(
      `SELECT c.*, u.display_name as child_name, p.display_name as parent_name
       FROM chores c
       JOIN users u ON u.id = c.assigned_to
       JOIN users p ON p.id = c.created_by
       WHERE c.family_id = ? AND c.assigned_to = ? AND c.archived = ?
       ORDER BY c.is_priority DESC, c.due_date ASC, c.created_at DESC`
    ).bind(family_id, effectiveChildId, archived);
  } else {
    stmt = env.DB.prepare(
      `SELECT c.*, u.display_name as child_name, p.display_name as parent_name
       FROM chores c
       JOIN users u ON u.id = c.assigned_to
       JOIN users p ON p.id = c.created_by
       WHERE c.family_id = ? AND c.archived = ?
       ORDER BY c.is_priority DESC, c.due_date ASC, c.created_at DESC`
    ).bind(family_id, archived);
  }

  const { results } = await stmt.all();
  return json({ chores: results });
}

// ----------------------------------------------------------------
// PATCH /api/chores/:id
// Parent edits a job.
// ----------------------------------------------------------------
export async function handleChoreUpdate(request: Request, env: Env, id: string): Promise<Response> {
  const auth = (request as AuthedRequest).auth;
  const body = await parseBody(request);
  if (!body) return error('Invalid JSON');

  const chore = await env.DB
    .prepare('SELECT * FROM chores WHERE id = ?')
    .bind(id)
    .first<{ family_id: string; archived: number }>();

  if (!chore) return error('Chore not found', 404);
  if (chore.family_id !== auth.family_id) return error('Forbidden', 403);
  if (chore.archived) return error('Cannot edit an archived chore');

  const allowed = ['title','description','reward_amount','currency','frequency',
                   'due_date','is_priority','is_flash','flash_deadline'];
  const updates: string[] = [];
  const values: unknown[] = [];

  for (const key of allowed) {
    if (key in body) {
      if (key === 'reward_amount') {
        if (!Number.isInteger(body[key]) || (body[key] as number) <= 0)
          return error('reward_amount must be a positive integer');
      }
      if (key === 'currency' && !['GBP','PLN'].includes(body[key] as string))
        return error('Invalid currency');
      if (key === 'frequency' && !VALID_FREQUENCIES.includes(body[key] as string))
        return error('Invalid frequency');
      updates.push(`${key} = ?`);
      values.push(body[key] ?? null);
    }
  }

  if (updates.length === 0) return error('No valid fields to update');

  updates.push('updated_at = ?');
  values.push(Math.floor(Date.now() / 1000));
  values.push(id);

  await env.DB
    .prepare(`UPDATE chores SET ${updates.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run();

  const updated = await env.DB.prepare('SELECT * FROM chores WHERE id = ?').bind(id).first();
  return json(updated);
}

// ----------------------------------------------------------------
// DELETE /api/chores/:id  (soft archive)
// ----------------------------------------------------------------
export async function handleChoreArchive(request: Request, env: Env, id: string): Promise<Response> {
  const auth = (request as AuthedRequest).auth;

  const chore = await env.DB
    .prepare('SELECT family_id FROM chores WHERE id = ?')
    .bind(id).first<{ family_id: string }>();

  if (!chore) return error('Chore not found', 404);
  if (chore.family_id !== auth.family_id) return error('Forbidden', 403);

  await env.DB
    .prepare('UPDATE chores SET archived = 1, updated_at = ? WHERE id = ?')
    .bind(Math.floor(Date.now() / 1000), id)
    .run();

  return json({ ok: true });
}

// ----------------------------------------------------------------
// POST /api/chores/:id/restore
// ----------------------------------------------------------------
export async function handleChoreRestore(request: Request, env: Env, id: string): Promise<Response> {
  const auth = (request as AuthedRequest).auth;

  const chore = await env.DB
    .prepare('SELECT family_id FROM chores WHERE id = ?')
    .bind(id).first<{ family_id: string }>();

  if (!chore) return error('Chore not found', 404);
  if (chore.family_id !== auth.family_id) return error('Forbidden', 403);

  await env.DB
    .prepare('UPDATE chores SET archived = 0, updated_at = ? WHERE id = ?')
    .bind(Math.floor(Date.now() / 1000), id)
    .run();

  return json({ ok: true });
}

// ----------------------------------------------------------------
// POST /api/chores/:id/submit
// Child marks a job done. Creates a completion record.
// The ledger entry is written AFTER parent approval.
// Body: { note? }
// Rate-limit: one submission per chore per child per calendar day.
// ----------------------------------------------------------------
export async function handleChoreSubmit(request: Request, env: Env, id: string): Promise<Response> {
  const auth = (request as AuthedRequest).auth;
  if (auth.role !== 'child') return error('Only children can submit chores', 403);

  const body = await parseBody(request);
  const note = (body?.note && typeof body.note === 'string') ? body.note.trim() : null;

  const chore = await env.DB
    .prepare('SELECT * FROM chores WHERE id = ?')
    .bind(id)
    .first<{
      id: string; family_id: string; assigned_to: string; title: string;
      reward_amount: number; currency: string; archived: number;
      is_flash: number; flash_deadline: string | null;
    }>();

  if (!chore) return error('Chore not found', 404);
  if (chore.family_id !== auth.family_id) return error('Forbidden', 403);
  if (chore.assigned_to !== auth.sub) return error('This chore is not assigned to you', 403);
  if (chore.archived) return error('This chore has been archived');

  // Flash deadline check
  if (chore.is_flash && chore.flash_deadline) {
    const deadline = new Date(chore.flash_deadline).getTime();
    if (Date.now() > deadline) return error('Flash job deadline has passed', 409);
  }

  // Rate-limit: one pending/approved submission per day
  const todayStart = todayEpoch();
  const existing = await env.DB
    .prepare(`SELECT id FROM completions
              WHERE chore_id = ? AND child_id = ? AND status != 'rejected'
              AND submitted_at >= ? LIMIT 1`)
    .bind(id, auth.sub, todayStart)
    .first<{ id: string }>();

  if (existing) return error('Already submitted today — wait for parent approval first', 409);

  const completionId = nanoid();
  const now = Math.floor(Date.now() / 1000);

  await env.DB.prepare(`
    INSERT INTO completions (id, family_id, chore_id, child_id, note, status, submitted_at)
    VALUES (?,?,?,?,?,'pending',?)
  `).bind(completionId, chore.family_id, id, auth.sub, note, now).run();

  return json({
    id: completionId,
    chore_id: id,
    title: chore.title,
    reward_amount: chore.reward_amount,
    currency: chore.currency,
    status: 'pending',
    submitted_at: now,
  }, 201);
}

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------
async function parseBody(request: Request): Promise<Record<string, unknown> | null> {
  try { return await request.json() as Record<string, unknown>; }
  catch { return null; }
}

function todayEpoch(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return Math.floor(d.getTime() / 1000);
}
