/**
 * Finance routes — spending, payouts, bonus payments, subscriptions
 *
 * POST   /api/spending                Log a child purchase
 * GET    /api/spending?family_id=&child_id=
 * POST   /api/payouts                 Parent pays child cash
 * GET    /api/payouts?family_id=&child_id=
 * POST   /api/bonus                   Parent awards bonus payment (writes ledger)
 * GET    /api/bonus?family_id=&child_id=
 * POST   /api/subscriptions           Add subscription
 * GET    /api/subscriptions?family_id=&child_id=
 * PATCH  /api/subscriptions/:id       Edit subscription
 * DELETE /api/subscriptions/:id       Cancel (set active=0)
 * GET    /api/balance?family_id=&child_id=   Computed balance summary
 */

import { Env } from '../types.js';

import { json, error, clientIp, parseBody } from '../lib/response.js';
import { nanoid } from '../lib/nanoid.js';
import { computeRecordHash, GENESIS_HASH } from '../lib/hash.js';
import { JwtPayload } from '../lib/jwt.js';
import { getStreakState, buildMissEvent, saveStreakEvent, hadScheduledChores, todayUTC, previousDay } from '../lib/streaks.js';
import { getBadgeStats, badgesToAward, insertBadges } from '../lib/badges.js';

type AuthedRequest = Request & { auth: JwtPayload };

// ----------------------------------------------------------------
// POST /api/spending
// ----------------------------------------------------------------
export async function handleSpendingCreate(request: Request, env: Env): Promise<Response> {
  const auth = (request as AuthedRequest).auth;
  if (auth.role !== 'child') return error('Only children can log spending', 403);

  const body = await parseBody(request);
  if (!body) return error('Invalid JSON');

  const { family_id, title, amount, currency, note, goal_id } = body;
  if (!family_id || family_id !== auth.family_id) return error('Forbidden', 403);
  if (!title || typeof title !== 'string') return error('title required');
  if (!Number.isInteger(amount) || (amount as number) <= 0)
    return error('amount must be a positive integer');
  if (!currency || !['GBP','PLN'].includes(currency as string)) return error('Invalid currency');

  const id  = nanoid();
  const now = Math.floor(Date.now() / 1000);

  await env.DB.prepare(`
    INSERT INTO spending (id, family_id, child_id, title, amount, currency, note, goal_id, spent_at)
    VALUES (?,?,?,?,?,?,?,?,?)
  `).bind(
    id, family_id as string, auth.sub,
    (title as string).trim(), amount, currency,
    note ? String(note).trim() : null,
    goal_id ?? null, now,
  ).run();

  return json({ id, spent_at: now }, 201);
}

export async function handleSpendingList(request: Request, env: Env): Promise<Response> {
  const auth = (request as AuthedRequest).auth;
  const url = new URL(request.url);
  const family_id = url.searchParams.get('family_id');
  const child_id  = auth.role === 'child' ? auth.sub : url.searchParams.get('child_id');

  if (!family_id || family_id !== auth.family_id) return error('Forbidden', 403);
  if (!child_id) return error('child_id required');

  const { results } = await env.DB.prepare(
    `SELECT * FROM spending WHERE family_id = ? AND child_id = ?
     ORDER BY spent_at DESC LIMIT 100`
  ).bind(family_id, child_id).all();
  return json({ spending: results });
}

// ----------------------------------------------------------------
// POST /api/payouts
// ----------------------------------------------------------------
export async function handlePayoutCreate(request: Request, env: Env): Promise<Response> {
  const auth = (request as AuthedRequest).auth;
  if (auth.role !== 'parent') return error('Only parents can record payouts', 403);

  const body = await parseBody(request);
  if (!body) return error('Invalid JSON');
  const { family_id, child_id, amount, currency, note } = body;
  if (!family_id || family_id !== auth.family_id) return error('Forbidden', 403);
  if (!child_id  || typeof child_id !== 'string') return error('child_id required');
  if (!Number.isInteger(amount) || (amount as number) <= 0)
    return error('amount must be a positive integer');
  if (!currency || !['GBP','PLN'].includes(currency as string)) return error('Invalid currency');

  const id  = nanoid();
  const now = Math.floor(Date.now() / 1000);

  await env.DB.prepare(
    `INSERT INTO payouts (id, family_id, child_id, paid_by, amount, currency, note, paid_at)
     VALUES (?,?,?,?,?,?,?,?)`
  ).bind(id, family_id as string, child_id as string, auth.sub, amount, currency,
    note ? String(note).trim() : null, now).run();

  // ── First-payday badge ─────────────────────────────────────────────
  try {
    const payoutCount = await env.DB.prepare(
      `SELECT COUNT(*) AS total FROM payouts WHERE child_id = ?`
    ).bind(child_id as string).first<{ total: number }>()

    if (payoutCount?.total === 1) {
      // This was the first payout — check for LANDMARK_SAPLING badge
      const [stats, streakState] = await Promise.all([
        getBadgeStats(env.DB, child_id as string),
        getStreakState(env.DB, child_id as string),
      ])
      const newBadges = badgesToAward({
        earnedBadgeKeys:       stats.earnedBadgeKeys,
        currentStreak:         streakState.current_streak,
        longestStreak:         Math.max(streakState.longest_streak, streakState.current_streak),
        totalApprovedChores:   stats.totalApprovedChores,
        totalGoalsCompleted:   stats.totalGoalsCompleted,
        totalSavedPence:       stats.totalSavedPence,
        totalLessonsCompleted: stats.totalLessonsCompleted,
        isFirstPayday:         true,
        isFirstChore:          false,
      })
      if (newBadges.length > 0) {
        await insertBadges(env.DB, child_id as string, newBadges, nanoid)
      }
    }
  } catch {
    // Badge eval is non-critical
  }
  // ── End first-payday badge ─────────────────────────────────────────

  return json({ id, paid_at: now }, 201);
}

export async function handlePayoutList(request: Request, env: Env): Promise<Response> {
  const auth = (request as AuthedRequest).auth;
  const url = new URL(request.url);
  const family_id = url.searchParams.get('family_id');
  const child_id  = auth.role === 'child' ? auth.sub : url.searchParams.get('child_id');
  if (!family_id || family_id !== auth.family_id) return error('Forbidden', 403);
  if (!child_id) return error('child_id required');

  const { results } = await env.DB.prepare(
    `SELECT p.*, u.display_name AS paid_by_name
     FROM payouts p JOIN users u ON u.id = p.paid_by
     WHERE p.family_id = ? AND p.child_id = ? ORDER BY p.paid_at DESC LIMIT 100`
  ).bind(family_id, child_id).all();
  return json({ payouts: results });
}

// ----------------------------------------------------------------
// POST /api/bonus  — writes a ledger entry of type 'credit'
// ----------------------------------------------------------------
export async function handleBonusCreate(request: Request, env: Env): Promise<Response> {
  const auth = (request as AuthedRequest).auth;
  if (auth.role !== 'parent') return error('Only parents can award bonuses', 403);

  const ip = clientIp(request);
  const body = await parseBody(request);
  if (!body) return error('Invalid JSON');

  const { family_id, child_id, amount, currency, reason } = body;
  if (!family_id || family_id !== auth.family_id) return error('Forbidden', 403);
  if (!child_id  || typeof child_id !== 'string') return error('child_id required');
  if (!reason    || typeof reason   !== 'string') return error('reason required');
  if (!Number.isInteger(amount) || (amount as number) <= 0)
    return error('amount must be a positive integer');
  if (!currency || !['GBP','PLN'].includes(currency as string)) return error('Invalid currency');

  const family = await env.DB
    .prepare('SELECT verify_mode FROM families WHERE id = ?')
    .bind(family_id).first<{ verify_mode: string }>();
  if (!family) return error('Family not found', 404);

  const verificationStatus = family.verify_mode === 'amicable' ? 'verified_auto' : 'verified_manual';
  const now = Math.floor(Date.now() / 1000);
  const disputeBefore = verificationStatus === 'verified_auto' ? now + 172800 : null;

  const prevRow = await env.DB
    .prepare('SELECT id, record_hash FROM ledger WHERE family_id = ? ORDER BY id DESC LIMIT 1')
    .bind(family_id).first<{ id: number; record_hash: string }>();
  const previousHash = prevRow?.record_hash ?? GENESIS_HASH;

  const newLedgerId = (prevRow?.id ?? 0) + 1;

  const recordHash = await computeRecordHash(
    newLedgerId, family_id as string, child_id as string,
    amount as number, currency as string, 'credit', previousHash,
  );

  const bonusId = nanoid();

  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO ledger
        (id, family_id, child_id, entry_type, amount, currency, description,
         verification_status, authorised_by, verified_at, verified_by,
         previous_hash, record_hash, ip_address, dispute_before)
      VALUES (?,?,?,'credit',?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      newLedgerId, family_id as string, child_id as string,
      amount, currency, `Bonus: ${reason}`,
      verificationStatus, auth.sub, now, auth.sub,
      previousHash, recordHash, ip, disputeBefore,
    ),
    env.DB.prepare(`
      INSERT INTO bonus_payments
        (id, family_id, child_id, paid_by, amount, currency, reason, ledger_id, created_at)
      VALUES (?,?,?,?,?,?,?,?,?)
    `).bind(bonusId, family_id as string, child_id as string, auth.sub,
      amount, currency, (reason as string).trim(), newLedgerId, now),
  ]);

  return json({ id: bonusId, ledger_id: newLedgerId, record_hash: recordHash }, 201);
}

export async function handleBonusList(request: Request, env: Env): Promise<Response> {
  const auth = (request as AuthedRequest).auth;
  const url = new URL(request.url);
  const family_id = url.searchParams.get('family_id');
  const child_id  = auth.role === 'child' ? auth.sub : url.searchParams.get('child_id');
  if (!family_id || family_id !== auth.family_id) return error('Forbidden', 403);
  if (!child_id) return error('child_id required');

  const { results } = await env.DB.prepare(
    `SELECT b.*, u.display_name AS paid_by_name FROM bonus_payments b
     JOIN users u ON u.id = b.paid_by
     WHERE b.family_id = ? AND b.child_id = ? ORDER BY b.created_at DESC LIMIT 100`
  ).bind(family_id, child_id).all();
  return json({ bonuses: results });
}

// ----------------------------------------------------------------
// Subscriptions
// ----------------------------------------------------------------
export async function handleSubscriptionCreate(request: Request, env: Env): Promise<Response> {
  const auth = (request as AuthedRequest).auth;
  const body = await parseBody(request);
  if (!body) return error('Invalid JSON');

  const { family_id, child_id, title, category, amount, currency, frequency, start_date } = body;
  if (!family_id || family_id !== auth.family_id) return error('Forbidden', 403);
  if (!child_id  || typeof child_id !== 'string') return error('child_id required');
  if (!title     || typeof title    !== 'string') return error('title required');
  if (!Number.isInteger(amount) || (amount as number) <= 0)
    return error('amount must be a positive integer');
  if (!currency || !['GBP','PLN'].includes(currency as string)) return error('Invalid currency');
  if (!frequency || !['weekly','monthly','annual'].includes(frequency as string))
    return error('frequency must be weekly, monthly, or annual');
  if (!start_date || typeof start_date !== 'string') return error('start_date required');

  const id  = nanoid();
  const now = Math.floor(Date.now() / 1000);

  await env.DB.prepare(`
    INSERT INTO subscriptions
      (id, family_id, child_id, title, category, amount, currency, frequency, start_date, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)
  `).bind(id, family_id as string, child_id as string,
    (title as string).trim(), category ?? 'other',
    amount, currency, frequency, start_date as string, now).run();

  return json(await env.DB.prepare('SELECT * FROM subscriptions WHERE id = ?').bind(id).first(), 201);
}

export async function handleSubscriptionList(request: Request, env: Env): Promise<Response> {
  const auth = (request as AuthedRequest).auth;
  const url = new URL(request.url);
  const family_id = url.searchParams.get('family_id');
  const child_id  = auth.role === 'child' ? auth.sub : url.searchParams.get('child_id');
  if (!family_id || family_id !== auth.family_id) return error('Forbidden', 403);
  if (!child_id) return error('child_id required');

  const { results } = await env.DB.prepare(
    `SELECT * FROM subscriptions WHERE family_id = ? AND child_id = ? AND active = 1
     ORDER BY created_at DESC`
  ).bind(family_id, child_id).all();
  return json({ subscriptions: results });
}

export async function handleSubscriptionUpdate(
  request: Request, env: Env, id: string,
): Promise<Response> {
  const auth = (request as AuthedRequest).auth;
  const body = await parseBody(request);
  if (!body) return error('Invalid JSON');

  const sub = await env.DB
    .prepare('SELECT family_id FROM subscriptions WHERE id = ?')
    .bind(id).first<{ family_id: string }>();
  if (!sub) return error('Subscription not found', 404);
  if (sub.family_id !== auth.family_id) return error('Forbidden', 403);

  const allowed = ['title','category','amount','currency','frequency','start_date'];
  const updates: string[] = [];
  const values: unknown[] = [];
  for (const key of allowed) {
    if (key in body) { updates.push(`${key} = ?`); values.push(body[key] ?? null); }
  }
  if (updates.length === 0) return error('No valid fields to update');
  values.push(id);
  await env.DB.prepare(`UPDATE subscriptions SET ${updates.join(', ')} WHERE id = ?`)
    .bind(...values).run();
  return json(await env.DB.prepare('SELECT * FROM subscriptions WHERE id = ?').bind(id).first());
}

export async function handleSubscriptionCancel(
  request: Request, env: Env, id: string,
): Promise<Response> {
  const auth = (request as AuthedRequest).auth;
  const sub = await env.DB
    .prepare('SELECT family_id FROM subscriptions WHERE id = ?')
    .bind(id).first<{ family_id: string }>();
  if (!sub) return error('Subscription not found', 404);
  if (sub.family_id !== auth.family_id) return error('Forbidden', 403);
  await env.DB.prepare('UPDATE subscriptions SET active = 0 WHERE id = ?').bind(id).run();
  return json({ ok: true });
}

// ----------------------------------------------------------------
// GET /api/balance  — computed balance for a child
// Returns: { earned, pending, paid_out, spent, subscriptions_owed,
//            available, ledger_entries_count }
// ----------------------------------------------------------------
export async function handleBalance(request: Request, env: Env): Promise<Response> {
  const auth = (request as AuthedRequest).auth;
  const url = new URL(request.url);
  const family_id = url.searchParams.get('family_id');
  const child_id  = auth.role === 'child' ? auth.sub : url.searchParams.get('child_id');
  if (!family_id || family_id !== auth.family_id) return error('Forbidden', 403);
  if (!child_id) return error('child_id required');

  const [earned, pending, reversals, payoutsRow, spentRow] = await Promise.all([
    env.DB.prepare(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM ledger
       WHERE family_id = ? AND child_id = ? AND entry_type = 'credit'
       AND verification_status IN ('verified_auto','verified_manual')`
    ).bind(family_id, child_id).first<{ total: number }>(),

    env.DB.prepare(
      `SELECT COALESCE(SUM(ch.reward_amount), 0) AS total
       FROM completions comp JOIN chores ch ON ch.id = comp.chore_id
       WHERE comp.family_id = ? AND comp.child_id = ? AND comp.status = 'awaiting_review'`
    ).bind(family_id, child_id).first<{ total: number }>(),

    env.DB.prepare(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM ledger
       WHERE family_id = ? AND child_id = ? AND entry_type IN ('reversal','payment')
       AND verification_status IN ('verified_auto','verified_manual')`
    ).bind(family_id, child_id).first<{ total: number }>(),

    env.DB.prepare(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM payouts
       WHERE family_id = ? AND child_id = ?`
    ).bind(family_id, child_id).first<{ total: number }>(),

    env.DB.prepare(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM spending
       WHERE family_id = ? AND child_id = ?`
    ).bind(family_id, child_id).first<{ total: number }>(),
  ]);

  const earnedTotal    = earned?.total    ?? 0;
  const pendingTotal   = pending?.total   ?? 0;
  const reversalsTotal = reversals?.total ?? 0;
  const payoutsTotal   = payoutsRow?.total ?? 0;
  const spentTotal     = spentRow?.total  ?? 0;

  const available = earnedTotal - reversalsTotal - payoutsTotal - spentTotal;

  // ── Gamification: lazy miss detection ──────────────────────────────
  let pendingCelebrations: string[] = []
  const today = todayUTC()
  const yesterday = previousDay(today)

  const [streakState, yesterdayHadChores] = await Promise.all([
    getStreakState(env.DB, child_id),
    hadScheduledChores(env.DB, child_id, yesterday),
  ])

  let currentStreakData = streakState

  try {
    const missEvent = buildMissEvent({
      hadScheduledChores: yesterdayHadChores,
      today,
      state: streakState,
    })

    if (missEvent) {
      await saveStreakEvent(env.DB, child_id, missEvent, today)
      currentStreakData = {
        ...streakState,
        current_streak:       missEvent.newStreak,
        grace_days_remaining: missEvent.newGrace,
        last_checked_date:    today,
      }
      if (missEvent.type === 'MISSED') {
        pendingCelebrations.push(`STREAK_LOST:${missEvent.previousStreak}:0`)
      } else if (missEvent.type === 'GRACE_USED') {
        pendingCelebrations.push(`STREAK_REVIVED:${missEvent.previousStreak}:${missEvent.newStreak}`)
      }
    } else if (streakState.last_checked_date !== today) {
      // Advance check date without changing streak
      await env.DB.prepare(
        `INSERT INTO child_streaks (child_id, current_streak, longest_streak, grace_days_remaining, last_kept_date, last_checked_date, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(child_id) DO UPDATE SET last_checked_date = excluded.last_checked_date, updated_at = excluded.updated_at`
      ).bind(
        child_id,
        streakState.current_streak,
        streakState.longest_streak,
        streakState.grace_days_remaining,
        streakState.last_kept_date,
        today,
        new Date().toISOString()
      ).run()
      currentStreakData = { ...streakState, last_checked_date: today }
    }

    // Surface newly earned badges on first balance load of each day
    if (streakState.last_checked_date !== today) {
      const newBadgeRows = await env.DB.prepare(
        `SELECT badge_key FROM child_badges WHERE child_id = ? AND date(earned_at) > COALESCE(?, '1970-01-01')`
      ).bind(child_id, streakState.last_checked_date).all<{ badge_key: string }>()

      for (const { badge_key } of newBadgeRows.results ?? []) {
        pendingCelebrations.push(`BADGE_${badge_key}`)
      }
    }
  } catch {
    pendingCelebrations = []
  }
  // ── End gamification ────────────────────────────────────────────────

  return json({
    earned:       earnedTotal,
    pending:      pendingTotal,
    reversals:    reversalsTotal,
    paid_out:     payoutsTotal,
    spent:        spentTotal,
    available:    Math.max(0, available),
    streak: {
      current:         currentStreakData.current_streak,
      longest:         currentStreakData.longest_streak,
      grace_remaining: currentStreakData.grace_days_remaining,
      last_kept_date:  currentStreakData.last_kept_date,
    },
    pending_celebrations: pendingCelebrations,
  });
}
