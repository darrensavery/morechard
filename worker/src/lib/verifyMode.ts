/**
 * Resolves the effective Approval Mode ('amicable' | 'standard') for a
 * specific child — the family's `verify_mode` unless the child has a
 * per-child `verify_mode_override` (set via the child-governance flow in
 * routes/childControls.ts), which takes precedence.
 */

import { Env } from '../types.js';

export type VerifyMode = 'amicable' | 'standard';

export async function resolveVerifyMode(
  env: Env, familyId: string, childId: string,
): Promise<VerifyMode> {
  const row = await env.DB.prepare(`
    SELECT f.verify_mode AS family_mode, u.verify_mode_override AS child_override
    FROM families f
    LEFT JOIN users u ON u.id = ? AND u.family_id = f.id
    WHERE f.id = ?
  `).bind(childId, familyId).first<{ family_mode: VerifyMode | null; child_override: VerifyMode | null }>();

  return row?.child_override ?? row?.family_mode ?? 'standard';
}
