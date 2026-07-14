/**
 * The six Diagnostic Toolkit queries from docs/support/README.md, exposed
 * as tier-'read' agent tools. Every handler takes an already-resolved
 * familyId/userId/email (from identity.ts's exact-match lookup, Task 5) —
 * never raw text a model extracted.
 */
import { Env } from '../../../types.js';
import { registerTool } from '../registry.js';

export function registerReadTools(): void {
  registerTool({
    name: 'get_family_license_state',
    tier: 'read',
    description: "Family license/trial state — id, currency, governance mode, parenting mode, has_lifetime_license, has_ai_mentor, has_shield, trial_start_date, deleted_at",
    handler: async (env: Env, payload: { familyId: string }) => {
      return env.DB
        .prepare(`
          SELECT id, name, base_currency, verify_mode, parenting_mode,
                 has_lifetime_license, has_ai_mentor, has_shield,
                 trial_start_date, deleted_at
          FROM families WHERE id = ?
        `)
        .bind(payload.familyId)
        .first();
    },
  });

  registerTool({
    name: 'get_family_members',
    tier: 'read',
    description: 'Parents + children in a family, with roles',
    handler: async (env: Env, payload: { familyId: string }) => {
      const { results } = await env.DB
        .prepare(`
          SELECT u.id, u.display_name, fr.role, fr.parent_role, u.email
          FROM family_roles fr JOIN users u ON u.id = fr.user_id
          WHERE fr.family_id = ?
        `)
        .bind(payload.familyId)
        .all();
      return results;
    },
  });

  registerTool({
    name: 'get_payment_audit_log',
    tier: 'read',
    description: 'Full payment history for a family — has money actually landed?',
    handler: async (env: Env, payload: { familyId: string }) => {
      const { results } = await env.DB
        .prepare(`
          SELECT id, stripe_session_id, payment_type, amount_paid_int, currency, refunded_at, created_at
          FROM payment_audit_log WHERE family_id = ? ORDER BY created_at DESC
        `)
        .bind(payload.familyId)
        .all();
      return results;
    },
  });

  registerTool({
    name: 'get_ledger_tail',
    tier: 'read',
    description: 'Most recent 10 ledger entries for a family (chain head)',
    handler: async (env: Env, payload: { familyId: string }) => {
      const { results } = await env.DB
        .prepare(`
          SELECT id, entry_type, amount, verification_status, description, record_hash, created_at
          FROM ledger WHERE family_id = ? ORDER BY id DESC LIMIT 10
        `)
        .bind(payload.familyId)
        .all();
      return results;
    },
  });

  registerTool({
    name: 'get_login_attempt_state',
    tier: 'read',
    description: 'Auth lockout state for a canonical (already-resolved) email address',
    handler: async (env: Env, payload: { email: string }) => {
      return env.DB
        .prepare('SELECT email, attempts, window_start, locked_until FROM login_attempts WHERE email = ?')
        .bind(payload.email)
        .first();
    },
  });

  registerTool({
    name: 'get_active_sessions',
    tier: 'read',
    description: 'Active (non-revoked) sessions for a resolved userId',
    handler: async (env: Env, payload: { userId: string }) => {
      const { results } = await env.DB
        .prepare(`
          SELECT jti, role, issued_at, expires_at, revoked_at
          FROM sessions WHERE user_id = ? ORDER BY issued_at DESC
        `)
        .bind(payload.userId)
        .all();
      return results;
    },
  });
}
