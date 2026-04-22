import { describe, expect, test, beforeEach } from 'vitest';
import {
  getDetails, setDetails, clearDetails, type StoredBankDetails,
} from './localBankDetails';

beforeEach(() => { localStorage.clear(); });

describe('localBankDetails', () => {
  test('setDetails then getDetails round-trips', () => {
    const d: StoredBankDetails = {
      childId: 'c_abc',
      sortCode: '201575',
      accountNumber: '12345678',
      updatedAt: 0, // overwritten by setDetails
    };
    setDetails('fam_1', 'c_abc', d);
    const got = getDetails('fam_1', 'c_abc');
    expect(got?.sortCode).toBe('201575');
    expect(got?.accountNumber).toBe('12345678');
    expect(got?.updatedAt).toBeGreaterThan(0);
  });

  test('getDetails returns null for unknown child', () => {
    expect(getDetails('fam_1', 'c_missing')).toBeNull();
  });

  test('setDetails on one child does not affect another', () => {
    setDetails('fam_1', 'c_abc', { childId: 'c_abc', sortCode: '111111', updatedAt: 0 });
    setDetails('fam_1', 'c_def', { childId: 'c_def', sortCode: '222222', updatedAt: 0 });
    expect(getDetails('fam_1', 'c_abc')?.sortCode).toBe('111111');
    expect(getDetails('fam_1', 'c_def')?.sortCode).toBe('222222');
  });

  test('clearDetails removes only the target child', () => {
    setDetails('fam_1', 'c_abc', { childId: 'c_abc', sortCode: '111111', updatedAt: 0 });
    setDetails('fam_1', 'c_def', { childId: 'c_def', sortCode: '222222', updatedAt: 0 });
    clearDetails('fam_1', 'c_abc');
    expect(getDetails('fam_1', 'c_abc')).toBeNull();
    expect(getDetails('fam_1', 'c_def')?.sortCode).toBe('222222');
  });

  test('stores Zelle handle (US)', () => {
    setDetails('fam_1', 'c_abc', {
      childId: 'c_abc',
      zelleHandle: 'alex@example.com',
      updatedAt: 0,
    });
    expect(getDetails('fam_1', 'c_abc')?.zelleHandle).toBe('alex@example.com');
  });

  test('survives corrupt JSON gracefully', () => {
    localStorage.setItem('morechard.bankdetails.v1.fam_1', 'not-json');
    expect(getDetails('fam_1', 'c_abc')).toBeNull();
  });
});
