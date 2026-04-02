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

export async function computeRecordHash(
  id: number,
  familyId: string,
  childId: string,
  amount: number,
  currency: string,
  entryType: string,
  previousHash: string,
): Promise<string> {
  const payload = [id, familyId, childId, amount, currency, entryType, previousHash].join('|');
  return sha256(payload);
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
