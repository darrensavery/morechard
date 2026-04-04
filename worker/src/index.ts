/**
 * MoneySteps — Cloudflare Worker API
 *
 * Public routes (no auth required):
 *   POST   /auth/register               Create parent account
 *   POST   /auth/login                  Email + password → JWT
 *   POST   /auth/magic-link             Request magic link email
 *   GET    /auth/verify                 Consume magic link → JWT
 *   POST   /auth/child/login            Child PIN → scoped JWT
 *   GET    /api/health                  Health check
 *
 * Authenticated — parent or child:
 *   GET    /auth/me                     Current user profile
 *   POST   /auth/logout                 Revoke session
 *
 * Authenticated — parent only:
 *   POST   /auth/child/set-pin          Set/reset child PIN
 *   POST   /api/ledger                  Create ledger entry
 *   GET    /api/ledger                  Query ledger
 *   POST   /api/ledger/:id/verify       Second parent verifies pending entry
 *   POST   /api/ledger/:id/raise-dispute Raise dispute with structured code
 *   POST   /api/ledger/:id/dispute      (legacy) Amicable-mode dispute
 *   GET    /api/export/json             GDPR portability export
 *   GET    /api/export/pdf              Court-ready HTML report
 *   POST   /api/governance/request      Request verify_mode change
 *   POST   /api/governance/:id/confirm  Second parent confirms
 *   POST   /api/governance/:id/reject   Second parent rejects
 *   POST   /api/governance/expire       Expire stale requests (cron)
 *   GET    /api/governance              Fetch governance log
 *
 * Authenticated — parent only (invite + registration):
 *   POST   /auth/invite/generate        Generate typed 6-char invite code
 *   POST   /auth/child/add              Add child + auto-generate child invite code
 *   POST   /auth/registration/save-step Persist mid-flow registration state
 *
 * Public — invite redemption:
 *   POST   /auth/invite/redeem          Redeem invite code (child or co-parent)
 */

import * as Sentry from '@sentry/cloudflare';
import { Env } from './types.js';
import {
  handleChoreCreate, handleChoreList, handleChoreUpdate,
  handleChoreArchive, handleChoreRestore, handleChoreSubmit,
} from './routes/chores.js';
import {
  handleCompletionList, handleCompletionHistory,
  handleCompletionApprove, handleCompletionReject,
  handleCompletionRate, handleApproveAll,
} from './routes/completions.js';
import {
  handleGoalList, handleGoalCreate, handleGoalUpdate,
  handleGoalDelete, handleGoalReorder,
} from './routes/goals.js';
import {
  handleSpendingCreate, handleSpendingList,
  handlePayoutCreate, handlePayoutList,
  handleBonusCreate, handleBonusList,
  handleSubscriptionCreate, handleSubscriptionList,
  handleSubscriptionUpdate, handleSubscriptionCancel,
  handleBalance,
} from './routes/finance.js';
import { handlePlanList, handlePlanCreate, handlePlanDelete } from './routes/plans.js';
import {
  handleSuggestionCreate, handleSuggestionList,
  handleSuggestionApprove, handleSuggestionReject,
} from './routes/suggestions.js';
import {
  handleSettingsGet, handleSettingsUpdate,
  handleFamilyGet, handleFamilyUpdate,
  handleChildrenList,
  handleAccountLock, handleAccountUnlock,
  handleParentMessageSet, handleParentMessageGet,
} from './routes/settings.js';
import { handleLedgerPost, handleLedgerGet, handleLedgerDispute } from './routes/ledger.js';
import { handleLedgerVerify } from './routes/verify.js';
import { handleRaiseDispute } from './routes/raise-dispute.js';
import { handleExportJson, handleExportPdf } from './routes/export.js';
import {
  handleGovernanceRequest,
  handleGovernanceConfirm,
  handleGovernanceReject,
  handleGovernanceExpire,
  handleGovernanceGet,
} from './routes/governance.js';
import {
  handleCreateFamily,
  handleRegister,
  handleLogin,
  handleMagicLinkRequest,
  handleMagicLinkVerify,
  handleChildLogin,
  handleSetChildPin,
  handleLogout,
  handleMe,
} from './routes/auth.js';
import { requireAuth, requireRole, requireFamilyMatch } from './lib/middleware.js';
import { checkTrialStatus, getTrialStatus } from './lib/trial.js';
import { handleCreateCheckout, handleStripeWebhook } from './routes/stripe.js';
import { handleExchange } from './routes/exchange.js';
import {
  handleGenerateInvite,
  handleRedeemInvite,
  handleAddChild,
  handleSaveRegistrationStep,
} from './routes/invite.js';
import { json, error } from './lib/response.js';
import { JwtPayload } from './lib/jwt.js';

export default Sentry.withSentry(
  (env: Env) => ({
    dsn: 'https://5c98bed7630910cc4fd178677dda8b33@o4511158328295424.ingest.de.sentry.io/4511158333997136',
    tracesSampleRate: 1.0,
  }),
  {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url    = new URL(request.url);
    const path   = url.pathname;
    const method = request.method.toUpperCase();

    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    let response: Response;
    try {
      response = await route(request, env, method, path);
    } catch (err) {
      console.error(err);
      Sentry.captureException(err);
      response = error('Internal server error', 500);
    }

    const headers = new Headers(response.headers);
    for (const [k, v] of Object.entries(corsHeaders())) headers.set(k, v);
    return new Response(response.body, { status: response.status, headers });
  },

  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    await env.DB
      .prepare(`UPDATE family_governance_log SET status = 'expired' WHERE status = 'pending' AND expires_at < ?`)
      .bind(now).run();
  },
} satisfies ExportedHandler<Env>,
);

// ----------------------------------------------------------------
async function route(request: Request, env: Env, method: string, path: string): Promise<Response> {

  // ── Public ──────────────────────────────────────────────────
  if (path === '/api/health') return json({ ok: true });

  if (path === '/auth/exchange'      && method === 'POST') return handleExchange(request, env);
  if (path === '/auth/create-family' && method === 'POST') return handleCreateFamily(request, env);
  if (path === '/auth/register'      && method === 'POST') return handleRegister(request, env);
  if (path === '/auth/login'       && method === 'POST') return handleLogin(request, env);
  if (path === '/auth/magic-link'  && method === 'POST') return handleMagicLinkRequest(request, env);
  if (path === '/auth/verify'      && method === 'GET')  return handleMagicLinkVerify(request, env);
  if (path === '/auth/child/login'   && method === 'POST') return handleChildLogin(request, env);
  if (path === '/auth/invite/redeem' && method === 'POST') return handleRedeemInvite(request, env);

  // Stripe webhook — public but signature-verified internally
  if (path === '/api/stripe/webhook' && method === 'POST') return handleStripeWebhook(request, env);

  // ── All authenticated routes require a valid JWT ─────────────
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  // ── Authenticated — any role ──────────────────────────────────
  if (path === '/auth/me'     && method === 'GET')  return withAuth(request, auth, env, handleMe);
  if (path === '/auth/logout' && method === 'POST') return withAuth(request, auth, env, handleLogout);

  // Settings (any role — children can update their own avatar/theme)
  if (path === '/api/settings' && method === 'GET')   return withAuth(request, auth, env, handleSettingsGet);
  if (path === '/api/settings' && method === 'PATCH')  return withAuth(request, auth, env, handleSettingsUpdate);

  // Family info (read — any authenticated role)
  if (path === '/api/family'   && method === 'GET')   return withAuth(request, auth, env, handleFamilyGet);
  if (path === '/api/children' && method === 'GET')   return withAuth(request, auth, env, handleChildrenList);

  // Chores — children can list & submit
  if (path === '/api/chores' && method === 'GET')     return withAuth(request, auth, env, handleChoreList);
  const choreSubmitMatch = path.match(/^\/api\/chores\/([^/]+)\/submit$/);
  if (choreSubmitMatch && method === 'POST') return withAuth(request, auth, env, (req, e) => handleChoreSubmit(req, e, choreSubmitMatch[1]));

  // Completions — children can list their own & rate
  if (path === '/api/completions'         && method === 'GET')  return withAuth(request, auth, env, handleCompletionList);
  if (path === '/api/completions/history' && method === 'GET')  return withAuth(request, auth, env, handleCompletionHistory);
  const compRateMatch = path.match(/^\/api\/completions\/([^/]+)\/rate$/);
  if (compRateMatch && method === 'POST') return withAuth(request, auth, env, (req, e) => handleCompletionRate(req, e, compRateMatch[1]));

  // Goals — children & parents can read; parents can write
  if (path === '/api/goals' && method === 'GET')      return withAuth(request, auth, env, handleGoalList);

  // Plans — both roles
  if (path === '/api/plans' && method === 'GET')      return withAuth(request, auth, env, handlePlanList);
  if (path === '/api/plans' && method === 'POST')     return withAuth(request, auth, env, handlePlanCreate);
  const planDeleteMatch = path.match(/^\/api\/plans\/([^/]+)$/);
  if (planDeleteMatch && method === 'DELETE') return withAuth(request, auth, env, (req, e) => handlePlanDelete(req, e, planDeleteMatch[1]));

  // Suggestions — children create, both roles can read
  if (path === '/api/suggestions' && method === 'GET')  return withAuth(request, auth, env, handleSuggestionList);
  if (path === '/api/suggestions' && method === 'POST') return withAuth(request, auth, env, handleSuggestionCreate);

  // Balance — any role
  if (path === '/api/balance' && method === 'GET')    return withAuth(request, auth, env, handleBalance);

  // Spending — child logs, both read
  if (path === '/api/spending' && method === 'GET')   return withAuth(request, auth, env, handleSpendingList);
  if (path === '/api/spending' && method === 'POST')  return withAuth(request, auth, env, handleSpendingCreate);

  // Payouts — both read
  if (path === '/api/payouts'  && method === 'GET')   return withAuth(request, auth, env, handlePayoutList);

  // Subscriptions — both read
  if (path === '/api/subscriptions' && method === 'GET') return withAuth(request, auth, env, handleSubscriptionList);

  // Parent message — child reads
  if (path === '/api/parent-message' && method === 'GET') return withAuth(request, auth, env, handleParentMessageGet);

  // ── Trial / paywall gate (all authenticated routes) ──────────
  const trialBlock = await checkTrialStatus(request, env, auth.family_id);
  if (trialBlock) return trialBlock;

  // ── Trial status endpoint (any role) ─────────────────────────
  if (path === '/api/trial/status' && method === 'GET') {
    return json(await getTrialStatus(env, auth.family_id));
  }

  // ── Parent-only routes ────────────────────────────────────────
  const parentCheck = requireRole(auth, 'parent');
  if (parentCheck) return parentCheck;

  // Child PIN management
  if (path === '/auth/child/set-pin' && method === 'POST') {
    return withAuth(request, auth, env, handleSetChildPin);
  }

  // Family write (parent only)
  if (path === '/api/family' && method === 'PATCH') return withAuth(request, auth, env, handleFamilyUpdate);

  // Chores write (parent only)
  if (path === '/api/chores' && method === 'POST')  return withAuth(request, auth, env, handleChoreCreate);
  const choreIdMatch = path.match(/^\/api\/chores\/([^/]+)$/);
  if (choreIdMatch && method === 'PATCH')  return withAuth(request, auth, env, (req, e) => handleChoreUpdate(req, e, choreIdMatch[1]));
  if (choreIdMatch && method === 'DELETE') return withAuth(request, auth, env, (req, e) => handleChoreArchive(req, e, choreIdMatch[1]));
  const choreRestoreMatch = path.match(/^\/api\/chores\/([^/]+)\/restore$/);
  if (choreRestoreMatch && method === 'POST') return withAuth(request, auth, env, (req, e) => handleChoreRestore(req, e, choreRestoreMatch[1]));

  // Completions — parent approval
  const compApproveMatch = path.match(/^\/api\/completions\/([^/]+)\/approve$/);
  if (compApproveMatch && method === 'POST') return withAuth(request, auth, env, (req, e) => handleCompletionApprove(req, e, compApproveMatch[1]));
  const compRejectMatch = path.match(/^\/api\/completions\/([^/]+)\/reject$/);
  if (compRejectMatch && method === 'POST') return withAuth(request, auth, env, (req, e) => handleCompletionReject(req, e, compRejectMatch[1]));
  if (path === '/api/completions/approve-all' && method === 'POST') return withAuth(request, auth, env, handleApproveAll);

  // Goals write (parent only)
  if (path === '/api/goals' && method === 'POST') return withAuth(request, auth, env, handleGoalCreate);
  const goalIdMatch = path.match(/^\/api\/goals\/([^/]+)$/);
  if (goalIdMatch && method === 'PATCH')  return withAuth(request, auth, env, (req, e) => handleGoalUpdate(req, e, goalIdMatch[1]));
  if (goalIdMatch && method === 'DELETE') return withAuth(request, auth, env, (req, e) => handleGoalDelete(req, e, goalIdMatch[1]));
  const goalReorderMatch = path.match(/^\/api\/goals\/([^/]+)\/reorder$/);
  if (goalReorderMatch && method === 'POST') return withAuth(request, auth, env, (req, e) => handleGoalReorder(req, e, goalReorderMatch[1]));

  // Finance write — parent only
  if (path === '/api/payouts' && method === 'POST')        return withAuth(request, auth, env, handlePayoutCreate);
  if (path === '/api/bonus'   && method === 'POST')        return withAuth(request, auth, env, handleBonusCreate);
  if (path === '/api/bonus'   && method === 'GET')         return withAuth(request, auth, env, handleBonusList);
  if (path === '/api/subscriptions' && method === 'POST')  return withAuth(request, auth, env, handleSubscriptionCreate);
  const subIdMatch = path.match(/^\/api\/subscriptions\/([^/]+)$/);
  if (subIdMatch && method === 'PATCH')  return withAuth(request, auth, env, (req, e) => handleSubscriptionUpdate(req, e, subIdMatch[1]));
  if (subIdMatch && method === 'DELETE') return withAuth(request, auth, env, (req, e) => handleSubscriptionCancel(req, e, subIdMatch[1]));

  // Suggestions — parent approves/rejects
  const sugApproveMatch = path.match(/^\/api\/suggestions\/([^/]+)\/approve$/);
  if (sugApproveMatch && method === 'POST') return withAuth(request, auth, env, (req, e) => handleSuggestionApprove(req, e, sugApproveMatch[1]));
  const sugRejectMatch = path.match(/^\/api\/suggestions\/([^/]+)\/reject$/);
  if (sugRejectMatch && method === 'POST') return withAuth(request, auth, env, (req, e) => handleSuggestionReject(req, e, sugRejectMatch[1]));

  // Account lock/unlock
  if (path === '/api/account-lock' && method === 'POST') return withAuth(request, auth, env, handleAccountLock);
  const unlockMatch = path.match(/^\/api\/account-lock\/([^/]+)$/);
  if (unlockMatch && method === 'DELETE') return withAuth(request, auth, env, (req, e) => handleAccountUnlock(req, e, unlockMatch[1]));

  // Parent message
  if (path === '/api/parent-message' && method === 'POST') return withAuth(request, auth, env, handleParentMessageSet);

  // Invite code generation + child onboarding + registration persistence
  if (path === '/auth/invite/generate'        && method === 'POST') return withAuth(request, auth, env, handleGenerateInvite);
  if (path === '/auth/child/add'               && method === 'POST') return withAuth(request, auth, env, handleAddChild);
  if (path === '/auth/registration/save-step'  && method === 'POST') return withAuth(request, auth, env, handleSaveRegistrationStep);

  // Ledger
  if (path === '/api/ledger') {
    if (method === 'POST') {
      const famCheck = await checkFamilyFromBody(request, auth, env);
      if (famCheck) return famCheck;
      return handleLedgerPost(request, env);
    }
    if (method === 'GET') {
      const famCheck = requireFamilyMatch(auth, new URL(request.url).searchParams.get('family_id') ?? '');
      if (famCheck) return famCheck;
      return handleLedgerGet(request, env);
    }
  }

  const verifyMatch = path.match(/^\/api\/ledger\/(\d+)\/verify$/);
  if (verifyMatch && method === 'POST') return handleLedgerVerify(request, env, verifyMatch[1]);

  const raiseDisputeMatch = path.match(/^\/api\/ledger\/(\d+)\/raise-dispute$/);
  if (raiseDisputeMatch && method === 'POST') return handleRaiseDispute(request, env, raiseDisputeMatch[1]);

  const disputeMatch = path.match(/^\/api\/ledger\/(\d+)\/dispute$/);
  if (disputeMatch && method === 'POST') return handleLedgerDispute(request, env, disputeMatch[1]);

  // Export
  if (path === '/api/export/json' && method === 'GET') {
    const famCheck = requireFamilyMatch(auth, new URL(request.url).searchParams.get('family_id') ?? '');
    if (famCheck) return famCheck;
    return handleExportJson(request, env);
  }
  if (path === '/api/export/pdf' && method === 'GET') {
    const famCheck = requireFamilyMatch(auth, new URL(request.url).searchParams.get('family_id') ?? '');
    if (famCheck) return famCheck;
    return handleExportPdf(request, env);
  }

  // Stripe checkout (parent only, post-auth)
  if (path === '/api/stripe/create-checkout' && method === 'POST') {
    return handleCreateCheckout(request, env, auth);
  }

  // Governance
  if (path === '/api/governance/request' && method === 'POST') return handleGovernanceRequest(request, env);
  if (path === '/api/governance/expire'  && method === 'POST') return handleGovernanceExpire(request, env);
  if (path === '/api/governance'         && method === 'GET')  return handleGovernanceGet(request, env);

  const govActionMatch = path.match(/^\/api\/governance\/(\d+)\/(confirm|reject)$/);
  if (govActionMatch && method === 'POST') {
    const [, id, action] = govActionMatch;
    if (action === 'confirm') return handleGovernanceConfirm(request, env, id);
    if (action === 'reject')  return handleGovernanceReject(request, env, id);
  }

  return error('Not found', 404);
}

// ----------------------------------------------------------------
// Inject auth payload into request for use by handlers
// ----------------------------------------------------------------
function withAuth(
  request: Request,
  auth: JwtPayload,
  env: Env,
  handler: (req: Request, env: Env) => Promise<Response>,
): Promise<Response> {
  const augmented = Object.assign(request, { auth });
  return handler(augmented, env);
}

// Peek at body's family_id to enforce family match — then re-inject body
// so the downstream handler can still read it.
async function checkFamilyFromBody(
  request: Request,
  auth: JwtPayload,
  env: Env,
): Promise<Response | null> {
  // We need to read the body to extract family_id, but body can only be
  // consumed once. Clone it first.
  const clone = request.clone();
  try {
    const body = await clone.json() as Record<string, unknown>;
    const family_id = body['family_id'];
    if (typeof family_id === 'string') {
      return requireFamilyMatch(auth, family_id);
    }
  } catch { /* invalid JSON — let the route handler return the error */ }
  return null;
}

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}
