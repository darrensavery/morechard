/**
 * Chain-of-Trust hashing for shared expenses.
 *
 * Each row's record_hash = SHA-256 of:
 *   id || family_id || logged_by || total_amount || currency || split_bp || previous_hash
 *
 * The genesis row uses previous_hash = GENESIS_HASH.
 */

import { sha256, GENESIS_HASH } from './hash';

export { GENESIS_HASH };

/**
 * Computes the record_hash for a committed shared_expense row.
 * Input mirrors the ledger pattern: fields joined with '|'.
 * Only call this at commit time — pending rows carry 'PENDING' as record_hash.
 */
export async function computeSharedExpenseHash(
  id: number,
  familyId: string,
  loggedBy: string,
  totalAmount: number,
  currency: string,
  splitBp: number,
  previousHash: string,
): Promise<string> {
  // description and category are intentionally excluded — only financial terms and chain linkage are hashed.
  const payload = [id, familyId, loggedBy, totalAmount, currency, splitBp, previousHash].join('|');
  return sha256(payload);
}

/**
 * Computes the record_hash for a committed shared_expense row using hash v2.
 *
 * v2 input string:
 *   {id}|{familyId}|{loggedBy}|{totalAmount}|{currency}|{splitBp}|{previousHash}|
 *   {expenseDate}|{note}|{receiptHash}|{voidedAt}|{voidsId}|2
 *
 * Null/undefined optional fields map to empty string.
 * The trailing literal "|2" is the hash_version marker — makes downgrade attacks
 * (re-hashing a v2 row as v1) detectable because the payloads differ structurally.
 */
export async function computeSharedExpenseHashV2(params: {
  id: number;
  familyId: string;
  loggedBy: string;
  totalAmount: number;
  currency: string;
  splitBp: number;
  previousHash: string;
  expenseDate: string | null;
  note: string | null;
  receiptHash: string | null;
  voidedAt: number | null;
  voidsId: number | null;
}): Promise<string> {
  const n = (v: string | null | undefined): string => v ?? '';
  const i = (v: number | null | undefined): string => (v == null ? '' : String(v));
  const payload = [
    params.id,
    params.familyId,
    params.loggedBy,
    params.totalAmount,
    params.currency,
    params.splitBp,
    params.previousHash,
    n(params.expenseDate),
    n(params.note),
    n(params.receiptHash),
    i(params.voidedAt),
    i(params.voidsId),
    '2', // hash_version literal
  ].join('|');
  return sha256(payload);
}

/**
 * Verifies a shared_expense row's record_hash by dispatching to the correct
 * hash function based on hash_version.
 *
 * Returns { valid: boolean; version: number }.
 */
export async function verifySharedExpenseHash(row: {
  id: number;
  family_id: string;
  logged_by: string;
  total_amount: number;
  currency: string;
  split_bp: number;
  previous_hash: string;
  record_hash: string;
  hash_version: number;
  // v2-only fields (may be absent on v1 rows):
  expense_date?: string | null;
  note?: string | null;
  receipt_hash?: string | null;
  voided_at?: number | null;
  voids_id?: number | null;
}): Promise<{ valid: boolean; version: number }> {
  const version = row.hash_version;

  let expected: string;

  if (version === 2) {
    expected = await computeSharedExpenseHashV2({
      id: row.id,
      familyId: row.family_id,
      loggedBy: row.logged_by,
      totalAmount: row.total_amount,
      currency: row.currency,
      splitBp: row.split_bp,
      previousHash: row.previous_hash,
      expenseDate: row.expense_date ?? null,
      note: row.note ?? null,
      receiptHash: row.receipt_hash ?? null,
      voidedAt: row.voided_at ?? null,
      voidsId: row.voids_id ?? null,
    });
  } else {
    // v1 (and any unknown version falls back to v1 for safety)
    expected = await computeSharedExpenseHash(
      row.id,
      row.family_id,
      row.logged_by,
      row.total_amount,
      row.currency,
      row.split_bp,
      row.previous_hash,
    );
  }

  return { valid: expected === row.record_hash, version };
}

/**
 * Fetches the record_hash of the most recently committed shared_expense row
 * for a given family, to use as previous_hash for the next committed row.
 * Returns GENESIS_HASH if no committed row exists yet.
 */
export async function getLastCommittedHash(db: D1Database, familyId: string): Promise<string> {
  const row = await db
    .prepare(
      `SELECT record_hash FROM shared_expenses
       WHERE family_id = ?
         AND verification_status IN ('committed_auto', 'committed_manual', 'reversed')
         AND record_hash != 'PENDING'
       ORDER BY id DESC
       LIMIT 1`,
    )
    .bind(familyId)
    .first<{ record_hash: string }>();
  return row?.record_hash ?? GENESIS_HASH;
}
