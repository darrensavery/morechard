# JWT Cookie Migration + Native Secure Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move web JWT auth from `localStorage` to an `HttpOnly` cookie with CSRF protection, and move native (Capacitor) JWT storage from `localStorage` to Keychain/Keystore-backed secure storage — closing the XSS-to-account-takeover path identified in the 2026-07-15 security audit.

**Architecture:** The Worker gains a shared `setAuthCookie`/`clearAuthCookie` helper wired into every token-issuing route, plus a non-HttpOnly "session marker" cookie so client JS can still answer "am I logged in" without ever touching the real secret. `extractToken()` prefers a cookie, falls back to `Authorization: Bearer` (this fallback is what keeps native's Bearer model working unchanged through the same middleware). A new `requireCsrfHeader` check closes the CSRF gap cookies reintroduce. On the app side, a new `app/src/lib/authState.ts` module replaces every direct `localStorage.getItem('mc_token')` check; `app/src/lib/api.ts`'s `request()` branches by platform (native: Bearer header from secure storage; web: `credentials: 'include'` + CSRF header, no token ever read by JS).

**Tech Stack:** Cloudflare Workers (hand-rolled JWT, no npm dep), Hono-less manual routing in `worker/src/index.ts`, Vitest for worker/app unit tests, Capacitor 8 (`capacitor-secure-storage-plugin` for native Keychain/Keystore), Playwright for web E2E.

## Global Constraints

- Token expiry stays unchanged: parent 365 days, child 90 days (`PARENT_JWT_EXPIRY` / `CHILD_JWT_EXPIRY` in `worker/src/routes/auth.ts`). No refresh-token mechanism is introduced.
- `parent`/`child` terminology is not renamed anywhere — this was explicitly raised and rejected during brainstorming.
- Web is a hard cutover: no dual Bearer+cookie acceptance window. Native gets a soft one-time migration (write-confirm-then-delete from `localStorage`).
- `tsc --noEmit` clean + full test suite passing in both `worker/` and `app/` before every commit (standing project practice).
- CORS origin allow-list (`worker/src/index.ts` `corsHeaders()`) must stay an exact hardcoded match (`https://app.morechard.com`) — never a wildcard — now that `Access-Control-Allow-Credentials: true` is added.

---

### Task 1: Worker — cookie helper module

**Files:**
- Create: `worker/src/lib/cookies.ts`
- Test: `worker/src/lib/cookies.test.ts`

**Interfaces:**
- Produces: `setAuthCookie(headers: Headers, token: string, expirySeconds: number): void`, `clearAuthCookie(headers: Headers): void`, `setSessionMarkerCookie(headers: Headers, role: 'parent' | 'child', expirySeconds: number): void`, `clearSessionMarkerCookie(headers: Headers): void`. All four take a `Headers` instance and append `Set-Cookie` entries directly (multiple `Set-Cookie` headers on one response is valid HTTP and `Headers.append` handles it correctly, unlike `.set`).

The session-marker cookie is a small addition beyond the spec: since `mc_token` becomes `HttpOnly`, client JS can no longer read it to answer "is there an active session" (used today by `LockScreen`, `LandingScreen`, `App.tsx`'s route guard). A second, non-HttpOnly cookie carrying only the role (never the secret) lets the client keep that check without touching the real token.

- [ ] **Step 1: Write the failing test**

```typescript
// worker/src/lib/cookies.test.ts
import { describe, it, expect } from 'vitest';
import { setAuthCookie, clearAuthCookie, setSessionMarkerCookie, clearSessionMarkerCookie } from './cookies.js';

describe('cookies', () => {
  it('setAuthCookie appends an HttpOnly, Secure, SameSite=Lax cookie with the given Max-Age', () => {
    const headers = new Headers();
    setAuthCookie(headers, 'abc.def.ghi', 31536000);
    const cookie = headers.get('Set-Cookie');
    expect(cookie).toContain('mc_token=abc.def.ghi');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Path=/');
    expect(cookie).toContain('Max-Age=31536000');
  });

  it('clearAuthCookie sets Max-Age=0', () => {
    const headers = new Headers();
    clearAuthCookie(headers);
    expect(headers.get('Set-Cookie')).toContain('mc_token=;');
    expect(headers.get('Set-Cookie')).toContain('Max-Age=0');
  });

  it('setSessionMarkerCookie is NOT HttpOnly and carries the role', () => {
    const headers = new Headers();
    setSessionMarkerCookie(headers, 'parent', 31536000);
    const cookie = headers.get('Set-Cookie');
    expect(cookie).toContain('mc_session=parent');
    expect(cookie).not.toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Lax');
  });

  it('clearSessionMarkerCookie sets Max-Age=0', () => {
    const headers = new Headers();
    clearSessionMarkerCookie(headers);
    expect(headers.get('Set-Cookie')).toContain('mc_session=;');
    expect(headers.get('Set-Cookie')).toContain('Max-Age=0');
  });

  it('setAuthCookie and setSessionMarkerCookie both append (not overwrite) Set-Cookie', () => {
    const headers = new Headers();
    setAuthCookie(headers, 'tok', 100);
    setSessionMarkerCookie(headers, 'child', 100);
    // Headers.get('Set-Cookie') only returns the first entry via the standard
    // Headers API — use getSetCookie() (supported in the Workers runtime) to
    // confirm both were appended rather than one clobbering the other.
    const all = (headers as Headers & { getSetCookie(): string[] }).getSetCookie();
    expect(all).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd worker && npx vitest run src/lib/cookies.test.ts`
Expected: FAIL — `Cannot find module './cookies.js'`

- [ ] **Step 3: Write minimal implementation**

```typescript
// worker/src/lib/cookies.ts
/**
 * HttpOnly auth cookie (the real credential) + a paired, JS-readable
 * "session marker" cookie (role only, never the token) so client code can
 * answer "is there an active session" without ever touching the secret.
 */

const AUTH_COOKIE    = 'mc_token';
const MARKER_COOKIE  = 'mc_session';

export function setAuthCookie(headers: Headers, token: string, expirySeconds: number): void {
  headers.append(
    'Set-Cookie',
    `${AUTH_COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${expirySeconds}`,
  );
}

export function clearAuthCookie(headers: Headers): void {
  headers.append(
    'Set-Cookie',
    `${AUTH_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`,
  );
}

export function setSessionMarkerCookie(headers: Headers, role: 'parent' | 'child', expirySeconds: number): void {
  headers.append(
    'Set-Cookie',
    `${MARKER_COOKIE}=${role}; Secure; SameSite=Lax; Path=/; Max-Age=${expirySeconds}`,
  );
}

export function clearSessionMarkerCookie(headers: Headers): void {
  headers.append(
    'Set-Cookie',
    `${MARKER_COOKIE}=; Secure; SameSite=Lax; Path=/; Max-Age=0`,
  );
}

/** Parse the raw Cookie request header into a name→value map. */
export function parseCookies(request: Request): Record<string, string> {
  const header = request.headers.get('Cookie');
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    out[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
  }
  return out;
}

export function getAuthCookie(request: Request): string | null {
  return parseCookies(request)[AUTH_COOKIE] ?? null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd worker && npx vitest run src/lib/cookies.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add worker/src/lib/cookies.ts worker/src/lib/cookies.test.ts
git commit -m "feat(worker): add HttpOnly auth cookie + session marker cookie helpers"
```

---

### Task 2: Worker — cookie-aware `extractToken` + CSRF header check

**Files:**
- Modify: `worker/src/lib/middleware.ts:17-101`
- Test: `worker/src/lib/middleware.test.ts` (create if it doesn't already exist — check with `Glob worker/src/lib/middleware.test.ts` first)

**Interfaces:**
- Consumes: `getAuthCookie(request: Request): string | null` from Task 1 (`./cookies.js`).
- Produces: `requireCsrfHeader(request: Request, viaCookie: boolean): Response | null` — exported alongside the existing `requireAuth`/`requireRole`/`requireFamilyMatch`. Returns a 403 `Response` when the request was cookie-authenticated, is a mutating method, and lacks the `X-Morechard-Client` header; returns `null` otherwise (including whenever `viaCookie` is `false`, i.e. Bearer/native requests always pass).
- `requireAuth` now also returns whether the token came from a cookie, via a small internal change — callers in `index.ts` need this to decide whether to run `requireCsrfHeader`. Change `requireAuth`'s return type is NOT changed (still `JwtPayload | Response`) — instead `requireCsrfHeader` re-derives `viaCookie` itself by checking `getAuthCookie(request) !== null`, so `index.ts` doesn't need any new plumbing beyond calling `requireCsrfHeader(request, ...)` right after `requireAuth`.

- [ ] **Step 1: Write the failing test**

```typescript
// worker/src/lib/middleware.test.ts
import { describe, it, expect } from 'vitest';
import { requireCsrfHeader } from './middleware.js';

describe('requireCsrfHeader', () => {
  it('rejects a cookie-authenticated mutating request with no client header', () => {
    const request = new Request('https://api.morechard.com/api/goals', {
      method: 'POST',
      headers: { Cookie: 'mc_token=abc' },
    });
    const result = requireCsrfHeader(request, true);
    expect(result).not.toBeNull();
    expect(result?.status).toBe(403);
  });

  it('accepts a cookie-authenticated mutating request WITH the client header', () => {
    const request = new Request('https://api.morechard.com/api/goals', {
      method: 'POST',
      headers: { Cookie: 'mc_token=abc', 'X-Morechard-Client': '1' },
    });
    expect(requireCsrfHeader(request, true)).toBeNull();
  });

  it('never blocks a Bearer-authenticated (native) request, regardless of header', () => {
    const request = new Request('https://api.morechard.com/api/goals', {
      method: 'POST',
      headers: { Authorization: 'Bearer abc' },
    });
    expect(requireCsrfHeader(request, false)).toBeNull();
  });

  it('never blocks GET requests even when cookie-authenticated', () => {
    const request = new Request('https://api.morechard.com/api/goals', {
      method: 'GET',
      headers: { Cookie: 'mc_token=abc' },
    });
    expect(requireCsrfHeader(request, true)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd worker && npx vitest run src/lib/middleware.test.ts`
Expected: FAIL — `requireCsrfHeader` is not exported from `./middleware.js`

- [ ] **Step 3: Write minimal implementation**

Replace `worker/src/lib/middleware.ts:91-101` (the `extractToken` function and file end) with:

```typescript
export function requireCsrfHeader(request: Request, viaCookie: boolean): Response | null {
  if (!viaCookie) return null; // Bearer/native — no browser auto-attach, no CSRF exposure
  const isWrite = !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
  if (!isWrite) return null;
  if (request.headers.get('X-Morechard-Client') !== '1') {
    return error('Missing client header', 403);
  }
  return null;
}

function extractToken(request: Request): string | null {
  // Cookie takes precedence — this is the web path (HttpOnly mc_token cookie).
  const cookieToken = getAuthCookie(request);
  if (cookieToken) return cookieToken;

  // Authorization: Bearer <token> — the native app's path (Capacitor WebView
  // can't reliably use cookies; see the JWT cookie migration design doc).
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  return null;
}
```

Add the import at the top of `worker/src/lib/middleware.ts` (after the existing `import { error } from './response.js';` on line 15):

```typescript
import { getAuthCookie } from './cookies.js';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd worker && npx vitest run src/lib/middleware.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add worker/src/lib/middleware.ts worker/src/lib/middleware.test.ts
git commit -m "feat(worker): extractToken reads cookie first, add requireCsrfHeader"
```

---

### Task 3: Worker — wire CSRF check + CORS credentials into `index.ts`

**Files:**
- Modify: `worker/src/index.ts:149` (import), `worker/src/index.ts:636-638` (auth gate), `worker/src/index.ts:1072-1078` (`corsHeaders`)

**Interfaces:**
- Consumes: `requireCsrfHeader` from Task 2 (`./lib/middleware.js`), `getAuthCookie` from Task 1 (`./lib/cookies.js`).

- [ ] **Step 1: Manual verification step (no unit test — this is routing glue)**

This task wires two things that are already unit-tested in isolation (Tasks 1–2) into the live request path. Verify with an integration-style curl check after implementing (see Step 3 below), not a new unit test.

- [ ] **Step 2: Update the import and route() auth gate**

In `worker/src/index.ts:149`, change:
```typescript
import { requireAuth, requireRole, requireFamilyMatch } from './lib/middleware.js';
```
to:
```typescript
import { requireAuth, requireRole, requireFamilyMatch, requireCsrfHeader } from './lib/middleware.js';
```

Add the import (near the top, alongside other `./lib/*` imports around line 149-151):
```typescript
import { getAuthCookie } from './lib/cookies.js';
```

In `worker/src/index.ts:635-638`, change:
```typescript
  // ── All authenticated routes require a valid JWT ─────────────
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
```
to:
```typescript
  // ── All authenticated routes require a valid JWT ─────────────
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  // ── CSRF check — only bites cookie-authenticated (web) mutating requests ──
  const csrfCheck = requireCsrfHeader(request, getAuthCookie(request) !== null);
  if (csrfCheck) return csrfCheck;
```

- [ ] **Step 3: Update `corsHeaders()`**

In `worker/src/index.ts:1072-1078`, change:
```typescript
function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin':  'https://app.morechard.com',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}
```
to:
```typescript
function corsHeaders(): Record<string, string> {
  return {
    // Must stay an exact match — never a wildcard — now that credentialed
    // (cookie-carrying) requests are allowed. Browsers reject wildcard +
    // credentials combinations, but keep this explicit as a guard against
    // a future accidental regression.
    'Access-Control-Allow-Origin':      'https://app.morechard.com',
    'Access-Control-Allow-Methods':     'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers':     'Content-Type, Authorization, X-Morechard-Client',
    'Access-Control-Allow-Credentials': 'true',
  };
}
```

- [ ] **Step 4: Run the full worker test suite**

Run: `cd worker && npm test`
Expected: PASS — all existing tests still pass (this task only adds calls to already-tested functions).

- [ ] **Step 5: Commit**

```bash
git add worker/src/index.ts
git commit -m "feat(worker): wire CSRF check into the auth gate, allow credentialed CORS"
```

---

### Task 4: Worker — issue auth + session-marker cookies on every login/registration route

**Files:**
- Modify: `worker/src/routes/auth.ts:1603-1621` (`issueParentJwt`), `worker/src/routes/auth.ts:566-571` (`handleChildLogin`), `worker/src/routes/auth.ts:578-589` (`handleLogout`)
- Modify: `worker/src/routes/demo.ts:49-50`, `worker/src/routes/demo.ts:84-85`
- Modify: `worker/src/routes/invite.ts:279-292` (`redeemChildInvite`), `worker/src/routes/invite.ts:343-349` (`redeemCoParentInvite`)
- Test: `worker/src/routes/auth.test.ts` (check with Glob whether it exists already — if so, add to it; if not, create it)

**Interfaces:**
- Consumes: `setAuthCookie`, `clearAuthCookie`, `setSessionMarkerCookie`, `clearSessionMarkerCookie` from Task 1 (`../lib/cookies.js`).
- All six call sites currently build a response via `json({ token, expires_in, ... })` from `../lib/response.js`. This task does NOT change what's in the JSON body (native still needs `token` there to write to secure storage) — it ADDS `Set-Cookie` headers onto the same response object. The cookie is harmless-but-unusable for native (cross-origin WebView, per the design doc) and is what web relies on.

- [ ] **Step 1: Write the failing test**

```typescript
// worker/src/routes/auth.test.ts — add this describe block (or create the file with it)
import { describe, it, expect } from 'vitest';
import { handleChildLogin } from './auth.js';
// ... existing imports/mocks for a test DB/env fixture in this file, if present.
// If this file doesn't exist yet, mirror the mock Env setup used in
// worker/src/routes/invite.test.ts or worker/src/lib/middleware.test.ts.

describe('handleChildLogin cookie issuance', () => {
  it('sets both mc_token (HttpOnly) and mc_session (role) cookies on success', async () => {
    // Arrange: seed a child user + family_roles row + pin_hash via the test DB fixture,
    // matching the pattern used by existing child-login tests in this file/suite.
    const request = new Request('https://api.morechard.com/auth/child/login', {
      method: 'POST',
      body: JSON.stringify({ family_id: 'fam1', child_id: 'child1', pin: '1234' }),
    });
    const res = await handleChildLogin(request, testEnv);
    const setCookies = (res.headers as Headers & { getSetCookie(): string[] }).getSetCookie();
    expect(setCookies.some(c => c.startsWith('mc_token=') && c.includes('HttpOnly'))).toBe(true);
    expect(setCookies.some(c => c.startsWith('mc_session=child') && !c.includes('HttpOnly'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd worker && npx vitest run src/routes/auth.test.ts`
Expected: FAIL — no `Set-Cookie` headers present yet

- [ ] **Step 3: Write minimal implementation**

In `worker/src/routes/auth.ts`, add the import near the other `../lib/*` imports (after line 24's `hash.js` import):
```typescript
import { setAuthCookie, clearAuthCookie, setSessionMarkerCookie, clearSessionMarkerCookie } from '../lib/cookies.js';
```

Change `issueParentJwt` (currently `worker/src/routes/auth.ts:1603-1621`):
```typescript
async function issueParentJwt(userId: string, familyId: string, request: Request, env: Env): Promise<Response> {
  const ip  = clientIp(request);
  const now = Math.floor(Date.now() / 1000);
  const jti = nanoid();
  const ua = request.headers.get('User-Agent') ?? '';

  await env.DB
    .prepare(`INSERT INTO sessions (jti, user_id, family_id, role, issued_at, expires_at, ip_address, user_agent)
              VALUES (?,?,?,'parent',?,?,?,?)`)
    .bind(jti, userId, familyId, now, now + PARENT_JWT_EXPIRY, ip, ua)
    .run();

  const token = await signJwt(
    { sub: userId, jti, family_id: familyId, role: 'parent', iat: now, exp: now + PARENT_JWT_EXPIRY },
    env.JWT_SECRET,
  );

  const response = json({ token, expires_in: PARENT_JWT_EXPIRY });
  setAuthCookie(response.headers, token, PARENT_JWT_EXPIRY);
  setSessionMarkerCookie(response.headers, 'parent', PARENT_JWT_EXPIRY);
  return response;
}
```

Change `handleChildLogin`'s return (currently `worker/src/routes/auth.ts:566-571`):
```typescript
  const token = await signJwt(
    { sub: user.id, jti, family_id, role: 'child', iat: now, exp: now + CHILD_JWT_EXPIRY },
    env.JWT_SECRET,
  );

  const response = json({ token, expires_in: CHILD_JWT_EXPIRY, graduation_pending: graduationPending });
  setAuthCookie(response.headers, token, CHILD_JWT_EXPIRY);
  setSessionMarkerCookie(response.headers, 'child', CHILD_JWT_EXPIRY);
  return response;
```

Change `handleLogout` (currently `worker/src/routes/auth.ts:578-589`):
```typescript
export async function handleLogout(request: Request, env: Env): Promise<Response> {
  const caller = (request as AuthedRequest).auth;
  if (!caller) return error('Unauthorised', 401);

  const now = Math.floor(Date.now() / 1000);
  await env.DB
    .prepare('UPDATE sessions SET revoked_at = ? WHERE jti = ?')
    .bind(now, caller.jti)
    .run();

  const response = json({ ok: true });
  clearAuthCookie(response.headers);
  clearSessionMarkerCookie(response.headers);
  return response;
}
```

In `worker/src/routes/demo.ts`, add the same import after line 12's `jwt.js` import:
```typescript
import { setAuthCookie, setSessionMarkerCookie } from '../lib/cookies.js';
```

Change both return sites (`worker/src/routes/demo.ts:49-50` and `:84-85`, both currently `return json({ token, expires_in: DEMO_SESSION_TTL });`) to:
```typescript
  const response = json({ token, expires_in: DEMO_SESSION_TTL });
  setAuthCookie(response.headers, token, DEMO_SESSION_TTL);
  setSessionMarkerCookie(response.headers, 'parent', DEMO_SESSION_TTL);
  return response;
```
(Demo tokens are always `role: 'parent'` per `issueDemoToken`'s hardcoded `role: 'parent'` in the signed payload — see `worker/src/routes/demo.ts:151`.)

In `worker/src/routes/invite.ts`, add the same import after line 17's `jwt.js` import:
```typescript
import { setAuthCookie, setSessionMarkerCookie } from '../lib/cookies.js';
```

Change `redeemChildInvite`'s return (currently `worker/src/routes/invite.ts:279-292`):
```typescript
  const token = await signJwt(
    { sub: userId, jti, family_id: familyId, role: 'child', iat: now, exp: now + CHILD_JWT_EXPIRY },
    env.JWT_SECRET,
  );

  const fam = await env.DB
    .prepare('SELECT child_analytics_consent FROM families WHERE id = ?')
    .bind(familyId)
    .first<{ child_analytics_consent: number }>();

  const response = json({ token, expires_in: CHILD_JWT_EXPIRY, role: 'child', user_id: userId, family_id: familyId, child_analytics: fam?.child_analytics_consent === 1 }, 201);
  setAuthCookie(response.headers, token, CHILD_JWT_EXPIRY);
  setSessionMarkerCookie(response.headers, 'child', CHILD_JWT_EXPIRY);
  return response;
```

Change `redeemCoParentInvite`'s return (currently `worker/src/routes/invite.ts:343-349`):
```typescript
  const token = await signJwt(
    { sub: userId, jti, family_id: familyId, role: 'parent', iat: now, exp: now + PARENT_JWT_EXPIRY },
    env.JWT_SECRET,
  );

  const response = json({ token, expires_in: PARENT_JWT_EXPIRY, role: 'co-parent', user_id: userId, family_id: familyId }, 201);
  setAuthCookie(response.headers, token, PARENT_JWT_EXPIRY);
  setSessionMarkerCookie(response.headers, 'parent', PARENT_JWT_EXPIRY);
  return response;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd worker && npx vitest run src/routes/auth.test.ts && npm test`
Expected: PASS — the new cookie assertion plus the full existing worker suite (body shape is unchanged, so no other test should break).

- [ ] **Step 5: Commit**

```bash
git add worker/src/routes/auth.ts worker/src/routes/demo.ts worker/src/routes/invite.ts worker/src/routes/auth.test.ts
git commit -m "feat(worker): issue auth + session-marker cookies from every login/registration route"
```

---

### Task 5: App — install `capacitor-secure-storage-plugin`, rewrite token storage in `api.ts`

**Files:**
- Modify: `package.json` (root, alongside the other `@capacitor/*` deps at `package.json:29-36`)
- Modify: `app/src/lib/api.ts:1-124`
- Create: `app/src/lib/authState.ts`
- Test: `app/src/lib/authState.test.ts`

**Interfaces:**
- Produces (`authState.ts`): `primeAuthState(): Promise<void>` — call once at app boot; on native, reads secure storage (with the write-then-clear migration from `localStorage`, see Task 6) into an in-memory cache; on web, reads the `mc_session` cookie (readable — not HttpOnly) via `document.cookie`. `isAuthenticated(): boolean` — synchronous, reads the primed in-memory/cookie state; safe to call from a route guard render. `getRole(): 'parent' | 'child' | null` — same, sourced from the primed state.
- Produces (`api.ts`): `getToken(): Promise<string | null>`, `setToken(token: string): Promise<void>`, `clearToken(): Promise<void>` — now **native-only** and **async**. On web these three become no-ops that return/resolve immediately (`getToken` resolves `null`, `setToken`/`clearToken` resolve `undefined`) — kept as no-ops rather than deleted so the ~12 existing call sites across the app don't all need conditional imports; Task 7 updates each call site to stop relying on their return value on web.
- Consumes (`api.ts`): `Capacitor` from `@capacitor/core` (already a dependency), `SecureStoragePlugin` from `capacitor-secure-storage-plugin`.

- [ ] **Step 1: Check Capacitor 8 compatibility before installing**

Run: `npm view capacitor-secure-storage-plugin peerDependencies`
Expected output includes a `@capacitor/core` range. This repo is on Capacitor `^8.3.1` (root `package.json:33`). If the plugin's peer range caps below `8.x`, stop and flag this to the user before proceeding — do not force-install past a peer dependency warning silently. As of the last check this plugin supports Capacitor's current major lines via its own v8 release; confirm the currently-published version before installing.

- [ ] **Step 2: Install the dependency**

Run (from the repo root, since Capacitor deps live in the root `package.json`):
```bash
npm install capacitor-secure-storage-plugin
npx cap sync
```
Expected: `package.json` gains `"capacitor-secure-storage-plugin": "^<version>"` under `dependencies`; `npx cap sync` completes without error for both `android` and `ios` platforms.

- [ ] **Step 3: Write the failing test for `authState.ts`**

```typescript
// app/src/lib/authState.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { primeAuthState, isAuthenticated, getRole } from './authState';

describe('authState (web path)', () => {
  beforeEach(() => {
    document.cookie = 'mc_session=; Max-Age=0; path=/';
    vi.resetModules();
  });

  it('isAuthenticated is false before priming with no session cookie', async () => {
    await primeAuthState();
    expect(isAuthenticated()).toBe(false);
    expect(getRole()).toBeNull();
  });

  it('isAuthenticated is true and getRole reflects the cookie after priming', async () => {
    document.cookie = 'mc_session=parent; path=/';
    await primeAuthState();
    expect(isAuthenticated()).toBe(true);
    expect(getRole()).toBe('parent');
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd app && npx vitest run src/lib/authState.test.ts`
Expected: FAIL — `Cannot find module './authState'`

- [ ] **Step 5: Write `authState.ts`**

```typescript
// app/src/lib/authState.ts
/**
 * In-memory session state, primed once at app boot (see App.tsx's checkingAuth
 * gate). Exists because the real JWT now lives in an HttpOnly cookie (web) or
 * Keychain/Keystore (native) — neither is synchronously readable by JS, but
 * route guards (RequireSession, LockScreen, LandingScreen) need a fast,
 * synchronous "am I logged in" answer during render.
 *
 * Web: sourced from the non-HttpOnly `mc_session` cookie (role only, never
 * the token — see worker/src/lib/cookies.ts).
 * Native: sourced from a secure-storage read done once at primeAuthState().
 */
import { Capacitor } from '@capacitor/core';

let primed = false;
let cachedRole: 'parent' | 'child' | null = null;

function readSessionCookie(): 'parent' | 'child' | null {
  const match = document.cookie.match(/(?:^|;\s*)mc_session=(parent|child)(?:;|$)/);
  return (match?.[1] as 'parent' | 'child' | undefined) ?? null;
}

export async function primeAuthState(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const { getToken } = await import('./api.js');
    let token: string | null = null;
    try {
      token = await getToken();
    } catch {
      token = null; // corrupted/inaccessible keychain — treat as logged out
    }
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1])) as { role?: 'parent' | 'child' };
        cachedRole = payload.role ?? null;
      } catch {
        cachedRole = null;
      }
    } else {
      cachedRole = null;
    }
  } else {
    cachedRole = readSessionCookie();
  }
  primed = true;
}

export function isAuthenticated(): boolean {
  return primed && cachedRole !== null;
}

export function getRole(): 'parent' | 'child' | null {
  return cachedRole;
}

/** Called by clearToken()/logout so the in-memory cache doesn't go stale mid-session. */
export function clearCachedAuthState(): void {
  cachedRole = null;
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd app && npx vitest run src/lib/authState.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 7: Rewrite `getToken`/`setToken`/`clearToken` and `request()` in `api.ts`**

Replace `app/src/lib/api.ts:1-46` with:

```typescript
/**
 * Morechard API client
 * All requests go through the Cloudflare Worker at /api or /auth.
 *
 * Web: the JWT lives in an HttpOnly cookie the browser attaches automatically
 * (see worker/src/lib/cookies.ts) — this client never reads or stores it.
 * Native (Capacitor): no reliable cookie story in a cross-origin WebView, so
 * the JWT is kept in Keychain/Keystore-backed secure storage and sent as a
 * Bearer header.
 */

import { Capacitor } from '@capacitor/core';
import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';
import { clearCachedAuthState } from './authState.js';

const SECURE_STORAGE_KEY = 'mc_token';

// On Cloudflare Pages, relative URLs work because Pages Functions proxy
// /auth/* and /api/* to the Worker. Inside Capacitor (Android/iOS), the app
// loads from http://localhost/ with no proxy, so we need an absolute URL.
const BASE = Capacitor.isNativePlatform()
  ? ((import.meta.env.VITE_WORKER_URL as string | undefined) ?? 'https://api.morechard.com')
  : '';

/** Build an absolute API URL. Pass the relative path (e.g. '/api/foo'); returns
 *  the same string on web and a fully-qualified worker URL on native. */
export function apiUrl(path: string): string {
  return `${BASE}${path}`;
}

/** Native-only: reads the Bearer token from Keychain/Keystore. Resolves null on web
 *  (the cookie is HttpOnly and invisible to JS by design) or on any storage error. */
export async function getToken(): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const { value } = await SecureStoragePlugin.get({ key: SECURE_STORAGE_KEY });
    return value ?? null;
  } catch {
    return null; // corrupted/inaccessible keychain — treat as logged out, never throw
  }
}

/** Native-only: writes the Bearer token to Keychain/Keystore. No-op on web. */
export async function setToken(token: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await SecureStoragePlugin.set({ key: SECURE_STORAGE_KEY, value: token });
}

/** Native-only: clears the Bearer token from Keychain/Keystore. No-op on web
 *  (there the server-side clearAuthCookie() on /auth/logout is what matters). */
export async function clearToken(): Promise<void> {
  clearCachedAuthState();
  if (!Capacitor.isNativePlatform()) return;
  await SecureStoragePlugin.remove({ key: SECURE_STORAGE_KEY }).catch(() => null);
}

/** Standard auth + content-type headers for callers that bypass request() (native only —
 *  used by the proof-upload/receipt-upload raw fetch() calls further down this file). */
export async function authHeaders(contentType?: string): Promise<Record<string, string>> {
  const h: Record<string, string> = {};
  if (contentType) h['Content-Type'] = contentType;
  if (Capacitor.isNativePlatform()) {
    const token = await getToken();
    if (token) h.Authorization = `Bearer ${token}`;
  }
  return h;
}

export function getFamilyId(): string {
  // Read exclusively from device identity — avoids exposing a separate localStorage key.
  try {
    const raw = localStorage.getItem('mc_device_identity');
    if (raw) return (JSON.parse(raw) as { family_id?: string }).family_id ?? '';
  } catch { /* ignore */ }
  return '';
}

export function getUserId(): string {
  try {
    const raw = localStorage.getItem('mc_device_identity');
    if (raw) return (JSON.parse(raw) as { user_id?: string }).user_id ?? '';
  } catch { /* ignore */ }
  return '';
}

export function getRole(): 'parent' | 'child' | null {
  try {
    const raw = localStorage.getItem('mc_device_identity');
    if (raw) return ((JSON.parse(raw) as { role?: string }).role ?? null) as 'parent' | 'child' | null;
  } catch { /* ignore */ }
  return null;
}

async function request<T>(path: string, options: RequestInit = {}, _retries = 2, skip402 = false): Promise<T> {
  const isNative = Capacitor.isNativePlatform();
  const isWrite  = !['GET', 'HEAD', 'OPTIONS'].includes((options.method ?? 'GET').toUpperCase());

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  };

  if (isNative) {
    const token = await getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  } else if (isWrite) {
    // CSRF defense — see worker/src/lib/middleware.ts requireCsrfHeader().
    // Cross-site attacks can't set custom headers, so this alone blocks them.
    headers['X-Morechard-Client'] = '1';
  }

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
    // Web only: makes the browser send/receive the HttpOnly mc_token cookie.
    // Harmless to set on native too (native uses an absolute cross-origin URL
    // and doesn't rely on cookies either way).
    credentials: isNative ? 'omit' : 'include',
  });

  // D1 transient reset — retry up to twice with a short delay
  if (res.status === 503 && _retries > 0) {
    await new Promise(r => setTimeout(r, 800));
    return request<T>(path, options, _retries - 1, skip402);
  }

  const text = await res.text();
  let data: T & { error?: string };
  try {
    data = text ? JSON.parse(text) as T & { error?: string } : {} as T & { error?: string };
  } catch {
    if (!res.ok) throw new Error('Something went wrong — please try again.');
    throw new Error('Unexpected response from server. Please try again.');
  }

  // Token expired or revoked — clear the token but NOT the device identity.
  // Device identity is set during join and is independent of the JWT lifetime.
  // Clearing it would force the child through the full re-join flow (6-digit code),
  // which is wrong — only the token needs refreshing.
  if (res.status === 401 && !path.startsWith('/auth/')) {
    await clearToken();
    window.location.href = '/';
    throw new Error((data as Record<string, unknown>).error as string ?? 'Session expired');
  }

  // Trial expired — worker sends 402 with { redirect: '/paywall' }
  if (res.status === 402 && !skip402) {
    window.location.href = '/paywall';
    throw new Error('Trial expired');
  }

  // Account locked by parent — throw with a recognisable code so UI can show a lock state
  if (res.status === 423) {
    const msg = (data as Record<string, unknown>).error as string ?? 'Account temporarily restricted';
    throw Object.assign(new Error(msg), { code: 'ACCOUNT_LOCKED' });
  }

  if (!res.ok) {
    throw new Error((data as Record<string, unknown>).error as string ?? 'Something went wrong — please try again.');
  }
  return data;
}
```

**Note on the two raw-`fetch()` upload helpers** (`uploadProof` at `app/src/lib/api.ts:494-503` and `uploadReceipt` at `:1257-1266`): both call `authHeaders(file.type || ...)` synchronously today. `authHeaders` is now `async` (Step above), so both call sites need `await authHeaders(...)` instead of `authHeaders(...)`. Make this change now while editing this file:

```typescript
// app/src/lib/api.ts — uploadProof, was: headers: authHeaders(file.type || 'application/octet-stream'),
export async function uploadProof(completionId: string, file: Blob): Promise<{ proof_url: string }> {
  const res = await fetch(apiUrl(`/api/completions/${completionId}/proof`), {
    method: 'POST',
    headers: await authHeaders(file.type || 'application/octet-stream'),
    credentials: Capacitor.isNativePlatform() ? 'omit' : 'include',
    body: file,
  });
  const data = await res.json() as { proof_url?: string; error?: string };
  if (!res.ok) throw new Error(data.error ?? 'Something went wrong — please try again.');
  return { proof_url: data.proof_url ?? '' };
}
```

Apply the same two changes (`await authHeaders(...)` and the `credentials` line) to `getProofUrl` (`:506-516`) and `uploadReceipt` (`:1257-1266`).

- [ ] **Step 8: Run the app test suite**

Run: `cd app && npx vitest run`
Expected: type errors will surface anywhere else in the codebase that calls `getToken()`/`setToken()`/`clearToken()`/`authHeaders()` synchronously — these are exactly the call sites Task 7 fixes. Confirm the failures are ONLY in the files listed in Task 7's file list; if a failure appears elsewhere, investigate before proceeding (it means a call site wasn't captured by the earlier grep).

- [ ] **Step 9: Commit**

```bash
git add package.json app/src/lib/api.ts app/src/lib/authState.ts app/src/lib/authState.test.ts
git commit -m "feat(app): move native token storage to Keychain/Keystore, add authState for cookie-based web sessions"
```

---

### Task 6: App — native one-time migration + async boot gate in `App.tsx`

**Files:**
- Modify: `app/src/App.tsx:124-131` (`RequireSession`), `app/src/App.tsx:185-195` (analytics-refresh effect), plus the top-level app boot (read the full mount sequence around the app's root component in this file to place `primeAuthState()` correctly — it must run before the router's first render of a guarded route)
- Test: `app/src/App.test.tsx` if one exists (check with Glob); otherwise this task is verified manually (see Step 5) since `App.tsx`'s root mount is normally covered by Playwright, not Vitest, in this codebase.

**Interfaces:**
- Consumes: `primeAuthState`, `isAuthenticated` from Task 5 (`./lib/authState.js`).

- [ ] **Step 1: Read the current boot sequence**

Read `app/src/App.tsx` in full before editing — the exact placement of the new `checkingAuth` gate depends on how the root component currently renders `<BrowserRouter>`/`<Routes>` (not pasted here since this task's diff must be applied around the codebase's actual current structure, which the previous file reads in this session only partially covered). Locate the top-level exported component that renders the router.

- [ ] **Step 2: Add the migration + boot-gate logic**

Add this near the top of `app/src/App.tsx`, alongside the existing imports:

```typescript
import { primeAuthState } from './lib/authState'
import { Capacitor } from '@capacitor/core'
import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin'

/**
 * One-time native migration: an existing install may still have the JWT in
 * localStorage from before this change. Write it into secure storage FIRST,
 * verify the write succeeded, and only THEN delete the localStorage copy —
 * if the secure-storage write fails, leaving localStorage intact gives the
 * app another chance to migrate on the next boot instead of hard-logging
 * the user out.
 */
async function migrateNativeTokenIfNeeded(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  const legacy = localStorage.getItem('mc_token')
  if (!legacy) return
  try {
    await SecureStoragePlugin.set({ key: 'mc_token', value: legacy })
    const { value } = await SecureStoragePlugin.get({ key: 'mc_token' })
    if (value === legacy) {
      localStorage.removeItem('mc_token')
    }
    // else: write didn't verify — leave localStorage alone, retry next boot
  } catch {
    // secure storage unavailable this boot — leave localStorage alone, retry next boot
  }
}
```

In the root exported component (found in Step 1), add a `checkingAuth` state that gates the router:

```typescript
const [checkingAuth, setCheckingAuth] = useState(true)

useEffect(() => {
  migrateNativeTokenIfNeeded()
    .then(() => primeAuthState())
    .finally(() => setCheckingAuth(false))
}, [])

if (checkingAuth) {
  return <SuspenseFallback /> // existing loading component at App.tsx:133-136 — reuse it, don't add a new one
}
```

- [ ] **Step 3: Replace the synchronous token checks**

Change `RequireSession` (currently `app/src/App.tsx:124-131`):
```typescript
/** Guard dashboards — needs identity + session token, otherwise send to lock. */
function RequireSession({ children }: { children: React.ReactNode }) {
  const identity = getDeviceIdentity()
  if (!identity) return <Navigate to="/" replace />
  if (!isAuthenticated()) return <Navigate to="/lock" replace />
  return <>{children}</>
}
```

(add `import { isAuthenticated } from './lib/authState'` to the same import you added in Step 2 — combine into one import line: `import { primeAuthState, isAuthenticated } from './lib/authState'`)

Change the analytics-refresh effect (currently `app/src/App.tsx:185-195`):
```typescript
  // Child devices: refresh the family-effective analytics decision on boot so a
  // parent's later opt-in or veto propagates (events only — replay stays off).
  useEffect(() => {
    const id = getDeviceIdentity()
    if (id?.role !== 'child' || !isAuthenticated()) return
    import('./lib/api').then(({ getAnalyticsEffective }) =>
      getAnalyticsEffective()
        .then(({ child_analytics }) => applyInheritedChildConsent(child_analytics))
        .catch(() => null)
    )
  }, [])
```

- [ ] **Step 4: Run the app test suite**

Run: `cd app && npx vitest run`
Expected: PASS

- [ ] **Step 5: Manual verification (native — documented, not automatable in CI)**

Per the existing outstanding "Android App Links on-device verification" section in `CLAUDE.md`, this needs a real emulator/device:
1. Build a debug APK with the OLD code (pre-migration) that writes a token to `localStorage['mc_token']`, install it, confirm login works.
2. Update to the new build, relaunch, confirm: (a) no flash of the Landing screen before the authenticated route renders, (b) `adb shell run-as com.morechard.app cat /data/data/com.morechard.app/shared_prefs/*.xml` (or equivalent secure-storage inspection) shows the token migrated, (c) the old `localStorage` key is gone.
3. Force a secure-storage write failure (e.g. temporarily revoke Keystore access via `adb shell` if feasible, or mock `SecureStoragePlugin.set` to reject in a debug build) and confirm the app does NOT log the user out — `localStorage['mc_token']` should still be present, and migration retries next boot.

- [ ] **Step 6: Commit**

```bash
git add app/src/App.tsx
git commit -m "feat(app): async boot gate priming auth state + one-time native token migration"
```

---

### Task 7: App — update remaining call sites to the new auth abstraction

**Files:**
- Modify: `app/src/screens/LandingScreen.tsx:78-84`
- Modify: `app/src/screens/LockScreen.tsx:20,41,63` (imports, `tokenMissingOnMount`, `setToken` call)
- Modify: `app/src/screens/JoinFamilyScreen.tsx:188-190`
- Modify: `app/src/screens/AuthCallbackScreen.tsx:4,41`
- Modify: `app/src/screens/ParentDashboard.tsx:4` (import) and its `clearToken()` call site (search this file for `clearToken(` to find the exact call)
- Modify: `app/src/components/settings/sections/ActiveSessionsSettings.tsx:59-65` (`getCurrentJti`)
- Modify: `app/src/components/settings/sections/ProfileSettings.tsx:13,133-139` (`wipeLsAndRedirect`)
- Modify: `app/src/components/registration/RegistrationShell.tsx:193` and its call site
- Modify: `app/src/components/demo/DemoRegisterScreen.tsx:12,54`
- Modify: `app/src/components/demo/DemoUpsellCard.tsx:9,42`
- Modify: `app/src/lib/deviceIdentity.ts:65-68` (`clearDeviceIdentity`)

**Interfaces:**
- Consumes: `isAuthenticated`, `getRole` from Task 5 (`../lib/authState.js` or `./lib/authState.js` depending on file location); `getToken`, `setToken`, `clearToken` (now async) from `../lib/api.js`.

- [ ] **Step 1: `LandingScreen.tsx` — replace the localStorage read**

Current (`app/src/screens/LandingScreen.tsx:78-84`):
```typescript
  function handleTileClick(tile: Tile) {
    const token = localStorage.getItem('mc_token')

    if (!token) {
      navigate('/signup')
      return
    }
```
Change to:
```typescript
  function handleTileClick(tile: Tile) {
    if (!isAuthenticated()) {
      navigate('/signup')
      return
    }
```
Add `import { isAuthenticated } from '../lib/authState'` near this file's other imports.

- [ ] **Step 2: `LockScreen.tsx` — async `setToken`, replace the sync mount check**

Current (`app/src/screens/LockScreen.tsx:41`):
```typescript
  const [tokenMissingOnMount] = useState(() => !localStorage.getItem('mc_token'))
```
Change to:
```typescript
  const [tokenMissingOnMount] = useState(() => !isAuthenticated())
```
Add `isAuthenticated` to the existing `authState` import (add a new import line: `import { isAuthenticated } from '@/lib/authState'`).

Current (`app/src/screens/LockScreen.tsx:62-63`):
```typescript
          const result = await childLogin(identity.family_id, identity.user_id, rawPin)
          setToken(result.token)
```
Change to:
```typescript
          const result = await childLogin(identity.family_id, identity.user_id, rawPin)
          await setToken(result.token)
```

- [ ] **Step 3: `JoinFamilyScreen.tsx` — use `setToken` instead of a direct localStorage write**

Current (`app/src/screens/JoinFamilyScreen.tsx:188-190`):
```typescript
      const data = await res.json() as RedeemResponse
      localStorage.setItem('mc_token', data.token)
      setRedeemedData({ ...data, display_name: name })
```
Change to:
```typescript
      const data = await res.json() as RedeemResponse
      await setToken(data.token)
      setRedeemedData({ ...data, display_name: name })
```
Add `setToken` to this file's existing `../lib/api` (or `@/lib/api`) import — check the file's current import line for `api.js` exports and add `setToken` to it if not already imported.

- [ ] **Step 4: `AuthCallbackScreen.tsx` — await `setToken`**

Current (`app/src/screens/AuthCallbackScreen.tsx:41`):
```typescript
        setToken(result.token)
```
Change to:
```typescript
        await setToken(result.token)
```
This is inside a `.then(result => { ... })` callback per the earlier grep (`AuthCallbackScreen.tsx:40-41`) — change that callback to `async (result) => { ... }` so `await` is valid, or switch the surrounding `exchangeSlt(slt).then(...)` chain to an `async` IIFE/function if the enclosing scope isn't already async. Read the full function around lines 20-60 of this file before editing to confirm the correct minimal change (don't restructure beyond making `await` valid).

- [ ] **Step 5: `ParentDashboard.tsx` — await `clearToken`**

`clearToken` is imported at `app/src/screens/ParentDashboard.tsx:4`. Find its call site in this file (grep `clearToken(` within `ParentDashboard.tsx`) and prefix it with `await`, making the enclosing function `async` if it isn't already.

- [ ] **Step 6: `ActiveSessionsSettings.tsx` — replace the direct-decode localStorage read**

Current (`app/src/components/settings/sections/ActiveSessionsSettings.tsx:59-65`):
```typescript
function getCurrentJti(): string | null {
  try {
    const token = localStorage.getItem('mc_token')
    if (!token) return null
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.jti ?? null
  } catch {
    return null
  }
}
```
Change to an async function backed by `getToken()` (native) — on web, there is no client-readable way to get the current `jti` from an HttpOnly cookie, so this becomes native-only; the "this is your current session" highlighting in the sessions list degrades gracefully to "unknown" on web (acceptable — it's a cosmetic highlight, not a security control; `handleRevokeOtherSessions` on the server already correctly excludes the caller's own `jti` regardless of what the client highlights):
```typescript
async function getCurrentJti(): Promise<string | null> {
  try {
    const token = await getToken() // null on web — HttpOnly cookie, not decodable client-side
    if (!token) return null
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.jti ?? null
  } catch {
    return null
  }
}
```
Add `import { getToken } from '../../../lib/api'` (match this file's existing relative import depth). Update this function's call site(s) in the same file to `await getCurrentJti()` inside an async context (read the surrounding component to find where it's called and adjust).

- [ ] **Step 7: `ProfileSettings.tsx` — await `clearToken`**

Current (`app/src/components/settings/sections/ProfileSettings.tsx:133-139`):
```typescript
  function wipeLsAndRedirect() {
    clearDeviceIdentity()
    localStorage.removeItem('mc_parent_tab')
    localStorage.removeItem('mc_parent_avatar')
    clearToken()
    window.location.replace('/')
  }
```
Change to:
```typescript
  async function wipeLsAndRedirect() {
    clearDeviceIdentity()
    localStorage.removeItem('mc_parent_tab')
    localStorage.removeItem('mc_parent_avatar')
    await clearToken()
    window.location.replace('/')
  }
```
Update this function's call site(s) in the same file to `await wipeLsAndRedirect()` (or leave un-awaited if the call site is itself about to navigate away regardless — `window.location.replace` already halts further JS execution, so a fire-and-forget call is acceptable here specifically; read the call site to confirm before deciding).

- [ ] **Step 8: `RegistrationShell.tsx` — replace the direct localStorage read**

Current (`app/src/components/registration/RegistrationShell.tsx:193`):
```typescript
      localStorage.getItem('mc_token')!,
```
This is an argument inside a call to `onComplete(...)` (per the earlier grep context, lines 190-197). Change to use `getToken()`:
```typescript
      await getToken(),
```
This requires the enclosing function (`handleNudgeDismiss` per the grep) to be `async`, and `onComplete`'s parameter type to accept `string | null` instead of a non-null-asserted `string` — read this component's `onComplete` prop type definition and adjust the type if it currently requires a non-null `string` (the non-null assertion `!` in the original code was already unsafe — a corrupted/missing token would have silently passed `undefined` at runtime; making the type honestly `string | null` here is a correctness improvement, not scope creep, since the async rewrite forces touching this line regardless).

- [ ] **Step 9: `DemoRegisterScreen.tsx` and `DemoUpsellCard.tsx` — await `setToken`**

Current (`app/src/components/demo/DemoRegisterScreen.tsx:54`):
```typescript
      setToken(data.token!)
```
Change to:
```typescript
      await setToken(data.token!)
```
(confirm the enclosing function is already `async` — per the grep context at lines 48-54, it's inside a `try` block after an `await res.json()`, so it already is.)

Current (`app/src/components/demo/DemoUpsellCard.tsx:42`):
```typescript
      setToken(data.token!)
```
Change to:
```typescript
      await setToken(data.token!)
```
(same — already inside an async function per the surrounding `await res.json()` on the preceding line.)

- [ ] **Step 10: `deviceIdentity.ts` — stop reaching into `mc_token` directly**

Current (`app/src/lib/deviceIdentity.ts:65-68`):
```typescript
export function clearDeviceIdentity(): void {
  localStorage.removeItem(STORAGE_KEY)
  localStorage.removeItem('mc_token')
}
```
`deviceIdentity.ts` has no existing dependency on `api.ts` (importing it would create a circular-ish coupling between two low-level lib modules for a single line). Instead, since `clearToken()` is now async and native-only, and every current caller of `clearDeviceIdentity()` (`ProfileSettings.tsx`'s `wipeLsAndRedirect`, `LockScreen.tsx`) already separately calls `clearToken()` right alongside it (confirmed: `ProfileSettings.tsx:134,137` calls both in the same function), simply remove the redundant native-incompatible line:
```typescript
export function clearDeviceIdentity(): void {
  localStorage.removeItem(STORAGE_KEY)
  // mc_token is no longer read here — callers already call clearToken()
  // separately (it's now async and platform-aware; see lib/api.ts).
}
```
Before making this change, grep the codebase for every call site of `clearDeviceIdentity()` and confirm each one also calls `clearToken()` nearby — if any caller does NOT, add a `clearToken()` call there instead of removing this line silently.

- [ ] **Step 11: Run the full app test suite and typecheck**

Run: `cd app && npx tsc -b --noEmit && npx vitest run`
Expected: PASS, zero TypeScript errors. This is the checkpoint that confirms every call site from the Task 5 Step 8 grep was actually fixed.

- [ ] **Step 12: Commit**

```bash
git add app/src/screens/LandingScreen.tsx app/src/screens/LockScreen.tsx app/src/screens/JoinFamilyScreen.tsx app/src/screens/AuthCallbackScreen.tsx app/src/screens/ParentDashboard.tsx app/src/components/settings/sections/ActiveSessionsSettings.tsx app/src/components/settings/sections/ProfileSettings.tsx app/src/components/registration/RegistrationShell.tsx app/src/components/demo/DemoRegisterScreen.tsx app/src/components/demo/DemoUpsellCard.tsx app/src/lib/deviceIdentity.ts
git commit -m "refactor(app): route all token read/write call sites through the async, platform-aware api.ts helpers"
```

---

### Task 8: Playwright web verification — cookie login + CSRF enforcement

**Files:**
- Create or extend: `app/e2e/auth-cookie.spec.ts` (check `Glob app/e2e/*.spec.ts` first for the existing Playwright config/pattern to match — this repo already has Playwright-verified flows per the prior encrypted-bank-vault audit pass, so mirror that file's setup rather than introducing a new config)

**Interfaces:**
- Consumes: a running local worker (`morechard-dev`, per `CLAUDE.md`'s `npm run dev`) and the built/served app.

- [ ] **Step 1: Write the test**

```typescript
// app/e2e/auth-cookie.spec.ts
import { test, expect } from '@playwright/test';

test('web login sets an HttpOnly cookie and subsequent authenticated requests succeed', async ({ page, context }) => {
  await page.goto('/');
  // ... drive the existing magic-link or demo-login flow used by this repo's
  // other Playwright specs (match the pattern in the existing bank-vault
  // Playwright spec for how this codebase logs in a test user headlessly).

  const cookies = await context.cookies();
  const authCookie = cookies.find(c => c.name === 'mc_token');
  expect(authCookie?.httpOnly).toBe(true);
  const marker = cookies.find(c => c.name === 'mc_session');
  expect(marker?.httpOnly).toBe(false);

  // A same-origin fetch from the page (which automatically gets the
  // X-Morechard-Client header + credentials via api.ts) should succeed.
  const ok = await page.evaluate(async () => {
    const res = await fetch('/api/family', { credentials: 'include' });
    return res.status;
  });
  expect(ok).toBe(200);
});

test('a cross-site-style POST without the CSRF header is rejected', async ({ page }) => {
  await page.goto('/'); // assumes the previous test's login state or its own login helper
  const status = await page.evaluate(async () => {
    // Deliberately omit X-Morechard-Client to simulate a forged cross-site request.
    const res = await fetch('/api/goals', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'test' }),
    });
    return res.status;
  });
  expect(status).toBe(403);
});
```

- [ ] **Step 2: Run it**

Run: `cd app && npx playwright test e2e/auth-cookie.spec.ts`
Expected: PASS (2 tests). Requires the worker dev server running per `CLAUDE.md`'s `npm run dev` — do not point this at production.

- [ ] **Step 3: Commit**

```bash
git add app/e2e/auth-cookie.spec.ts
git commit -m "test(app): Playwright coverage for HttpOnly cookie login + CSRF header enforcement"
```

---

### Task 9: Final full-suite verification

- [ ] **Step 1: Worker**

Run: `cd worker && npx tsc --noEmit && npm test`
Expected: zero TypeScript errors, full suite green.

- [ ] **Step 2: App**

Run: `cd app && npx tsc -b --noEmit && npx vitest run`
Expected: zero TypeScript errors, full suite green.

- [ ] **Step 3: Update the roadmap**

Per `CLAUDE.md`'s standing instruction ("update this list after every successful implementation"), add a line under Phase 8 or wherever security follow-ups are tracked noting: JWT cookie migration (web) + native secure storage shipped, referencing this plan and the design spec at `docs/superpowers/specs/2026-07-15-jwt-cookie-migration-design.md`. Also update `docs/security/audits/2026-07-15-production-security-audit.md`'s "still open" list (item 2 from the handoff doc) to closed.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md docs/security/audits/2026-07-15-production-security-audit.md
git commit -m "docs: mark JWT cookie migration + native secure storage as shipped"
```
