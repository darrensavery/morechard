import { describe, expect, test, beforeEach } from 'vitest';
import {
  getDetails, setDetails, clearDetails, type StoredBankDetails,
} from './localBankDetails';

function deleteVaultDb(): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase('morechard-bank-vault');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve(); // no open connections in tests; shouldn't happen
  });
}

beforeEach(async () => {
  sessionStorage.clear();
  await deleteVaultDb();
});

describe('localBankDetails (encrypted vault)', () => {
  test('setDetails then getDetails round-trips', async () => {
    const d: StoredBankDetails = {
      childId: 'c_abc',
      sortCode: '201575',
      accountNumber: '12345678',
      updatedAt: 0, // overwritten by setDetails
    };
    await setDetails('fam_1', 'c_abc', d);
    const got = await getDetails('fam_1', 'c_abc');
    expect(got?.sortCode).toBe('201575');
    expect(got?.accountNumber).toBe('12345678');
    expect(got?.updatedAt).toBeGreaterThan(0);
  });

  test('getDetails returns null for unknown child', async () => {
    expect(await getDetails('fam_1', 'c_missing')).toBeNull();
  });

  test('setDetails on one child does not affect another', async () => {
    await setDetails('fam_1', 'c_abc', { childId: 'c_abc', sortCode: '111111', updatedAt: 0 });
    await setDetails('fam_1', 'c_def', { childId: 'c_def', sortCode: '222222', updatedAt: 0 });
    expect((await getDetails('fam_1', 'c_abc'))?.sortCode).toBe('111111');
    expect((await getDetails('fam_1', 'c_def'))?.sortCode).toBe('222222');
  });

  test('clearDetails removes only the target child', async () => {
    await setDetails('fam_1', 'c_abc', { childId: 'c_abc', sortCode: '111111', updatedAt: 0 });
    await setDetails('fam_1', 'c_def', { childId: 'c_def', sortCode: '222222', updatedAt: 0 });
    await clearDetails('fam_1', 'c_abc');
    expect(await getDetails('fam_1', 'c_abc')).toBeNull();
    expect((await getDetails('fam_1', 'c_def'))?.sortCode).toBe('222222');
  });

  test('stores Zelle handle (US)', async () => {
    await setDetails('fam_1', 'c_abc', {
      childId: 'c_abc',
      zelleHandle: 'alex@example.com',
      updatedAt: 0,
    });
    expect((await getDetails('fam_1', 'c_abc'))?.zelleHandle).toBe('alex@example.com');
  });

  test('different families do not share a vault entry', async () => {
    await setDetails('fam_1', 'c_abc', { childId: 'c_abc', sortCode: '111111', updatedAt: 0 });
    await setDetails('fam_2', 'c_abc', { childId: 'c_abc', sortCode: '999999', updatedAt: 0 });
    expect((await getDetails('fam_1', 'c_abc'))?.sortCode).toBe('111111');
    expect((await getDetails('fam_2', 'c_abc'))?.sortCode).toBe('999999');
  });

  test('data does not survive a new tab session (sessionStorage cleared)', async () => {
    await setDetails('fam_1', 'c_abc', { childId: 'c_abc', sortCode: '111111', updatedAt: 0 });
    expect((await getDetails('fam_1', 'c_abc'))?.sortCode).toBe('111111');

    // Simulate a closed-and-reopened tab: sessionStorage is gone, IndexedDB isn't.
    sessionStorage.clear();

    expect(await getDetails('fam_1', 'c_abc')).toBeNull();
  });

  test('is actually encrypted at rest — the raw ciphertext contains no plaintext PII', async () => {
    await setDetails('fam_1', 'c_abc', {
      childId: 'c_abc',
      sortCode: '201575',
      accountNumber: '87654321',
      updatedAt: 0,
    });

    const raw = await new Promise<unknown>((resolve, reject) => {
      const openReq = indexedDB.open('morechard-bank-vault');
      openReq.onsuccess = () => {
        const db = openReq.result;
        const getReq = db.transaction('entries', 'readonly').objectStore('entries').get('fam_1');
        getReq.onsuccess = () => { resolve(getReq.result); db.close(); };
        getReq.onerror = () => { reject(getReq.error); db.close(); };
      };
      openReq.onerror = () => reject(openReq.error);
    });

    const serialized = JSON.stringify(raw, (_key, value) =>
      value instanceof ArrayBuffer ? Array.from(new Uint8Array(value)) : value);
    expect(serialized).not.toContain('201575');
    expect(serialized).not.toContain('87654321');
  });
});
