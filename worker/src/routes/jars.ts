import { Env } from '../types.js';
import { json, error } from '../lib/response.js';
import { JwtPayload } from '../lib/jwt.js';
import { getJarConfig, getJarBalances } from '../lib/jar-balance.js';

type AuthedRequest = Request & { auth: JwtPayload };

// ----------------------------------------------------------------
// GET /api/jars?family_id=&child_id=
// Returns current balances + config. Parent can read any child;
// child can only read own.
// ----------------------------------------------------------------
export async function handleGetJars(request: Request, env: Env): Promise<Response> {
  const auth = (request as AuthedRequest).auth;
  const url  = new URL(request.url);
  const family_id = url.searchParams.get('family_id');
  const child_id  = url.searchParams.get('child_id');

  if (!family_id || !child_id) return error('family_id and child_id required');
  if (family_id !== auth.family_id) return error('Forbidden', 403);
  if (auth.role === 'child' && child_id !== auth.sub) return error('Forbidden', 403);

  const [config, balances] = await Promise.all([
    getJarConfig(env.DB, family_id, child_id),
    getJarBalances(env.DB, family_id, child_id),
  ]);

  return json({ config, balances });
}

// ----------------------------------------------------------------
// PUT /api/jars/config
// Body: { family_id, child_id, enabled?, spend_pct?, save_pct?, give_pct?,
//         initial_seed?: { spend, save, give } }
// Child only. initial_seed is used on first enable (wizard).
// ----------------------------------------------------------------
export async function handlePutJarConfig(request: Request, env: Env): Promise<Response> {
  const auth = (request as AuthedRequest).auth;
  if (auth.role !== 'child') return error('Only children can configure their own jars', 403);

  const body = await request.json<{
    family_id: string; child_id: string;
    enabled?: number;
    spend_pct?: number; save_pct?: number; give_pct?: number;
    initial_seed?: { spend: number; save: number; give: number };
  }>();

  const { family_id, child_id } = body;
  if (!family_id || !child_id) return error('family_id and child_id required');
  if (family_id !== auth.family_id || child_id !== auth.sub) return error('Forbidden', 403);

  const spend_pct = body.spend_pct ?? 70;
  const save_pct  = body.save_pct  ?? 20;
  const give_pct  = body.give_pct  ?? 10;
  if (spend_pct + save_pct + give_pct !== 100) return error('Percentages must sum to 100', 400);
  if (spend_pct < 0 || save_pct < 0 || give_pct < 0) return error('Percentages must be non-negative', 400);

  const enabled = body.enabled ?? 1;
  const now = Math.floor(Date.now() / 1000);

  const existing = await getJarConfig(env.DB, family_id, child_id);
  const isFirstEnable = !existing.enabled && enabled === 1;

  const ops: ReturnType<typeof env.DB.prepare>[] = [
    env.DB.prepare(`
      INSERT INTO jar_config (family_id, child_id, enabled, spend_pct, save_pct, give_pct, updated_at)
      VALUES (?,?,?,?,?,?,?)
      ON CONFLICT(family_id, child_id) DO UPDATE SET
        enabled=excluded.enabled, spend_pct=excluded.spend_pct,
        save_pct=excluded.save_pct, give_pct=excluded.give_pct,
        updated_at=excluded.updated_at
    `).bind(family_id, child_id, enabled, spend_pct, save_pct, give_pct, now),
  ];

  // First enable: write enable_seed movements from wizard split
  if (isFirstEnable && body.initial_seed) {
    const { spend, save, give } = body.initial_seed;
    if (spend + save + give < 0) return error('Seed amounts cannot be negative', 400);
    for (const [jar, amount] of [['spend', spend], ['save', save], ['give', give]] as const) {
      if (amount > 0) {
        ops.push(env.DB.prepare(`
          INSERT INTO jar_movements (family_id, child_id, jar, delta, kind, created_at)
          VALUES (?,?,?,?,'enable_seed',?)
        `).bind(family_id, child_id, jar, amount, now));
      }
    }
  }

  await env.DB.batch(ops);
  const balances = await getJarBalances(env.DB, family_id, child_id);
  return json({ ok: true, balances });
}

// ----------------------------------------------------------------
// POST /api/jars/move
// Body: { family_id, child_id, from_jar, to_jar, amount }
// Validates source balance server-side before writing.
// ----------------------------------------------------------------
export async function handlePostJarMove(request: Request, env: Env): Promise<Response> {
  const auth = (request as AuthedRequest).auth;
  if (auth.role !== 'child') return error('Only children can move money between jars', 403);

  const body = await request.json<{
    family_id: string; child_id: string;
    from_jar: 'spend' | 'save' | 'give';
    to_jar:   'spend' | 'save' | 'give';
    amount:   number;
  }>();

  const { family_id, child_id, from_jar, to_jar, amount } = body;
  if (!family_id || !child_id || !from_jar || !to_jar || !amount)
    return error('family_id, child_id, from_jar, to_jar, amount required', 400);
  if (family_id !== auth.family_id || child_id !== auth.sub) return error('Forbidden', 403);
  if (from_jar === to_jar) return error('from_jar and to_jar must differ', 400);
  if (!['spend','save','give'].includes(from_jar) || !['spend','save','give'].includes(to_jar))
    return error('Invalid jar name', 400);
  if (amount <= 0) return error('Amount must be positive', 400);

  // Server-side balance check
  const balances = await getJarBalances(env.DB, family_id, child_id);
  if (!balances.enabled) return error('Jars are not enabled for this child', 400);
  const sourceBalance = balances[from_jar];
  if (sourceBalance < amount) return error(`Insufficient balance in ${from_jar} jar`, 400);

  const now = Math.floor(Date.now() / 1000);
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO jar_movements (family_id,child_id,jar,delta,kind,created_at) VALUES (?,?,?,?,'manual_move',?)`)
      .bind(family_id, child_id, from_jar, -amount, now),
    env.DB.prepare(`INSERT INTO jar_movements (family_id,child_id,jar,delta,kind,created_at) VALUES (?,?,?,?,'manual_move',?)`)
      .bind(family_id, child_id, to_jar, amount, now),
  ]);

  const updated = await getJarBalances(env.DB, family_id, child_id);
  return json({ ok: true, balances: updated });
}

// ----------------------------------------------------------------
// GET /api/jars/movements?family_id=&child_id=&limit=20&offset=0
// ----------------------------------------------------------------
export async function handleGetJarMovements(request: Request, env: Env): Promise<Response> {
  const auth = (request as AuthedRequest).auth;
  const url  = new URL(request.url);
  const family_id = url.searchParams.get('family_id');
  const child_id  = url.searchParams.get('child_id');
  const limit  = Math.min(50, parseInt(url.searchParams.get('limit')  ?? '20', 10));
  const offset = Math.max(0,  parseInt(url.searchParams.get('offset') ?? '0',  10));

  if (!family_id || !child_id) return error('family_id and child_id required');
  if (family_id !== auth.family_id) return error('Forbidden', 403);
  if (auth.role === 'child' && child_id !== auth.sub) return error('Forbidden', 403);

  const rows = await env.DB
    .prepare(`SELECT * FROM jar_movements WHERE family_id=? AND child_id=? ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .bind(family_id, child_id, limit, offset)
    .all();

  return json({ movements: rows.results });
}
