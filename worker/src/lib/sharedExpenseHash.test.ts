/**
 * Tests for sharedExpenseHash — hash v1 (existing) and hash v2 (new).
 *
 * crypto.subtle is available natively in Node 18+ (no mocking needed).
 */

import { describe, it, expect } from 'vitest';
import {
  computeSharedExpenseHash,
  computeSharedExpenseHashV2,
  verifySharedExpenseHash,
  GENESIS_HASH,
} from './sharedExpenseHash';

// ─── Shared fixture ────────────────────────────────────────────────────────────

const BASE = {
  id: 42,
  familyId: 'fam-abc',
  loggedBy: 'user-xyz',
  totalAmount: 5000,
  currency: 'GBP',
  splitBp: 5000,
  previousHash: GENESIS_HASH,
};

// ─── computeSharedExpenseHashV2 ───────────────────────────────────────────────

describe('computeSharedExpenseHashV2', () => {
  it('produces a 64-char hex string', async () => {
    const hash = await computeSharedExpenseHashV2({
      ...BASE,
      expenseDate: '2026-05-01',
      note: 'Groceries',
      receiptHash: null,
      voidedAt: null,
      voidsId: null,
    });
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces a different hash to v1 for same core fields', async () => {
    const v1 = await computeSharedExpenseHash(
      BASE.id,
      BASE.familyId,
      BASE.loggedBy,
      BASE.totalAmount,
      BASE.currency,
      BASE.splitBp,
      BASE.previousHash,
    );
    const v2 = await computeSharedExpenseHashV2({
      ...BASE,
      expenseDate: null,
      note: null,
      receiptHash: null,
      voidedAt: null,
      voidsId: null,
    });
    expect(v2).not.toBe(v1);
  });

  it('null fields are treated as empty strings in payload', async () => {
    const withNulls = await computeSharedExpenseHashV2({
      ...BASE,
      expenseDate: null,
      note: null,
      receiptHash: null,
      voidedAt: null,
      voidsId: null,
    });
    // Equivalent call with explicit empty strings should produce the same hash
    const withEmpties = await computeSharedExpenseHashV2({
      ...BASE,
      expenseDate: '',
      note: '',
      receiptHash: '',
      voidedAt: null,
      voidsId: null,
    });
    expect(withNulls).toBe(withEmpties);
  });

  it('voidsId: 0 produces a different hash from voidsId: null', async () => {
    const withNull = await computeSharedExpenseHashV2({
      ...BASE,
      expenseDate: null,
      note: null,
      receiptHash: null,
      voidedAt: null,
      voidsId: null,
    });
    const withZero = await computeSharedExpenseHashV2({
      ...BASE,
      expenseDate: null,
      note: null,
      receiptHash: null,
      voidedAt: null,
      voidsId: 0,
    });
    // null maps to '' but 0 maps to '0' — payloads must differ
    expect(withZero).not.toBe(withNull);
  });

  it('different expenseDate produces different hash', async () => {
    const params = {
      ...BASE,
      note: null,
      receiptHash: null,
      voidedAt: null,
      voidsId: null,
    };
    const h1 = await computeSharedExpenseHashV2({ ...params, expenseDate: '2026-05-01' });
    const h2 = await computeSharedExpenseHashV2({ ...params, expenseDate: '2026-05-02' });
    expect(h1).not.toBe(h2);
  });

  it('different note produces different hash', async () => {
    const params = {
      ...BASE,
      expenseDate: '2026-05-01',
      receiptHash: null,
      voidedAt: null,
      voidsId: null,
    };
    const h1 = await computeSharedExpenseHashV2({ ...params, note: 'Groceries' });
    const h2 = await computeSharedExpenseHashV2({ ...params, note: 'Fuel' });
    expect(h1).not.toBe(h2);
  });

  it('different receiptHash produces different hash', async () => {
    const params = {
      ...BASE,
      expenseDate: '2026-05-01',
      note: null,
      voidedAt: null,
      voidsId: null,
    };
    const h1 = await computeSharedExpenseHashV2({ ...params, receiptHash: 'abc123' });
    const h2 = await computeSharedExpenseHashV2({ ...params, receiptHash: 'def456' });
    expect(h1).not.toBe(h2);
  });
});

// ─── verifySharedExpenseHash ──────────────────────────────────────────────────

describe('verifySharedExpenseHash', () => {
  it('verifies a v1 row correctly', async () => {
    const record_hash = await computeSharedExpenseHash(
      BASE.id,
      BASE.familyId,
      BASE.loggedBy,
      BASE.totalAmount,
      BASE.currency,
      BASE.splitBp,
      BASE.previousHash,
    );
    const result = await verifySharedExpenseHash({
      id: BASE.id,
      family_id: BASE.familyId,
      logged_by: BASE.loggedBy,
      total_amount: BASE.totalAmount,
      currency: BASE.currency,
      split_bp: BASE.splitBp,
      previous_hash: BASE.previousHash,
      record_hash,
      hash_version: 1,
    });
    expect(result.valid).toBe(true);
    expect(result.version).toBe(1);
  });

  it('verifies a v2 row correctly', async () => {
    const v2Params = {
      ...BASE,
      expenseDate: '2026-05-01',
      note: 'Groceries',
      receiptHash: 'abc123',
      voidedAt: null,
      voidsId: null,
    };
    const record_hash = await computeSharedExpenseHashV2(v2Params);
    const result = await verifySharedExpenseHash({
      id: BASE.id,
      family_id: BASE.familyId,
      logged_by: BASE.loggedBy,
      total_amount: BASE.totalAmount,
      currency: BASE.currency,
      split_bp: BASE.splitBp,
      previous_hash: BASE.previousHash,
      record_hash,
      hash_version: 2,
      expense_date: '2026-05-01',
      note: 'Groceries',
      receipt_hash: 'abc123',
      voided_at: null,
      voids_id: null,
    });
    expect(result.valid).toBe(true);
    expect(result.version).toBe(2);
  });

  it('returns valid: false for a tampered v1 row', async () => {
    const record_hash = await computeSharedExpenseHash(
      BASE.id,
      BASE.familyId,
      BASE.loggedBy,
      BASE.totalAmount,
      BASE.currency,
      BASE.splitBp,
      BASE.previousHash,
    );
    const result = await verifySharedExpenseHash({
      id: BASE.id,
      family_id: BASE.familyId,
      logged_by: BASE.loggedBy,
      total_amount: BASE.totalAmount + 1, // tampered
      currency: BASE.currency,
      split_bp: BASE.splitBp,
      previous_hash: BASE.previousHash,
      record_hash,
      hash_version: 1,
    });
    expect(result.valid).toBe(false);
  });

  it('returns valid: false for a tampered v2 row', async () => {
    const record_hash = await computeSharedExpenseHashV2({
      ...BASE,
      expenseDate: '2026-05-01',
      note: 'Groceries',
      receiptHash: null,
      voidedAt: null,
      voidsId: null,
    });
    const result = await verifySharedExpenseHash({
      id: BASE.id,
      family_id: BASE.familyId,
      logged_by: BASE.loggedBy,
      total_amount: BASE.totalAmount,
      currency: BASE.currency,
      split_bp: BASE.splitBp,
      previous_hash: BASE.previousHash,
      record_hash,
      hash_version: 2,
      expense_date: '2026-05-02', // tampered date
      note: 'Groceries',
      receipt_hash: null,
      voided_at: null,
      voids_id: null,
    });
    expect(result.valid).toBe(false);
  });

  it('returns the correct version number', async () => {
    const record_hash_v1 = await computeSharedExpenseHash(
      BASE.id,
      BASE.familyId,
      BASE.loggedBy,
      BASE.totalAmount,
      BASE.currency,
      BASE.splitBp,
      BASE.previousHash,
    );
    const r1 = await verifySharedExpenseHash({
      id: BASE.id,
      family_id: BASE.familyId,
      logged_by: BASE.loggedBy,
      total_amount: BASE.totalAmount,
      currency: BASE.currency,
      split_bp: BASE.splitBp,
      previous_hash: BASE.previousHash,
      record_hash: record_hash_v1,
      hash_version: 1,
    });
    expect(r1.version).toBe(1);

    const record_hash_v2 = await computeSharedExpenseHashV2({
      ...BASE,
      expenseDate: null,
      note: null,
      receiptHash: null,
      voidedAt: null,
      voidsId: null,
    });
    const r2 = await verifySharedExpenseHash({
      id: BASE.id,
      family_id: BASE.familyId,
      logged_by: BASE.loggedBy,
      total_amount: BASE.totalAmount,
      currency: BASE.currency,
      split_bp: BASE.splitBp,
      previous_hash: BASE.previousHash,
      record_hash: record_hash_v2,
      hash_version: 2,
      expense_date: null,
      note: null,
      receipt_hash: null,
      voided_at: null,
      voids_id: null,
    });
    expect(r2.version).toBe(2);
  });
});
