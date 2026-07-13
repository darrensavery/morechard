/**
 * Deterministic identity resolution — the ONLY path by which a model-
 * extracted candidate email becomes a family_id/user_id the rest of the
 * system can act on. No fuzzy matching, no "closest match": an exact miss
 * resolves to null and the caller (processIncident, Task 14) must treat
 * that as an unconfirmed identity, never guess.
 */

export function normalizeEmailCandidate(raw: string): string {
  return raw.trim().toLowerCase();
}

export interface ResolvedIdentity {
  userId: string;
  familyId: string;
  email: string; // canonical value from the users table, not the candidate text
}

export async function resolveFamilyIdentity(
  db: D1Database,
  candidateEmail: string,
): Promise<ResolvedIdentity | null> {
  const normalized = normalizeEmailCandidate(candidateEmail);
  if (!normalized || !normalized.includes('@')) return null;

  const row = await db
    .prepare('SELECT id, family_id, email FROM users WHERE email = ?')
    .bind(normalized)
    .first<{ id: string; family_id: string; email: string }>();

  if (!row) return null;
  return { userId: row.id, familyId: row.family_id, email: row.email };
}
