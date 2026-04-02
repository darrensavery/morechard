/**
 * POST /api/ledger
 *
 * Creates an immutable ledger entry. Automatically chains the SHA-256 hash
 * to the previous row. Verification status is set based on the family's
 * current verify_mode (amicable = verified_auto, standard = pending).
 *
 * verified_auto rows receive a dispute_before timestamp (created_at + 48h).
 * After that window closes, the entry is permanent and undisputable.
 *
 * Body (JSON):
 *   family_id    string
 *   child_id     string
 *   chore_id?    string
 *   entry_type   'credit' | 'reversal' | 'payment'
 *   amount       integer (pence or groszy — no floats)
 *   currency     'GBP' | 'PLN'
 *   description  string
 *   authorised_by? string  (required when manually verifying)
 */

import { Env } from '../types.js';
import { computeRecordHash, GENESIS_HASH } from '../lib/hash.js';
import { json, error, clientIp } from '../lib/response.js';

export async function handleLedgerPost(request: Request, env: Env): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return error('Invalid JSON body');
  }

  const { family_id, child_id, chore_id, entry_type, amount, currency, description, authorised_by } = body;

  // --- Validate required fields ---
  if (!family_id || typeof family_id !== 'string') return error('family_id required');
  if (!child_id  || typeof child_id  !== 'string') return error('child_id required');
  if (!entry_type || !['credit','reversal','payment'].includes(entry_type as string)) return error('Invalid entry_type');
  if (!currency  || !['GBP','PLN'].includes(currency as string)) return error('Invalid currency');
  if (!description || typeof description !== 'string') return error('description required');

  // --- Enforce integer-only amounts ---
  if (!Number.isInteger(amount) || (amount as number) <= 0) {
    return error('amount must be a positive integer (pence or groszy)');
  }

  const ip = clientIp(request);

  // --- Fetch family to determine verify_mode ---
  const family = await env.DB
    .prepare('SELECT verify_mode FROM families WHERE id = ?')
    .bind(family_id)
    .first<{ verify_mode: string }>();

  if (!family) return error('Family not found', 404);

  const verificationStatus = family.verify_mode === 'amicable' ? 'verified_auto' : 'pending';
  const now = Math.floor(Date.now() / 1000);
  const disputeBefore = verificationStatus === 'verified_auto' ? now + 172800 : null; // 48h window

  // --- Get previous row's hash for chain ---
  const prevRow = await env.DB
    .prepare('SELECT id, record_hash FROM ledger WHERE family_id = ? ORDER BY id DESC LIMIT 1')
    .bind(family_id)
    .first<{ id: number; record_hash: string }>();

  const previousHash = prevRow?.record_hash ?? GENESIS_HASH;

  // --- We need the new row's id to compute its hash.
  //     D1 doesn't return AUTOINCREMENT id before insert, so we:
  //     1. Get MAX(id) + 1 as the next id
  //     2. Compute hash
  //     3. Insert with explicit id
  // ---
  const maxRow = await env.DB
    .prepare('SELECT COALESCE(MAX(id), 0) AS max_id FROM ledger WHERE family_id = ?')
    .bind(family_id)
    .first<{ max_id: number }>();

  const newId = (maxRow?.max_id ?? 0) + 1;

  const recordHash = await computeRecordHash(
    newId,
    family_id,
    child_id,
    amount as number,
    currency as string,
    entry_type as string,
    previousHash,
  );

  // --- Insert ---
  await env.DB
    .prepare(`
      INSERT INTO ledger
        (id, family_id, child_id, chore_id, entry_type, amount, currency,
         description, verification_status, authorised_by,
         previous_hash, record_hash, ip_address, dispute_before)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `)
    .bind(
      newId,
      family_id,
      child_id,
      chore_id ?? null,
      entry_type,
      amount,
      currency,
      description,
      verificationStatus,
      (verificationStatus === 'verified_auto' ? (authorised_by ?? null) : null),
      previousHash,
      recordHash,
      ip,
      disputeBefore,
    )
    .run();

  return json({ id: newId, record_hash: recordHash, verification_status: verificationStatus, dispute_before: disputeBefore }, 201);
}

/**
 * POST /api/ledger/:id/dispute
 *
 * Raises a dispute on an auto-verified transaction within the 48h window.
 * Effect: Creates a governance request to switch the family back to 'standard'
 * mode, requiring the second parent to confirm. The disputed ledger row itself
 * remains immutable — dispute is recorded via the governance log.
 *
 * Body: { disputed_by: string }
 */
export async function handleLedgerDispute(
  request: Request,
  env: Env,
  ledgerIdStr: string,
): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return error('Invalid JSON body');
  }

  const { disputed_by } = body;
  if (!disputed_by || typeof disputed_by !== 'string') return error('disputed_by required');

  const ledgerId = parseInt(ledgerIdStr, 10);
  if (isNaN(ledgerId)) return error('Invalid ledger id');

  const row = await env.DB
    .prepare('SELECT family_id, verification_status, dispute_before FROM ledger WHERE id = ?')
    .bind(ledgerId)
    .first<{ family_id: string; verification_status: string; dispute_before: number | null }>();

  if (!row) return error('Ledger entry not found', 404);
  if (row.verification_status !== 'verified_auto') return error('Only auto-verified entries can be disputed');
  if (!row.dispute_before) return error('No dispute window on this entry');

  const now = Math.floor(Date.now() / 1000);
  if (now > row.dispute_before) return error('Dispute window has closed (48h elapsed)', 409);

  // Check if a pending governance request already exists for this family
  const existing = await env.DB
    .prepare(`SELECT id FROM family_governance_log WHERE family_id = ? AND status = 'pending' LIMIT 1`)
    .bind(row.family_id)
    .first<{ id: number }>();
  if (existing) return error('A pending governance request already exists for this family', 409);

  const ip = clientIp(request);
  const EXPIRY_SECONDS = 72 * 60 * 60;

  const result = await env.DB
    .prepare(`
      INSERT INTO family_governance_log
        (family_id, requested_by, old_mode, new_mode, status, requested_at, expires_at, request_ip)
      VALUES (?,?,'amicable','standard','pending',?,?,?)
    `)
    .bind(row.family_id, disputed_by, now, now + EXPIRY_SECONDS, ip)
    .run();

  return json({
    disputed: true,
    ledger_id: ledgerId,
    governance_request_id: result.meta.last_row_id,
    message: 'Dispute raised. The second parent must confirm switching back to Standard mode.',
  }, 201);
}

/**
 * GET /api/ledger?family_id=&child_id=&limit=&offset=
 */
export async function handleLedgerGet(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const family_id = url.searchParams.get('family_id');
  const child_id  = url.searchParams.get('child_id');
  const limit  = Math.min(parseInt(url.searchParams.get('limit')  ?? '50'), 200);
  const offset = parseInt(url.searchParams.get('offset') ?? '0');

  if (!family_id) return error('family_id required');

  const query = child_id
    ? 'SELECT * FROM ledger WHERE family_id = ? AND child_id = ? ORDER BY id DESC LIMIT ? OFFSET ?'
    : 'SELECT * FROM ledger WHERE family_id = ? ORDER BY id DESC LIMIT ? OFFSET ?';

  const stmt = child_id
    ? env.DB.prepare(query).bind(family_id, child_id, limit, offset)
    : env.DB.prepare(query).bind(family_id, limit, offset);

  const { results } = await stmt.all();
  return json({ entries: results, limit, offset });
}
