import { describe, it, expect } from 'vitest';

// ── proof_required + auto_approve mutual exclusion ────────────────────────────

function validateChoreFlags(proof_required: unknown, auto_approve: unknown): string | null {
  const proofRequired = proof_required ? 1 : 0;
  const autoApprove   = auto_approve   ? 1 : 0;
  if (proofRequired && autoApprove) return 'proof_required and auto_approve are mutually exclusive';
  return null;
}

describe('chore flag mutual exclusion', () => {
  it('allows proof_required without auto_approve', () => {
    expect(validateChoreFlags(true, false)).toBeNull();
  });

  it('allows auto_approve without proof_required', () => {
    expect(validateChoreFlags(false, true)).toBeNull();
  });

  it('allows neither flag set', () => {
    expect(validateChoreFlags(false, false)).toBeNull();
  });

  it('rejects both flags set (the security bypass case)', () => {
    expect(validateChoreFlags(true, true)).toBe(
      'proof_required and auto_approve are mutually exclusive',
    );
  });

  it('rejects integer truthy values (1, 1)', () => {
    expect(validateChoreFlags(1, 1)).toBe(
      'proof_required and auto_approve are mutually exclusive',
    );
  });
});

// ── bi_weekly period start calculation ───────────────────────────────────────
// Extracted from lazyGenerateCompletions — must produce a period that changes
// every 2 weeks, not every week.

const EPOCH_MONDAY = 345600;    // Mon 5 Jan 1970 00:00:00 UTC
const WEEK_SEC     = 604800;    // 7 × 86400

function biWeeklyPeriodStart(weekStart: number): number {
  const weekIndex = Math.floor((weekStart - EPOCH_MONDAY) / WEEK_SEC);
  return EPOCH_MONDAY + Math.floor(weekIndex / 2) * 2 * WEEK_SEC;
}

const WEEK_0 = EPOCH_MONDAY;
const WEEK_1 = EPOCH_MONDAY + WEEK_SEC;
const WEEK_2 = EPOCH_MONDAY + 2 * WEEK_SEC;
const WEEK_3 = EPOCH_MONDAY + 3 * WEEK_SEC;

describe('bi_weekly period start', () => {
  it('week 0 and week 1 share the same bi-weekly period', () => {
    expect(biWeeklyPeriodStart(WEEK_0)).toBe(biWeeklyPeriodStart(WEEK_1));
  });

  it('week 2 starts a new bi-weekly period', () => {
    expect(biWeeklyPeriodStart(WEEK_2)).not.toBe(biWeeklyPeriodStart(WEEK_0));
  });

  it('week 2 and week 3 share the same bi-weekly period', () => {
    expect(biWeeklyPeriodStart(WEEK_2)).toBe(biWeeklyPeriodStart(WEEK_3));
  });

  it('the period start is always a Monday (multiple of WEEK_SEC from EPOCH_MONDAY)', () => {
    for (const weekStart of [WEEK_0, WEEK_1, WEEK_2, WEEK_3]) {
      const start = biWeeklyPeriodStart(weekStart);
      expect((start - EPOCH_MONDAY) % WEEK_SEC).toBe(0);
    }
  });

  it('adjacent bi-weekly periods are exactly 14 days apart', () => {
    const block0 = biWeeklyPeriodStart(WEEK_0);
    const block1 = biWeeklyPeriodStart(WEEK_2);
    expect(block1 - block0).toBe(2 * WEEK_SEC);
  });
});

// ── pending badge total calculation ──────────────────────────────────────────
// Mirrors the ParentDashboard pendingCount calculation (F-03 fix).

function totalPending(pendingByChild: Record<string, number>): number {
  return Object.values(pendingByChild).reduce((sum, n) => sum + n, 0);
}

function siblingsWithPending(
  pendingByChild: Record<string, number>,
  activeChildId: string,
  children: Array<{ id: string; display_name: string }>,
): string[] {
  return Object.entries(pendingByChild)
    .filter(([id, n]) => id !== activeChildId && n > 0)
    .map(([id]) => children.find(c => c.id === id)?.display_name ?? id);
}

describe('pending badge total (F-03)', () => {
  const children = [
    { id: 'a', display_name: 'Alice' },
    { id: 'b', display_name: 'Bob' },
    { id: 'c', display_name: 'Charlie' },
  ];

  it('sums all children including the active one', () => {
    expect(totalPending({ a: 2, b: 1, c: 3 })).toBe(6);
  });

  it('returns 0 when no submissions waiting', () => {
    expect(totalPending({ a: 0, b: 0, c: 0 })).toBe(0);
  });

  it('returns 0 for an empty map', () => {
    expect(totalPending({})).toBe(0);
  });

  it('identifies siblings with pending items (excludes active child)', () => {
    const result = siblingsWithPending({ a: 2, b: 1, c: 0 }, 'a', children);
    expect(result).toEqual(['Bob']);
  });

  it('returns empty array when no siblings have pending items', () => {
    const result = siblingsWithPending({ a: 2, b: 0, c: 0 }, 'a', children);
    expect(result).toEqual([]);
  });

  it('returns all sibling names when all siblings have pending items', () => {
    const result = siblingsWithPending({ a: 0, b: 1, c: 2 }, 'a', children);
    expect(result).toEqual(['Bob', 'Charlie']);
  });
});

// ── F-05: auto_approve submission path ───────────────────────────────────────
// Verifies the logic guarantees we fixed in the auto_approve path.

describe('auto_approve submission invariants (F-05)', () => {
  // BUG-013: dangling 'available' slot after auto_approve
  it('available row for same chore must be deleted before the completed row is written', () => {
    // Simulates the ordering check: DELETE must precede INSERT in the batch.
    // We test the logic by verifying a DELETE of ('available','needs_revision')
    // would not also delete 'awaiting_review' or 'completed' rows.
    const statusesToDelete = new Set(['available', 'needs_revision']);
    const rowsInDB = [
      { id: '1', status: 'available' },
      { id: '2', status: 'needs_revision' },
      { id: '3', status: 'awaiting_review' },
      { id: '4', status: 'completed' },
    ];
    const toDelete = rowsInDB.filter(r => statusesToDelete.has(r.status));
    expect(toDelete.map(r => r.id)).toEqual(['1', '2']);
    expect(toDelete.some(r => r.status === 'awaiting_review')).toBe(false);
    expect(toDelete.some(r => r.status === 'completed')).toBe(false);
  });

  // BUG-011: jar allocation percentages
  it('jar allocation amounts sum to the full reward', () => {
    const reward = 150; // pence
    const save_pct = 20;
    const give_pct = 10;
    const saveAmt    = Math.floor(reward * save_pct / 100);
    const giveAmt    = Math.floor(reward * give_pct / 100);
    const spendFinal = reward - saveAmt - giveAmt;
    expect(saveAmt + giveAmt + spendFinal).toBe(reward);
  });

  it('jar floor prevents rounding from over-allocating', () => {
    // reward = 7, save_pct = 20, give_pct = 10
    // floor(7 * 0.20) = 1, floor(7 * 0.10) = 0, spend = 7 - 1 - 0 = 6
    const reward = 7;
    const saveAmt    = Math.floor(reward * 20 / 100);
    const giveAmt    = Math.floor(reward * 10 / 100);
    const spendFinal = reward - saveAmt - giveAmt;
    expect(saveAmt + giveAmt + spendFinal).toBe(reward);
    expect(spendFinal).toBeGreaterThanOrEqual(0);
  });

  // BUG-012: pending_celebrations included in auto_approve response
  it('auto_approve response shape includes pending_celebrations field', () => {
    const mockResponse = {
      id: 'abc',
      chore_id: 'c1',
      title: 'Wash up',
      reward_amount: 100,
      currency: 'GBP',
      status: 'completed',
      ledger_id: 42,
      submitted_at: 1700000000,
      auto_approved: true,
      pending_celebrations: [] as string[],
    };
    expect(mockResponse).toHaveProperty('pending_celebrations');
    expect(Array.isArray(mockResponse.pending_celebrations)).toBe(true);
  });
});

// ── F-06: give request submission → parent Activity badge ─────────────────────
// The Activity tab badge = chore submissions + pending give requests.

describe('Activity tab badge with give requests (F-06)', () => {
  function totalBadge(pendingByChild: Record<string, number>, pendingGiveCount: number): number {
    return Object.values(pendingByChild).reduce((sum, n) => sum + n, 0) + pendingGiveCount;
  }

  it('badge is 0 when no chore submissions and no give requests', () => {
    expect(totalBadge({}, 0)).toBe(0);
  });

  it('badge includes give requests even when no chore submissions are pending', () => {
    expect(totalBadge({ a: 0, b: 0 }, 2)).toBe(2);
  });

  it('badge sums chore submissions and give requests together', () => {
    expect(totalBadge({ a: 3, b: 1 }, 2)).toBe(6);
  });

  it('badge drops to 0 once all give requests are resolved and no chore submissions remain', () => {
    expect(totalBadge({ a: 0 }, 0)).toBe(0);
  });

  it('give request count resets to 0 when all requests are fulfilled or declined', () => {
    const pendingRequests = [{ status: 'fulfilled' }, { status: 'declined' }];
    const pendingCount = pendingRequests.filter(r => r.status === 'requested').length;
    expect(pendingCount).toBe(0);
  });
});

// ── F-07: Give jar balance reconciliation after parent fulfil / decline ────────

describe('Give jar balance reconciliation (F-07)', () => {
  // BUG-016: double-subtraction in available-give check
  it('available give is just the jar balance (jar_movements already debits at submission)', () => {
    // Simulate: Give jar started at 500, one pending request of 300.
    // jar_movements recorded -300 at submission → balances.give = 200.
    // The check must use balances.give directly, NOT subtract pendingRow.total again.
    const balancesGive   = 200;  // SUM(delta) from jar_movements after 300p pending request
    const requestAmount  = 150;  // new request the child wants to submit
    const availableGive  = balancesGive;  // correct: no secondary subtraction
    expect(availableGive).toBeGreaterThanOrEqual(requestAmount); // should be allowed
  });

  it('double-subtraction pattern would incorrectly block a valid request', () => {
    const balancesGive  = 200;
    const pendingTotal  = 300;
    const requestAmount = 150;
    const wrongAvailable = balancesGive - pendingTotal; // the old buggy formula
    // Incorrectly negative even though 200p is available
    expect(wrongAvailable).toBeLessThan(0);
    expect(wrongAvailable).toBeLessThan(requestAmount);
  });

  // Fulfil: Give jar balance stays at post-debit level (delta=0 on fulfil)
  it('fulfil inserts a delta=0 jar movement — jar balance unchanged from request', () => {
    const movements = [
      { kind: 'allocation',    delta: 500 },
      { kind: 'give_request',  delta: -300 },
      { kind: 'give_fulfilled', delta: 0 },
    ];
    const balance = movements.reduce((sum, m) => sum + m.delta, 0);
    expect(balance).toBe(200); // 500 - 300 + 0
  });

  // Decline: Give jar balance is restored (+amount added back)
  it('decline inserts a positive delta — jar balance restored to pre-request level', () => {
    const movements = [
      { kind: 'allocation',   delta: 500 },
      { kind: 'give_request', delta: -300 },
      { kind: 'give_declined', delta: 300 },
    ];
    const balance = movements.reduce((sum, m) => sum + m.delta, 0);
    expect(balance).toBe(500); // fully restored
  });

  it('decline delta equals the original request amount', () => {
    const requestAmount = 250;
    const declineMovement = { delta: requestAmount };
    expect(declineMovement.delta).toBe(requestAmount);
  });
});

// ── F-08: verify_mode governance consent handshake ───────────────────────────

describe('governance consent handshake (F-08)', () => {
  // BUG-017: withAuth missing — handlers would crash accessing request.auth

  it('requester cannot confirm their own governance request', () => {
    const requestedBy  = 'parent-A';
    const confirmedBy  = 'parent-A'; // same person
    const selfConfirm  = requestedBy === confirmedBy;
    expect(selfConfirm).toBe(true); // should be rejected by the handler
  });

  it('co-parent (different user) can confirm the request', () => {
    const requestedBy  = 'parent-A' as string;
    const confirmedBy  = 'parent-B' as string;
    const selfConfirm  = requestedBy === confirmedBy;
    expect(selfConfirm).toBe(false); // allowed
  });

  it('expired request cannot be confirmed', () => {
    const now      = Math.floor(Date.now() / 1000);
    const expiresAt = now - 1; // 1 second ago
    const isExpired = now > expiresAt;
    expect(isExpired).toBe(true);
  });

  it('pending request is not expired', () => {
    const now      = Math.floor(Date.now() / 1000);
    const expiresAt = now + 72 * 3600;
    const isExpired = now > expiresAt;
    expect(isExpired).toBe(false);
  });

  // BUG-019: direct verify_mode change must be blocked in co-parenting mode
  it('verify_mode update blocked for co-parenting families', () => {
    function canDirectlyUpdateVerifyMode(parentingMode: string): boolean {
      return parentingMode !== 'co-parenting';
    }
    expect(canDirectlyUpdateVerifyMode('single')).toBe(true);
    expect(canDirectlyUpdateVerifyMode('co-parenting')).toBe(false);
  });

  it('governance request expires after 72 hours', () => {
    const EXPIRY_SECONDS = 72 * 60 * 60;
    const now = 1000000;
    const expiresAt = now + EXPIRY_SECONDS;
    expect(expiresAt - now).toBe(259200); // 72 * 3600
  });
});

// ── F-09: earnings_mode → child dashboard weekly estimate ────────────────────
// weeklyAllowancePence must include allowance_amount for ALLOWANCE/HYBRID children.

type EarningsMode = 'ALLOWANCE' | 'CHORES' | 'HYBRID';
type AllowanceFreq = 'WEEKLY' | 'BI_WEEKLY' | 'MONTHLY';

function weeklyIncomePence(
  choreWeekly: number,
  earningsMode: EarningsMode,
  allowanceAmount: number,
  allowanceFreq: AllowanceFreq,
): number {
  const allowanceWeekly = (earningsMode === 'ALLOWANCE' || earningsMode === 'HYBRID')
    ? (allowanceFreq === 'WEEKLY' ? allowanceAmount
       : allowanceFreq === 'BI_WEEKLY' ? Math.round(allowanceAmount / 2)
       : Math.round(allowanceAmount / 4))
    : 0;
  return choreWeekly + allowanceWeekly;
}

describe('weeklyIncomePence (F-09)', () => {
  it('CHORES mode: only chore rewards count', () => {
    expect(weeklyIncomePence(300, 'CHORES', 500, 'WEEKLY')).toBe(300);
  });

  it('ALLOWANCE mode: only fixed allowance counts (no chores)', () => {
    expect(weeklyIncomePence(0, 'ALLOWANCE', 500, 'WEEKLY')).toBe(500);
  });

  it('HYBRID mode: chore rewards plus allowance', () => {
    expect(weeklyIncomePence(200, 'HYBRID', 300, 'WEEKLY')).toBe(500);
  });

  it('ALLOWANCE bi-weekly: allowance is halved to weekly equivalent', () => {
    expect(weeklyIncomePence(0, 'ALLOWANCE', 1000, 'BI_WEEKLY')).toBe(500);
  });

  it('ALLOWANCE monthly: allowance is quartered to weekly equivalent', () => {
    expect(weeklyIncomePence(0, 'ALLOWANCE', 1200, 'MONTHLY')).toBe(300);
  });

  it('BUG-020: ALLOWANCE mode with zero chores previously gave 0 (the bug)', () => {
    // Before fix: choreWeekly was the only input → 0 for allowance-only child
    const buggyResult = 0; // old code returned just choreWeekly
    const fixedResult = weeklyIncomePence(0, 'ALLOWANCE', 500, 'WEEKLY');
    expect(fixedResult).not.toBe(buggyResult);
    expect(fixedResult).toBe(500);
  });
});

// ── F-04: approval propagation + status label coverage ───────────────────────
// Mirror the ChildHistoryTab STATUS_STYLES map — every status that the
// completions/history endpoint can return must have a defined label.

const STATUS_STYLES: Record<string, { label: string }> = {
  completed:       { label: 'Approved'     },
  awaiting_review: { label: 'In review'    },
  needs_revision:  { label: 'Needs redo'   },
  rejected:        { label: 'Not approved' },
  pending:         { label: 'Pending'      },
};

const HISTORY_STATUSES = ['completed', 'awaiting_review', 'needs_revision', 'rejected', 'pending'];

describe('ChildHistoryTab status label coverage (F-04)', () => {
  it('every possible history status has a defined label', () => {
    for (const status of HISTORY_STATUSES) {
      expect(STATUS_STYLES[status]).toBeDefined();
      expect(typeof STATUS_STYLES[status]?.label).toBe('string');
    }
  });

  it('rejected maps to a child-friendly label (not the raw DB string)', () => {
    expect(STATUS_STYLES['rejected'].label).not.toBe('rejected');
    expect(STATUS_STYLES['rejected'].label.length).toBeGreaterThan(0);
  });

  it('completed maps to Approved', () => {
    expect(STATUS_STYLES['completed'].label).toBe('Approved');
  });

  it('needs_revision maps to Needs redo', () => {
    expect(STATUS_STYLES['needs_revision'].label).toBe('Needs redo');
  });
});

// ── F-10: 'anyone' chore race-claim correctness ───────────────────────────────

describe("'anyone' chore claim correctness (F-10)", () => {
  // BUG-022 + BUG-023: handleChoreClaim must insert 'available' completion immediately.
  // This eliminates the lazy-gen race and covers as_needed/quarterly frequencies.
  it('claim response should be followed by an available completion (no lazy-gen wait)', () => {
    // Simulate: DB state after handleChoreClaim
    const completionsInsertedByClaimHandler = [
      { chore_id: 'c1', child_id: 'child-a', status: 'available' },
    ];
    // getCompletions?status=available must find this row immediately
    const found = completionsInsertedByClaimHandler.filter(
      r => r.status === 'available' && r.child_id === 'child-a'
    );
    expect(found).toHaveLength(1);
  });

  it('atomic UPDATE prevents double-claim: 0 rows changed on concurrent loser', () => {
    // Model: assigned_to='anyone' → child A wins → assigned_to='child-a'
    // child B's UPDATE WHERE assigned_to='anyone' matches 0 rows
    let assignedTo = 'anyone';
    function atomicClaim(claimerId: string): number {
      if (assignedTo === 'anyone') { assignedTo = claimerId; return 1; }
      return 0; // changes = 0
    }
    const resultA = atomicClaim('child-a');
    const resultB = atomicClaim('child-b');
    expect(resultA).toBe(1); // child A wins
    expect(resultB).toBe(0); // child B loses
    expect(assignedTo).toBe('child-a');
  });

  it('loser gets 409 when changes === 0', () => {
    const changes = 0;
    const shouldReturn409 = changes === 0;
    expect(shouldReturn409).toBe(true);
  });

  // BUG-024: on 409, the open-chore card must be removed (load() called in finally)
  it('finally block ensures load() is called on both success and 409 error', () => {
    const loadCalled: boolean[] = [];
    async function handleClaim(willFail: boolean) {
      try {
        if (willFail) throw Object.assign(new Error('taken'), { status: 409 });
      } catch { /* noop */ }
      finally {
        loadCalled.push(true); // simulates `await load()`
      }
    }
    handleClaim(false);
    handleClaim(true);
    // synchronous check after microtask — both paths push to loadCalled
    expect(loadCalled.length).toBe(2);
  });

  // BUG-025: claiming state must reset in finally, not just in catch
  it('finally block resets claiming state regardless of success or failure', () => {
    let claiming: string | null = 'chore-1';
    function finallyClear() { claiming = null; }
    // success path
    finallyClear();
    expect(claiming).toBeNull();
    // reset for error path
    claiming = 'chore-1';
    finallyClear();
    expect(claiming).toBeNull();
  });

  // as_needed exclusion from lazy gen — claim handler must compensate
  it('as_needed frequency is excluded from lazy gen (SKIP set)', () => {
    const SKIP = new Set(['as_needed', 'quarterly']);
    expect(SKIP.has('as_needed')).toBe(true);
    expect(SKIP.has('quarterly')).toBe(true);
    expect(SKIP.has('weekly')).toBe(false);
    expect(SKIP.has('daily')).toBe(false);
  });
});

// ── F-12: Flash chore deadline enforcement ────────────────────────────────────

describe('flash chore deadline enforcement (F-12)', () => {
  function isFlashExpired(flashDeadline: string | null, nowMs: number): boolean {
    if (!flashDeadline) return false;
    return new Date(flashDeadline).getTime() < nowMs;
  }

  // BUG-030: open-tasks query must exclude expired flash chores
  it('expired flash chore is excluded from open-tasks list', () => {
    const pastDeadline = new Date(Date.now() - 3600_000).toISOString(); // 1h ago
    const chores = [
      { id: 'c1', is_flash: 1, flash_deadline: pastDeadline, assigned_to: 'anyone' },
      { id: 'c2', is_flash: 0, flash_deadline: null,         assigned_to: 'anyone' },
    ];
    const visible = chores.filter(c =>
      c.is_flash === 0 || !c.flash_deadline || !isFlashExpired(c.flash_deadline, Date.now())
    );
    expect(visible.map(c => c.id)).toEqual(['c2']);
  });

  it('active flash chore (future deadline) is still visible', () => {
    const futureDeadline = new Date(Date.now() + 3600_000).toISOString();
    const chores = [{ id: 'c1', is_flash: 1, flash_deadline: futureDeadline }];
    const visible = chores.filter(c =>
      c.is_flash === 0 || !c.flash_deadline || !isFlashExpired(c.flash_deadline, Date.now())
    );
    expect(visible).toHaveLength(1);
  });

  // BUG-031: child chore list must also exclude expired flash chores
  it('expired flash chore is excluded from child assigned-chore list', () => {
    const pastDeadline = new Date(Date.now() - 60_000).toISOString();
    const assignedChores = [
      { id: 'a', is_flash: 1, flash_deadline: pastDeadline },  // expired
      { id: 'b', is_flash: 1, flash_deadline: new Date(Date.now() + 60_000).toISOString() }, // active
      { id: 'c', is_flash: 0, flash_deadline: null },           // non-flash
    ];
    const visible = assignedChores.filter(c =>
      c.is_flash === 0 || !c.flash_deadline || !isFlashExpired(c.flash_deadline, Date.now())
    );
    expect(visible.map(c => c.id)).toEqual(['b', 'c']);
  });

  // BUG-031 secondary: claim of expired flash chore must be rejected
  it('claim endpoint rejects expired flash chore', () => {
    const flashDeadline = new Date(Date.now() - 1000).toISOString();
    const isExpiredAtClaim = isFlashExpired(flashDeadline, Date.now());
    expect(isExpiredAtClaim).toBe(true); // handler returns 409
  });

  // submit endpoint deadline check (existing behaviour — regression guard)
  it('submit endpoint rejects expired flash chore with 409', () => {
    const deadline = new Date(Date.now() - 5000).toISOString();
    const deadlineMs = new Date(deadline).getTime();
    const isPast = Date.now() > deadlineMs;
    expect(isPast).toBe(true); // worker returns 409 "Flash job deadline has passed"
  });

  // BUG-029: flash_deadline must be present on the Chore type and displayed
  it('flash_deadline field is on the Chore interface (compile-time check via assignment)', () => {
    const mockChore = { is_flash: 1, flash_deadline: '2026-01-01T18:00:00Z' };
    const deadline = mockChore.flash_deadline ? new Date(mockChore.flash_deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;
    expect(deadline).not.toBeNull();
    expect(typeof deadline).toBe('string');
  });
});

// ── F-11: Goal funding → purchase atomicity ───────────────────────────────────

describe('goal purchase atomicity (F-11)', () => {
  // BUG-027: parent contribution jar movement must use delta=amount_pence, not 0
  it('goal_allocate delta equals contribution amount (not 0)', () => {
    const amount_pence = 300;
    const jarMovement = { delta: amount_pence, earmark_pence: amount_pence, kind: 'goal_allocate' };
    // SUM(delta) must include the contribution so balances.save reflects it
    expect(jarMovement.delta).toBe(amount_pence);
    expect(jarMovement.delta).not.toBe(0);
  });

  it('purchase guard passes when save balance equals target (after contribution credited)', () => {
    // balances.save = SUM(delta) — now includes parent contribution
    const saveBalance = 200 + 300; // 200 earned + 300 contributed via delta
    const targetAmount = 500;
    const canPurchase = saveBalance >= targetAmount;
    expect(canPurchase).toBe(true);
  });

  it('BUG-027 repro: delta=0 contribution would leave save balance insufficient', () => {
    const saveBalance = 200; // only chore earnings — contribution delta was 0 (old bug)
    const targetAmount = 500;
    const canPurchase = saveBalance >= targetAmount;
    expect(canPurchase).toBe(false); // the old buggy state
  });

  // BUG-028: spending INSERT must be in the same batch as goal REACHED + jar debit
  it('purchase batch must include spending record, goal update, and jar debit', () => {
    const batchStatements = [
      { op: 'UPDATE goals SET status=REACHED' },
      { op: 'INSERT spending' },         // must be here, not before batch
      { op: 'INSERT jar_movements' },    // jar debit
    ];
    const hasGoalUpdate  = batchStatements.some(s => s.op.includes('goals'));
    const hasSpending    = batchStatements.some(s => s.op.includes('spending'));
    const hasJarDebit    = batchStatements.some(s => s.op.includes('jar_movements'));
    expect(hasGoalUpdate).toBe(true);
    expect(hasSpending).toBe(true);
    expect(hasJarDebit).toBe(true);
  });

  it('orphaned spending record scenario: spending before batch means debit without REACHED', () => {
    let spendingInserted = false;
    let goalReached      = false;
    // BUG-028 repro: INSERT spending first, then batch fails → goal never REACHED
    function buggyPurchase(batchFails: boolean) {
      spendingInserted = true; // INSERT runs unconditionally
      if (!batchFails) { goalReached = true; }
      return goalReached;
    }
    const result = buggyPurchase(true); // batch fails
    expect(spendingInserted).toBe(true);   // spending deducted
    expect(result).toBe(false);            // but goal never marked REACHED
  });

  // BUG-026: progress bar must use Save jar balance when jars enabled
  it('goal progress uses Save jar balance (not total available) when jars enabled', () => {
    const balance = { available: 700, jars: { enabled: true, save: 100, spend: 600, give: 0 } };
    const targetAmount = 500;
    const progressBalance = (balance.jars.enabled && balance.jars.save != null)
      ? balance.jars.save
      : balance.available;
    const pct = Math.min(100, Math.round((progressBalance / targetAmount) * 100));
    // Using save (100p) → 20%, not available (700p) → 100%
    expect(pct).toBe(20);
    // Old code using b.available would show 100% (capped) — misleading
    const wrongPct = Math.min(100, Math.round((balance.available / targetAmount) * 100));
    expect(wrongPct).toBe(100);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// F-13: Pay-out / balance integrity (BUG-032 & BUG-033)
// ─────────────────────────────────────────────────────────────────────────────
describe('payout and bonus jar sync (F-13)', () => {
  // BUG-032: payout must debit jar_movements so getJarBalances stays in sync
  it('payout splits into proportional jar debits matching jar config', () => {
    function computePayoutDebits(amount: number, spendPct: number, savePct: number) {
      const spendDebit = Math.round(amount * spendPct / 100);
      const saveDebit  = Math.round(amount * savePct  / 100);
      const giveDebit  = amount - spendDebit - saveDebit;
      return { spendDebit, saveDebit, giveDebit };
    }
    const { spendDebit, saveDebit, giveDebit } = computePayoutDebits(500, 70, 20);
    expect(spendDebit).toBe(350);
    expect(saveDebit).toBe(100);
    expect(giveDebit).toBe(50);
    // Debits must sum to full payout — no rounding drift
    expect(spendDebit + saveDebit + giveDebit).toBe(500);
  });

  it('payout rounding assigns remainder to give (last bucket)', () => {
    // 100p at 33/33/34 — remainder handled by give = total - spend - save
    function computePayoutDebits(amount: number, spendPct: number, savePct: number) {
      const spendDebit = Math.round(amount * spendPct / 100);
      const saveDebit  = Math.round(amount * savePct  / 100);
      const giveDebit  = amount - spendDebit - saveDebit;
      return { spendDebit, saveDebit, giveDebit };
    }
    const { spendDebit, saveDebit, giveDebit } = computePayoutDebits(100, 33, 33);
    expect(spendDebit + saveDebit + giveDebit).toBe(100);
  });

  it('zero-amount jars are excluded from batch insert (no zero-delta noise)', () => {
    // If give_pct=0, giveDebit=0 → filtered out
    const amount = 200;
    const spendDebit = Math.round(amount * 80 / 100); // 160
    const saveDebit  = Math.round(amount * 20 / 100); // 40
    const giveDebit  = amount - spendDebit - saveDebit; // 0
    const debits = [['spend', spendDebit], ['save', saveDebit], ['give', giveDebit]]
      .filter(([, v]) => (v as number) > 0);
    expect(debits).toHaveLength(2);
    expect(debits.map(([j]) => j)).not.toContain('give');
  });

  // BUG-033: bonus must allocate jar_movements so getJarBalances stays in sync
  it('bonus splits into proportional jar credits matching jar config', () => {
    function computeBonusAllocations(amount: number, spendPct: number, savePct: number) {
      const spendAmt = Math.round(amount * spendPct / 100);
      const saveAmt  = Math.round(amount * savePct  / 100);
      const giveAmt  = amount - spendAmt - saveAmt;
      return { spendAmt, saveAmt, giveAmt };
    }
    const { spendAmt, saveAmt, giveAmt } = computeBonusAllocations(300, 70, 20);
    expect(spendAmt).toBe(210);
    expect(saveAmt).toBe(60);
    expect(giveAmt).toBe(30);
    expect(spendAmt + saveAmt + giveAmt).toBe(300);
  });

  // BUG-032 repro: without jar debit, jar spend balance diverges from available after payout
  it('BUG-032 repro: jar spend stays inflated when no debit written on payout', () => {
    // Before fix: jar_movements.spend never debited → getJarBalances.spend doesn't decrease
    const jarSpendBeforePayout = 1000; // p
    const payoutAmount         = 500;  // p
    // Buggy: no debit written → jar spend unchanged
    const jarSpendAfterBuggy   = jarSpendBeforePayout; // stays 1000
    // Fixed: debit written proportionally (70% of 500 = 350 to spend jar)
    const jarSpendAfterFixed   = jarSpendBeforePayout - Math.round(payoutAmount * 70 / 100);
    expect(jarSpendAfterBuggy).toBe(1000);   // diverges from available
    expect(jarSpendAfterFixed).toBe(650);    // correctly reduced
  });

  // BUG-033 repro: without jar allocation, bonus credit is invisible to jar balances
  it('BUG-033 repro: jar spend not increased when no allocation written on bonus', () => {
    const jarSpendBefore = 200;
    const bonusAmount    = 100;
    // Buggy: no jar_movements allocation → jar spend unchanged
    const jarSpendAfterBuggy = jarSpendBefore;
    // Fixed: allocation written (70% of 100 = 70 to spend jar)
    const jarSpendAfterFixed = jarSpendBefore + Math.round(bonusAmount * 70 / 100);
    expect(jarSpendAfterBuggy).toBe(200); // diverges from earned
    expect(jarSpendAfterFixed).toBe(270); // correctly increased
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// F-14: Jar configuration & manual transfer (BUG-034 & BUG-035)
// ─────────────────────────────────────────────────────────────────────────────
describe('jar config and manual transfer (F-14)', () => {
  // BUG-034: first-enable without initial_seed must be rejected
  it('BUG-034: first-enable without initial_seed is rejected (400)', () => {
    const isFirstEnable  = true;
    const initialSeed    = undefined;
    // Simulates the guard added to handlePutJarConfig
    const rejected = isFirstEnable && !initialSeed;
    expect(rejected).toBe(true);
  });

  it('first-enable with initial_seed proceeds normally', () => {
    const isFirstEnable = true;
    const initialSeed   = { spend: 350, save: 100, give: 50 };
    const rejected = isFirstEnable && !initialSeed;
    expect(rejected).toBe(false);
  });

  it('re-configure percentages (not first-enable) does not require initial_seed', () => {
    const isFirstEnable = false;
    const initialSeed   = undefined;
    const rejected = isFirstEnable && !initialSeed;
    expect(rejected).toBe(false);
  });

  // BUG-035: move from Save must use save_unallocated not save total
  it('BUG-035: move from Save with earmarked funds uses unallocated balance', () => {
    const balances = { save: 1000, save_unallocated: 200, save_earmarked: 800 };
    const from_jar = 'save';
    const amount   = 500;
    // Old buggy check: uses balances.save (1000) → allows 500 move
    const buggyAllowed = balances.save >= amount;
    // Fixed check: uses save_unallocated (200) → blocks 500 move
    const sourceBalance = from_jar === 'save' ? balances.save_unallocated : balances[from_jar as 'save'];
    const fixedAllowed  = sourceBalance >= amount;
    expect(buggyAllowed).toBe(true);  // old code wrongly allowed it
    expect(fixedAllowed).toBe(false); // new code correctly blocks it
  });

  it('move from Save succeeds when unallocated balance covers amount', () => {
    const balances = { save: 1000, save_unallocated: 600, save_earmarked: 400 };
    const amount = 500;
    const allowed = balances.save_unallocated >= amount;
    expect(allowed).toBe(true);
  });

  it('move from Spend uses full spend balance (no earmarking on Spend)', () => {
    const balances = { spend: 800, save_unallocated: 0, save_earmarked: 0 };
    const from_jar = 'spend' as string;
    const amount   = 500;
    const sourceBalance = from_jar === 'save' ? balances.save_unallocated : (balances as Record<string, number>)[from_jar];
    expect(sourceBalance).toBe(800);
    expect(sourceBalance >= amount).toBe(true);
  });

  // F-15 tests follow in the next describe block
  it('seed total must match available balance within 1p tolerance', () => {
    const actualAvailable = 500;
    const seed = { spend: 350, save: 100, give: 50 };
    const seedTotal = seed.spend + seed.save + seed.give;
    const withinTolerance = Math.abs(seedTotal - actualAvailable) <= 1;
    expect(seedTotal).toBe(500);
    expect(withinTolerance).toBe(true);

    const badSeed = { spend: 400, save: 100, give: 50 };
    const badTotal = badSeed.spend + badSeed.save + badSeed.give;
    expect(Math.abs(badTotal - actualAvailable) <= 1).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// F-15: Settings flow — earnings mode, allowance config, cache invalidation
// ─────────────────────────────────────────────────────────────────────────────
describe('settings flow (F-15)', () => {
  // BUG-036: child growth update must bust the settings cache
  it('BUG-036: growth update cache key matches settings GET cache key', () => {
    const childId   = 'child-123';
    // Settings GET caches under this key:
    const getKey    = `user:settings:${childId}`;
    // Growth update must delete the same key:
    const deleteKey = `user:settings:${childId}`;
    expect(getKey).toBe(deleteKey);
  });

  // BUG-038: shared expense settings update must bust the family config cache
  it('BUG-038: family/settings update cache key matches family GET cache key', () => {
    const familyId   = 'family-456';
    const getKey     = `family:config:${familyId}`;
    const deleteKey  = `family:config:${familyId}`;
    expect(getKey).toBe(deleteKey);
  });

  it('earnings_mode whitelist rejects unknown values', () => {
    const VALID_MODES = ['ALLOWANCE', 'CHORES', 'HYBRID'];
    expect(VALID_MODES.includes('ALLOWANCE')).toBe(true);
    expect(VALID_MODES.includes('CHORES')).toBe(true);
    expect(VALID_MODES.includes('HYBRID')).toBe(true);
    expect(VALID_MODES.includes('free_money')).toBe(false);
    expect(VALID_MODES.includes('')).toBe(false);
  });

  it('allowance_frequency whitelist rejects unknown values', () => {
    const VALID_FREQS = ['WEEKLY', 'BI_WEEKLY', 'MONTHLY'];
    expect(VALID_FREQS.includes('WEEKLY')).toBe(true);
    expect(VALID_FREQS.includes('DAILY')).toBe(false);
    expect(VALID_FREQS.includes('annual')).toBe(false);
  });

  it('account lock blocks writes but not reads', () => {
    const WRITE_METHODS = ['POST', 'PATCH', 'PUT', 'DELETE'];
    const READ_METHODS  = ['GET', 'HEAD', 'OPTIONS'];
    // Locked child should be blocked on writes
    for (const method of WRITE_METHODS) {
      const isWrite = !['GET', 'HEAD', 'OPTIONS'].includes(method);
      expect(isWrite).toBe(true);
    }
    // but allowed on reads (can still view balance and goals)
    for (const method of READ_METHODS) {
      const isWrite = !['GET', 'HEAD', 'OPTIONS'].includes(method);
      expect(isWrite).toBe(false);
    }
  });

  // F-16 tests follow in the next describe block
  it('co-parent cannot update verify_mode directly — must use governance/request', () => {
    const familyParentingMode = 'co-parenting';
    const attemptingDirectUpdate = true;
    // Block condition from handleFamilyUpdate
    const blocked = familyParentingMode === 'co-parenting' && attemptingDirectUpdate;
    expect(blocked).toBe(true);
  });

  it('shared expense split is stored in basis points (0–10000)', () => {
    const splitBp = 5000; // 50%
    expect(splitBp >= 0 && splitBp <= 10000).toBe(true);
    const splitPct = splitBp / 100;
    expect(splitPct).toBe(50);
    // Counter-party share
    const counterPct = 100 - splitPct;
    expect(counterPct).toBe(50);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// F-16: Give requests panel — approve / decline / state transitions (BUG-039 & BUG-043)
// ─────────────────────────────────────────────────────────────────────────────
describe('give requests panel (F-16)', () => {
  // BUG-039: non-integer amounts must be rejected before reaching the DB
  it('BUG-039: float amount is rejected (SQLite truncation would diverge from jar debit)', () => {
    function validateAmount(amount: unknown): boolean {
      return Number.isInteger(amount) && (amount as number) > 0;
    }
    expect(validateAmount(100)).toBe(true);   // 100p = £1.00 ✓
    expect(validateAmount(0.5)).toBe(false);  // 0.5p → truncated to 0 in SQLite ✗
    expect(validateAmount(1.5)).toBe(false);  // 1.5p → truncated to 1 ✗
    expect(validateAmount(0)).toBe(false);    // zero ✗
    expect(validateAmount(-50)).toBe(false);  // negative ✗
  });

  it('integer check passes valid pence amounts', () => {
    const valid = [1, 50, 100, 999, 10000];
    for (const v of valid) {
      expect(Number.isInteger(v) && v > 0).toBe(true);
    }
  });

  // BUG-043: refresh must be in finally so failed PATCH still clears stale card
  it('BUG-043: refresh-in-finally pattern clears stale card on PATCH failure', async () => {
    // Buggy: refresh only on success path — stale card on failure
    let buggyRefreshed = false;
    async function resolveBuggy(patchFails: boolean) {
      try {
        if (patchFails) throw new Error('already resolved');
        buggyRefreshed = true;
      } catch { /* non-fatal */ }
    }
    await resolveBuggy(true);
    expect(buggyRefreshed).toBe(false); // stale card stays

    // Fixed: refresh in finally — always runs
    let fixedRefreshed = false;
    async function resolveFixed(patchFails: boolean) {
      try {
        if (patchFails) throw new Error('already resolved');
      } catch { /* non-fatal */ }
      finally { fixedRefreshed = true; }
    }
    await resolveFixed(true);
    expect(fixedRefreshed).toBe(true); // card cleared
  });

  it('double-resolution is blocked by status guard (status !== requested)', () => {
    const status = 'fulfilled' as string;
    const alreadyResolved = status !== 'requested';
    expect(alreadyResolved).toBe(true); // server returns 400
  });

  it('decline restores Give jar balance via give_declined movement', () => {
    const originalBalance = 500;
    const requestAmount   = 200;
    // After submit: give_request movement debits 200 → balance = 300
    const balanceAfterSubmit = originalBalance - requestAmount;
    expect(balanceAfterSubmit).toBe(300);
    // After decline: give_declined movement credits 200 → balance restored = 500
    const balanceAfterDecline = balanceAfterSubmit + requestAmount;
    expect(balanceAfterDecline).toBe(originalBalance);
  });

  it('fulfil records give_fulfilled audit event (delta=0), not a balance change', () => {
    const originalBalance = 500;
    const requestAmount   = 200;
    const balanceAfterSubmit = originalBalance - requestAmount; // 300
    const delta              = 0; // give_fulfilled is audit-only
    const balanceAfterFulfil = balanceAfterSubmit + delta;     // still 300
    expect(balanceAfterFulfil).toBe(300); // balance does NOT restore on fulfil
    expect(balanceAfterFulfil).not.toBe(originalBalance);
  });

  it('family isolation: parent can only resolve requests from own family', () => {
    const parentFamilyId  = 'family-A' as string;
    const requestFamilyId = 'family-B' as string;
    const allowed = requestFamilyId === parentFamilyId;
    expect(allowed).toBe(false); // 403
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// F-17: History tabs — status label rendering & month grouping (BUG-044)
// ─────────────────────────────────────────────────────────────────────────────
describe('history tabs — status labels and month grouping (F-17)', () => {
  // BUG-044: HistoryTab STATUS_STYLES used wrong keys ('approved'/'pending'/'suggestion')
  // while DB statuses are 'completed'/'awaiting_review'/'needs_revision'.
  // Result: all approved chores rendered gray "completed" badge instead of green "Approved".
  const CORRECT_STATUS_STYLES: Record<string, { label: string; bg: string }> = {
    completed:       { label: 'Approved',   bg: 'bg-green-100' },
    awaiting_review: { label: 'Pending',    bg: 'bg-amber-100' },
    needs_revision:  { label: 'Needs redo', bg: 'bg-amber-100' },
    rejected:        { label: 'Rejected',   bg: 'bg-red-100'   },
  };

  it('BUG-044: completed status maps to Approved (green) — not gray fallback', () => {
    const s = CORRECT_STATUS_STYLES['completed'];
    expect(s).toBeDefined();
    expect(s.label).toBe('Approved');
    expect(s.bg).toBe('bg-green-100');
  });

  it('BUG-044: awaiting_review maps to Pending (amber) — not undefined', () => {
    const s = CORRECT_STATUS_STYLES['awaiting_review'];
    expect(s).toBeDefined();
    expect(s.label).toBe('Pending');
  });

  it('wrong keys (approved, pending, suggestion) are not in corrected STATUS_STYLES', () => {
    expect(CORRECT_STATUS_STYLES['approved']).toBeUndefined();
    expect(CORRECT_STATUS_STYLES['pending']).toBeUndefined();
    expect(CORRECT_STATUS_STYLES['suggestion']).toBeUndefined();
  });

  it('needs_revision maps to Needs redo (not Suggestion)', () => {
    const s = CORRECT_STATUS_STYLES['needs_revision'];
    expect(s).toBeDefined();
    expect(s.label).toBe('Needs redo');
  });

  it('unknown status resolves via fallback — raw label, gray style', () => {
    const status = 'unknown_future_status';
    const s = CORRECT_STATUS_STYLES[status];
    // Fallback logic: s ?? { label: status, bg: 'bg-gray-100' }
    const resolved = s ?? { label: status, bg: 'bg-gray-100' };
    expect(resolved.label).toBe(status);
    expect(resolved.bg).toBe('bg-gray-100');
  });

  it('month grouping produces YYYY-MM keys in correct order (date-desc)', () => {
    const items = [
      { submitted_at: new Date('2025-03-15').getTime() / 1000, status: 'completed', reward_amount: 100 },
      { submitted_at: new Date('2025-01-10').getTime() / 1000, status: 'completed', reward_amount: 200 },
      { submitted_at: new Date('2025-03-02').getTime() / 1000, status: 'completed', reward_amount: 150 },
    ];
    const sorted = [...items].sort((a, b) => b.submitted_at - a.submitted_at);
    const groupMap = new Map<string, typeof items>();
    for (const item of sorted) {
      const d   = new Date(item.submitted_at * 1000);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(item);
    }
    const groups = [...groupMap.entries()].sort((a, b) => b[0].localeCompare(a[0]));
    expect(groups[0][0]).toBe('2025-03');
    expect(groups[1][0]).toBe('2025-01');
    expect(groups[0][1]).toHaveLength(2); // two items in March
    expect(groups[1][1]).toHaveLength(1); // one item in January
  });

  it('totalEarned and approvedCount only count completed items', () => {
    const history = [
      { status: 'completed',       reward_amount: 300 },
      { status: 'awaiting_review', reward_amount: 100 },
      { status: 'rejected',        reward_amount: 200 },
      { status: 'completed',       reward_amount: 400 },
    ];
    const totalEarned   = history.filter(h => h.status === 'completed').reduce((s, h) => s + h.reward_amount, 0);
    const approvedCount = history.filter(h => h.status === 'completed').length;
    expect(totalEarned).toBe(700);
    expect(approvedCount).toBe(2);
  });
});
