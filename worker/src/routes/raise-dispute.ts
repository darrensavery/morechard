/**
 * POST /api/ledger/:id/raise-dispute
 *
 * Raises a formal dispute on a ledger entry. Replaces the earlier generic
 * /dispute endpoint with RODO-compliant structured dispute codes.
 *
 * Rules:
 * - Entry must be 'pending' or 'verified_auto' (within dispute_before window).
 * - A dispute_code is mandatory — no free-text conflict content stored.
 * - Status transitions to 'disputed' and is logged in ledger_status_log.
 * - A new ledger entry (entry_type: 'reversal') is NOT automatically created;
 *   that requires an explicit follow-up action by the resolving parent.
 *
 * Body: { disputed_by: string, dispute_code: DisputeCode }
 */

import { Env, DISPUTE_CODES } from '../types.js';
import { json, error, clientIp } from '../lib/response.js';

export async function handleRaiseDispute(
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

  const { disputed_by, dispute_code } = body;
  if (!disputed_by  || typeof disputed_by  !== 'string') return error('disputed_by required');
  if (!dispute_code || !DISPUTE_CODES.includes(dispute_code as never)) {
    return error(`dispute_code required. Must be one of: ${DISPUTE_CODES.join(', ')}`);
  }

  const ledgerId = parseInt(ledgerIdStr, 10);
  if (isNaN(ledgerId)) return error('Invalid ledger id');

  const row = await env.DB
    .prepare(`SELECT family_id, verification_status, dispute_before, authorised_by
              FROM ledger WHERE id = ?`)
    .bind(ledgerId)
    .first<{
      family_id: string;
      verification_status: string;
      dispute_before: number | null;
      authorised_by: string | null;
    }>();

  if (!row) return error('Ledger entry not found', 404);

  const now = Math.floor(Date.now() / 1000);

  // Allow dispute on 'pending' entries (standard mode) at any time
  // Allow dispute on 'verified_auto' entries within the 48h window only
  if (row.verification_status === 'verified_auto') {
    if (!row.dispute_before || now > row.dispute_before) {
      return error('Dispute window has closed (48h elapsed)', 409);
    }
  } else if (row.verification_status !== 'pending') {
    return error(`Cannot dispute an entry with status '${row.verification_status}'`);
  }

  const ip = clientIp(request);

  await env.DB.batch([
    // Mark the ledger entry as disputed and store the structured code
    env.DB.prepare(`
      UPDATE ledger
      SET verification_status = 'disputed',
          dispute_code = ?
      WHERE id = ?
    `).bind(dispute_code, ledgerId),

    // Immutable status transition log
    env.DB.prepare(`
      INSERT INTO ledger_status_log
        (ledger_id, from_status, to_status, actor_id, dispute_code, ip_address)
      VALUES (?, ?, 'disputed', ?, ?, ?)
    `).bind(ledgerId, row.verification_status, disputed_by, dispute_code, ip),
  ]);

  return json({
    disputed: true,
    ledger_id: ledgerId,
    dispute_code,
    message: 'Entry marked as disputed. A reversal entry is required to correct the record.',
  });
}
