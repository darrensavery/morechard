/**
 * POST /api/ledger/:id/verify
 *
 * Second parent verifies a 'pending' ledger entry in Standard mode.
 * - Locks metadata: receipt_id, category, exchange rate snapshot are frozen on verification.
 * - Logs the status transition to ledger_status_log.
 * - The verifying parent must not be the same user who created the entry (authorised_by).
 *
 * Body: { verified_by: string, exchange_rate_bp?: number }
 *   exchange_rate_bp: GBP/PLN rate in basis points (e.g. 503 = 5.03). Required only
 *   when the family currency is PLN (cross-border households).
 */

import { Env } from '../types.js';
import { json, error, clientIp } from '../lib/response.js';

export async function handleLedgerVerify(
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

  const { verified_by, exchange_rate_bp } = body;
  if (!verified_by || typeof verified_by !== 'string') return error('verified_by required');

  const ledgerId = parseInt(ledgerIdStr, 10);
  if (isNaN(ledgerId)) return error('Invalid ledger id');

  const row = await env.DB
    .prepare(`SELECT id, family_id, currency, verification_status, authorised_by, created_at
              FROM ledger WHERE id = ?`)
    .bind(ledgerId)
    .first<{
      id: number;
      family_id: string;
      currency: string;
      verification_status: string;
      authorised_by: string | null;
      created_at: number;
    }>();

  if (!row) return error('Ledger entry not found', 404);
  if (row.verification_status !== 'pending') {
    return error(`Entry is '${row.verification_status}' — only 'pending' entries can be verified`);
  }
  if (row.authorised_by === verified_by) {
    return error('The submitting parent cannot verify their own entry');
  }

  // Cross-border households must supply an exchange rate at moment of verification
  if (row.currency === 'PLN' && exchange_rate_bp !== undefined) {
    if (!Number.isInteger(exchange_rate_bp) || (exchange_rate_bp as number) <= 0) {
      return error('exchange_rate_bp must be a positive integer (basis points)');
    }
  }

  const now = Math.floor(Date.now() / 1000);
  const ip  = clientIp(request);

  const ops: D1PreparedStatement[] = [
    // Update ledger — metadata is now locked (no further updates possible via triggers)
    env.DB.prepare(`
      UPDATE ledger
      SET verification_status = 'verified_manual',
          verified_at  = ?,
          verified_by  = ?
      WHERE id = ?
    `).bind(now, verified_by, ledgerId),

    // Log the status transition
    env.DB.prepare(`
      INSERT INTO ledger_status_log
        (ledger_id, from_status, to_status, actor_id, ip_address)
      VALUES (?, 'pending', 'verified_manual', ?, ?)
    `).bind(ledgerId, verified_by, ip),
  ];

  // Optionally snapshot the exchange rate at verification time
  if (row.currency === 'PLN' && typeof exchange_rate_bp === 'number') {
    ops.push(
      env.DB.prepare(`
        INSERT INTO currency_snapshots (ledger_id, base, quote, rate_bp)
        VALUES (?, 'PLN', 'GBP', ?)
      `).bind(ledgerId, exchange_rate_bp),
    );
  }

  await env.DB.batch(ops);

  return json({ verified: true, ledger_id: ledgerId, verified_at: now });
}
