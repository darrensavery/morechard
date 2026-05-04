// worker/src/routes/sharedExpenseVoid.ts
import { computeSharedExpenseHashV2, getLastCommittedHash, GENESIS_HASH } from '../lib/sharedExpenseHash.js';
import { AuthedRequest } from './auth.js';
import { Env } from '../types.js';
import { json as jsonOk, error as jsonErr, clientIp as ip } from '../lib/response.js';

const VALID_CATEGORIES = ['education', 'health', 'clothing', 'travel', 'activities', 'childcare', 'food', 'tech', 'gifts', 'other'];

// ---------------------------------------------------------------------------
// POST /api/shared-expenses/:id/void
// Void an expense. Optionally creates a replacement (corrected) row.
// No time restriction — void is always available.
// ---------------------------------------------------------------------------
export async function handleVoidSharedExpense(
  req: AuthedRequest,
  env: Env,
  expenseId: string,
): Promise<Response> {
  if (!req.auth) return jsonErr('Unauthorized', 401);

  // 1. Fetch the expense
  const expense = await env.DB
    .prepare(
      `SELECT id, family_id, logged_by, verification_status, voided_at,
              description, category, total_amount, currency, split_bp,
              expense_date, note, receipt_hash, hash_version, previous_hash, record_hash
       FROM shared_expenses
       WHERE id = ? AND family_id = ? AND deleted_at IS NULL`,
    )
    .bind(expenseId, req.auth.family_id)
    .first<{
      id: number;
      family_id: string;
      logged_by: string;
      verification_status: string;
      voided_at: number | null;
      description: string;
      category: string;
      total_amount: number;
      currency: string;
      split_bp: number;
      expense_date: string | null;
      note: string | null;
      receipt_hash: string | null;
      hash_version: number;
      previous_hash: string;
      record_hash: string;
    }>();

  if (!expense) return jsonErr('expense not found', 404);
  if (expense.voided_at !== null) return jsonErr('Expense is already voided', 409);

  // 2. Validate body
  const body = await req.json<{
    reason: string;
    replacement?: {
      description: string;
      category: string;
      total_amount: number;
      split_bp?: number;
      expense_date?: string;
      note?: string;
    };
  }>();

  if (!body.reason?.trim()) return jsonErr('reason is required', 400);

  if (body.replacement) {
    const r = body.replacement;
    if (!r.description?.trim()) return jsonErr('replacement.description is required', 400);
    if (!r.category || !VALID_CATEGORIES.includes(r.category)) return jsonErr('replacement.category is invalid', 400);
    if (!Number.isInteger(r.total_amount) || r.total_amount <= 0) {
      return jsonErr('replacement.total_amount must be a positive integer (pence/cents/grosze)', 400);
    }
    if (r.split_bp !== undefined && (!Number.isInteger(r.split_bp) || r.split_bp < 0 || r.split_bp > 10000)) {
      return jsonErr('replacement.split_bp must be an integer 0–10000', 400);
    }
    if (r.expense_date && !/^\d{4}-\d{2}-\d{2}$/.test(r.expense_date)) {
      return jsonErr('replacement.expense_date must be in YYYY-MM-DD format', 400);
    }
  }

  // 3. Mark the original row as voided + re-hash if committed
  const nowSec = Math.floor(Date.now() / 1000);
  const isCommitted =
    expense.verification_status === 'committed_auto' ||
    expense.verification_status === 'committed_manual';

  const voidStmt = env.DB
    .prepare(
      `UPDATE shared_expenses SET voided_at = ?, voided_by = ?, note = ? WHERE id = ?`,
    )
    .bind(nowSec, req.auth.sub, body.reason.trim(), expense.id);

  if (isCommitted) {
    // Compute new hash that includes the voided_at value
    const newHash = await computeSharedExpenseHashV2({
      id: expense.id,
      familyId: expense.family_id,
      loggedBy: expense.logged_by,
      totalAmount: expense.total_amount,
      currency: expense.currency,
      splitBp: expense.split_bp,
      previousHash: expense.previous_hash,
      expenseDate: expense.expense_date,
      note: body.reason.trim(),
      receiptHash: expense.receipt_hash,
      voidedAt: nowSec,
      voidsId: null,
    });

    await env.DB.batch([
      voidStmt,
      env.DB.prepare('UPDATE shared_expenses SET record_hash = ? WHERE id = ?').bind(newHash, expense.id),
    ]);
  } else {
    await voidStmt.run();
  }

  // 4. Optionally create a replacement row
  if (body.replacement) {
    const r = body.replacement;

    const family = await env.DB
      .prepare('SELECT currency, verify_mode, shared_expense_threshold, shared_expense_split_bp FROM families WHERE id = ?')
      .bind(req.auth.family_id)
      .first<{ currency: string; verify_mode: string; shared_expense_threshold: number; shared_expense_split_bp: number }>();

    if (!family) return jsonErr('family not found', 404);

    const splitBp = r.split_bp ?? family.shared_expense_split_bp;
    const isAmicable = family.verify_mode === 'amicable';
    const underThreshold = r.total_amount <= family.shared_expense_threshold;
    const autoCommit = isAmicable || underThreshold;

    const insertStatus = autoCommit ? 'committed_auto' : 'pending';
    const previousHash = autoCommit ? await getLastCommittedHash(env.DB, req.auth.family_id) : GENESIS_HASH;
    const replacementNote = r.note ?? body.reason.trim();

    const insertResult = await env.DB
      .prepare(
        `INSERT INTO shared_expenses
           (family_id, logged_by, description, category, total_amount, currency,
            split_bp, verification_status, previous_hash, record_hash, ip_address,
            expense_date, note, voids_id, hash_version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, 2)`,
      )
      .bind(
        req.auth.family_id,
        req.auth.sub,
        r.description.trim(),
        r.category,
        r.total_amount,
        family.currency,
        splitBp,
        insertStatus,
        previousHash,
        ip(req),
        r.expense_date ?? null,
        replacementNote,
        expense.id,
      )
      .run();

    const newId = insertResult.meta.last_row_id as number;

    if (autoCommit) {
      const recordHash = await computeSharedExpenseHashV2({
        id: newId,
        familyId: req.auth.family_id,
        loggedBy: req.auth.sub,
        totalAmount: r.total_amount,
        currency: family.currency,
        splitBp,
        previousHash,
        expenseDate: r.expense_date ?? null,
        note: replacementNote,
        receiptHash: null,
        voidedAt: null,
        voidsId: expense.id,
      });

      await env.DB.batch([
        env.DB.prepare('UPDATE shared_expenses SET record_hash = ? WHERE id = ?').bind(recordHash, newId),
      ]);
    }

    return jsonOk({ voided_id: expense.id, replacement_id: newId, verification_status: insertStatus });
  }

  return jsonOk({ voided_id: expense.id, replacement_id: null });
}
