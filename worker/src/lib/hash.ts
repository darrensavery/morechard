/**
 * Chain-of-Trust hashing for the immutable ledger.
 *
 * Each row's record_hash = SHA-256 of:
 *   id || family_id || child_id || amount || currency || entry_type || previous_hash
 *
 * The genesis row uses previous_hash = '0000000000000000000000000000000000000000000000000000000000000000'
 */

export const GENESIS_HASH = '0'.repeat(64);

export async function sha256(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const buffer = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function esc(v: string | number): string {
  return String(v).replace(/\\/g, '\\\\').replace(/\|/g, '\\|');
}

export async function computeRecordHash(
  id: number,
  familyId: string,
  childId: string,
  amount: number,
  currency: string,
  entryType: string,
  previousHash: string,
): Promise<string> {
  const payload = [id, familyId, childId, amount, currency, entryType, previousHash].map(esc).join('|');
  return sha256(payload);
}

/** Shape of a full ledger row needed to verify and extend the hash chain. */
export interface ChainTipRow {
  id: number;
  family_id: string;
  child_id: string | null;
  amount: number;
  currency: string;
  entry_type: string;
  previous_hash: string;
  record_hash: string;
}

/**
 * Fetch the latest ledger row for a family, recompute its hash, and confirm
 * the stored hash still matches.  Throws if the chain is already corrupted so
 * the caller's INSERT is rejected rather than silently propagating bad data.
 *
 * Returns { previousHash, newId } — the inputs needed to write the next row.
 */
export async function fetchAndVerifyChainTip(
  db: D1Database,
  familyId: string,
): Promise<{ previousHash: string; newId: number }> {
  const tip = await db
    .prepare(`SELECT id, family_id, child_id, amount, currency, entry_type,
                     previous_hash, record_hash
              FROM ledger WHERE family_id = ? ORDER BY id DESC LIMIT 1`)
    .bind(familyId)
    .first<ChainTipRow>();

  if (!tip) return { previousHash: GENESIS_HASH, newId: 1 };

  const expected = await computeRecordHash(
    tip.id,
    tip.family_id,
    tip.child_id ?? 'NULL',
    tip.amount,
    tip.currency,
    tip.entry_type,
    tip.previous_hash,
  );

  if (expected !== tip.record_hash) {
    throw new Error(
      `Ledger chain integrity failure on family ${familyId} at row ${tip.id}. ` +
      `Expected hash ${expected}, stored ${tip.record_hash}.`,
    );
  }

  return { previousHash: tip.record_hash, newId: tip.id + 1 };
}

export async function verifyChain(entries: Array<{
  id: number;
  family_id: string;
  child_id: string;
  amount: number;
  currency: string;
  entry_type: string;
  previous_hash: string;
  record_hash: string;
}>): Promise<{ valid: boolean; brokenAt: number | null }> {
  for (const entry of entries) {
    const expected = await computeRecordHash(
      entry.id,
      entry.family_id,
      entry.child_id,
      entry.amount,
      entry.currency,
      entry.entry_type,
      entry.previous_hash,
    );
    if (expected !== entry.record_hash) {
      return { valid: false, brokenAt: entry.id };
    }
  }
  return { valid: true, brokenAt: null };
}
