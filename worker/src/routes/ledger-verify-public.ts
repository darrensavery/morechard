/**
 * Public ledger verification — GET /api/verify/:hash
 *
 * Anyone with a chain-head hash (from a PDF export) can confirm the ledger
 * is untampered. No auth required; no family PII is returned.
 *
 * Response:
 *   200 { valid: true,  entryCount, chainHeadHash, verifiedAt }
 *   200 { valid: false, brokenAt: <ledger row id> }
 *   404 { error: 'Hash not found' }
 */

import { Env } from '../types.js';
import { verifyChain } from '../lib/hash.js';
import { json, error } from '../lib/response.js';

interface LedgerRow {
  id: number;
  family_id: string;
  child_id: string;
  amount: number;
  currency: string;
  entry_type: string;
  previous_hash: string;
  record_hash: string;
}

export async function handlePublicLedgerVerify(
  _request: Request,
  env: Env,
  hash: string,
): Promise<Response> {
  // Look up the family whose latest (highest id) ledger entry has this record_hash.
  const row = await env.DB.prepare(
    `SELECT family_id FROM ledger WHERE record_hash = ?
     ORDER BY id DESC LIMIT 1`,
  ).bind(hash).first<{ family_id: string }>();

  if (!row) return error('Hash not found', 404);

  const { family_id } = row;

  const ledger = await env.DB.prepare(
    `SELECT id, family_id, child_id, amount, currency, entry_type,
            previous_hash, record_hash
     FROM ledger WHERE family_id = ? ORDER BY id ASC`,
  ).bind(family_id).all<LedgerRow>();

  const entries = ledger.results;
  const result = await verifyChain(entries);

  if (!result.valid) {
    return json({ valid: false, brokenAt: result.brokenAt });
  }

  const chainHead = entries[entries.length - 1];

  return json({
    valid: true,
    entryCount: entries.length,
    chainHeadHash: chainHead.record_hash,
    verifiedAt: new Date().toISOString(),
  });
}
