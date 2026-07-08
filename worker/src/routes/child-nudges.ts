/**
 * child-nudges: AI Mentor nudge system for child-facing screens.
 *
 * Nudges are short, personalised coaching messages delivered inline on the
 * earn, money, and goals screens. Tone is calibrated to the child's app_view:
 *   ORCHARD — nature metaphors, warm and playful
 *   CLEAN   — direct financial language, peer-level honesty
 *
 * Trigger types
 * ─────────────
 * Event-driven (called from other route handlers):
 *   first_task_complete  streak_3  streak_7  streak_14
 *   task_rejected        goal_created  goal_funded  jar_raid
 *   give_jar_activated   earnings_milestone_20/50/100
 *   gaming_goal_created  multi_goal_portfolio
 *   lab_reinforced_M9b   lab_reinforced_M11  lab_reinforced_M14
 *
 * Background (weekly CRON sweep via runChildNudgeBackgroundChecks):
 *   low_consistency      give_jar_stagnant  spend_heavy
 *   goal_at_risk         high_balance_giving  consistent_saver
 *   goal_halfway         balance_no_goal
 *   idle_balance         growth_streak       high_reliability
 *   repeat_spend_category  balance_milestone_30  earnings_volatile
 *
 * Throttle model
 * ──────────────
 * generateChildNudge       — fires unconditionally (event milestones & streaks)
 * generateOnceChildNudge   — fires once ever per trigger type (milestone events)
 * maybeGenerateChildNudge  — dedup: 7-day trigger-type + 7-day per-screen throttle
 *                            (background CRON only — max 1 nudge per screen per week)
 *
 * This caps background nudges at 3/week (one per screen) regardless of how many
 * patterns fire simultaneously, preventing overload in active or struggling periods.
 */

import type { Env } from '../types.js';
import { json, error } from '../lib/response.js';
import { JwtPayload } from '../lib/jwt.js';

type AuthedRequest = Request & { auth: JwtPayload };

const SEVEN_DAYS = 7 * 24 * 60 * 60;

// ── Nudge content library ──────────────────────────────────────────────────────

interface NudgeDef {
  screen:         'earn' | 'money' | 'goals';
  pillar:         string;
  tone:           'encouraging' | 'celebratory' | 'honest' | 'accountability';
  parent_summary: string;
  orchard:        string;
  clean:          string;
}

const NUDGES: Record<string, NudgeDef> = {

  // ── Event triggers ──────────────────────────────────────────────────────────

  first_task_complete: {
    screen: 'earn', pillar: 'LABOR_VALUE', tone: 'celebratory',
    parent_summary: 'First task completion celebration',
    orchard: 'Your first harvest is in! Every big grove starts with a single seed. Keep going — each task you finish grows your grove leaf by leaf.',
    clean:   'First task done. Every pound you earn is the result of showing up and doing the work. That habit is worth more than the money itself.',
  },

  streak_3: {
    screen: 'earn', pillar: 'LABOR_VALUE', tone: 'encouraging',
    parent_summary: '3-day streak milestone nudge',
    orchard: 'Three tasks in a row! Your grove is taking root. Groves grow from small, steady habits — not big bursts.',
    clean:   'Three-day streak. Consistency is the most underrated money skill there is — keep it going.',
  },

  streak_7: {
    screen: 'earn', pillar: 'LABOR_VALUE', tone: 'celebratory',
    parent_summary: '7-day streak milestone nudge',
    orchard: 'A full week of harvest! Most seedlings give up before this. Your roots are growing deep.',
    clean:   'Seven days running. That\'s discipline, not motivation. Most people don\'t make it this far.',
  },

  streak_14: {
    screen: 'earn', pillar: 'DELAYED_GRATIFICATION', tone: 'celebratory',
    parent_summary: '14-day streak milestone nudge',
    orchard: 'Two whole weeks of steady harvest! You\'re no longer a seedling — your grove has a real foundation now.',
    clean:   'Fourteen days. You\'ve built a real habit. Habits are what separate people who save from people who always plan to save.',
  },

  task_rejected: {
    screen: 'earn', pillar: 'LABOR_VALUE', tone: 'honest',
    parent_summary: 'Task sent back — quality feedback nudge',
    orchard: 'Your harvest wasn\'t quite ready. Ask what would make it perfect, then try again — that\'s how growers improve.',
    clean:   'Task sent back. Find out exactly what was expected, fix it, and resubmit. Feedback is how you get better.',
  },

  goal_created: {
    screen: 'goals', pillar: 'DELAYED_GRATIFICATION', tone: 'encouraging',
    parent_summary: 'New savings goal set nudge',
    orchard: 'A new seed planted! Setting a goal means you\'re thinking about tomorrow, not just today. Your future self will thank you.',
    clean:   'New goal set. You\'ve just given your money a purpose. That\'s one of the most powerful things you can do.',
  },

  goal_funded: {
    screen: 'goals', pillar: 'DELAYED_GRATIFICATION', tone: 'celebratory',
    parent_summary: 'Savings goal reached — celebration nudge',
    orchard: 'Your harvest is in! You set a goal, kept going, and made it happen. That\'s the whole skill — right there.',
    clean:   'Goal reached. You planned, you worked, you got there. Remember this feeling — it\'s what discipline produces.',
  },

  jar_raid: {
    screen: 'money', pillar: 'OPPORTUNITY_COST', tone: 'honest',
    parent_summary: 'Money moved from savings jar nudge',
    orchard: 'You moved some sunshine from your Saving jar. Once in a while is fine — just make sure it\'s worth the delay to your harvest.',
    clean:   'Savings moved to spending. That\'s your call — but every time it happens, your goals take a little longer. Make sure it\'s worth the trade-off.',
  },

  // ── Background triggers ─────────────────────────────────────────────────────

  goal_halfway: {
    screen: 'goals', pillar: 'DELAYED_GRATIFICATION', tone: 'encouraging',
    parent_summary: 'Goal halfway milestone nudge',
    orchard: 'You\'re halfway to your {goal} harvest! The first 50% shows you\'re serious. The second 50% proves it.',
    clean:   '50% of the way to {goal}. You started and didn\'t quit. The second half runs on the same habit — keep going.',
  },

  balance_no_goal: {
    screen: 'money', pillar: 'OPPORTUNITY_COST', tone: 'encouraging',
    parent_summary: 'Good balance but no active goal — planning nudge',
    orchard: 'Your grove is growing but there\'s nothing new being planted for next season. What do you want your harvest to become?',
    clean:   'Good balance — but money without a goal tends to drift. Give it a job: set a new goal.',
  },

  low_consistency: {
    screen: 'earn', pillar: 'LABOR_VALUE', tone: 'accountability',
    parent_summary: 'Low recent activity — re-engagement nudge',
    orchard: 'Your grove has been quiet lately. Even a little watering each week keeps things growing. Ready to pick it back up?',
    clean:   'Not much activity lately. Small, regular effort beats big bursts — try to complete at least one task this week.',
  },

  give_jar_stagnant: {
    screen: 'money', pillar: 'SOCIAL_RESPONSIBILITY', tone: 'encouraging',
    parent_summary: 'Give jar inactive — social responsibility nudge',
    orchard: 'Your Giving jar has been sitting quietly. Even small acts of sharing make your grove feel whole.',
    clean:   'Your giving amount hasn\'t moved in a while. Giving is a habit, not a one-off — even small amounts count.',
  },

  spend_heavy: {
    screen: 'money', pillar: 'OPPORTUNITY_COST', tone: 'honest',
    parent_summary: 'High spending pattern — opportunity cost nudge',
    orchard: 'Most of your sunshine is flowing to your Spending jar. Is there room to grow something for tomorrow too?',
    clean:   'Over 80% going to spending consistently. Goals take longer when this happens — worth adjusting?',
  },

  goal_at_risk: {
    screen: 'goals', pillar: 'DELAYED_GRATIFICATION', tone: 'honest',
    parent_summary: 'Goal deadline at risk — planning nudge',
    orchard: 'Your {goal} harvest day is coming up fast but your jar isn\'t quite full yet. Can you plant more seeds this week?',
    clean:   'Your {goal} deadline is close but you\'re not halfway there yet. Either earn more this week or extend the deadline.',
  },

  high_balance_giving: {
    screen: 'money', pillar: 'SOCIAL_RESPONSIBILITY', tone: 'encouraging',
    parent_summary: 'High balance — Pillar 5 giving nudge',
    orchard: 'Your grove is really growing! When trees grow tall, they give shade to others. Is there something you could share a little of?',
    clean:   'You\'ve built a solid balance. High earners who also give tend to feel better about their money. Even a small amount matters.',
  },

  consistent_saver: {
    screen: 'money', pillar: 'CAPITAL_MANAGEMENT', tone: 'celebratory',
    parent_summary: 'Consistent savings split — capital management celebration',
    orchard: 'Week after week, you\'re planting seeds in all three jars. A balanced grove is a healthy grove — and it grows over time.',
    clean:   'Consistent money split for weeks in a row. That\'s rare. And it compounds — the longer you keep it, the bigger the difference.',
  },

  // ── Milestone events (once-ever, bypass screen throttle) ────────────────────

  give_jar_activated: {
    screen: 'money', pillar: 'SOCIAL_RESPONSIBILITY', tone: 'celebratory',
    parent_summary: 'Give jar first activated — welcoming nudge',
    orchard: 'You\'ve opened a corner of your grove just for others. That seed of generosity often grows into something bigger than money ever could.',
    clean:   'You\'ve set up a giving amount. Research shows people who give — even small amounts — tend to feel better about their finances overall.',
  },

  earnings_milestone_20: {
    screen: 'earn', pillar: 'LABOR_VALUE', tone: 'celebratory',
    parent_summary: 'Cumulative £20 earned — taxation awareness nudge',
    orchard: 'You\'ve harvested £20 of real earnings! In the grown-up world, this is called income — money that comes from your own effort.',
    clean:   '£20 earned. In the real world, some of that would be deducted before it reached you — taxes pay for roads, schools, the NHS. Worth knowing how that works.',
  },

  earnings_milestone_50: {
    screen: 'earn', pillar: 'LABOR_VALUE', tone: 'celebratory',
    parent_summary: 'Cumulative £50 earned — consistency milestone nudge',
    orchard: 'Fifty pounds grown from your own work! Your grove is becoming something real. Every single leaf started as a completed task.',
    clean:   '£50 earned through your own effort. The people who end up financially secure mostly just kept showing up — you\'re building that habit.',
  },

  earnings_milestone_100: {
    screen: 'earn', pillar: 'CAPITAL_MANAGEMENT', tone: 'celebratory',
    parent_summary: 'Cumulative £100 earned — capital deployment nudge',
    orchard: 'One hundred pounds harvested! Your grove is strong now. This is the point where real growers start thinking about how to make their sunshine grow itself.',
    clean:   '£100 earned. At this level, money sitting still starts to cost you — inflation quietly shrinks it. This is when most people start thinking about where to put it to work.',
  },

  gaming_goal_created: {
    screen: 'goals', pillar: 'OPPORTUNITY_COST', tone: 'honest',
    parent_summary: 'Gaming goal created — digital currency awareness nudge',
    orchard: 'You\'re saving up for something in-game. Worth knowing: in-game coins or gems live on someone else\'s servers — they\'re not yours the same way real money is.',
    clean:   'Gaming goal set. In-game currency is real money going in, but it can\'t be saved, withdrawn, or earned back. Know the exchange before you commit.',
  },

  multi_goal_portfolio: {
    screen: 'goals', pillar: 'CAPITAL_MANAGEMENT', tone: 'celebratory',
    parent_summary: 'Three or more active goals — portfolio thinking nudge',
    orchard: 'You\'re growing three goals at once! A short one, a bigger one, and something further ahead. A balanced grove. That\'s exactly how real financial planning works.',
    clean:   'Three active goals simultaneously. Short, medium, long-term — that\'s a portfolio. The same thinking serious investors use, at a smaller scale.',
  },

  // ── Background pattern triggers (screen-throttled via maybeGenerateChildNudge) ─

  idle_balance: {
    screen: 'money', pillar: 'CAPITAL_MANAGEMENT', tone: 'honest',
    parent_summary: 'Balance idle with no recent activity — inflation awareness nudge',
    orchard: 'Your sunshine pile hasn\'t moved in a while. Money sitting still quietly loses a little value each year — like fruit left too long. Give it a job to do.',
    clean:   'Your balance has been idle for two weeks. Inflation means money sitting still buys slightly less over time. Even a small goal gives it direction.',
  },

  growth_streak: {
    screen: 'money', pillar: 'CAPITAL_MANAGEMENT', tone: 'encouraging',
    parent_summary: 'Three consecutive weeks of balance growth — compound momentum nudge',
    orchard: 'Your grove has grown three weeks in a row! That\'s momentum — the longer it keeps growing, the easier it gets to grow even more.',
    clean:   'Three straight weeks of balance growth. This is what compound momentum looks like — small consistent gains beat big one-offs every time.',
  },

  high_reliability: {
    screen: 'earn', pillar: 'LABOR_VALUE', tone: 'celebratory',
    parent_summary: 'High task pass rate — reliability as financial asset nudge',
    orchard: 'Over 85% of your tasks are approved first time. In a real grove, that\'s the mark of a trusted worker — and that trust is worth more than any single harvest.',
    clean:   'You\'re getting over 85% of tasks approved first time. In the real world, that pass rate has a name: your reputation. It opens doors money alone doesn\'t.',
  },

  repeat_spend_category: {
    screen: 'money', pillar: 'OPPORTUNITY_COST', tone: 'honest',
    parent_summary: 'Repeat category spending pattern — advertising influence awareness nudge',
    orchard: 'You\'ve spent on the same type of thing a few times recently. Sometimes that\'s a real favourite. Sometimes it\'s a habit wearing the disguise of a choice.',
    clean:   'You\'ve spent in the same category three times recently. Worth asking: is this a deliberate habit, or have advertisers just been doing their job on you?',
  },

  balance_milestone_30: {
    screen: 'money', pillar: 'CAPITAL_MANAGEMENT', tone: 'encouraging',
    parent_summary: 'Balance first crosses £30 — banking concept introduction nudge',
    orchard: 'Your grove just passed £30! This is the point where real growers think about a safe place for their sunshine — somewhere it earns a tiny bit extra while it waits.',
    clean:   'Balance over £30. This is when most people open a savings account — money in a bank earns interest rather than just sitting still. That option exists for you.',
  },

  earnings_volatile: {
    screen: 'earn', pillar: 'LABOR_VALUE', tone: 'honest',
    parent_summary: 'Inconsistent weekly earnings — income stability awareness nudge',
    orchard: 'Your harvest has been up-and-down lately — some big weeks, some quiet ones. Steady growers usually earn more across a whole season than boom-and-bust ones.',
    clean:   'Your earnings have been inconsistent lately. In the real world, unpredictable income is much harder to manage than steady income — even if the totals are the same.',
  },

  impulse_speed_bump: {
    screen: 'money', pillar: 'OPPORTUNITY_COST', tone: 'honest',
    parent_summary: 'Large spend flagged — impulse cooldown shown',
    orchard: "We've noticed this harvest is very large! If you keep these seeds instead, your grove keeps growing. Are you sure?",
    clean:   'This is 15% of your available balance. Delaying big spends by 48 hours usually feels better later. Shall we pause?',
  },

  // ── Learning Lab reinforcement (fires once after act completion, bypasses throttle) ─

  lab_reinforced_M9b: {
    screen: 'money', pillar: 'CAPITAL_MANAGEMENT', tone: 'encouraging',
    parent_summary: 'Learning Lab Snowball module — real-data reinforcement nudge',
    orchard: 'You just learned about the snowball. Here\'s the thing — it\'s already happening in your grove. Keep your balance growing and the momentum builds itself.',
    clean:   'You just covered compound growth in your lesson. Your balance growth over recent weeks is exactly that principle in real life. The lesson was the theory. This is the proof.',
  },

  lab_reinforced_M11: {
    screen: 'earn', pillar: 'LABOR_VALUE', tone: 'encouraging',
    parent_summary: 'Learning Lab Credit Scores module — real-data reinforcement nudge',
    orchard: 'You just learned about trust and reliability. Your grove\'s pass rate is the same idea — a track record that says "this grower can be counted on."',
    clean:   'You just covered credit scores. Your chore approval rate is the same concept: a number that tells others how reliable you are. Build it now and it pays off later.',
  },

  lab_reinforced_M14: {
    screen: 'money', pillar: 'CAPITAL_MANAGEMENT', tone: 'honest',
    parent_summary: 'Learning Lab Inflation module — real-data reinforcement nudge',
    orchard: 'You just learned about inflation — money quietly shrinking over time. Look at your grove: any sunshine sitting still is doing exactly that right now.',
    clean:   'You just covered inflation. Every pound in your balance with no goal is losing tiny fractions of value each year. That\'s not doom — it\'s the reason to put money to work.',
  },
};

// ── Internal: write a nudge row to D1 ─────────────────────────────────────────

export async function generateChildNudge(
  db: D1Database,
  child_id: string,
  family_id: string,
  trigger_type: string,
  meta?: Record<string, string | number>,
): Promise<void> {
  const def = NUDGES[trigger_type];
  if (!def) return;

  const now        = Math.floor(Date.now() / 1000);
  const expires_at = now + SEVEN_DAYS;

  let orchard_text = def.orchard;
  let clean_text   = def.clean;
  if (meta?.goal_title) {
    orchard_text = orchard_text.replace('{goal}', String(meta.goal_title));
    clean_text   = clean_text.replace('{goal}', String(meta.goal_title));
  }

  await db.prepare(`
    INSERT INTO child_nudges
      (child_id, family_id, trigger_type, screen_context,
       orchard_text, clean_text, pillar, tone, parent_summary,
       source, trigger_meta, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'rule_based', ?, ?, ?)
  `).bind(
    child_id, family_id, trigger_type, def.screen,
    orchard_text, clean_text,
    def.pillar, def.tone, def.parent_summary,
    meta ? JSON.stringify(meta) : null,
    now, expires_at,
  ).run();
}

// Fires once ever per trigger type — for milestone events that should never repeat.
export async function generateOnceChildNudge(
  db: D1Database,
  child_id: string,
  family_id: string,
  trigger_type: string,
  meta?: Record<string, string | number>,
): Promise<void> {
  const existing = await db.prepare(`
    SELECT id FROM child_nudges WHERE child_id = ? AND trigger_type = ? LIMIT 1
  `).bind(child_id, trigger_type).first<{ id: number }>();
  if (existing) return;
  await generateChildNudge(db, child_id, family_id, trigger_type, meta);
}

// Background dedup guard — two-layer protection:
//   1. Trigger-type cooldown:  same trigger won't repeat within 7 days.
//   2. Screen-context throttle: max ONE background nudge per screen per 7 days,
//      regardless of how many patterns fire simultaneously. This caps background
//      nudge volume at 3/week (one per screen) and prevents flooding when a child
//      is struggling on multiple dimensions at once.
//
// Event milestones use generateChildNudge / generateOnceChildNudge and intentionally
// bypass this throttle — a streak or earnings milestone is always worth marking.
export async function maybeGenerateChildNudge(
  db: D1Database,
  child_id: string,
  family_id: string,
  trigger_type: string,
  meta?: Record<string, string | number>,
): Promise<void> {
  const def = NUDGES[trigger_type];
  if (!def) return;

  const sevenDaysAgo = Math.floor(Date.now() / 1000) - SEVEN_DAYS;

  const [existingTrigger, existingScreen] = await Promise.all([
    db.prepare(`
      SELECT id FROM child_nudges
      WHERE child_id = ? AND trigger_type = ? AND created_at > ?
      LIMIT 1
    `).bind(child_id, trigger_type, sevenDaysAgo).first<{ id: number }>(),
    db.prepare(`
      SELECT id FROM child_nudges
      WHERE child_id = ? AND screen_context = ? AND created_at > ?
      LIMIT 1
    `).bind(child_id, def.screen, sevenDaysAgo).first<{ id: number }>(),
  ]);

  if (existingTrigger || existingScreen) return;
  await generateChildNudge(db, child_id, family_id, trigger_type, meta);
}

// ── GET /api/child-nudges?child_id=X ──────────────────────────────────────────
// Returns the most recent active (non-dismissed, non-expired) nudge per screen.
// Children see their own; parents see any child in their family.

export async function handleGetChildNudges(
  request: Request,
  env: Env,
): Promise<Response> {
  const auth    = (request as AuthedRequest).auth;
  const childId = new URL(request.url).searchParams.get('child_id');

  if (!childId) return error('child_id required', 400);

  if (auth.role === 'child' && auth.sub !== childId) return error('Forbidden', 403);
  if (auth.role === 'parent') {
    const member = await env.DB
      .prepare('SELECT id FROM users WHERE id = ? AND family_id = ?')
      .bind(childId, auth.family_id)
      .first<{ id: string }>();
    if (!member) return error('Forbidden', 403);
  }

  const now  = Math.floor(Date.now() / 1000);
  const rows = await env.DB.prepare(`
    SELECT id, trigger_type, screen_context, orchard_text, clean_text,
           pillar, tone, source, parent_summary, created_at
    FROM child_nudges
    WHERE child_id = ? AND is_dismissed = 0 AND expires_at > ?
    ORDER BY created_at DESC
  `).bind(childId, now).all<{
    id: number; trigger_type: string; screen_context: string;
    orchard_text: string; clean_text: string;
    pillar: string; tone: string; source: string;
    parent_summary: string; created_at: number;
  }>();

  // One nudge per context — most-recent wins
  const nudges: Record<string, (typeof rows.results)[0] | null> = {
    earn: null, money: null, goals: null,
  };
  for (const row of (rows.results ?? [])) {
    if (!nudges[row.screen_context]) nudges[row.screen_context] = row;
  }

  return json({ nudges });
}

// ── POST /api/child-nudges/dismiss ────────────────────────────────────────────
// Only the child themselves can dismiss their nudges.

export async function handleDismissChildNudge(
  request: Request,
  env: Env,
): Promise<Response> {
  const auth = (request as AuthedRequest).auth;
  if (auth.role !== 'child') return error('Forbidden', 403);

  const body = await request.json<{ nudge_id: number }>();
  if (!body?.nudge_id) return error('nudge_id required', 400);

  const row = await env.DB
    .prepare('SELECT child_id FROM child_nudges WHERE id = ?')
    .bind(body.nudge_id)
    .first<{ child_id: string }>();

  if (!row || row.child_id !== auth.sub) return error('Not found', 404);

  await env.DB
    .prepare('UPDATE child_nudges SET is_dismissed = 1 WHERE id = ?')
    .bind(body.nudge_id)
    .run();

  return json({ ok: true });
}

// ── Background checks (called from CRON, Sunday 20:00 UTC) ───────────────────
// Sweeps all active children and generates pattern-based nudges.

export async function runChildNudgeBackgroundChecks(env: Env): Promise<void> {
  const db  = env.DB;
  const now = Math.floor(Date.now() / 1000);

  const children = await db.prepare(`
    SELECT u.id AS child_id, u.family_id,
           jc.enabled   AS jars_enabled,
           jc.spend_pct, jc.save_pct, jc.give_pct
    FROM   users u
    LEFT JOIN jar_config jc ON jc.child_id = u.id AND jc.family_id = u.family_id
    WHERE  u.role = 'child'
      AND  u.family_id IN (SELECT id FROM families WHERE deleted_at IS NULL)
  `).all<{
    child_id: string; family_id: string;
    jars_enabled: number | null;
    spend_pct: number | null; save_pct: number | null; give_pct: number | null;
  }>();

  for (const child of (children.results ?? [])) {
    try {
      await checkPatterns(db, child, now);
    } catch (e) {
      console.error(`[child-nudges] background check failed for ${child.child_id}:`, e);
    }
  }
}

async function checkPatterns(
  db: D1Database,
  child: {
    child_id: string; family_id: string;
    jars_enabled: number | null;
    spend_pct: number | null; save_pct: number | null; give_pct: number | null;
  },
  now: number,
): Promise<void> {
  const { child_id, family_id } = child;
  const fourteenDaysAgo = now - 14 * 24 * 60 * 60;
  const thirtyDaysAgo   = now - 30 * 24 * 60 * 60;

  // ── 1. Completion counts ─────────────────────────────────────────────────
  const [recentRow, totalRow] = await Promise.all([
    db.prepare(`SELECT COUNT(*) AS cnt FROM completions WHERE child_id = ? AND status = 'completed' AND resolved_at > ?`)
      .bind(child_id, fourteenDaysAgo).first<{ cnt: number }>(),
    db.prepare(`SELECT COUNT(*) AS cnt FROM completions WHERE child_id = ? AND status = 'completed'`)
      .bind(child_id).first<{ cnt: number }>(),
  ]);
  const recentCompletions = recentRow?.cnt ?? 0;
  const totalCompletions  = totalRow?.cnt  ?? 0;

  // ── 2. Low consistency (quiet past 2 weeks but has prior history) ────────
  if (totalCompletions >= 3 && recentCompletions === 0) {
    await maybeGenerateChildNudge(db, child_id, family_id, 'low_consistency');
  }

  // ── 3. Ledger balance ────────────────────────────────────────────────────
  const balRow = await db.prepare(`
    SELECT SUM(CASE WHEN entry_type = 'credit' THEN amount ELSE -amount END) AS bal
    FROM   ledger
    WHERE  child_id = ? AND family_id = ?
  `).bind(child_id, family_id).first<{ bal: number | null }>();
  const balancePence = balRow?.bal ?? 0;

  // ── 4. Active goals checks ───────────────────────────────────────────────
  const activeGoals = await db.prepare(`
    SELECT id, title, target_amount FROM goals
    WHERE  child_id = ? AND status = 'ACTIVE'
  `).bind(child_id).all<{ id: string; title: string; target_amount: number }>();
  const goalsList = activeGoals.results ?? [];

  // 4a. Goal at risk (< 14 days to deadline, < 50% funded)
  const atRiskGoals = await db.prepare(`
    SELECT title FROM goals
    WHERE  child_id = ? AND status = 'ACTIVE'
      AND  deadline IS NOT NULL
      AND  deadline > date('now')
      AND  deadline < date('now', '+14 days')
  `).bind(child_id).all<{ title: string }>();

  for (const g of (atRiskGoals.results ?? [])) {
    const pct = goalsList.find(x => x.title === g.title)
      ? Math.min(100, Math.round((balancePence / (goalsList.find(x => x.title === g.title)!.target_amount)) * 100))
      : 0;
    if (pct < 50) {
      await maybeGenerateChildNudge(db, child_id, family_id, 'goal_at_risk', { goal_title: g.title });
      break;
    }
  }

  // 4b. Goal halfway (40-65% funded, no halfway nudge sent yet this week)
  for (const g of goalsList) {
    if (g.target_amount > 0) {
      const pct = Math.min(100, Math.round((balancePence / g.target_amount) * 100));
      if (pct >= 40 && pct <= 65) {
        await maybeGenerateChildNudge(db, child_id, family_id, 'goal_halfway', { goal_title: g.title });
        break;
      }
    }
  }

  // 4c. Good balance but no active goals
  if (goalsList.length === 0 && balancePence > 500 && totalCompletions >= 3) {
    await maybeGenerateChildNudge(db, child_id, family_id, 'balance_no_goal');
  }

  // ── 5. Jar-based checks ──────────────────────────────────────────────────
  if (child.jars_enabled) {
    const spendPct = child.spend_pct ?? 70;
    const savePct  = child.save_pct  ?? 20;

    // 5a. Give jar stagnant (has give history, untouched 14+ days)
    const lastGiveRow = await db.prepare(`
      SELECT MAX(created_at) AS last_at FROM jar_movements
      WHERE  child_id = ? AND jar = 'give'
    `).bind(child_id).first<{ last_at: number | null }>();

    if (lastGiveRow?.last_at && lastGiveRow.last_at < fourteenDaysAgo) {
      await maybeGenerateChildNudge(db, child_id, family_id, 'give_jar_stagnant');
    }

    // 5b. Spend heavy (> 80% to spend jar for 2+ weeks)
    if (spendPct > 80) {
      const snapCount = await db.prepare(`
        SELECT COUNT(*) AS cnt FROM insight_snapshots WHERE child_id = ? AND created_at > ?
      `).bind(child_id, thirtyDaysAgo).first<{ cnt: number }>();
      if ((snapCount?.cnt ?? 0) >= 2) {
        await maybeGenerateChildNudge(db, child_id, family_id, 'spend_heavy');
      }
    }

    // 5c. Consistent saver (save_pct >= 15% for 3+ weeks)
    if (savePct >= 15) {
      const snapCount = await db.prepare(`
        SELECT COUNT(*) AS cnt FROM insight_snapshots WHERE child_id = ? AND created_at > ?
      `).bind(child_id, thirtyDaysAgo).first<{ cnt: number }>();
      if ((snapCount?.cnt ?? 0) >= 3) {
        await maybeGenerateChildNudge(db, child_id, family_id, 'consistent_saver');
      }
    }
  }

  // ── 6. High balance + no giving (Pillar 5) ──────────────────────────────
  if (balancePence > 10000) {
    const recentGiving = await db.prepare(`
      SELECT COUNT(*) AS cnt FROM give_requests WHERE child_id = ? AND requested_at > ?
    `).bind(child_id, thirtyDaysAgo).first<{ cnt: number }>();
    if ((recentGiving?.cnt ?? 0) === 0) {
      await maybeGenerateChildNudge(db, child_id, family_id, 'high_balance_giving');
    }
  }

  // ── 7. Idle balance — money sitting still (Pillar 4 / M14 pre-hook) ──────
  if (balancePence > 200) {
    const lastLedgerRow = await db.prepare(`
      SELECT MAX(created_at) AS last_at FROM ledger WHERE child_id = ? AND family_id = ?
    `).bind(child_id, family_id).first<{ last_at: number | null }>();
    const lastActivity = lastLedgerRow?.last_at ?? 0;
    if (lastActivity > 0 && lastActivity < fourteenDaysAgo) {
      await maybeGenerateChildNudge(db, child_id, family_id, 'idle_balance');
    }
  }

  // ── 8. Three consecutive weeks of balance growth (M9b Snowball pre-hook) ─
  const oneWeekAgo    = now - 7  * 24 * 60 * 60;
  const twoWeeksAgo   = now - 14 * 24 * 60 * 60;
  const threeWeeksAgo = now - 21 * 24 * 60 * 60;

  const [bal1wRow, bal2wRow, bal3wRow] = await Promise.all([
    db.prepare(`SELECT COALESCE(SUM(CASE WHEN entry_type='credit' THEN amount ELSE -amount END),0) AS bal FROM ledger WHERE child_id=? AND family_id=? AND created_at<=?`).bind(child_id, family_id, oneWeekAgo).first<{ bal: number }>(),
    db.prepare(`SELECT COALESCE(SUM(CASE WHEN entry_type='credit' THEN amount ELSE -amount END),0) AS bal FROM ledger WHERE child_id=? AND family_id=? AND created_at<=?`).bind(child_id, family_id, twoWeeksAgo).first<{ bal: number }>(),
    db.prepare(`SELECT COALESCE(SUM(CASE WHEN entry_type='credit' THEN amount ELSE -amount END),0) AS bal FROM ledger WHERE child_id=? AND family_id=? AND created_at<=?`).bind(child_id, family_id, threeWeeksAgo).first<{ bal: number }>(),
  ]);
  const b1 = bal1wRow?.bal ?? 0;
  const b2 = bal2wRow?.bal ?? 0;
  const b3 = bal3wRow?.bal ?? 0;
  if (balancePence > b1 && b1 > b2 && b2 > b3 && b3 > 0) {
    await maybeGenerateChildNudge(db, child_id, family_id, 'growth_streak');
  }

  // ── 9. High reliability (M11 Credit Scores pre-hook) ──────────────────────
  const fourWeeksAgo = now - 28 * 24 * 60 * 60;
  const relRow = await db.prepare(`
    SELECT COUNT(*) AS total,
           SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS passed
    FROM   completions
    WHERE  child_id=? AND status IN ('completed','rejected','needs_revision')
      AND  created_at >= ?
  `).bind(child_id, fourWeeksAgo).first<{ total: number; passed: number }>();
  if (relRow && relRow.total >= 8 && relRow.total > 0 && (relRow.passed / relRow.total) >= 0.85) {
    await maybeGenerateChildNudge(db, child_id, family_id, 'high_reliability');
  }

  // ── 10. Repeat-category spending (M6 Advertising pre-hook) ───────────────
  const spendCatRow = await db.prepare(`
    SELECT category, COUNT(*) AS cnt FROM ledger
    WHERE  child_id=? AND entry_type='payment' AND created_at >= ?
      AND  category IS NOT NULL AND category != 'other'
    GROUP BY category HAVING cnt >= 3
    LIMIT 1
  `).bind(child_id, thirtyDaysAgo).first<{ category: string; cnt: number }>();
  if (spendCatRow) {
    await maybeGenerateChildNudge(db, child_id, family_id, 'repeat_spend_category');
  }

  // ── 11. Balance crosses £30 for the first time (M8 Banking pre-hook) ─────
  if (balancePence >= 3000) {
    await generateOnceChildNudge(db, child_id, family_id, 'balance_milestone_30');
  }

  // ── 12. Volatile weekly earnings (M3b Gig Trap mirror) ───────────────────
  const weeklyEarningsRows = await db.prepare(`
    SELECT strftime('%Y-%W', datetime(created_at,'unixepoch')) AS wk,
           SUM(amount) AS total
    FROM   ledger
    WHERE  child_id=? AND entry_type='credit'
      AND  created_at >= strftime('%s','now','-28 days')
    GROUP  BY wk ORDER BY wk
  `).bind(child_id).all<{ wk: string; total: number }>();
  if ((weeklyEarningsRows.results ?? []).length >= 3) {
    const vals   = weeklyEarningsRows.results.map(r => r.total);
    const avg    = vals.reduce((a, b) => a + b, 0) / vals.length;
    const stddev = Math.sqrt(vals.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / vals.length);
    if (avg > 0 && stddev / avg > 0.40) {
      await maybeGenerateChildNudge(db, child_id, family_id, 'earnings_volatile');
    }
  }
}

// ── POST /api/child-nudges/impulse-outcome ────────────────────────────────────
// Logs the outcome of an Impulse Speed Bump interstitial. Written once the
// child acts — taps "Wait a bit" or "I'm sure, log it" — never merely when
// the interstitial is shown, so one row always carries the full outcome.

export function validateImpulseOutcomeBody(body: Record<string, unknown>): string | null {
  if (!body.family_id || typeof body.family_id !== 'string') return 'family_id required';
  if (!body.child_id  || typeof body.child_id  !== 'string') return 'child_id required';
  if (!Number.isInteger(body.amount_pence) || (body.amount_pence as number) <= 0)
    return 'amount_pence must be a positive integer';
  if (!Number.isInteger(body.balance_pence) || (body.balance_pence as number) < 0)
    return 'balance_pence must be a non-negative integer';
  if (body.outcome !== 'waited' && body.outcome !== 'proceeded')
    return 'outcome must be "waited" or "proceeded"';
  return null;
}

export async function handleImpulseOutcome(request: Request, env: Env): Promise<Response> {
  const auth = (request as AuthedRequest).auth;
  if (auth.role !== 'child') return error('Only children can log this outcome', 403);

  const body = await request.json<Record<string, unknown>>();

  const validationError = validateImpulseOutcomeBody(body);
  if (validationError) return error(validationError, 400);

  const family_id    = body.family_id as string;
  const child_id     = body.child_id as string;
  const amount_pence  = body.amount_pence as number;
  const balance_pence = body.balance_pence as number;
  const outcome       = body.outcome as 'waited' | 'proceeded';

  if (child_id !== auth.sub || family_id !== auth.family_id) return error('Forbidden', 403);

  await generateChildNudge(env.DB, child_id, family_id, 'impulse_speed_bump', {
    amount_pence, balance_pence, outcome,
  });

  return json({ ok: true });
}
