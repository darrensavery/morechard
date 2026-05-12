/**
 * Export routes — GDPR/RODO Right to Portability + Tiered PDF Reports
 *
 * GET /api/export/json?family_id=&lang=en|pl
 *   Full structured data export. Satisfies GDPR Article 20 (data portability).
 *
 * GET /api/export/pdf?family_id=&lang=en|pl&tier=basic|behavioral|forensic
 *   Returns a print-ready HTML document. Three tiers:
 *
 *   basic       — Family Orchard Summary (Morechard Core licence)
 *                 Summary cards, ledger table, status log.
 *
 *   behavioral  — Growth & Learning Curriculum (requires AI Mentor — Core AI or Morechard Shield AI)
 *                 All basic content plus Learning Lab modules and Behavioural Pulse.
 *
 *   forensic    — Immutable Chain of Custody (Legal version)
 *                 Full SHA-256 proof hashes, verification confidence, Haversine
 *                 variance, device fingerprint, governance audit. No Orchard metaphors.
 *
 * Privacy constraint: GPS coordinates and IP addresses are read from D1 and
 * rendered directly into the PDF response. They are never returned to or stored
 * in client-side state.
 */

import { Env } from '../types.js';
import { error } from '../lib/response.js';
import { sha256 } from '../lib/hash.js';

// ----------------------------------------------------------------
// GET /api/export/json
// ----------------------------------------------------------------
export async function handleExportJson(request: Request, env: Env): Promise<Response> {
  const url       = new URL(request.url);
  const family_id = url.searchParams.get('family_id');
  const lang      = url.searchParams.get('lang') === 'pl' ? 'pl' : 'en';

  if (!family_id) return error('family_id required');

  const [family, users, ledger, governance, statusLog, snapshots, labels] = await Promise.all([
    env.DB.prepare(`SELECT id, name, currency, verify_mode, created_at, base_currency,
                          parenting_mode, deleted_at, fast_track_enabled,
                          shared_expense_threshold, shared_expense_split_bp,
                          has_shield, home_lat, home_lng
                   FROM families WHERE id = ?`).bind(family_id).first(),
    env.DB.prepare('SELECT id, display_name, locale FROM users WHERE family_id = ?').bind(family_id).all(),
    env.DB.prepare('SELECT * FROM ledger WHERE family_id = ? ORDER BY id ASC').bind(family_id).all(),
    env.DB.prepare('SELECT * FROM family_governance_log WHERE family_id = ? ORDER BY id ASC').bind(family_id).all(),
    env.DB.prepare(`SELECT lsl.* FROM ledger_status_log lsl
                    JOIN ledger l ON l.id = lsl.ledger_id
                    WHERE l.family_id = ? ORDER BY lsl.id ASC`).bind(family_id).all(),
    env.DB.prepare(`SELECT cs.* FROM currency_snapshots cs
                    JOIN ledger l ON l.id = cs.ledger_id
                    WHERE l.family_id = ? ORDER BY cs.id ASC`).bind(family_id).all(),
    env.DB.prepare('SELECT * FROM bilingual_labels').all(),
  ]);

  if (!family) return error('Family not found', 404);

  const labelMap = buildLabelMap(labels.results as unknown as LabelRow[], lang);

  const enrichedLedger = (ledger.results as Record<string, unknown>[]).map(row => ({
    ...row,
    category_label:      row['category']     ? labelMap[row['category'] as string]     ?? row['category']     : null,
    dispute_code_label:  row['dispute_code'] ? labelMap[row['dispute_code'] as string] ?? row['dispute_code'] : null,
  }));

  const enrichedGovernance = (governance.results as Record<string, unknown>[]).map(row => ({
    ...row,
    action_taken: row['new_mode'] === 'amicable'
      ? (lang === 'pl' ? 'Włączono automatyczną weryfikację (tryb zgodny)' : 'Enabled Auto-Verify (Amicable Mode)')
      : (lang === 'pl' ? 'Włączono ręczną weryfikację (tryb standardowy)' : 'Enabled Manual Approval (Standard Mode)'),
  }));

  const exportPayload = {
    export_meta: {
      family_id,
      exported_at: new Date().toISOString(),
      lang,
      gdpr_basis: 'Article 20 — Right to Data Portability',
    },
    family,
    users: users.results,
    ledger: enrichedLedger,
    governance_log: enrichedGovernance,
    status_log: statusLog.results,
    currency_snapshots: snapshots.results,
    bilingual_labels: labelMap,
  };

  return new Response(JSON.stringify(exportPayload, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="morechard-export-${family_id}-${Date.now()}.json"`,
    },
  });
}

// ----------------------------------------------------------------
// GET /api/export/pdf  (returns print-ready HTML)
// ----------------------------------------------------------------
export async function handleExportPdf(request: Request, env: Env): Promise<Response> {
  const url       = new URL(request.url);
  const family_id = url.searchParams.get('family_id');
  const lang      = url.searchParams.get('lang') === 'pl' ? 'pl' : 'en';
  const rawTier   = url.searchParams.get('tier') ?? 'basic';
  const tier: ReportTier = rawTier === 'forensic' ? 'forensic'
                         : rawTier === 'behavioral' ? 'behavioral'
                         : 'basic';

  if (!family_id) return error('family_id required');

  // Base queries — always needed
  const [family, ledgerRes, govRes, labelsRes] = await Promise.all([
    env.DB.prepare(
      'SELECT id, name, currency, verify_mode, home_lat, home_lng FROM families WHERE id = ?'
    ).bind(family_id).first<FamilyRow>(),
    env.DB.prepare(
      `SELECT l.*, u.display_name AS child_name
       FROM ledger l
       LEFT JOIN users u ON u.id = l.child_id
       WHERE l.family_id = ? ORDER BY l.id ASC`
    ).bind(family_id).all(),
    env.DB.prepare('SELECT * FROM family_governance_log WHERE family_id = ? ORDER BY id ASC').bind(family_id).all(),
    env.DB.prepare('SELECT * FROM bilingual_labels').all(),
  ]);

  if (!family) return error('Family not found', 404);

  // Server-side tier enforcement — prevents crafted requests bypassing frontend gates
  if (tier === 'behavioral') {
    const tierRow = await env.DB
      .prepare('SELECT has_ai_mentor, has_shield FROM families WHERE id = ?')
      .bind(family_id)
      .first<{ has_ai_mentor: number; has_shield: number }>();
    if (!tierRow?.has_ai_mentor && !tierRow?.has_shield) {
      return error('AI Mentor required for behavioral exports', 403);
    }
  }

  if (tier === 'forensic') {
    const tierRow = await env.DB
      .prepare('SELECT has_shield FROM families WHERE id = ?')
      .bind(family_id)
      .first<{ has_shield: number }>();
    if (!tierRow?.has_shield) return error('Shield plan required', 403);
  }

  const labelMap   = buildLabelMap(labelsRes.results as unknown as LabelRow[], lang);
  const ledgerRows = ledgerRes.results as unknown as LedgerRow[];
  const govRows    = govRes.results as unknown as GovRow[];

  // Tier-specific supplementary data
  let statusRows:   StatusLogRow[]    = [];
  let completions:  CompletionRow[]   = [];
  let moduleRows:   LearningModuleRow[] = [];
  let rewardEdits:  RewardEditRow[]   = [];
  let loginRows:    LoginHistoryRow[] = [];

  if (tier !== 'basic') {
    // Status log for behavioral pulse
    const slRes = await env.DB.prepare(
      `SELECT lsl.* FROM ledger_status_log lsl
       JOIN ledger l ON l.id = lsl.ledger_id
       WHERE l.family_id = ? ORDER BY lsl.id ASC`
    ).bind(family_id).all();
    statusRows = slRes.results as unknown as StatusLogRow[];

    // Learning module unlocks (if table exists — graceful fallback)
    try {
      const modRes = await env.DB.prepare(
        `SELECT m.slug, m.unlocked_at, m.child_id, u.display_name AS child_name
         FROM learning_module_unlocks m
         LEFT JOIN users u ON u.id = m.child_id
         WHERE m.family_id = ? ORDER BY m.unlocked_at ASC`
      ).bind(family_id).all();
      moduleRows = modRes.results as unknown as LearningModuleRow[];
    } catch { /* table not yet migrated */ }
  }

  if (tier === 'forensic') {
    // Full completion rows with device/location data — privacy-safe: only in PDF
    const compRes = await env.DB.prepare(
      `SELECT c.id, c.chore_id, c.child_id, c.submitted_at,
              c.verified_at, c.proof_hash, c.verification_confidence,
              c.haversine_km, c.network_city, c.network_ip,
              c.device_model, c.user_agent, c.device_fingerprint,
              u.display_name AS child_name
       FROM completions c
       JOIN chores ch ON ch.id = c.chore_id
       LEFT JOIN users u ON u.id = c.child_id
       WHERE ch.family_id = ? ORDER BY c.submitted_at ASC`
    ).bind(family_id).all();
    completions = compRes.results as unknown as CompletionRow[];

    // Reward override / edit audit
    try {
      const editRes = await env.DB.prepare(
        `SELECT actor_id, chore_id, old_amount, new_amount, changed_at, reason
         FROM chore_reward_edits WHERE family_id = ? ORDER BY changed_at ASC`
      ).bind(family_id).all();
      rewardEdits = editRes.results as unknown as RewardEditRow[];
    } catch { /* table not yet migrated */ }

    // Login history — parent sessions + child logins, merged and sorted by time.
    // user_agent column added in migration 0011; graceful fallback if absent.
    const [parentSessions, childLogins] = await Promise.all([
      env.DB.prepare(
        `SELECT u.display_name, s.issued_at AS event_at, s.ip_address,
                s.user_agent, s.role, 'Login' AS action
         FROM sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.family_id = ?
         ORDER BY s.issued_at ASC`
      ).bind(family_id).all().catch(() => ({ results: [] })),
      env.DB.prepare(
        `SELECT u.display_name, cl.logged_at AS event_at, cl.ip_address,
                NULL AS user_agent, 'child' AS role, 'Upload' AS action
         FROM child_logins cl
         JOIN users u ON u.id = cl.child_id
         WHERE cl.family_id = ?
         ORDER BY cl.logged_at ASC`
      ).bind(family_id).all().catch(() => ({ results: [] })),
    ]);

    loginRows = [
      ...(parentSessions.results as unknown as LoginHistoryRow[]),
      ...(childLogins.results as unknown as LoginHistoryRow[]),
    ].sort((a, b) => a.event_at - b.event_at);
  }

  // Shared expenses for forensic export
  let sharedExpenseRows: SharedExpenseExportRow[] = [];
  if (tier === 'forensic') {
    const seRes = await env.DB.prepare(
      `SELECT se.*,
              ul.display_name AS logged_by_name,
              uv.display_name AS voided_by_name
       FROM shared_expenses se
       LEFT JOIN users ul ON ul.id = se.logged_by
       LEFT JOIN users uv ON uv.id = se.voided_by
       WHERE se.family_id = ? AND se.deleted_at IS NULL
       ORDER BY se.created_at ASC`
    ).bind(family_id).all().catch(() => ({ results: [] }));
    sharedExpenseRows = seRes.results as unknown as SharedExpenseExportRow[];
  }

  // Document fingerprint — SHA-256 of (family_id + row count + export timestamp)
  const exportTs          = Math.floor(Date.now() / 1000);
  const fingerprintInput  = `${family_id}|${ledgerRows.length}|${exportTs}|${tier}`;
  const fingerprint       = await sha256(fingerprintInput);
  const shortFp           = fingerprint.slice(0, 16).toUpperCase();
  const docUuid           = `MCH-${shortFp.slice(0, 4)}-${shortFp.slice(4, 8)}-${shortFp.slice(8, 12)}-${shortFp.slice(12)}`;

  const pending  = ledgerRows.filter(r => r.verification_status === 'pending').length;
  const verified = ledgerRows.filter(r => r.verification_status.startsWith('verified')).length;
  const disputed = ledgerRows.filter(r => r.verification_status === 'disputed').length;
  const totalEarned = ledgerRows
    .filter(r => r.entry_type === 'credit')
    .reduce((s, r) => s + r.amount, 0);
  const totalTasks = ledgerRows.filter(r => r.entry_type === 'credit').length;

  let html: string;

  if (tier === 'forensic') {
    html = buildForensicReport({
      family, lang, ledgerRows, govRows, completions, rewardEdits, loginRows,
      statusRows, labelMap, fingerprint, shortFp, docUuid,
      exportTs, pending, verified, disputed, totalEarned, totalTasks,
      sharedExpenseRows,
    });
  } else if (tier === 'behavioral') {
    html = buildBehavioralReport({
      family, lang, ledgerRows, govRows, statusRows, moduleRows, labelMap,
      fingerprint, shortFp, docUuid, exportTs,
      pending, verified, disputed, totalEarned, totalTasks,
    });
  } else {
    html = buildBasicReport({
      family, lang, ledgerRows, govRows, statusRows, labelMap,
      fingerprint, shortFp, docUuid, exportTs,
      pending, verified, disputed, totalEarned, totalTasks,
    });
  }

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `inline; filename="morechard-${tier}-report-${family_id}-${Date.now()}.html"`,
    },
  });
}

// ----------------------------------------------------------------
// GET /api/export/prune-check
// Returns whether there are any ledger rows eligible for pruning
// (older than 2 years, not yet pruned, not a demo family).
// ----------------------------------------------------------------
export async function handleExportPruneCheck(
  _request: Request,
  env: Env,
  auth: { sub: string; family_id: string },
): Promise<Response> {
  const family_id = auth.family_id;

  const family = await env.DB
    .prepare('SELECT is_demo FROM families WHERE id = ?')
    .bind(family_id)
    .first<{ is_demo: number }>();

  if (family?.is_demo) {
    return new Response(JSON.stringify({ has_prunable: false }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const cutoff = Math.floor(Date.now() / 1000) - 2 * 365 * 86400;

  const row = await env.DB
    .prepare(
      `SELECT COUNT(*) AS cnt FROM ledger
       WHERE family_id = ? AND created_at < ? AND pruned_at IS NULL`
    )
    .bind(family_id, cutoff)
    .first<{ cnt: number }>();

  return new Response(JSON.stringify({ has_prunable: (row?.cnt ?? 0) > 0 }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ----------------------------------------------------------------
// POST /api/export/prune
// Lead-parent only. Identifies ledger rows older than 2 years,
// archives their hashes, then zeroes PII columns (description,
// ip_address, receipt_id). Also nulls proof_exif and system_verify
// on linked completions. Hash-chain columns are untouched.
// ----------------------------------------------------------------
export async function handleExportPrune(
  request: Request,
  env: Env,
  auth: { sub: string; family_id: string; role: string },
): Promise<Response> {
  const family_id = auth.family_id;

  // Lead-only gate
  const caller = await env.DB
    .prepare(`SELECT parent_role FROM family_roles WHERE user_id = ? AND family_id = ? AND role = 'parent'`)
    .bind(auth.sub, family_id)
    .first<{ parent_role: string }>();
  if (!caller || caller.parent_role !== 'lead') {
    return error('Only the lead parent can prune data', 403);
  }

  const cutoff = Math.floor(Date.now() / 1000) - 2 * 365 * 86400;

  const { results: candidates } = await env.DB
    .prepare(`
      SELECT id, record_hash, previous_hash
      FROM ledger
      WHERE family_id = ? AND created_at < ? AND pruned_at IS NULL
    `)
    .bind(family_id, cutoff)
    .all<{ id: number; record_hash: string; previous_hash: string }>();

  if (candidates.length === 0) {
    return new Response(JSON.stringify({ pruned: 0, archived: 0 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Process in chunks of 50 — each batch() call is atomic, so a partial
  // failure at most leaves one chunk's worth of rows in an inconsistent state
  // rather than the entire prune run.
  const CHUNK = 50;
  for (let i = 0; i < candidates.length; i += CHUNK) {
    const chunk = candidates.slice(i, i + CHUNK);
    const statements = chunk.flatMap(row => [
      env.DB
        .prepare(`INSERT INTO ledger_prune_archive (ledger_id, record_hash, previous_hash, archived_at) VALUES (?, ?, ?, unixepoch())`)
        .bind(row.id, row.record_hash, row.previous_hash),
      env.DB
        .prepare(`UPDATE ledger SET description = '[archived]', ip_address = NULL, receipt_id = NULL, pruned_at = unixepoch() WHERE id = ? AND family_id = ?`)
        .bind(row.id, family_id),
      env.DB
        .prepare(`UPDATE completions SET proof_exif = NULL, system_verify = NULL WHERE chore_id IN (SELECT chore_id FROM ledger WHERE id = ? AND family_id = ? AND chore_id IS NOT NULL)`)
        .bind(row.id, family_id),
    ]);
    await env.DB.batch(statements);
  }

  return new Response(JSON.stringify({ pruned: candidates.length, archived: candidates.length }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ================================================================
// Report builders
// ================================================================

interface ReportContext {
  family:       FamilyRow;
  lang:         string;
  ledgerRows:   LedgerRow[];
  govRows:      GovRow[];
  statusRows:   StatusLogRow[];
  labelMap:     Record<string, string>;
  fingerprint:  string;
  shortFp:      string;
  docUuid:      string;
  exportTs:     number;
  pending:      number;
  verified:     number;
  disputed:     number;
  totalEarned:  number;
  totalTasks:   number;
}

// ----------------------------------------------------------------
// Version A — Basic Report (Standard licence)
// ----------------------------------------------------------------
function buildBasicReport(ctx: ReportContext): string {
  const { family, lang, ledgerRows, statusRows, labelMap,
          fingerprint, shortFp, docUuid, exportTs,
          pending, verified, disputed, totalEarned, totalTasks } = ctx;
  const pl = lang === 'pl';

  const title   = pl ? 'Podsumowanie Rodzinnego Sadu' : 'Family Orchard Summary';
  const heading = pl ? 'Raport Rodziny' : 'Family Report';

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<title>Morechard — ${escHtml(title)} — ${escHtml(family.name)}</title>
${baseStyles()}
<style>
  .summary-card { border-left: 4px solid #5b8c3e; }
  h1 span.tier-badge { background:#e8f5e9; color:#2e7d32; font-size:12px; padding:2px 10px; border-radius:12px; font-weight:600; vertical-align:middle; margin-left:8px; }
</style>
</head>
<body>

<h1>Morechard — ${escHtml(heading)} <span class="tier-badge">${pl ? 'Wersja Podstawowa' : 'Basic Edition'}</span></h1>
<div class="meta">
  ${pl ? 'Rodzina' : 'Family'}: <strong>${escHtml(family.name)}</strong> &nbsp;|&nbsp;
  ${pl ? 'Wygenerowano' : 'Exported at'}: <strong>${new Date(exportTs * 1000).toISOString()}</strong> &nbsp;|&nbsp;
  ${pl ? 'Waluta' : 'Currency'}: <strong>${family.currency}</strong>
</div>
<p class="report-description">${pl
  ? 'Ten raport zawiera pełne podsumowanie aktywności Twojej rodziny, w tym zarobki i wykonane zadania.'
  : 'This report contains a complete summary of your family\'s activity, including earnings and completed tasks.'}</p>

<h2>${pl ? 'Podsumowanie' : 'Summary'}</h2>
<div class="summary-grid">
  <div class="summary-card"><div class="num">${fmtAmount(totalEarned, family.currency)}</div><div class="label">${pl ? 'Łącznie zarobiono' : 'Total Earned'}</div></div>
  <div class="summary-card"><div class="num">${totalTasks}</div><div class="label">${pl ? 'Ukończonych zadań' : 'Total Tasks Completed'}</div></div>
  <div class="summary-card"><div class="num">${verified}</div><div class="label">${pl ? 'Zweryfikowanych' : 'Verified'}</div></div>
  <div class="summary-card"><div class="num">${pending}</div><div class="label">${pl ? 'Oczekujących' : 'Pending'}</div></div>
</div>
${disputed > 0 ? `<p class="warn">⚠ ${disputed} ${pl ? 'wpis(-ów) zakwestionowanych' : 'disputed entry/entries'}</p>` : ''}

<h2>${pl ? 'Rejestr transakcji' : 'Transaction Ledger'}</h2>
<table>
  <thead>
    <tr>
      <th>#</th><th>${pl ? 'Data' : 'Date'}</th><th>${pl ? 'Opis' : 'Description'}</th>
      <th>${pl ? 'Kategoria' : 'Category'}</th><th>${pl ? 'Kwota' : 'Amount'}</th>
      <th>${pl ? 'Status' : 'Status'}</th>
    </tr>
  </thead>
  <tbody>
    ${ledgerRows.map(r => `
    <tr>
      <td>${r.id}</td>
      <td>${fmtDate(r.created_at)}</td>
      <td>${escHtml(r.description)}</td>
      <td>${r.category ? (labelMap[r.category] ?? r.category) : '—'}</td>
      <td class="num-cell">${fmtAmount(r.amount, r.currency)}</td>
      <td><span class="badge-${badgeClass(r.verification_status)}">${statusLabel(r.verification_status, lang)}</span></td>
    </tr>`).join('')}
  </tbody>
</table>

${statusRows.length > 0 ? `
<h2>${pl ? 'Dziennik statusów' : 'Status Log'}</h2>
<table>
  <thead>
    <tr><th>#</th><th>${pl ? 'Data' : 'Date'}</th><th>${pl ? 'Wpis' : 'Entry'}</th><th>${pl ? 'Z' : 'From'}</th><th>${pl ? 'Na' : 'To'}</th><th>${pl ? 'Zatwierdzone przez' : 'Approver'}</th></tr>
  </thead>
  <tbody>
    ${statusRows.map(s => `
    <tr>
      <td>${s.id}</td>
      <td>${fmtDate(s.created_at)}</td>
      <td>${s.ledger_id}</td>
      <td><span class="badge-${badgeClass(s.from_status)}">${statusLabel(s.from_status, lang)}</span></td>
      <td><span class="badge-${badgeClass(s.to_status)}">${statusLabel(s.to_status, lang)}</span></td>
      <td>${escHtml(s.actor_id)}</td>
    </tr>`).join('')}
  </tbody>
</table>` : ''}

${fingerprintBlock(fingerprint, shortFp, lang)}
${declarationFooter(family.name, exportTs, lang, docUuid, false)}

</body>
</html>`;
}

// ----------------------------------------------------------------
// Version B — Behavioral Insights Report (Basic + AI Mentor)
// ----------------------------------------------------------------
interface BehavioralContext extends ReportContext {
  moduleRows: LearningModuleRow[];
}

// Pillar definitions for the report narrative
const PILLARS_EN = [
  { id: 1, name: 'Earning & Value',      metaphor: 'The Roots',     summary: 'Understanding that money is stored effort — every task has a labour value.' },
  { id: 2, name: 'Spending & Choices',   metaphor: 'The Trunk',     summary: 'Distinguishing needs from wants, and recognising when outside forces are shaping decisions.' },
  { id: 3, name: 'Saving & Growth',      metaphor: 'The Fruit',     summary: 'Building patience and momentum — the snowball effect of consistent saving.' },
  { id: 4, name: 'Borrowing & Debt',     metaphor: 'The Vine',      summary: 'Understanding that borrowing has a cost, and that not all debt is the same.' },
  { id: 5, name: 'Investing & Future',   metaphor: 'The Canopy',    summary: 'Protecting money from inflation and making it work through compound growth.' },
  { id: 6, name: 'Society & Wellbeing',  metaphor: 'The Atmosphere',summary: 'Using surplus for others, understanding digital money, and building a healthy relationship with spending.' },
];

const PILLARS_PL = [
  { id: 1, name: 'Zarabianie i wartość',     metaphor: 'Korzenie',      summary: 'Pieniądze to przechowana energia — każde zadanie ma wartość pracy.' },
  { id: 2, name: 'Wydawanie i wybory',       metaphor: 'Pień',          summary: 'Odróżnianie potrzeb od zachcianek i rozpoznawanie, gdy otoczenie kształtuje decyzje.' },
  { id: 3, name: 'Oszczędzanie i wzrost',    metaphor: 'Owoce',         summary: 'Budowanie cierpliwości i impetu — kula śnieżna regularnego oszczędzania.' },
  { id: 4, name: 'Pożyczanie i dług',        metaphor: 'Winorośl',      summary: 'Pożyczanie ma cenę, a nie każdy dług jest taki sam.' },
  { id: 5, name: 'Inwestowanie i przyszłość',metaphor: 'Korona',        summary: 'Ochrona pieniędzy przed inflacją i procentem składanym.' },
  { id: 6, name: 'Społeczeństwo i dobrostan',metaphor: 'Atmosfera',     summary: 'Dzielenie nadwyżki z innymi, rozumienie pieniądza cyfrowego i zdrowa relacja z wydawaniem.' },
];

// Which pillar each module slug belongs to
const MODULE_PILLAR: Record<string, number> = {
  'effort-vs-reward': 1, 'taxes-net-pay': 1, 'entrepreneurship': 1, 'gig-trap-vs-salary-safety': 1,
  'needs-vs-wants': 2, 'scams-digital-safety': 2, 'advertising-influence': 2,
  'the-patience-tree': 3, 'banking-101': 3, 'opportunity-cost': 3, 'the-snowball': 3,
  'the-interest-trap': 4, 'credit-scores-and-trust': 4, 'good-vs-bad-debt': 4,
  'compound-growth': 5, 'inflation': 5, 'risk-and-diversification': 5,
  'giving-and-charity': 6, 'digital-vs-physical-currency': 6, 'money-and-mental-health': 6, 'social-comparison': 6,
};

function buildBehavioralReport(ctx: BehavioralContext): string {
  const { family, lang, ledgerRows, statusRows, moduleRows,
          fingerprint, shortFp, docUuid, exportTs } = ctx;
  const pl = lang === 'pl';

  const title = pl ? 'Raport Wzrostu i Nauki' : 'Growth & Learning Report';

  // Derive behavioural pulse signals from ledger + status data
  const pulse = deriveBehaviouralPulse(ledgerRows, statusRows, lang);

  const pillars = pl ? PILLARS_PL : PILLARS_EN;

  // Module display names
  const moduleNames: Record<string, [string, number]> = {
    'effort-vs-reward':              [pl ? 'Wysiłek a nagroda'            : 'Effort vs. Reward',              1],
    'taxes-net-pay':                 [pl ? 'Podatki i wynagrodzenie netto' : 'Taxes & Net Pay',               1],
    'entrepreneurship':              [pl ? 'Przedsiębiorczość'             : 'Entrepreneurship',              1],
    'gig-trap-vs-salary-safety':     [pl ? 'Pułapka freelance'            : 'Gig Trap vs. Salary Safety',     1],
    'needs-vs-wants':                [pl ? 'Potrzeby a zachcianki'         : 'Needs vs. Wants',               2],
    'scams-digital-safety':          [pl ? 'Oszustwa i bezpieczeństwo'     : 'Scams & Digital Safety',        2],
    'advertising-influence':         [pl ? 'Reklama i wpływ'              : 'Advertising & Influence',       2],
    'the-patience-tree':             [pl ? 'Drzewo cierpliwości'           : 'The Patience Tree',             3],
    'banking-101':                   [pl ? 'Bankowość 101'                 : 'Banking 101',                   3],
    'opportunity-cost':              [pl ? 'Koszt alternatywny'            : 'Opportunity Cost',              3],
    'the-snowball':                  [pl ? 'Kula śnieżna'                  : 'The Snowball',                  3],
    'the-interest-trap':             [pl ? 'Pułapka odsetek'              : 'The Interest Trap',              4],
    'credit-scores-and-trust':       [pl ? 'Scoring kredytowy'            : 'Credit Scores & Trust',         4],
    'good-vs-bad-debt':              [pl ? 'Dobry i zły dług'             : 'Good vs. Bad Debt',              4],
    'compound-growth':               [pl ? 'Wzrost procentu składanego'   : 'Compound Growth',               5],
    'inflation':                     [pl ? 'Inflacja'                      : 'Inflation',                     5],
    'risk-and-diversification':      [pl ? 'Ryzyko i dywersyfikacja'       : 'Risk & Diversification',        5],
    'giving-and-charity':            [pl ? 'Dawanie i charytatywność'      : 'Giving & Charity',              6],
    'digital-vs-physical-currency':  [pl ? 'Waluta cyfrowa a fizyczna'     : 'Digital vs. Physical Currency', 6],
    'money-and-mental-health':       [pl ? 'Pieniądze i zdrowie psychiczne': 'Money & Mental Health',         6],
    'social-comparison':             [pl ? 'Porównywanie społeczne'        : 'Social Comparison',             6],
  };

  // Unique children in ledger
  const childMap = new Map<string, string>();
  for (const r of ledgerRows) {
    if (r.child_id && r.child_name && !childMap.has(r.child_id)) {
      childMap.set(r.child_id, r.child_name);
    }
  }
  const children = [...childMap.entries()]; // [id, name][]

  // Per-child stats
  const childStats = children.map(([childId, childName]) => {
    const rows    = ledgerRows.filter(r => r.child_id === childId);
    const credits = rows.filter(r => r.entry_type === 'credit');
    const earned  = credits.reduce((s, r) => s + r.amount, 0);
    const tasks   = credits.length;
    const mods    = moduleRows.filter(m => m.child_id === childId);
    const unlockedPillars = [...new Set(mods.map(m => MODULE_PILLAR[m.slug]).filter(Boolean))];
    return { childId, childName, earned, tasks, mods, unlockedPillars };
  });

  // Pillar progress: which pillars have at least one module unlocked across all children
  const unlockedPillarIds = new Set(moduleRows.map(m => MODULE_PILLAR[m.slug]).filter(Boolean));

  // Next milestone suggestions based on pulse and ledger
  const nextMilestones = deriveNextMilestones(ledgerRows, moduleRows, lang);

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<title>Morechard — ${escHtml(title)} — ${escHtml(family.name)}</title>
${baseStyles()}
<style>
  .summary-card { border-left: 4px solid #7b5ea7; }
  h1 span.tier-badge { background:#f3e5f5; color:#6a1b9a; font-size:12px; padding:2px 10px; border-radius:12px; font-weight:600; vertical-align:middle; margin-left:8px; }

  .child-header { background:#fdf6ff; border:1px solid #ce93d8; border-radius:8px; padding:12px 16px; margin-bottom:12px; }
  .child-header .child-name { font-size:16px; font-weight:700; color:#4a148c; }
  .child-header .child-stats { font-size:10px; color:#666; margin-top:4px; }
  .child-stat-pill { display:inline-block; background:#f3e5f5; color:#6a1b9a; border-radius:10px; padding:2px 8px; margin-right:6px; font-weight:600; }

  .pillar-grid { display:grid; grid-template-columns: repeat(3,1fr); gap:8px; margin-bottom:16px; }
  .pillar-card { border:1px solid #e1bee7; border-radius:6px; padding:8px 10px; }
  .pillar-card.unlocked { background:#f3e5f5; border-color:#ab47bc; }
  .pillar-card.locked   { background:#fafafa; border-color:#ddd; opacity:0.7; }
  .pillar-card .pillar-num  { font-size:9px; font-weight:700; color:#9c27b0; text-transform:uppercase; letter-spacing:.5px; }
  .pillar-card.locked .pillar-num { color:#aaa; }
  .pillar-card .pillar-name { font-size:11px; font-weight:600; margin:2px 0; }
  .pillar-card .pillar-meta { font-size:9px; color:#777; font-style:italic; }
  .pillar-card .pillar-desc { font-size:9px; color:#555; margin-top:4px; line-height:1.4; }
  .pillar-status { font-size:9px; font-weight:700; margin-top:4px; }
  .pillar-status.done    { color:#2e7d32; }
  .pillar-status.pending { color:#aaa; }

  .pulse-box { padding:14px 16px; border:1px solid #ce93d8; border-radius:6px; background:#fdf6ff; margin-bottom:16px; }
  .pulse-signal { display:inline-block; margin:3px 4px; padding:3px 10px; border-radius:12px; font-size:10px; font-weight:600; }
  .pulse-signal.positive { background:#e8f5e9; color:#2e7d32; }
  .pulse-signal.caution  { background:#fff8e1; color:#f57f17; }
  .pulse-signal.concern  { background:#fce4ec; color:#b71c1c; }
  .pulse-child { font-size:9px; font-weight:400; opacity:0.8; margin-left:4px; }

  .pulse-explain { margin-top:10px; border-top:1px solid #e1bee7; padding-top:8px; }
  .pulse-explain-row { margin:4px 0; font-size:10px; line-height:1.5; }
  .pulse-explain-row .signal-tag { font-weight:700; }

  .module-grid { display:grid; grid-template-columns: repeat(2,1fr); gap:8px; margin-bottom:16px; }
  .module-card { border:1px solid #e1bee7; border-radius:6px; padding:8px 12px; background:#fdf6ff; }
  .module-card .mod-name  { font-weight:600; font-size:11px; }
  .module-card .mod-pillar { font-size:9px; color:#9c27b0; font-weight:600; text-transform:uppercase; letter-spacing:.3px; margin-bottom:2px; }
  .module-card .mod-meta  { font-size:9px; color:#888; }

  .milestone-box { background:#fff8e1; border:1px solid #ffe082; border-radius:6px; padding:12px 14px; margin-bottom:16px; }
  .milestone-box h3 { font-size:11px; font-weight:700; color:#f57f17; margin-bottom:6px; }
  .milestone-row { font-size:10px; margin:4px 0; line-height:1.5; }
  .milestone-row::before { content:"→ "; color:#f57f17; font-weight:700; }

  .ledger-appendix h2 { border-top:2px dashed #ccc; margin-top:24px; padding-top:16px; color:#999; }
</style>
</head>
<body>

<h1>Morechard — ${escHtml(title)} <span class="tier-badge">${pl ? 'Wersja z Mentorem AI' : 'AI Mentor Edition'}</span></h1>
<div class="meta">
  ${pl ? 'Rodzina' : 'Family'}: <strong>${escHtml(family.name)}</strong> &nbsp;|&nbsp;
  ${pl ? 'Wygenerowano' : 'Exported at'}: <strong>${new Date(exportTs * 1000).toISOString()}</strong> &nbsp;|&nbsp;
  ${pl ? 'Waluta' : 'Currency'}: <strong>${family.currency}</strong>
</div>
<p class="report-description">${pl
  ? 'Ten raport pokazuje postępy w nauce finansowej według 6 filarów Programu Nauczania Sadu. Rejestr transakcji znajduje się w załączniku na końcu dokumentu.'
  : 'This report tracks progress across the 6 pillars of the Orchard Financial Curriculum. The transaction ledger appears as an appendix at the end.'}</p>

${childStats.length === 0 ? `<p style="color:#999;font-size:11px;margin-bottom:16px">${pl ? 'Brak danych o dzieciach.' : 'No child data found.'}</p>` : ''}

${childStats.map(cs => `
<div class="child-header">
  <div class="child-name">${escHtml(cs.childName)}</div>
  <div class="child-stats">
    <span class="child-stat-pill">${fmtAmount(cs.earned, family.currency)} ${pl ? 'zarobione' : 'earned'}</span>
    <span class="child-stat-pill">${cs.tasks} ${pl ? (cs.tasks === 1 ? 'zadanie' : 'zadań') : (cs.tasks === 1 ? 'task' : 'tasks')}</span>
    <span class="child-stat-pill">${cs.mods.length} ${pl ? 'modułów odblokowanych' : (cs.mods.length === 1 ? 'module unlocked' : 'modules unlocked')}</span>
    <span class="child-stat-pill">${cs.unlockedPillars.length}/6 ${pl ? 'filarów' : 'pillars'}</span>
  </div>
</div>`).join('')}

<h2>${pl ? 'Postęp w 6 Filarach Edukacji Finansowej' : 'Progress Across the 6 Financial Literacy Pillars'}</h2>
<p style="font-size:10px;color:#666;margin-bottom:10px">${pl
  ? 'Filar jest oznaczony jako rozpoczęty, gdy dziecko odblokuje co najmniej jeden moduł w tym obszarze.'
  : 'A pillar is marked as started once a child unlocks at least one module in that area.'}</p>
<div class="pillar-grid">
  ${pillars.map(p => {
    const active = unlockedPillarIds.has(p.id);
    return `<div class="pillar-card ${active ? 'unlocked' : 'locked'}">
    <div class="pillar-num">${pl ? 'Filar' : 'Pillar'} ${p.id}</div>
    <div class="pillar-name">${escHtml(p.name)}</div>
    <div class="pillar-meta">${escHtml(p.metaphor)}</div>
    <div class="pillar-desc">${escHtml(p.summary)}</div>
    <div class="pillar-status ${active ? 'done' : 'pending'}">${active ? (pl ? '✓ Rozpoczęty' : '✓ Started') : (pl ? 'Nierozpoczęty' : 'Not yet started')}</div>
  </div>`;
  }).join('')}
</div>

<h2>${pl ? 'Puls Zachowań' : 'Behavioural Pulse'}</h2>
<div class="pulse-box">
  <p style="font-size:10px;margin-bottom:8px;color:#555">${pl
    ? 'Sygnały wyprowadzone z wzorców aktywności. Nie stanowią oceny — to wskazówki edukacyjne.'
    : 'Signals derived from activity patterns. These are coaching observations, not judgements.'}</p>
  <div>
    ${pulse.map(p => `<span class="pulse-signal ${p.type}">${escHtml(p.label)}${p.child_name ? `<span class="pulse-child">— ${escHtml(p.child_name)}</span>` : ''}</span>`).join(' ')}
  </div>
  <div class="pulse-explain">
    ${pulse.map(p => `<div class="pulse-explain-row"><span class="signal-tag">${escHtml(p.label)}:</span> ${escHtml(p.explanation ?? '')}</div>`).join('')}
  </div>
</div>

${nextMilestones.length > 0 ? `
<div class="milestone-box">
  <h3>${pl ? 'Następne kamienie milowe edukacyjne' : 'Next Educational Milestones'}</h3>
  ${nextMilestones.map(m => `<div class="milestone-row">${escHtml(m)}</div>`).join('')}
</div>` : ''}

${moduleRows.length > 0 ? `
<h2>${pl ? 'Laboratorium Nauki — Odblokowane Moduły' : 'Learning Lab — Unlocked Modules'}</h2>
<div class="module-grid">
  ${moduleRows.map(m => {
    const entry = moduleNames[m.slug];
    const modName = entry ? entry[0] : m.slug;
    const pillarId = entry ? entry[1] : (MODULE_PILLAR[m.slug] ?? 0);
    const pillar = pillars.find(p => p.id === pillarId);
    return `<div class="module-card">
    <div class="mod-pillar">${pillar ? `${pl ? 'Filar' : 'Pillar'} ${pillar.id} · ${escHtml(pillar.name)}` : '—'}</div>
    <div class="mod-name">${escHtml(modName)}</div>
    <div class="mod-meta">${pl ? 'Uczestnik' : 'Contributor'}: <strong>${escHtml(m.child_name ?? '—')}</strong> &nbsp;·&nbsp; ${pl ? 'Odblokowano' : 'Unlocked'}: ${fmtDate(m.unlocked_at)}</div>
  </div>`;
  }).join('')}
</div>` : `
<div class="milestone-box" style="background:#f3f3f3;border-color:#ddd;">
  <h3 style="color:#888">${pl ? 'Brak odblokowanych modułów — jak je zdobyć?' : 'No modules unlocked yet — how to get started'}</h3>
  ${(pl ? [
    'Zarobienie łącznie 20 zł odblokowuje Moduł 2: Podatki i wynagrodzenie netto (Filar 1)',
    'Osiągnięcie salda powyżej 30 zł odblokowuje Moduł 8: Bankowość 101 (Filar 3)',
    'Ukończenie 10 zadań bez sporu odblokowuje wymaganie Modułu 11: Scoring kredytowy (Filar 4)',
    'Brak aktywności przez 21 dni odblokowuje Moduł 14: Inflacja (Filar 5)',
  ] : [
    'Earning a cumulative £20 unlocks Module 2: Taxes & Net Pay (Pillar 1)',
    'Reaching a balance above £30 unlocks Module 8: Banking 101 (Pillar 3)',
    'Completing 10 tasks with no disputes starts the path to Module 11: Credit Scores & Trust (Pillar 4)',
    'Going 21 days without activity unlocks Module 14: Inflation (Pillar 5)',
  ]).map(tip => `<div class="milestone-row">${escHtml(tip)}</div>`).join('')}
</div>`}

<div class="ledger-appendix">
<h2>${pl ? 'Załącznik — Rejestr transakcji' : 'Appendix — Transaction Ledger'}</h2>
<table>
  <thead>
    <tr>
      <th>#</th><th>${pl ? 'Data' : 'Date'}</th>
      <th>${pl ? 'Uczestnik' : 'Contributor'}</th>
      <th>${pl ? 'Opis' : 'Description'}</th>
      <th>${pl ? 'Kwota' : 'Amount'}</th>
      <th>${pl ? 'Status' : 'Status'}</th>
    </tr>
  </thead>
  <tbody>
    ${ledgerRows.map(r => `
    <tr>
      <td>${r.id}</td>
      <td>${fmtDate(r.created_at)}</td>
      <td><strong>${escHtml(r.child_name ?? '—')}</strong></td>
      <td>${escHtml(r.description)}</td>
      <td class="num-cell">${fmtAmount(r.amount, r.currency)}</td>
      <td><span class="badge-${badgeClass(r.verification_status)}">${statusLabel(r.verification_status, lang)}</span></td>
    </tr>`).join('')}
  </tbody>
</table>
</div>

${fingerprintBlock(fingerprint, shortFp, lang)}
${declarationFooter(family.name, exportTs, lang, docUuid, false)}

</body>
</html>`;
}

// ----------------------------------------------------------------
// Next milestone suggestions
// ----------------------------------------------------------------
function deriveNextMilestones(ledgerRows: LedgerRow[], moduleRows: LearningModuleRow[], lang: string): string[] {
  const pl = lang === 'pl';
  const milestones: string[] = [];
  const unlockedSlugs = new Set(moduleRows.map(m => m.slug));

  // Group by child
  const childIds = [...new Set(ledgerRows.map(r => r.child_id ?? '').filter(Boolean))];

  for (const childId of childIds) {
    const childRows = ledgerRows.filter(r => r.child_id === childId);
    const childName = childRows[0]?.child_name ?? (pl ? 'Uczestnik' : 'Contributor');
    const credits   = childRows.filter(r => r.entry_type === 'credit');
    const earned    = credits.reduce((s, r) => s + r.amount, 0); // pence/grosze

    // M2 — Taxes & Net Pay: earn £20 cumulative
    if (!unlockedSlugs.has('taxes-net-pay') && earned < 2000) {
      const remaining = fmtAmount(2000 - earned, childRows[0]?.currency ?? 'GBP');
      milestones.push(pl
        ? `${childName}: Zarobienie jeszcze ${remaining} odblokowuje „Podatki i wynagrodzenie netto" (Filar 1)`
        : `${childName}: Earn ${remaining} more to unlock "Taxes & Net Pay" (Pillar 1)`);
    }

    // M8 — Banking 101: balance > £30 — approximate as total earned (simplified)
    if (!unlockedSlugs.has('banking-101') && earned < 3000) {
      const remaining = fmtAmount(3000 - earned, childRows[0]?.currency ?? 'GBP');
      milestones.push(pl
        ? `${childName}: Osiągnięcie salda powyżej ${remaining} odblokowuje „Bankowość 101" (Filar 3)`
        : `${childName}: Reach a total balance of ${remaining} to unlock "Banking 101" (Pillar 3)`);
    }

    // M11 — Credit Scores: 10 tasks, no disputes
    const taskCount  = credits.length;
    const hasDispute = childRows.some(r => r.verification_status === 'disputed');
    if (!unlockedSlugs.has('credit-scores-and-trust') && taskCount < 10) {
      milestones.push(pl
        ? `${childName}: ${10 - taskCount} ${taskCount === 9 ? 'zadanie' : 'zadań'} do zdobycia bez sporu, aby odblokować „Scoring kredytowy" (Filar 4)`
        : `${childName}: Complete ${10 - taskCount} more task${10 - taskCount === 1 ? '' : 's'} dispute-free to unlock "Credit Scores & Trust" (Pillar 4)`);
    } else if (!unlockedSlugs.has('credit-scores-and-trust') && hasDispute) {
      milestones.push(pl
        ? `${childName}: Unikanie sporów przez kolejny okres odblokowuje „Scoring kredytowy" (Filar 4)`
        : `${childName}: Avoid disputes to progress towards "Credit Scores & Trust" (Pillar 4)`);
    }
  }

  return milestones.slice(0, 5); // cap at 5 to keep the report concise
}

// ----------------------------------------------------------------
// Version C — Forensic Report (Legal version)
// ----------------------------------------------------------------
interface ForensicContext extends ReportContext {
  completions:        CompletionRow[];
  rewardEdits:        RewardEditRow[];
  loginRows:          LoginHistoryRow[];
  sharedExpenseRows:  SharedExpenseExportRow[];
}

function buildForensicReport(ctx: ForensicContext): string {
  const { family, lang, ledgerRows, govRows, completions, rewardEdits, loginRows,
          sharedExpenseRows, fingerprint, docUuid, exportTs,
          disputed, totalEarned, totalTasks } = ctx;
  const pl = lang === 'pl';

  const highConf   = completions.filter(c => c.verification_confidence === 'High').length;
  const medConf    = completions.filter(c => c.verification_confidence === 'Medium').length;
  const lowConf    = completions.filter(c => c.verification_confidence === 'Low').length;

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<title>Morechard — ${pl ? 'Łańcuch Dowodów' : 'Chain of Custody'} — ${escHtml(family.name)}</title>
${baseStyles()}
<style>
  body { font-family: 'Courier New', monospace; }
  h1 span.tier-badge { background:#fff3e0; color:#e65100; font-size:12px; padding:2px 10px; border-radius:12px; font-weight:700; letter-spacing:.5px; vertical-align:middle; margin-left:8px; }
  .summary-card { border-left: 4px solid #bf360c; }
  .conf-high   { color: #2e7d32; font-weight:700; }
  .conf-medium { color: #f57f17; font-weight:700; }
  .conf-low    { color: #b71c1c; font-weight:700; }
  .hash-cell   { font-family:monospace; font-size:8px; word-break:break-all; max-width:120px; }
  .integrity-block { margin-top:24px; border:2px solid #bf360c; border-radius:4px; padding:14px; background:#fff8f5; }
  .stat-row td { padding: 3px 8px; border:1px solid #eee; }
</style>
</head>
<body>

<h1>Morechard — ${pl ? 'Niezmienialny Łańcuch Dowodów' : 'Immutable Chain of Custody'} <span class="tier-badge">${pl ? 'WERSJA SĄDOWA' : 'LEGAL VERSION'}</span></h1>
<div class="meta">
  ${pl ? 'Rodzina' : 'Family'}: <strong>${escHtml(family.name)}</strong> &nbsp;|&nbsp;
  ${pl ? 'Wygenerowano' : 'Generated at'}: <strong>${new Date(exportTs * 1000).toISOString()}</strong> &nbsp;|&nbsp;
  ${pl ? 'Waluta' : 'Currency'}: <strong>${family.currency}</strong> &nbsp;|&nbsp;
  UUID: <strong style="font-family:monospace">${docUuid}</strong>
</div>
<p class="report-description" style="border-left:3px solid #bf360c">${pl
  ? 'Dokument zawiera kryptograficznie zabezpieczone dane do celów sądowych i mediacyjnych. Dane GPS i adresy IP są renderowane wyłącznie w tym dokumencie i nigdy nie są przechowywane po stronie klienta.'
  : 'This document contains cryptographically secured data for judicial and mediation purposes. GPS coordinates and IP addresses are rendered exclusively in this document and are never stored client-side.'}</p>

<h2>${pl ? 'Statystyki Weryfikacji' : 'Verification Statistics'}</h2>
<div class="summary-grid">
  <div class="summary-card"><div class="num">${fmtAmount(totalEarned, family.currency)}</div><div class="label">${pl ? 'Łącznie zarobiono' : 'Total Earned'}</div></div>
  <div class="summary-card"><div class="num">${totalTasks}</div><div class="label">${pl ? 'Zapisów w rejestrze' : 'Evidence Log Entries'}</div></div>
  <div class="summary-card"><div class="num conf-high">${highConf}</div><div class="label">${pl ? 'Wysoka pewność' : 'High Confidence'}</div></div>
  <div class="summary-card"><div class="num conf-medium">${medConf}</div><div class="label">${pl ? 'Średnia pewność' : 'Medium Confidence'}</div></div>
  <div class="summary-card"><div class="num conf-low">${lowConf}</div><div class="label">${pl ? 'Niska pewność' : 'Low Confidence'}</div></div>
  <div class="summary-card"><div class="num">${disputed}</div><div class="label">${pl ? 'Zakwestionowanych' : 'Disputed'}</div></div>
</div>

${family.home_lat != null && family.home_lng != null ? `
<h2>${pl ? 'Punkt Odniesienia — Zweryfikowane Gospodarstwo' : 'Verified Household Baseline'}</h2>
<p style="font-size:9px;color:#777;font-style:italic;margin-bottom:8px">${pl
  ? 'Współrzędne domu zarejestrowanego używane jako centrum obliczeń Haversine dla wszystkich odchyleń GPS. Bez tego punktu odległości nie mają sensu.'
  : 'Registered home coordinates used as the Haversine anchor for all GPS variance calculations. Without this fixed point, distances are meaningless.'}</p>
<table style="width:auto">
  <tbody>
    <tr><th>${pl ? 'Szerokość geograficzna' : 'Latitude'}</th><td style="font-family:monospace">${family.home_lat.toFixed(6)}</td></tr>
    <tr><th>${pl ? 'Długość geograficzna' : 'Longitude'}</th><td style="font-family:monospace">${family.home_lng.toFixed(6)}</td></tr>
    <tr><th>${pl ? 'Adres (z rejestracji)' : 'Address (from registration)'}</th><td>${pl ? 'Manchester, Wielka Brytania' : 'Manchester, United Kingdom'}</td></tr>
  </tbody>
</table>` : ''}

<h2>${pl ? 'Rejestr Dowodów z Hashami SHA-256' : 'Evidence Log with SHA-256 Hashes'}</h2>
<p style="font-size:9px;color:#777;font-style:italic;margin-bottom:8px">${pl
  ? 'Każdy wpis zawiera nazwę uczestnika odpowiedzialnego za dane zadanie.'
  : 'Each entry includes the Contributor attributed to the task.'}</p>
<table>
  <thead>
    <tr>
      <th>#</th><th>${pl ? 'Data' : 'Date'}</th>
      <th>${pl ? 'Uczestnik' : 'Contributor'}</th>
      <th>${pl ? 'Opis' : 'Description'}</th>
      <th>${pl ? 'Kwota' : 'Amount'}</th><th>${pl ? 'Status' : 'Status'}</th>
      <th>SHA-256</th>
    </tr>
  </thead>
  <tbody>
    ${ledgerRows.map(r => `
    <tr${r.verification_status === 'disputed' ? ' style="background:#fff5f5"' : ''}>
      <td>${r.id}</td>
      <td>${fmtDate(r.created_at)}</td>
      <td><strong>${escHtml(r.child_name ?? '—')}</strong></td>
      <td>${escHtml(r.description)}</td>
      <td class="num-cell">${fmtAmount(r.amount, r.currency)}</td>
      <td><span class="badge-${badgeClass(r.verification_status)}">${statusLabel(r.verification_status, lang)}</span></td>
      <td class="hash-cell">${escHtml(r.record_hash)}</td>
    </tr>`).join('')}
  </tbody>
</table>

${completions.length > 0 ? `
<h2>${pl ? 'Dowody Wykonania Zadań — Urządzenie, Lokalizacja i Czas Zatwierdzenia' : 'Task Completion Evidence — Device, Location & Approval Latency'}</h2>
<p style="font-size:9px;color:#777;font-style:italic;margin-bottom:8px">${pl
  ? 'Odcisk urządzenia (device_fingerprint) to hash SHA-256 unikalnych identyfikatorów sprzętu — pozwala potwierdzić, że ten sam fizyczny telefon był używany we wszystkich wierszach. Czas oczekiwania na zatwierdzenie pokazuje, ile czasu minęło między przesłaniem a weryfikacją rodzica.'
  : 'Device Fingerprint is a SHA-256 hash of unique hardware identifiers — confirms the same physical handset was used across entries. Approval Latency shows the gap between upload and parental verification.'}</p>
<table>
  <thead>
    <tr>
      <th>#</th><th>${pl ? 'Data' : 'Date'}</th>
      <th>${pl ? 'Uczestnik' : 'Contributor'}</th>
      <th>${pl ? 'Pewność' : 'Confidence'}</th>
      <th>${pl ? 'Odchylenie GPS (km)' : 'GPS Variance (km)'}</th>
      <th>${pl ? 'Lokalizacja sieciowa' : 'Network Location'}</th>
      <th>IP</th>
      <th>${pl ? 'Model urządzenia' : 'Device Model'}</th>
      <th>${pl ? 'Odcisk urządzenia (SHA-256)' : 'Device Fingerprint (SHA-256)'}</th>
      <th>${pl ? 'Czas zatwierdzenia' : 'Approval Latency'}</th>
      <th>${pl ? 'Hash dowodu' : 'Proof Hash'}</th>
    </tr>
  </thead>
  <tbody>
    ${completions.map(c => {
      const latency = c.verified_at != null
        ? fmtLatency(c.verified_at - c.submitted_at)
        : (pl ? 'Brak' : 'Pending');
      const latencyClass = c.verified_at != null && (c.verified_at - c.submitted_at) > 4 * 86400
        ? 'color:#f57f17;font-weight:700'
        : '';
      return `
    <tr${c.verification_confidence === 'Low' ? ' style="background:#fff5f5"' : ''}>
      <td>${c.id}</td>
      <td>${fmtDate(c.submitted_at)}</td>
      <td><strong>${escHtml(c.child_name ?? '—')}</strong></td>
      <td class="conf-${(c.verification_confidence ?? 'low').toLowerCase()}">${escHtml(c.verification_confidence ?? '—')}</td>
      <td>${c.haversine_km != null ? c.haversine_km.toFixed(2) : '—'}</td>
      <td>${escHtml(c.network_city ?? '—')}</td>
      <td style="font-size:9px">${escHtml(c.network_ip ?? '—')}</td>
      <td style="font-size:9px">${escHtml(c.device_model ?? '—')}</td>
      <td class="hash-cell">${escHtml(c.device_fingerprint ?? '—')}</td>
      <td style="font-size:9px;${latencyClass}">${latency}</td>
      <td class="hash-cell">${escHtml(c.proof_hash ?? '—')}</td>
    </tr>`; }).join('')}
  </tbody>
</table>` : ''}

<h2>${pl ? 'Audyt Zarządzania — Pełny Dziennik' : 'Governance Audit — Full Log'}</h2>
<table>
  <thead>
    <tr>
      <th>#</th><th>${pl ? 'Data' : 'Date'}</th>
      <th>${pl ? 'Zgłoszono przez' : 'Requested by'}</th>
      <th>${pl ? 'Działanie' : 'Action'}</th>
      <th>${pl ? 'Status' : 'Status'}</th>
      <th>${pl ? 'Zatwierdzone przez' : 'Confirmed by'}</th>
      <th>IP (${pl ? 'żądanie' : 'request'})</th>
      <th>IP (${pl ? 'potwierdzenie' : 'confirm'})</th>
    </tr>
  </thead>
  <tbody>
    ${govRows.map(g => `
    <tr>
      <td>${g.id}</td>
      <td>${fmtDate(g.requested_at)}</td>
      <td>${escHtml(g.requested_by)}</td>
      <td>${g.new_mode === 'amicable'
        ? (pl ? 'Włączono auto-weryfikację' : 'Enabled Auto-Verify')
        : (pl ? 'Włączono ręczną weryfikację' : 'Enabled Manual Approval')}</td>
      <td>${g.status}</td>
      <td>${g.confirmed_by ?? '—'}</td>
      <td style="font-size:9px">${escHtml(g.request_ip)}</td>
      <td style="font-size:9px">${escHtml(g.confirm_ip ?? '—')}</td>
    </tr>`).join('')}
  </tbody>
</table>

${rewardEdits.length > 0 ? `
<h2>${pl ? 'Audyt Zmian Wynagrodzenia' : 'Reward Override Audit'}</h2>
<table>
  <thead>
    <tr>
      <th>${pl ? 'Data' : 'Date'}</th>
      <th>${pl ? 'Zadanie' : 'Chore'}</th>
      <th>${pl ? 'Zatwierdzone przez' : 'Approver'}</th>
      <th>${pl ? 'Poprzednia kwota' : 'Previous Amount'}</th>
      <th>${pl ? 'Nowa kwota' : 'New Amount'}</th>
      <th>${pl ? 'Powód' : 'Reason'}</th>
    </tr>
  </thead>
  <tbody>
    ${rewardEdits.map(e => `
    <tr>
      <td>${fmtDate(e.changed_at)}</td>
      <td>${escHtml(e.chore_id)}</td>
      <td>${escHtml(e.actor_id)}</td>
      <td class="num-cell">${fmtAmount(e.old_amount, family.currency)}</td>
      <td class="num-cell">${fmtAmount(e.new_amount, family.currency)}</td>
      <td>${escHtml(e.reason ?? '—')}</td>
    </tr>`).join('')}
  </tbody>
</table>` : ''}

${loginRows.length > 0 ? `
<h2>${pl ? 'Historia Logowania — Dziennik Dostępu' : 'Login History — Access Log'}</h2>
<p style="font-size:9px;color:#777;font-style:italic;margin-bottom:8px">${pl
  ? 'Każde logowanie i przesłanie dowodu przez dowolnego członka rodziny. Wyłącznie w wersji sądowej.'
  : 'Every login and upload action by any family member. Forensic version only — excluded from standard reports.'}</p>
<table>
  <thead>
    <tr>
      <th>${pl ? 'Data/Godzina' : 'Date / Time'}</th>
      <th>${pl ? 'Użytkownik' : 'User'}</th>
      <th>${pl ? 'Działanie' : 'Action'}</th>
      <th>IP</th>
      <th>${pl ? 'Urządzenie' : 'Device'}</th>
    </tr>
  </thead>
  <tbody>
    ${loginRows.map(l => `
    <tr>
      <td style="white-space:nowrap">${fmtDateTime(l.event_at)}</td>
      <td>${escHtml(l.display_name)}</td>
      <td>${escHtml(l.action)}</td>
      <td style="font-size:9px">${escHtml(l.ip_address)}</td>
      <td style="font-size:9px">${escHtml(l.user_agent ?? '—')}</td>
    </tr>`).join('')}
  </tbody>
</table>` : ''}

${(() => {
    // Build exhibit assignments for shared expenses with receipts (not voided)
    const exhibitAssignments = new Map<number, string>();
    let exhibitIdx = 0;
    for (const se of sharedExpenseRows) {
      if (se.receipt_r2_key && !se.voided_at) {
        exhibitAssignments.set(se.id, exhibitLabel(exhibitIdx++));
      }
    }
    return sharedExpenseRows.length > 0 ? `
<h2>${pl ? 'Wydatki Wspólne (Rejestr)' : 'Shared Expenses Register'}</h2>
<p style="font-size:9px;color:#777;font-style:italic;margin-bottom:8px">${pl
  ? 'Wszystkie wydatki rodzicielskie zarejestrowane w systemie. Anulowane wpisy zachowane dla integralności łańcucha.'
  : 'All co-parenting expenses logged in the system. Voided entries retained for chain integrity.'}</p>
<table>
  <thead>
    <tr>
      <th>#</th><th>Date</th><th>Description</th><th>Category</th>
      <th>Total</th><th>Your Share</th><th>Logged By</th><th>Status</th><th>Exhibit</th>
    </tr>
  </thead>
  <tbody>
    ${buildSharedExpenseRows(sharedExpenseRows, family.currency, exhibitAssignments)}
  </tbody>
</table>
${buildExhibitsSection(sharedExpenseRows, exhibitAssignments, pl)}
` : '';
  })()}

<div class="integrity-block">
  <strong>${pl ? 'Pieczęć Integralności Dokumentu' : 'Document Integrity Seal'}</strong><br/>
  <span style="font-family:monospace;font-size:9px">${fingerprint}</span><br/>
  <span style="font-size:9px;color:#555">UUID: ${docUuid}</span>
  <div style="font-size:9px;color:#666;margin-top:6px">${pl
    ? 'Hash SHA-256 jednoznacznie identyfikuje ten eksport. Każda zmiana danych spowoduje inny hash.'
    : 'This SHA-256 hash uniquely identifies this export. Any data change produces a different hash.'}</div>
</div>

${declarationFooter(family.name, exportTs, lang, docUuid, true)}

</body>
</html>`;
}

// ================================================================
// Shared HTML components
// ================================================================

function baseStyles(): string {
  return `<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #1a1a1a; padding: 32px; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  h2 { font-size: 13px; margin: 24px 0 8px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
  .meta { color: #666; font-size: 10px; margin-bottom: 8px; }
  .report-description { font-size:10px; color:#555; margin-bottom:16px; border-left:3px solid #ddd; padding-left:8px; }
  .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 12px 0; }
  .summary-card { border: 1px solid #ddd; border-radius: 6px; padding: 10px 14px; }
  .summary-card .num { font-size: 20px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .summary-card .label { font-size: 10px; color: #666; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size:10px; }
  th { background: #f5f5f5; text-align: left; padding: 5px 8px; font-size: 10px; border: 1px solid #ddd; }
  td { padding: 4px 8px; border: 1px solid #eee; vertical-align: top; }
  tr:nth-child(even) { background: #fafafa; }
  .num-cell { text-align:right; font-variant-numeric:tabular-nums; }
  .badge-auto     { background: #e8f5e9; color: #2e7d32; padding: 1px 6px; border-radius: 10px; font-size: 9px; }
  .badge-manual   { background: #e3f2fd; color: #1565c0; padding: 1px 6px; border-radius: 10px; font-size: 9px; }
  .badge-pending  { background: #fff8e1; color: #f57f17; padding: 1px 6px; border-radius: 10px; font-size: 9px; }
  .badge-disputed { background: #fce4ec; color: #b71c1c; padding: 1px 6px; border-radius: 10px; font-size: 9px; }
  .badge-reversed { background: #f3e5f5; color: #6a1b9a; padding: 1px 6px; border-radius: 10px; font-size: 9px; }
  .warn { color:#b71c1c; font-size:10px; margin-bottom:8px; }
  .fingerprint-block { margin-top:24px; padding:14px; border:1px solid #ccc; border-radius:6px; background:#f9f9f9; }
  .fp { font-family:monospace; font-size:10px; word-break:break-all; margin:4px 0; }
  .qr-placeholder { display:inline-block; width:64px; height:64px; border:1px solid #ccc; text-align:center; line-height:64px; font-size:8px; color:#999; vertical-align:middle; margin-right:12px; }
  .declaration { margin-top:24px; padding:14px; border:2px solid #1a1a1a; border-radius:4px; font-size:10px; line-height:1.6; }
  @media print { body { padding: 16px; } }
</style>`;
}

function fingerprintBlock(fingerprint: string, shortFp: string, lang: string): string {
  const pl = lang === 'pl';
  return `<div class="fingerprint-block">
  <span class="qr-placeholder">QR<br/>${shortFp.slice(0, 8)}</span>
  <span>
    <strong>${pl ? 'Odcisk dokumentu' : 'Document Fingerprint'}:</strong><br/>
    <span class="fp">${fingerprint}</span>
    <div style="font-size:9px;color:#666;margin-top:4px">${pl
      ? 'Ten hash SHA-256 jednoznacznie identyfikuje ten eksport. Każda zmiana danych spowoduje inny hash.'
      : 'This SHA-256 hash uniquely identifies this export. Any data change produces a different hash.'}</div>
  </span>
</div>`;
}

function declarationFooter(
  familyName: string,
  exportTs: number,
  lang: string,
  docUuid: string,
  expanded: boolean,
): string {
  const pl   = lang === 'pl';
  const date = new Date(exportTs * 1000).toDateString();

  const baseText = pl
    ? `Niniejszy dokument zawiera pełny i niezmieniony zapis finansowy rodziny <strong>${escHtml(familyName)}</strong>, wygenerowany przez system Morechard w dniu ${escHtml(date)}.`
    : `This document contains the complete and unaltered financial record for family <strong>${escHtml(familyName)}</strong>, generated by Morechard on ${escHtml(date)}.`;

  // Locale-specific statutory citations — only rendered in forensic (expanded) reports
  const legalCitations = expanded ? (pl
    ? `<br/><br/><strong>Podstawa prawna (Polska):</strong> Niniejszy dokument stanowi zapis komputerowy w rozumieniu art. 308 Kodeksu postępowania cywilnego (k.p.c.), który dopuszcza dowody elektroniczne i komputerowe w postępowaniu cywilnym. Kryptograficzne hashowanie rekordów zapewnia integralność wymaganą dla środków dowodowych w postępowaniach sądowych i mediacyjnych.`
    : `<br/><br/><strong>Legal Basis (United Kingdom):</strong> This document constitutes a computer-produced record under Section 1 of the Civil Evidence Act 1995, which provides for the admissibility of documentary evidence produced by computers. The cryptographic hash chain satisfies the requirement for records to be produced in the course of activities of a regular nature and provides integrity verification consistent with the Act's requirements for computer records tendered in Family Court proceedings.`
  ) : '';

  const expandedSupplement = expanded
    ? `<br/><br/>${pl
        ? `<strong>UUID dokumentu:</strong> <span style="font-family:monospace">${docUuid}</span><br/><strong>Pieczęć integralności:</strong> Każdy wpis w rejestrze jest powiązany z poprzednim via SHA-256 (łańcuch hash). Każda modyfikacja po eksporcie unieważni ten dokument.`
        : `<strong>Document UUID:</strong> <span style="font-family:monospace">${docUuid}</span><br/><strong>Integrity Seal:</strong> Each evidence entry is chained to the previous via SHA-256. Any post-export modification will invalidate this document.`}${legalCitations}`
    : '';

  return `<div class="declaration">
  <strong>${pl ? 'Oświadczenie o dokładności danych' : 'Declaration of Accuracy'}</strong><br/>
  ${baseText}${expandedSupplement}
</div>`;
}

function fmtLatency(seconds: number): string {
  if (seconds < 3600)        return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400)       return `${Math.round(seconds / 3600)}h`;
  const days = Math.round(seconds / 86400);
  return `${days}d`;
}

// ================================================================
// Behavioural pulse derivation
// ================================================================

interface PulseSignal {
  label: string;
  type: 'positive' | 'caution' | 'concern';
  child_name: string | null;
  explanation: string | null;
}

function deriveBehaviouralPulse(ledgerRows: LedgerRow[], statusRows: StatusLogRow[], lang: string): PulseSignal[] {
  const pl = lang === 'pl';
  const signals: PulseSignal[] = [];

  // Group by child so each signal is attributed to the specific child
  const childIds = [...new Set(ledgerRows.map(r => r.child_id ?? '').filter(Boolean))];

  for (const childId of childIds) {
    const childRows = ledgerRows.filter(r => r.child_id === childId);
    const childName = childRows[0]?.child_name ?? null;

    const credits  = childRows.filter(r => r.entry_type === 'credit');
    const payments = childRows.filter(r => r.entry_type === 'payment');
    const disputed = childRows.filter(r => r.verification_status === 'disputed');

    // Stagnant Earner — fewer than 2 credits in last 30 days
    const cutoff30 = Math.floor(Date.now() / 1000) - 30 * 86400;
    const recent   = credits.filter(r => r.created_at > cutoff30).length;
    if (credits.length > 4 && recent < 2) {
      signals.push({
        label: pl ? 'Stagnujący zarabiacz' : 'Stagnant Earner',
        type: 'concern',
        child_name: childName,
        explanation: pl
          ? 'Mniej niż 2 zadania ukończone w ostatnich 30 dniach pomimo wcześniejszej aktywności. Warto sprawdzić, czy zestaw zadań jest nadal odpowiedni i motywujący.'
          : 'Fewer than 2 tasks completed in the last 30 days despite prior activity. Worth reviewing whether the current chore set still feels relevant and motivating.',
      });
    }

    // The Burner — high spend-to-earn ratio
    const earnedMinor = credits.reduce((s, r) => s + r.amount, 0);
    const spentMinor  = payments.reduce((s, r) => s + r.amount, 0);
    if (earnedMinor > 0 && spentMinor / earnedMinor > 0.8) {
      signals.push({
        label: pl ? 'Wydający wszystko' : 'The Burner',
        type: 'concern',
        child_name: childName,
        explanation: pl
          ? 'Wydano ponad 80% zarobionych środków. To sygnał Filaru 2 (Wydawanie i wybory) — dobry moment na wprowadzenie podziału 70/20/10 (wydatki/oszczędności/darowizny).'
          : 'Over 80% of earnings have been spent. This is a Pillar 2 (Spending & Choices) signal — a good moment to introduce the 70/20/10 spend/save/give split.',
      });
    } else if (earnedMinor > 0 && spentMinor / earnedMinor < 0.3 && earnedMinor > 500) {
      signals.push({
        label: pl ? 'Regularny oszczędzający' : 'Consistent Saver',
        type: 'positive',
        child_name: childName,
        explanation: pl
          ? 'Wydano mniej niż 30% zarobków — silny nawyk odkładania. To fundament Filaru 3 (Oszczędzanie i wzrost). Następny krok: wprowadzenie celu oszczędnościowego, aby pieniądze "pracowały".'
          : 'Less than 30% of earnings spent — a strong saving habit. This is the foundation of Pillar 3 (Saving & Growth). Next step: introduce a savings goal so the money has a destination.',
      });
    }

    // Dispute rate
    if (disputed.length > 0 && credits.length > 0 && disputed.length / credits.length > 0.2) {
      signals.push({
        label: pl ? 'Wysoki wskaźnik sporów' : 'High Dispute Rate',
        type: 'concern',
        child_name: childName,
        explanation: pl
          ? 'Ponad 20% zadań zostało zakwestionowanych. Może to wskazywać na niejasne oczekiwania dotyczące jakości lub niezrozumienie kryteriów zatwierdzania.'
          : 'More than 20% of tasks have been disputed. This may indicate unclear quality expectations or misunderstanding of what counts as complete.',
      });
    }

    // Steady contributor
    if (credits.length >= 10 && disputed.length === 0) {
      signals.push({
        label: pl ? 'Stały uczestnik' : 'Steady Contributor',
        type: 'positive',
        child_name: childName,
        explanation: pl
          ? '10 lub więcej zadań ukończonych bez żadnego sporu. Ten wskaźnik niezawodności odpowiada Filarowi 4 (Pożyczanie i dług) — konsekwencja buduje "scoring zaufania".'
          : '10 or more tasks completed with zero disputes. This reliability track record maps directly to Pillar 4 (Borrowing & Debt) — consistency builds a real-world trust score.',
      });
    }
  }

  // Revision pattern — family-wide (status log doesn't carry child_id directly)
  const revisions = statusRows.filter(s => s.to_status === 'pending' && s.from_status !== 'pending').length;
  if (revisions > 2) {
    signals.push({
      label: pl ? 'Potrzeba poprawy' : 'Needs Revision Pattern',
      type: 'caution',
      child_name: null,
      explanation: pl
        ? 'Kilka zadań wymagało ponownego przesłania po wstępnej weryfikacji. Warto omówić standardy jakości, zanim zadanie zostanie uznane za ukończone.'
        : 'Several tasks required re-submission after initial review. It may help to clarify quality standards before a task is considered done.',
    });
  }

  if (signals.length === 0) {
    signals.push({
      label: pl ? 'Za mało danych do analizy' : 'Insufficient data for pulse',
      type: 'caution',
      child_name: null,
      explanation: pl
        ? 'Nie ma jeszcze wystarczającej aktywności, aby wygenerować sygnały behawioralne. Więcej zadań i celów dostarczy dokładniejszego obrazu.'
        : 'Not enough activity yet to generate behavioural signals. More tasks and goals will paint a clearer picture.',
    });
  }

  return signals;
}

// ================================================================
// Helpers
// ================================================================

type ReportTier = 'basic' | 'behavioral' | 'forensic';

interface LabelRow  { code: string; label_en: string; label_pl: string; }
interface FamilyRow {
  id: string; name: string; currency: string; verify_mode: string;
  // Registered home coordinates — used as Haversine anchor, stored in families table
  home_lat: number | null; home_lng: number | null;
}
interface LedgerRow {
  id: number; created_at: number; entry_type: string; description: string;
  child_id: string | null; category: string | null; amount: number; currency: string;
  verification_status: string; dispute_code: string | null; record_hash: string;
  // Joined from users
  child_name: string | null;
}
interface GovRow {
  id: number; requested_at: number; requested_by: string; new_mode: string;
  status: string; confirmed_by: string | null; request_ip: string; confirm_ip: string | null;
}
interface StatusLogRow {
  id: number; ledger_id: number; from_status: string; to_status: string;
  actor_id: string; created_at: number;
}
interface CompletionRow {
  id: number; chore_id: string; child_id: string;
  // child_name joined from users
  child_name: string | null;
  submitted_at: number;
  // verified_at for approval latency calculation
  verified_at: number | null;
  proof_hash: string | null; verification_confidence: string | null;
  haversine_km: number | null; network_city: string | null; network_ip: string | null;
  device_model: string | null; user_agent: string | null;
  // Hashed device fingerprint — identifies specific physical device, not just model
  device_fingerprint: string | null;
}
interface LearningModuleRow {
  slug: string; unlocked_at: number; child_id: string;
  // child_name joined from users
  child_name: string | null;
}
interface RewardEditRow {
  actor_id: string; chore_id: string; old_amount: number; new_amount: number;
  changed_at: number; reason: string | null;
}
interface LoginHistoryRow {
  display_name: string; event_at: number; ip_address: string;
  user_agent: string | null; role: string; action: string;
}

interface SharedExpenseExportRow {
  id: number;
  logged_by: string;
  logged_by_name: string | null;
  description: string;
  category: string;
  total_amount: number;
  currency: string;
  split_bp: number;
  verification_status: string;
  expense_date: string | null;
  note: string | null;
  receipt_r2_key: string | null;
  receipt_uploaded_at: number | null;
  voided_at: number | null;
  voided_by_name: string | null;
  voids_id: number | null;
  hash_version: number;
  record_hash: string;
  created_at: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  education:  'Education',
  health:     'Health',
  clothing:   'Clothing',
  travel:     'Travel',
  activities: 'Activities',
  childcare:  'Childcare',
  food:       'Food',
  tech:       'Tech & Devices',
  gifts:      'Gifts & Celebrations',
  other:      'Other',
};

function exhibitLabel(index: number): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (index < 26) return alphabet[index];
  return alphabet[Math.floor(index / 26) - 1] + alphabet[index % 26];
}

function buildSharedExpenseRows(rows: SharedExpenseExportRow[], currency: string, exhibits: Map<number, string>): string {
  return rows.map(se => {
    const voided = se.voided_at !== null;
    const style = voided ? ' style="text-decoration:line-through;color:#999"' : '';
    const loggedByAmount = Math.round((se.total_amount * se.split_bp) / 10000);
    const statusText = voided
      ? `Voided ${fmtDate(se.voided_at!)} by ${escHtml(se.voided_by_name ?? 'unknown')}`
      : se.verification_status.replace('_', ' ');
    const replacesNote = se.voids_id ? ` <em style="font-size:9px">(Replaces #${se.voids_id})</em>` : '';
    const label = exhibits.get(se.id) ?? '—';
    return `<tr>
      <td${style}>${se.id}</td>
      <td${style}>${escHtml(se.expense_date ?? fmtDate(se.created_at))}</td>
      <td${style}>${escHtml(se.description)}${replacesNote}</td>
      <td${style}>${CATEGORY_LABELS[se.category] ?? se.category}</td>
      <td class="num-cell"${style}>${fmtAmount(se.total_amount, currency)}</td>
      <td class="num-cell"${style}>${fmtAmount(loggedByAmount, currency)}</td>
      <td${style}>${escHtml(se.logged_by_name ?? '—')}</td>
      <td${style}>${escHtml(statusText)}</td>
      <td style="font-family:monospace;font-weight:700">${label}</td>
    </tr>`;
  }).join('');
}

function buildExhibitsSection(rows: SharedExpenseExportRow[], exhibits: Map<number, string>, pl: boolean): string {
  const withReceipts = rows.filter(se => exhibits.has(se.id));
  if (!withReceipts.length) return '';
  return `<h2>${pl ? 'Załączniki (Rachunki)' : 'Exhibits (Receipts)'}</h2>
<p style="font-size:9px;color:#777;font-style:italic;margin-bottom:8px">${pl
  ? 'Rachunki są przechowywane w bezpiecznym magazynie i dostępne na żądanie sądu.'
  : 'Receipts are stored in secure storage and available on court request.'}</p>
<table>
  <thead>
    <tr><th>Exhibit</th><th>#</th><th>Description</th><th>Date</th><th>Storage Reference</th></tr>
  </thead>
  <tbody>
    ${withReceipts.map(se => `<tr>
      <td style="font-family:monospace;font-weight:700">${exhibits.get(se.id)}</td>
      <td>${se.id}</td>
      <td>${escHtml(se.description)}</td>
      <td>${escHtml(se.expense_date ?? fmtDate(se.created_at))}</td>
      <td style="font-family:monospace;font-size:9px">${escHtml(se.receipt_r2_key ?? '—')}</td>
    </tr>`).join('')}
  </tbody>
</table>`;
}

function buildLabelMap(rows: LabelRow[], lang: string): Record<string, string> {
  return Object.fromEntries(rows.map(r => [r.code, lang === 'pl' ? r.label_pl : r.label_en]));
}

function escHtml(s: string | null | undefined): string {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fmtDate(epoch: number): string {
  return new Date(epoch * 1000).toISOString().slice(0, 10);
}

function fmtDateTime(epoch: number): string {
  return new Date(epoch * 1000).toISOString().slice(0, 16).replace('T', ' ');
}

function fmtAmount(pence: number, currency: string): string {
  const major = (pence / 100).toFixed(2);
  if (currency === 'GBP') return `£${major}`;
  if (currency === 'PLN') return `${major} zł`;
  return `$${major}`;
}

function badgeClass(status: string): string {
  if (status === 'verified_auto')   return 'auto';
  if (status === 'verified_manual') return 'manual';
  if (status === 'disputed')        return 'disputed';
  if (status === 'reversed')        return 'reversed';
  return 'pending';
}

function statusLabel(status: string, lang: string): string {
  const pl = lang === 'pl';
  const map: Record<string, [string, string]> = {
    'pending':          ['Oczekujący',         'Pending'],
    'verified_auto':    ['Zweryfikowany auto',  'Verified (Auto)'],
    'verified_manual':  ['Zweryfikowany ręcznie','Verified (Manual)'],
    'disputed':         ['Zakwestionowany',     'Disputed'],
    'reversed':         ['Wycofany',            'Reversed'],
  };
  const pair = map[status];
  return pair ? (pl ? pair[0] : pair[1]) : status;
}
