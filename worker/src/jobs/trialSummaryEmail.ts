// worker/src/jobs/trialSummaryEmail.ts
//
// End-of-trial usage summary email — a value-proof touchpoint, not a discount.
// Runs daily. For every family whose 14-day trial has ended, hasn't purchased
// anything, and hasn't been sent this email yet, checks a meaningful activity
// bar (3+ verified completed chores) and — if met — emails the lead parent a
// short summary of what their family did, with a link back into the app. The
// PDF export itself is never attached; it stays behind the existing
// authenticated in-app download (Settings → Data & Exports), which is already
// unrestricted for every account regardless of purchase.
//
// Deliberately NOT behavior-triggered on anything conflict-adjacent — this
// fires identically for every family based purely on trial elapsing, unlike
// the co-parenting-signal-based Shield AI discount idea that was ruled out.

import { Env } from '../types.js';
import { EmailService, buildTrialSummaryEmailHtml, buildTrialSummaryEmailText } from '../lib/email.js';

const TRIAL_DAYS = 14;
const MIN_COMPLETED_CHORES = 3;

interface EligibleFamily {
  id:         string;
  name:       string;
  currency:   string;
  lead_email: string | null;
  lead_name:  string | null;
}

export interface TrialSummaryStats {
  completedChores: number;
  totalEarnedPence: number;
  childCount: number;
}

function currencySymbol(currency: string): string {
  if (currency === 'USD') return '$';
  if (currency === 'PLN') return 'zł';
  return '£';
}

export function formatSummaryAmount(pence: number, currency: string): string {
  return `${currencySymbol(currency)}${(pence / 100).toFixed(2)}`;
}

export async function runTrialSummaryEmail(env: Env, nowMs: number = Date.now()): Promise<void> {
  const cutoffIso = new Date(nowMs - TRIAL_DAYS * 86_400_000).toISOString();

  const families = await env.DB
    .prepare(`
      SELECT f.id, f.name, f.currency, u.email AS lead_email, u.display_name AS lead_name
      FROM families f
      JOIN family_roles fr ON fr.family_id = f.id AND fr.role = 'parent' AND fr.parent_role = 'lead'
      JOIN users u ON u.id = fr.user_id
      WHERE f.is_activated = 1
        AND f.has_lifetime_license = 0
        AND f.is_demo = 0
        AND f.deleted_at IS NULL
        AND f.trial_summary_sent_at IS NULL
        AND f.trial_start_date IS NOT NULL
        AND f.trial_start_date <= ?
    `)
    .bind(cutoffIso)
    .all<EligibleFamily>();

  for (const family of families.results) {
    try {
      await processFamily(env, family);
    } catch (err) {
      // One family's failure (bad email, transient Resend error) must not
      // block the rest of the batch or cause an infinite retry loop — it
      // stays eligible (trial_summary_sent_at untouched) and is picked up
      // again on tomorrow's run.
      console.error(`[trial-summary-email] failed for family ${family.id}:`, err);
    }
  }
}

async function processFamily(env: Env, family: EligibleFamily): Promise<void> {
  if (!family.lead_email) return;

  const stats = await getTrialStats(env, family.id);
  if (stats.completedChores < MIN_COMPLETED_CHORES) return;

  const displayName = family.lead_name ?? 'there';
  const earnedDisplay = formatSummaryAmount(stats.totalEarnedPence, family.currency);

  await new EmailService(env).sendTransactional({
    to:      family.lead_email,
    subject: 'Your first 14 days with Morechard',
    html:    buildTrialSummaryEmailHtml(displayName, stats, earnedDisplay, env.APP_URL),
    text:    buildTrialSummaryEmailText(displayName, stats, earnedDisplay, env.APP_URL),
  });

  await env.DB
    .prepare('UPDATE families SET trial_summary_sent_at = ? WHERE id = ?')
    .bind(Math.floor(Date.now() / 1000), family.id)
    .run();
}

async function getTrialStats(env: Env, familyId: string): Promise<TrialSummaryStats> {
  const [completedRow, earnedRow, childRow] = await Promise.all([
    env.DB
      .prepare(`SELECT COUNT(*) AS cnt FROM completions WHERE family_id = ? AND status = 'completed'`)
      .bind(familyId)
      .first<{ cnt: number }>(),
    env.DB
      .prepare(`
        SELECT COALESCE(SUM(amount), 0) AS total
        FROM ledger
        WHERE family_id = ?
          AND entry_type = 'credit'
          AND verification_status IN ('verified_auto', 'verified_manual')
      `)
      .bind(familyId)
      .first<{ total: number }>(),
    env.DB
      .prepare(`SELECT COUNT(*) AS cnt FROM family_roles WHERE family_id = ? AND role = 'child'`)
      .bind(familyId)
      .first<{ cnt: number }>(),
  ]);

  return {
    completedChores:  completedRow?.cnt ?? 0,
    totalEarnedPence: earnedRow?.total ?? 0,
    childCount:       childRow?.cnt ?? 0,
  };
}
