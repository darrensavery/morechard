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
 */

import { Env } from './types.js';
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
import { json, error } from './lib/response.js';
import { JwtPayload } from './lib/jwt.js';

export default {
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
} satisfies ExportedHandler<Env>;

// ----------------------------------------------------------------
async function route(request: Request, env: Env, method: string, path: string): Promise<Response> {

  // ── Public ──────────────────────────────────────────────────
  if (path === '/api/health') return json({ ok: true });

  if (path === '/auth/register'    && method === 'POST') return handleRegister(request, env);
  if (path === '/auth/login'       && method === 'POST') return handleLogin(request, env);
  if (path === '/auth/magic-link'  && method === 'POST') return handleMagicLinkRequest(request, env);
  if (path === '/auth/verify'      && method === 'GET')  return handleMagicLinkVerify(request, env);
  if (path === '/auth/child/login' && method === 'POST') return handleChildLogin(request, env);

  // Stripe webhook — public but signature-verified internally
  if (path === '/api/stripe/webhook' && method === 'POST') return handleStripeWebhook(request, env);

  // ── All authenticated routes require a valid JWT ─────────────
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  // ── Authenticated — any role ──────────────────────────────────
  if (path === '/auth/me'     && method === 'GET')  return withAuth(request, auth, env, handleMe);
  if (path === '/auth/logout' && method === 'POST') return withAuth(request, auth, env, handleLogout);

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
