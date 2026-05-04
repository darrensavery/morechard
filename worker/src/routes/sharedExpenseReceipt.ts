/**
 * Shared expense receipt routes (R2 — RECEIPTS bucket)
 *
 * POST   /api/shared-expenses/:id/receipt   Upload receipt (any parent in family)
 * GET    /api/shared-expenses/:id/receipt   Get presigned URL (1-hour expiry)
 * DELETE /api/shared-expenses/:id/receipt   Delete receipt (48h window, logging parent only)
 *
 * R2 key format: {family_id}/{expenseId}/{timestamp}.{ext}
 * Max size: 10 MB
 * Allowed types: image/jpeg, image/png, image/webp, image/heic, image/heif, application/pdf
 */

import { computeSharedExpenseHashV2 } from '../lib/sharedExpenseHash.js';
import { AuthedRequest } from './auth.js';
import { Env } from '../types.js';
import { json as jsonOk, error as jsonErr } from '../lib/response.js';

// Allowed MIME types for receipts
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
];

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

function extFromMime(mime: string): string {
  return (
    ({
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/heic': 'heic',
      'image/heif': 'heic',
      'application/pdf': 'pdf',
    } as Record<string, string>)[mime] ?? 'bin'
  );
}

async function sha256hex(buf: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

interface SharedExpenseRow {
  id: number;
  family_id: string;
  logged_by: string;
  receipt_uploaded_at: number | null;
  receipt_r2_key: string | null;
  receipt_hash: string | null;
  hash_version: number;
  previous_hash: string;
  record_hash: string;
  expense_date: string | null;
  note: string | null;
  total_amount: number;
  currency: string;
  split_bp: number;
  verification_status: string;
  voided_at: number | null;
  voids_id: number | null;
}

async function fetchExpenseRow(
  env: Env,
  expenseId: string,
  familyId: string,
): Promise<SharedExpenseRow | null> {
  return env.DB.prepare(
    `SELECT id, family_id, logged_by, receipt_uploaded_at, receipt_r2_key, receipt_hash,
            hash_version, previous_hash, record_hash, expense_date, note,
            total_amount, currency, split_bp, verification_status, voided_at, voids_id
     FROM shared_expenses
     WHERE id = ? AND family_id = ? AND deleted_at IS NULL`,
  )
    .bind(expenseId, familyId)
    .first<SharedExpenseRow>();
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/shared-expenses/:id/receipt
// Upload a receipt. Any authenticated parent in the family may upload.
// ─────────────────────────────────────────────────────────────────────────────
export async function handleUploadReceipt(
  request: AuthedRequest,
  env: Env,
  expenseId: string,
): Promise<Response> {
  const auth = request.auth;

  // 1. Auth check (caller must be a parent — enforced upstream, but guard here too)
  if (!auth) return jsonErr('Unauthorized', 401);

  // 2. Fetch expense row
  const row = await fetchExpenseRow(env, expenseId, auth.family_id);
  if (!row) return jsonErr('Shared expense not found', 404);

  // 4. Read raw bytes
  const bytes = await request.arrayBuffer();
  if (!bytes || bytes.byteLength === 0) return jsonErr('Request body is empty', 400);

  // 5. Content-Type check
  const contentType = (request.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  if (!ALLOWED_TYPES.includes(contentType)) {
    return jsonErr(
      `Unsupported file type. Allowed: ${ALLOWED_TYPES.join(', ')}`,
      415,
    );
  }

  // 6. Size check
  if (bytes.byteLength > MAX_BYTES) {
    return jsonErr('Receipt too large (max 10MB)', 413);
  }

  // 7. Hash the bytes
  const receiptHash = await sha256hex(bytes);

  // 8. Build R2 key
  const ext = extFromMime(contentType);
  const r2Key = `${row.family_id}/${expenseId}/${Date.now()}.${ext}`;

  // 9. Delete existing receipt if present
  if (row.receipt_r2_key) {
    try {
      await env.RECEIPTS.delete(row.receipt_r2_key);
    } catch {
      // Non-fatal: object may already be missing
    }
  }

  // 10. Upload to R2
  await env.RECEIPTS.put(r2Key, bytes, { httpMetadata: { contentType } });

  // 11. Update DB columns
  const receiptUploadedAt = Math.floor(Date.now() / 1000);
  await env.DB.prepare(
    `UPDATE shared_expenses SET receipt_r2_key = ?, receipt_hash = ?, receipt_uploaded_at = ? WHERE id = ?`,
  )
    .bind(r2Key, receiptHash, receiptUploadedAt, row.id)
    .run();

  // 12. Re-derive record_hash if the row is committed
  const committedStatuses = ['committed_auto', 'committed_manual'];
  if (committedStatuses.includes(row.verification_status)) {
    const newRecordHash = await computeSharedExpenseHashV2({
      id: row.id,
      familyId: row.family_id,
      loggedBy: row.logged_by,
      totalAmount: row.total_amount,
      currency: row.currency,
      splitBp: row.split_bp,
      previousHash: row.previous_hash,
      expenseDate: row.expense_date,
      note: row.note,
      receiptHash,
      voidedAt: row.voided_at ?? null,
      voidsId: row.voids_id ?? null,
    });
    await env.DB.prepare(`UPDATE shared_expenses SET record_hash = ? WHERE id = ?`)
      .bind(newRecordHash, row.id)
      .run();
  }

  // 13. Return result
  return jsonOk({ id: row.id, receipt_uploaded_at: receiptUploadedAt });
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/shared-expenses/:id/receipt
// Returns a presigned URL valid for 1 hour.
// Any authenticated family member may fetch.
// ─────────────────────────────────────────────────────────────────────────────
export async function handleGetReceiptUrl(
  request: AuthedRequest,
  env: Env,
  expenseId: string,
): Promise<Response> {
  const auth = request.auth;
  if (!auth) return jsonErr('Unauthorized', 401);

  // 2. Fetch receipt_r2_key from the row
  const row = await env.DB.prepare(
    `SELECT receipt_r2_key FROM shared_expenses WHERE id = ? AND family_id = ? AND deleted_at IS NULL`,
  )
    .bind(expenseId, auth.family_id)
    .first<{ receipt_r2_key: string | null }>();

  if (!row) return jsonErr('Shared expense not found', 404);

  // 3. Check receipt exists
  if (!row.receipt_r2_key) return jsonErr('No receipt attached', 404);

  // 4. Generate presigned URL
  // createSignedUrl is a Cloudflare R2 runtime method not yet fully typed in workers-types
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const url = await (env.RECEIPTS as unknown as any).createSignedUrl(row.receipt_r2_key, {
    expiresIn: 3600,
  });

  return jsonOk({ url });
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/shared-expenses/:id/receipt
// Delete a receipt. Only the logging parent may delete. 48-hour window.
// ─────────────────────────────────────────────────────────────────────────────
export async function handleDeleteReceipt(
  request: AuthedRequest,
  env: Env,
  expenseId: string,
): Promise<Response> {
  const auth = request.auth;
  if (!auth) return jsonErr('Unauthorized', 401);

  // 2. Fetch expense row
  const row = await fetchExpenseRow(env, expenseId, auth.family_id);
  if (!row) return jsonErr('Shared expense not found', 404);

  // 1. Only the logging parent can delete
  if (row.logged_by !== auth.sub) {
    return jsonErr('Only the parent who logged this expense can delete its receipt', 403);
  }

  // 3. Check receipt exists
  if (!row.receipt_r2_key) return jsonErr('No receipt attached', 404);

  // 4. Check 48h delete window
  const now = Math.floor(Date.now() / 1000);
  if (row.receipt_uploaded_at !== null && now - row.receipt_uploaded_at > 48 * 3600) {
    return jsonOk(
      {
        error: 'Receipt delete window has passed (48 hours). Use the Void-and-Re-log flow to correct this expense.',
        hint: 'void',
      },
      409,
    );
  }

  // 5. Delete from R2
  await env.RECEIPTS.delete(row.receipt_r2_key);

  // 6. Clear DB columns
  await env.DB.prepare(
    `UPDATE shared_expenses SET receipt_r2_key = NULL, receipt_hash = NULL, receipt_uploaded_at = NULL WHERE id = ?`,
  )
    .bind(row.id)
    .run();

  // 7. Re-derive record_hash with receiptHash = null if committed
  const committedStatuses = ['committed_auto', 'committed_manual'];
  if (committedStatuses.includes(row.verification_status)) {
    const newRecordHash = await computeSharedExpenseHashV2({
      id: row.id,
      familyId: row.family_id,
      loggedBy: row.logged_by,
      totalAmount: row.total_amount,
      currency: row.currency,
      splitBp: row.split_bp,
      previousHash: row.previous_hash,
      expenseDate: row.expense_date,
      note: row.note,
      receiptHash: null,
      voidedAt: row.voided_at ?? null,
      voidsId: row.voids_id ?? null,
    });
    await env.DB.prepare(`UPDATE shared_expenses SET record_hash = ? WHERE id = ?`)
      .bind(newRecordHash, row.id)
      .run();
  }

  // 8. Return result
  return jsonOk({ id: row.id, deleted: true });
}
