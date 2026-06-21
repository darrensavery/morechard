// worker/src/jobs/suggestionPromotion.ts
//
// Item 8 — promote popular child suggestions into the app-wide market_rates library.
//
// Runs weekly (Monday 03:00 UTC, gated in scheduled()). It clusters NOVEL child
// suggestions — ones not already in market_rates — by a normalised title key + locale,
// counts DISTINCT FAMILIES per cluster, and parks any cluster that clears the
// promotion threshold in chore_promotion_candidates as a PENDING row for the operator
// to review. It then emails the operator a digest of anything newly waiting.
//
// Why distinct families, not raw suggestions: one enthusiastic child must not be able
// to manufacture a "trend" by suggesting the same thing 20 times. Cross-household
// breadth is the signal that a chore belongs in the shared library.
//
// Threshold scales with the active base so the bar rises with confidence:
//   max(3, ceil(0.5% of families that have ever suggested anything))
// At ~1,000 families this evaluates to 3 — low by design, because a human still
// approves every promotion. The count's only job is to filter the firehose into a
// short, reviewable queue, not to be the sole quality gate.

import { Env } from '../types.js';
import { nanoid } from '../lib/nanoid.js';
import { EmailService } from '../lib/email.js';

const ADMIN_EMAIL = 'darren.savery@gmail.com';

function currencyToLocale(currency: string): string {
  if (currency === 'PLN') return 'pl';
  if (currency === 'USD') return 'en-US';
  return 'en-GB'; // GBP and anything else
}

/** Cluster key: lowercase, strip punctuation, collapse whitespace. */
function normalizeTitle(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleCase(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map(w => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ');
}

/** Median with 10% symmetric trim once there are enough samples to bother. */
function trimmedMedian(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const trim = sorted.length >= 5 ? Math.floor(sorted.length * 0.1) : 0;
  const core = sorted.slice(trim, sorted.length - trim);
  const mid = Math.floor(core.length / 2);
  return core.length % 2 ? core[mid] : Math.round((core[mid - 1] + core[mid]) / 2);
}

interface SuggestionRow {
  title: string;
  proposed_amount: number;
  family_id: string;
  currency: string | null;
}

interface Cluster {
  normalizedKey: string;
  locale: string;
  families: Set<string>;
  amounts: number[];
  titleFreq: Map<string, number>; // raw title → count, to pick a display name
}

export async function runSuggestionPromotion(env: Env): Promise<void> {
  // 1. Build the exclusion set: chores already in the library (canonical names + synonyms),
  //    normalised, so we never re-surface something that already exists.
  const rateRows = await env.DB
    .prepare('SELECT canonical_name, synonyms FROM market_rates')
    .all<{ canonical_name: string; synonyms: string }>();

  const excluded = new Set<string>();
  for (const r of rateRows.results) {
    excluded.add(normalizeTitle(r.canonical_name));
    try {
      const syns = JSON.parse(r.synonyms) as string[];
      for (const s of syns) excluded.add(normalizeTitle(s));
    } catch { /* malformed synonyms — ignore */ }
  }

  // 2. Pull every live, non-rejected suggestion with its family's currency.
  //    'rejected' is excluded: that household actively didn't want it. 'pending' and
  //    'approved' both count — a parent approving a child's idea is a strong real-world signal.
  const sugRows = await env.DB
    .prepare(`
      SELECT s.title, s.proposed_amount, s.family_id, f.currency
      FROM suggestions s
      JOIN families f ON f.id = s.family_id
      WHERE s.status IN ('pending','approved')
        AND f.deleted_at IS NULL
    `)
    .all<SuggestionRow>();

  if (!sugRows.results.length) return;

  // 3. Cluster by (normalised key, locale), skipping anything already in the library.
  const clusters = new Map<string, Cluster>();
  const suggestingFamilies = new Set<string>();

  for (const row of sugRows.results) {
    const key = normalizeTitle(row.title);
    if (!key) continue;
    suggestingFamilies.add(row.family_id);
    if (excluded.has(key)) continue; // already in the library

    const locale = currencyToLocale(row.currency ?? 'GBP');
    const clusterKey = `${locale}::${key}`;
    let c = clusters.get(clusterKey);
    if (!c) {
      c = { normalizedKey: key, locale, families: new Set(), amounts: [], titleFreq: new Map() };
      clusters.set(clusterKey, c);
    }
    c.families.add(row.family_id);
    if (Number.isFinite(row.proposed_amount) && row.proposed_amount > 0) c.amounts.push(row.proposed_amount);
    const cleanTitle = row.title.trim().replace(/\s+/g, ' ');
    c.titleFreq.set(cleanTitle, (c.titleFreq.get(cleanTitle) ?? 0) + 1);
  }

  // 4. Threshold scales with the active suggesting base; floor of 3.
  const threshold = Math.max(3, Math.ceil(suggestingFamilies.size * 0.005));

  // 5. Upsert qualifying clusters as PENDING candidates. The ON CONFLICT … WHERE guard
  //    means promoted/dismissed clusters are never reopened.
  const now = Math.floor(Date.now() / 1000);
  for (const c of clusters.values()) {
    const distinctFamilies = c.families.size;
    if (distinctFamilies < threshold) continue;

    // Pick the most common raw spelling as the display name; collect example titles.
    const byFreq = [...c.titleFreq.entries()].sort((a, b) => b[1] - a[1]);
    const displayName = titleCase(byFreq[0][0]);
    const sampleTitles = byFreq.slice(0, 5).map(([t]) => t);
    const median = trimmedMedian(c.amounts);

    await env.DB
      .prepare(`
        INSERT INTO chore_promotion_candidates
          (id, normalized_key, locale, display_name, category,
           distinct_families, suggestion_count, median_amount, sample_titles,
           status, first_seen_at, last_seen_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,'pending',?,?,?)
        ON CONFLICT(normalized_key, locale) DO UPDATE SET
          display_name      = excluded.display_name,
          distinct_families = excluded.distinct_families,
          suggestion_count  = excluded.suggestion_count,
          median_amount     = excluded.median_amount,
          sample_titles     = excluded.sample_titles,
          last_seen_at      = excluded.last_seen_at,
          updated_at        = excluded.updated_at
        WHERE chore_promotion_candidates.status = 'pending'
      `)
      .bind(
        nanoid(), c.normalizedKey, c.locale, displayName, 'Good Habits',
        distinctFamilies, c.amounts.length, median, JSON.stringify(sampleTitles),
        now, now, now,
      )
      .run();
  }

  // 6. Alert the operator about anything new that's waiting for review.
  await emailNewCandidates(env);
}

/** Email a digest of pending candidates not yet alerted, then mark them alerted. */
async function emailNewCandidates(env: Env): Promise<void> {
  const pending = await env.DB
    .prepare(`
      SELECT id, display_name, locale, category, distinct_families, suggestion_count,
             median_amount, sample_titles
      FROM chore_promotion_candidates
      WHERE status = 'pending' AND emailed_at IS NULL
      ORDER BY distinct_families DESC
    `)
    .all<{
      id: string; display_name: string; locale: string; category: string;
      distinct_families: number; suggestion_count: number;
      median_amount: number | null; sample_titles: string;
    }>();

  if (!pending.results.length) return;

  const lines = pending.results.map((r, i) => {
    let samples: string[] = [];
    try { samples = JSON.parse(r.sample_titles) as string[]; } catch { /* ignore */ }
    const amount = r.median_amount != null ? `${(r.median_amount / 100).toFixed(2)}` : 'n/a';
    return [
      `${i + 1}. "${r.display_name}"  [${r.locale}]`,
      `   ${r.distinct_families} families · ${r.suggestion_count} suggestions · median ${amount}`,
      `   examples: ${samples.join(' / ')}`,
      `   id: ${r.id}`,
    ].join('\n');
  });

  const count = pending.results.length;
  const text = [
    `${count} chore suggestion${count === 1 ? '' : 's'} reached the promotion threshold and ${count === 1 ? 'is' : 'are'} waiting for your review.`,
    '',
    'Review queue:  GET  /api/admin/promotion-candidates   (X-Admin-Key)',
    'Approve:       POST /api/admin/promotion-candidates/{id}/promote',
    'Dismiss:       POST /api/admin/promotion-candidates/{id}/dismiss',
    '',
    lines.join('\n\n'),
  ].join('\n');

  const html = `<div style="font-family:system-ui,sans-serif;font-size:14px;color:#1a1a1a">
    <p style="font-size:16px;font-weight:700">🌱 ${count} chore${count === 1 ? '' : 's'} ready to review</p>
    <p style="color:#555">These reached the promotion threshold (distinct families). Approve to add them to the app-wide Chore Guide, or dismiss to keep them out for good.</p>
    <pre style="background:#f5f5f0;padding:16px;border-radius:8px;white-space:pre-wrap;font-size:12px">${text.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string))}</pre>
  </div>`;

  try {
    await new EmailService(env).sendTransactional({
      to: ADMIN_EMAIL,
      subject: `[Morechard] ${count} chore suggestion${count === 1 ? '' : 's'} ready to review`,
      html,
      text,
    });
  } catch (err) {
    // Don't let a mail failure strand the candidates — they'll retry next run while emailed_at is null.
    console.error('[suggestion-promotion] digest email failed', err);
    return;
  }

  const ids = pending.results.map(r => r.id);
  const placeholders = ids.map(() => '?').join(',');
  await env.DB
    .prepare(`UPDATE chore_promotion_candidates SET emailed_at = ? WHERE id IN (${placeholders})`)
    .bind(Math.floor(Date.now() / 1000), ...ids)
    .run();
}
