// worker/src/lib/ledgerBalance.ts
//
// Canonical "available balance" formula for a child's ledger. Single
// source of truth — insights.ts and family-audit.ts both call this instead
// of duplicating the SQL, after a 2026-07 audit found each had drifted
// from the correct formula independently (see
// docs/superpowers/specs/2026-07-07-balance-math-shared-fix-design.md).

import type { D1Database } from '@cloudflare/workers-types';

export async function getAvailableBalancePence(
  db: D1Database,
  familyId: string,
  childId: string,
): Promise<number> {
  const row = await db.prepare(`
    SELECT COALESCE(SUM(
      CASE entry_type
        WHEN 'credit'   THEN amount
        WHEN 'reversal' THEN -amount
        WHEN 'payment'  THEN -amount
        ELSE 0
      END
    ), 0) AS bal
    FROM ledger WHERE family_id = ? AND child_id = ?
      AND verification_status IN ('verified_auto', 'verified_manual')
  `).bind(familyId, childId).first<{ bal: number }>();
  return row?.bal ?? 0;
}
