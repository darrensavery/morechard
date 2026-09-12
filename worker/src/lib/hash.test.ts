import { describe, it, expect } from 'vitest';
import { GENESIS_HASH, computeRecordHash, fetchAndVerifyChainTip, prepareSystemNoteInsert, verifyChain } from './hash.js';

interface FakeRow {
  id: number; family_id: string; child_id: string | null; amount: number;
  currency: string; entry_type: string; previous_hash: string; record_hash: string;
}

function makeFakeLedgerDb(seedRows: FakeRow[] = []) {
  const rows: FakeRow[] = [...seedRows];
  const db = {
    prepare(sql: string) {
      return {
        async first<T>() {
          if (sql.includes('MAX(id) AS max_id')) {
            const maxId = rows.length ? Math.max(...rows.map(r => r.id)) : null;
            return { max_id: maxId } as unknown as T;
          }
          return null as unknown as T;
        },
        bind(...args: unknown[]) {
          return {
            async first<T>() {
              if (sql.includes('MAX(id) AS max_id')) {
                const maxId = rows.length ? Math.max(...rows.map(r => r.id)) : null;
                return { max_id: maxId } as unknown as T;
              }
              if (sql.includes('SELECT record_hash FROM ledger')) {
                const [familyId] = args as [string];
                const tip = rows.filter(r => r.family_id === familyId).sort((a, b) => b.id - a.id)[0];
                return (tip ? { record_hash: tip.record_hash } : null) as unknown as T;
              }
              if (sql.includes('SELECT id, family_id, child_id')) {
                const [familyId] = args as [string];
                const tip = rows.filter(r => r.family_id === familyId).sort((a, b) => b.id - a.id)[0];
                return (tip ?? null) as unknown as T;
              }
              return null as unknown as T;
            },
            async run() { return { success: true }; },
          };
        },
      };
    },
  };
  return { db: db as unknown as D1Database, rows };
}

describe('fetchAndVerifyChainTip', () => {
  it('returns genesis hash and id 1 for a completely empty ledger', async () => {
    const { db } = makeFakeLedgerDb([]);
    const result = await fetchAndVerifyChainTip(db, 'fam_a');
    expect(result).toEqual({ previousHash: GENESIS_HASH, newId: 1 });
  });

  it("computes newId from the table-wide max id, not the family's own last row", async () => {
    // family A's only row is id=5; family B has advanced the shared id
    // sequence to 20. The next write for family A must not reuse 6 — another
    // family may already hold that id.
    const famAHash = await computeRecordHash(5, 'fam_a', 'NULL', 0, 'GBP', 'system_note', GENESIS_HASH);
    const famBHash = await computeRecordHash(20, 'fam_b', 'NULL', 0, 'GBP', 'system_note', GENESIS_HASH);
    const { db } = makeFakeLedgerDb([
      { id: 5, family_id: 'fam_a', child_id: null, amount: 0, currency: 'GBP', entry_type: 'system_note', previous_hash: GENESIS_HASH, record_hash: famAHash },
      { id: 20, family_id: 'fam_b', child_id: null, amount: 0, currency: 'GBP', entry_type: 'system_note', previous_hash: GENESIS_HASH, record_hash: famBHash },
    ]);
    const result = await fetchAndVerifyChainTip(db, 'fam_a');
    expect(result.newId).toBe(21);
    expect(result.previousHash).toBe(famAHash);
  });

  it('throws when the stored hash no longer matches recomputation (corrupted chain)', async () => {
    const { db } = makeFakeLedgerDb([
      { id: 1, family_id: 'fam_a', child_id: null, amount: 0, currency: 'GBP', entry_type: 'system_note', previous_hash: GENESIS_HASH, record_hash: 'tampered-hash' },
    ]);
    await expect(fetchAndVerifyChainTip(db, 'fam_a')).rejects.toThrow(/chain integrity failure/i);
  });
});

describe('prepareSystemNoteInsert', () => {
  it('prepares a statement whose id/hash come from the table-wide max, and hashes NULL child_id as the literal string \'NULL\'', async () => {
    const famBHash = await computeRecordHash(20, 'fam_b', 'NULL', 0, 'GBP', 'system_note', GENESIS_HASH);
    const { db } = makeFakeLedgerDb([
      { id: 20, family_id: 'fam_b', child_id: null, amount: 0, currency: 'GBP', entry_type: 'system_note', previous_hash: GENESIS_HASH, record_hash: famBHash },
    ]);

    const expectedHash = await computeRecordHash(21, 'fam_a', 'NULL', 0, 'USD', 'system_note', GENESIS_HASH);
    const { id, recordHash } = await prepareSystemNoteInsert(db, 'fam_a', 'USD', 'test note', '1.2.3.4', 'user_1');

    expect(id).toBe(21);
    expect(recordHash).toBe(expectedHash);
  });
});

describe('verifyChain', () => {
  it('validates a row whose NULL child_id was hashed as the literal string \'NULL\'', async () => {
    const hash = await computeRecordHash(1, 'fam_a', 'NULL', 0, 'GBP', 'system_note', GENESIS_HASH);
    const entries = [{
      id: 1, family_id: 'fam_a', child_id: null, amount: 0, currency: 'GBP',
      entry_type: 'system_note', previous_hash: GENESIS_HASH, record_hash: hash,
    }];
    const result = await verifyChain(entries);
    expect(result).toEqual({ valid: true, brokenAt: null });
  });

  it('flags a broken chain when a NULL child_id was hashed with a different convention at write time', async () => {
    // Reproduces the pre-fix bug: a row written with child_id hashed as ''
    // instead of 'NULL' fails verification forever after.
    const wrongHash = await computeRecordHash(1, 'fam_a', '', 0, 'GBP', 'system_note', GENESIS_HASH);
    const entries = [{
      id: 1, family_id: 'fam_a', child_id: null, amount: 0, currency: 'GBP',
      entry_type: 'system_note', previous_hash: GENESIS_HASH, record_hash: wrongHash,
    }];
    const result = await verifyChain(entries);
    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBe(1);
  });
});
