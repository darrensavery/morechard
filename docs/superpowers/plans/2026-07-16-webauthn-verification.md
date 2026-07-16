# WebAuthn Server-Side Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the client-side-only biometric check in `app/src/lib/biometrics.ts` with real, server-verified WebAuthn (web) and native-keypair (Capacitor) authentication that both unlocks the device and (re)issues a real login session.

**Architecture:** One D1 table (`webauthn_credentials`) storing public keys for two ceremonies — real WebAuthn via `@simplewebauthn/server`/`@simplewebauthn/browser` on web, and a Web-Crypto ECDSA key pair persisted in IndexedDB and gated by a native biometric prompt (`@aparajita/capacitor-biometric-auth`) on the Capacitor app. Four new worker endpoints (`register/options`, `register/verify`, `login/options`, `login/verify`) reuse the existing `issueParentJwt`/session-issuing machinery from the JWT cookie migration, so a successful verification always leaves the device with a valid cookie/token, not just a "yes, still you" flag. Challenges are short-lived KV entries, not a new table.

**Tech Stack:** Cloudflare Workers + D1 + KV, `@simplewebauthn/server` (worker), `@simplewebauthn/browser` + `@aparajita/capacitor-biometric-auth` (app), Vitest.

## Global Constraints

These come from the design spec (`docs/superpowers/specs/2026-07-16-webauthn-verification-design.md`) — every task below implicitly includes them:

- Covers **both parent and child** accounts — no role-based feature gating.
- Every successful verification (web or native) **both unlocks the device and issues a real session** (cookie on web, Bearer token via `setToken()` on native) — there is no separate "just prove it's you, don't touch the session" mode.
- **No migration UX** — pre-launch, no live users. Any pre-existing `mc_biometric_id`-only client state is silently treated as "never registered."
- All stored `credential_id` and `public_key` values are **base64url, no padding** — one shared encode/decode helper used by both ceremonies.
- Web-path signature-counter regression must be **rejected (401) and logged to Sentry** with `fingerprint: ['webauthn-clone-detected', credentialId]`, matching the existing `stripe-payment-failure` pattern in `worker/src/routes/stripe.ts`.
- Native path has **no clone-detection signal** — accepted, documented limitation (no attestation/counter concept for a raw ECDSA key).
- All 5 existing exported functions in `app/src/lib/biometrics.ts` (`isBiometricsAvailable`, `registerBiometrics`, `challengeBiometrics`, `hasBiometricCredential`, `clearBiometricCredential`) **keep their exact current signatures** — their internals are rewritten, but zero changes are needed at any of their 5 call sites (`Stage3SecureApp.tsx`, `JoinFamilyScreen.tsx`, `PinManagementSettings.tsx`, `useGatekeeper.tsx`, `LockScreen.tsx`). This is a deliberate implementation choice made during planning (not itself a spec change) to minimize risk — do not "helpfully" refactor those call sites.
- **No live device/browser verification is possible in this environment** (`wrangler dev --remote` 503s here; no iOS/Android device or emulator attached) — every task ships verified by unit tests + code review only. Real end-to-end verification happens on real hardware afterward.

---

### Task 1: D1 migration — `webauthn_credentials` table

**Files:**
- Create: `worker/migrations/0087_webauthn_credentials.sql`

**Interfaces:**
- Produces: the `webauthn_credentials` table that every later task reads/writes — columns `id, user_id, role, credential_id, public_key, type, counter, device_label, created_at, last_used_at`.

- [ ] **Step 1: Write the migration file**

```sql
-- Migration 0087: WebAuthn credentials
--
-- Stores server-verified WebAuthn (web, type='webauthn') and native ECDSA
-- (Capacitor app, type='native-ecdsa') public keys for real biometric/
-- passkey login + device-unlock verification. Replaces the previous
-- client-side-only check in app/src/lib/biometrics.ts, which only stored a
-- credential ID and never verified a signature.
--
-- See docs/superpowers/specs/2026-07-16-webauthn-verification-design.md

CREATE TABLE webauthn_credentials (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id),
  role          TEXT NOT NULL CHECK (role IN ('parent', 'child')),
  credential_id TEXT NOT NULL UNIQUE,
  public_key    TEXT NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('webauthn', 'native-ecdsa')),
  counter       INTEGER NOT NULL DEFAULT 0,
  device_label  TEXT,
  created_at    INTEGER NOT NULL,
  last_used_at  INTEGER
);

CREATE INDEX idx_webauthn_credentials_user ON webauthn_credentials(user_id);
```

- [ ] **Step 2: Apply to the dev database (never `--local`, per CLAUDE.md)**

Run: `cd worker && npx wrangler d1 migrations apply morechard-dev --remote`
Expected: output lists `0087_webauthn_credentials.sql` as applied, no errors.

- [ ] **Step 3: Verify the table exists**

Run: `cd worker && npx wrangler d1 execute morechard-dev --remote --command="SELECT sql FROM sqlite_master WHERE name = 'webauthn_credentials'"`
Expected: prints the `CREATE TABLE` statement back.

- [ ] **Step 4: Commit**

```bash
git add worker/migrations/0087_webauthn_credentials.sql
git commit -m "feat(worker): add webauthn_credentials D1 table"
```

**Note for a later task:** production migration application (`npx wrangler d1 migrations apply morechard --remote --env production`) is deliberately deferred to Task 10, after every other task has shipped and the full feature is verified — never apply a migration for a half-built feature to the live database.

---

### Task 2: Worker — pure WebAuthn helpers (encoding, native crypto, KV challenges)

**Files:**
- Create: `worker/src/lib/webauthn.ts`
- Test: `worker/src/lib/webauthn.test.ts`

**Interfaces:**
- Consumes: `Env` type from `../types.js` (for `env.CACHE: KVNamespace`).
- Produces (used by Tasks 4 and 5):
  - `toBase64Url(input: ArrayBuffer | Uint8Array): string`
  - `fromBase64Url(input: string): Uint8Array`
  - `deriveNativeCredentialId(publicKeyB64Url: string): Promise<string>`
  - `verifyNativeSignature(publicKeyB64Url: string, signatureB64Url: string, challengeB64Url: string): Promise<boolean>`
  - `storeChallenge(env: Env, userId: string, challenge: string): Promise<void>`
  - `consumeChallenge(env: Env, userId: string): Promise<string | null>`

- [ ] **Step 1: Write the failing tests**

```typescript
// worker/src/lib/webauthn.test.ts
import { describe, it, expect } from 'vitest';
import {
  toBase64Url, fromBase64Url, deriveNativeCredentialId, verifyNativeSignature,
  storeChallenge, consumeChallenge,
} from './webauthn.js';
import type { Env } from '../types.js';

function makeMockKV() {
  const store = new Map<string, string>();
  return {
    async get(key: string) { return store.get(key) ?? null; },
    async put(key: string, value: string) { store.set(key, value); },
    async delete(key: string) { store.delete(key); },
  } as unknown as KVNamespace;
}

describe('base64url encode/decode', () => {
  it('round-trips arbitrary bytes without padding characters', () => {
    const bytes = crypto.getRandomValues(new Uint8Array(37)); // odd length forces padding in plain base64
    const encoded = toBase64Url(bytes);
    expect(encoded).not.toMatch(/[+/=]/);
    const decoded = fromBase64Url(encoded);
    expect(Array.from(decoded)).toEqual(Array.from(bytes));
  });
});

describe('deriveNativeCredentialId', () => {
  it('is deterministic for the same public key', async () => {
    const key = toBase64Url(crypto.getRandomValues(new Uint8Array(65)));
    const id1 = await deriveNativeCredentialId(key);
    const id2 = await deriveNativeCredentialId(key);
    expect(id1).toBe(id2);
    expect(id1).not.toMatch(/[+/=]/);
  });

  it('differs for different public keys', async () => {
    const keyA = toBase64Url(crypto.getRandomValues(new Uint8Array(65)));
    const keyB = toBase64Url(crypto.getRandomValues(new Uint8Array(65)));
    expect(await deriveNativeCredentialId(keyA)).not.toBe(await deriveNativeCredentialId(keyB));
  });
});

describe('verifyNativeSignature — real ECDSA round trip', () => {
  it('accepts a genuine signature over the challenge', async () => {
    const keyPair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const spki = await crypto.subtle.exportKey('spki', keyPair.publicKey);
    const publicKeyB64Url = toBase64Url(spki);

    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const challengeB64Url = toBase64Url(challenge);

    const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, keyPair.privateKey, challenge);
    const signatureB64Url = toBase64Url(signature);

    const valid = await verifyNativeSignature(publicKeyB64Url, signatureB64Url, challengeB64Url);
    expect(valid).toBe(true);
  });

  it('rejects a signature over a different challenge (catches client/server format mismatch too)', async () => {
    const keyPair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const spki = await crypto.subtle.exportKey('spki', keyPair.publicKey);
    const publicKeyB64Url = toBase64Url(spki);

    const realChallenge = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
    const otherChallenge = crypto.getRandomValues(new Uint8Array(32));
    const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, keyPair.privateKey, otherChallenge);
    const signatureB64Url = toBase64Url(signature);

    const valid = await verifyNativeSignature(publicKeyB64Url, signatureB64Url, realChallenge);
    expect(valid).toBe(false);
  });

  it('returns false (not a throw) for garbage input', async () => {
    const valid = await verifyNativeSignature('not-a-real-key', 'not-a-real-signature', 'not-a-real-challenge');
    expect(valid).toBe(false);
  });
});

describe('challenge KV storage', () => {
  it('stores then consumes a challenge exactly once', async () => {
    const env = { CACHE: makeMockKV() } as unknown as Env;
    await storeChallenge(env, 'user_1', 'abc123');
    expect(await consumeChallenge(env, 'user_1')).toBe('abc123');
    expect(await consumeChallenge(env, 'user_1')).toBe(null); // one-time use
  });

  it('returns null for a user with no stored challenge', async () => {
    const env = { CACHE: makeMockKV() } as unknown as Env;
    expect(await consumeChallenge(env, 'nobody')).toBe(null);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd worker && npx vitest run src/lib/webauthn.test.ts`
Expected: FAIL — `Cannot find module './webauthn.js'`.

- [ ] **Step 3: Write the implementation**

```typescript
// worker/src/lib/webauthn.ts
import type { Env } from '../types.js';

const CHALLENGE_TTL_SECONDS = 120;

/** Encodes bytes as base64url (RFC 4648 §5), no padding. */
export function toBase64Url(input: ArrayBuffer | Uint8Array): string {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Decodes a base64url (unpadded) string back to raw bytes. */
export function fromBase64Url(input: string): Uint8Array {
  const padded = input + '='.repeat((4 - (input.length % 4)) % 4);
  const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Native credentials have no attestation ceremony to hand us a credential
 * ID, so we derive one deterministically from the public key itself
 * (SHA-256 of the raw SPKI bytes, base64url-encoded). Deterministic so
 * re-registering the same key pair can't create a duplicate row — the
 * `UNIQUE` constraint on `webauthn_credentials.credential_id` catches that.
 */
export async function deriveNativeCredentialId(publicKeyB64Url: string): Promise<string> {
  const bytes = fromBase64Url(publicKeyB64Url);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return toBase64Url(digest);
}

/**
 * Verifies a raw ECDSA P-256/SHA-256 signature against a stored SPKI public
 * key. This is the native-app path — there's no WebAuthn attestation object
 * here, just "did this exact key sign this exact challenge." Returns false
 * (never throws) on any malformed input, so callers can treat it as a plain
 * boolean check.
 */
export async function verifyNativeSignature(
  publicKeyB64Url: string,
  signatureB64Url: string,
  challengeB64Url: string,
): Promise<boolean> {
  try {
    const publicKey = await crypto.subtle.importKey(
      'spki',
      fromBase64Url(publicKeyB64Url),
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    );
    return await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      publicKey,
      fromBase64Url(signatureB64Url),
      fromBase64Url(challengeB64Url),
    );
  } catch {
    return false;
  }
}

/**
 * One-time, short-lived challenge storage in KV (not a new D1 table — no
 * cleanup cron needed, KV expires these for free). Keyed per-user, so a
 * user can only have one outstanding registration/login challenge at a
 * time — a second `storeChallenge` call for the same user overwrites the
 * first, which is fine (only one ceremony should be in flight per user).
 */
export async function storeChallenge(env: Env, userId: string, challenge: string): Promise<void> {
  await env.CACHE.put(`webauthn:challenge:${userId}`, challenge, { expirationTtl: CHALLENGE_TTL_SECONDS });
}

/** Reads and deletes the stored challenge in one call — one-time use. */
export async function consumeChallenge(env: Env, userId: string): Promise<string | null> {
  const key = `webauthn:challenge:${userId}`;
  const challenge = await env.CACHE.get(key);
  if (!challenge) return null;
  await env.CACHE.delete(key);
  return challenge;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd worker && npx vitest run src/lib/webauthn.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add worker/src/lib/webauthn.ts worker/src/lib/webauthn.test.ts
git commit -m "feat(worker): base64url, native ECDSA verify, and KV challenge helpers for WebAuthn"
```

---

### Task 3: Worker — extract `issueChildJwt`, export `issueParentJwt`

**Why this task exists:** the WebAuthn login/verify handler (Task 5) needs to issue a real session on success, for both parent and child accounts, using the exact same cookie-setting code every other login route uses. `issueParentJwt` already does this for parents but is a private (non-exported) function in `auth.ts`. There is no equivalent for children — `handleChildLogin` has the session-issuing logic inlined together with PIN-specific bookkeeping (a `child_logins` history row + ORCHARD→CLEAN "graduation" detection) that a WebAuthn login should **not** duplicate — a WebAuthn login is not a PIN attempt.

**Files:**
- Modify: `worker/src/routes/auth.ts:1616-1631` (make `issueParentJwt` exported), `:497-576` (`handleChildLogin`, extract the session-issuing part)
- Test: `worker/src/routes/auth.test.ts` (existing test must still pass unmodified)

**Interfaces:**
- Produces (used by Task 5): `export async function issueParentJwt(userId: string, familyId: string, request: Request, env: Env): Promise<Response>` (signature unchanged, now exported), `export async function issueChildJwt(childId: string, familyId: string, request: Request, env: Env): Promise<Response>` (new).

- [ ] **Step 1: Read the current `handleChildLogin` tail to confirm nothing has drifted**

Run: `cd worker && grep -n "async function handleChildLogin" -A 120 src/routes/auth.ts | tail -50`
Expected: matches the code shown in Step 3 below (lines ~540-576) — if it doesn't match, stop and re-read the file before proceeding; the diff in Step 3 assumes this exact starting shape.

- [ ] **Step 2: Export `issueParentJwt`**

In `worker/src/routes/auth.ts`, change:
```ts
async function issueParentJwt(userId: string, familyId: string, request: Request, env: Env): Promise<Response> {
```
to:
```ts
export async function issueParentJwt(userId: string, familyId: string, request: Request, env: Env): Promise<Response> {
```
(No other change to this function — it's already exactly what Task 5's parent login path needs.)

- [ ] **Step 3: Extract `createChildSession` + `issueChildJwt`, refactor `handleChildLogin`**

Replace this block in `handleChildLogin` (the part after `clearPinLockout` and the app_view/graduation lookups, i.e. everything from `const ip  = clientIp(request);` through the final `return response;`):

```ts
  const ip  = clientIp(request);
  const jti = nanoid();

  const ua = request.headers.get('User-Agent') ?? null;

  await env.DB.batch([
    env.DB
      .prepare(`INSERT INTO sessions (jti, user_id, family_id, role, issued_at, expires_at, ip_address, user_agent)
                VALUES (?,?,?,'child',?,?,?,?)`)
      .bind(jti, user.id, family_id, now, now + CHILD_JWT_EXPIRY, ip, ua),
    env.DB
      .prepare(`INSERT INTO child_logins (child_id, logged_at, ip_address, user_agent, session_jti, app_view)
                VALUES (?,?,?,?,?,?)`)
      .bind(user.id, now, ip, ua, jti, appView),
  ]);

  const token = await signJwt(
    { sub: user.id, jti, family_id, role: 'child', iat: now, exp: now + CHILD_JWT_EXPIRY },
    env.JWT_SECRET,
  );

  const response = json({ token, expires_in: CHILD_JWT_EXPIRY, graduation_pending: graduationPending });
  setAuthCookie(response.headers, token, CHILD_JWT_EXPIRY);
  setSessionMarkerCookie(response.headers, 'child', CHILD_JWT_EXPIRY);
  return response;
}
```

with:

```ts
  const { token, jti, ip, userAgent } = await createChildSession(user.id, family_id, request, env);

  await env.DB
    .prepare(`INSERT INTO child_logins (child_id, logged_at, ip_address, user_agent, session_jti, app_view)
              VALUES (?,?,?,?,?,?)`)
    .bind(user.id, now, ip, userAgent, jti, appView)
    .run();

  const response = json({ token, expires_in: CHILD_JWT_EXPIRY, graduation_pending: graduationPending });
  setAuthCookie(response.headers, token, CHILD_JWT_EXPIRY);
  setSessionMarkerCookie(response.headers, 'child', CHILD_JWT_EXPIRY);
  return response;
}

/**
 * Inserts the `sessions` row and signs the JWT for a child login — shared
 * by `handleChildLogin` (PIN) and the WebAuthn login/verify handler
 * (Task 5). Does NOT touch `child_logins`/graduation detection — that
 * bookkeeping is specific to the PIN login-history feature, not part of
 * session issuance itself.
 */
async function createChildSession(
  childId: string,
  familyId: string,
  request: Request,
  env: Env,
): Promise<{ token: string; jti: string; ip: string; userAgent: string | null }> {
  const ip  = clientIp(request);
  const now = Math.floor(Date.now() / 1000);
  const jti = nanoid();
  const userAgent = request.headers.get('User-Agent') ?? null;

  await env.DB
    .prepare(`INSERT INTO sessions (jti, user_id, family_id, role, issued_at, expires_at, ip_address, user_agent)
              VALUES (?,?,?,'child',?,?,?,?)`)
    .bind(jti, childId, familyId, now, now + CHILD_JWT_EXPIRY, ip, userAgent)
    .run();

  const token = await signJwt(
    { sub: childId, jti, family_id: familyId, role: 'child', iat: now, exp: now + CHILD_JWT_EXPIRY },
    env.JWT_SECRET,
  );

  return { token, jti, ip, userAgent };
}

/**
 * Issues a full child session (cookie + marker cookie) for a non-PIN login
 * path (currently: WebAuthn). Mirrors `issueParentJwt`'s shape exactly —
 * no `child_logins`/graduation bookkeeping, that's PIN-specific.
 */
export async function issueChildJwt(
  childId: string,
  familyId: string,
  request: Request,
  env: Env,
): Promise<Response> {
  const { token } = await createChildSession(childId, familyId, request, env);
  const response = json({ token, expires_in: CHILD_JWT_EXPIRY });
  setAuthCookie(response.headers, token, CHILD_JWT_EXPIRY);
  setSessionMarkerCookie(response.headers, 'child', CHILD_JWT_EXPIRY);
  return response;
}
```

Note the accepted behavior change: this replaces one atomic `env.DB.batch([...])` (two inserts in one call) with two sequential single-row inserts. At this app's login volume this is not a meaningful risk, and it's what lets `createChildSession` be reused standalone without also always writing a `child_logins` row.

- [ ] **Step 4: Run the existing test to confirm it still passes unmodified**

Run: `cd worker && npx vitest run src/routes/auth.test.ts`
Expected: PASS — `handleChildLogin cookie issuance` still sets both cookies correctly. (The mock DB's `run`/`batch` stubs already tolerate this change — `batch` is simply no longer called, `run` is called twice instead of once via `.batch()`.)

- [ ] **Step 5: Run the full worker suite to catch any other `issueParentJwt`/`handleChildLogin` caller affected by the export/refactor**

Run: `cd worker && npx tsc --noEmit && npm test`
Expected: zero TypeScript errors, all tests passing (343+ — the exact count may have grown from Task 2's new file).

- [ ] **Step 6: Commit**

```bash
git add worker/src/routes/auth.ts
git commit -m "refactor(worker): export issueParentJwt, extract issueChildJwt for reuse by WebAuthn login"
```

---

### Task 4: Worker — WebAuthn registration endpoints

**Files:**
- Modify: `worker/package.json` (add `@simplewebauthn/server`)
- Create: `worker/src/routes/webauthn.ts`
- Test: `worker/src/routes/webauthn.test.ts`

**Interfaces:**
- Consumes: `toBase64Url`, `fromBase64Url`, `deriveNativeCredentialId`, `storeChallenge`, `consumeChallenge` from `../lib/webauthn.js` (Task 2); `resolveReturnOrigin` from `../lib/appUrl.js`; `nanoid` from `../lib/nanoid.js`; `json`, `error`, `parseBody` from `../lib/response.js`; `parseValidatedBody` from `../lib/validate.js`; `JwtPayload` type from `../lib/jwt.js`.
- Produces (used by Task 5 in the same file, and Task 6 for wiring): `export async function handleWebauthnRegisterOptions(request: Request, env: Env): Promise<Response>`, `export async function handleWebauthnRegisterVerify(request: Request, env: Env): Promise<Response>` — both expect `(request as AuthedRequest).auth` to already be set (called via `withAuth`, same as every other authenticated route in `index.ts`).

- [ ] **Step 1: Install the dependency**

Run: `cd worker && npm install @simplewebauthn/server@^13.3.2`
Expected: adds to `worker/package.json` `dependencies` and `package-lock.json`.

- [ ] **Step 2: Write the failing tests**

```typescript
// worker/src/routes/webauthn.test.ts
import { describe, it, expect, vi } from 'vitest';
import { handleWebauthnRegisterOptions, handleWebauthnRegisterVerify } from './webauthn.js';
import type { Env } from '../types.js';
import type { JwtPayload } from '../lib/jwt.js';
import { toBase64Url } from '../lib/webauthn.js';

type AuthedRequest = Request & { auth: JwtPayload };

function makeAuth(overrides: Partial<JwtPayload> = {}): JwtPayload {
  return { sub: 'user_1', jti: 'jti_1', family_id: 'fam_1', role: 'parent', iat: 0, exp: 9999999999, ...overrides };
}

function makeAuthedRequest(url: string, body: unknown, auth: JwtPayload): AuthedRequest {
  const req = new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://app.morechard.com' },
    body: JSON.stringify(body),
  }) as AuthedRequest;
  req.auth = auth;
  return req;
}

function makeMockKV() {
  const store = new Map<string, string>();
  return {
    async get(key: string) { return store.get(key) ?? null; },
    async put(key: string, value: string) { store.set(key, value); },
    async delete(key: string) { store.delete(key); },
  } as unknown as KVNamespace;
}

function makeMockDb(existingCredentials: Array<{ credential_id: string }> = []) {
  const inserted: Array<Record<string, unknown>> = [];
  return {
    db: {
      prepare(sql: string) {
        return {
          bind(...args: unknown[]) {
            return {
              async all() {
                if (sql.includes('SELECT credential_id FROM webauthn_credentials')) {
                  return { results: existingCredentials };
                }
                return { results: [] };
              },
              async run() {
                if (sql.includes('INSERT INTO webauthn_credentials')) {
                  inserted.push({ args });
                }
                return { success: true, meta: {} };
              },
            };
          },
        };
      },
    } as unknown as D1Database,
    inserted,
  };
}

describe('handleWebauthnRegisterOptions', () => {
  it('returns a native challenge when platform=native', async () => {
    const { db } = makeMockDb();
    const env = { DB: db, CACHE: makeMockKV(), APP_URL: 'https://app.morechard.com' } as unknown as Env;
    const request = makeAuthedRequest('https://api.morechard.com/auth/webauthn/register/options', { platform: 'native' }, makeAuth());

    const res = await handleWebauthnRegisterOptions(request, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { platform: string; challenge: string };
    expect(body.platform).toBe('native');
    expect(typeof body.challenge).toBe('string');
    expect(body.challenge).not.toMatch(/[+/=]/); // base64url, no padding
  });

  it('returns WebAuthn creation options when platform=web', async () => {
    const { db } = makeMockDb();
    const env = { DB: db, CACHE: makeMockKV(), APP_URL: 'https://app.morechard.com' } as unknown as Env;
    const request = makeAuthedRequest('https://api.morechard.com/auth/webauthn/register/options', { platform: 'web' }, makeAuth());

    const res = await handleWebauthnRegisterOptions(request, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { platform: string; options: { challenge: string; rp: { id: string } } };
    expect(body.platform).toBe('web');
    expect(body.options.rp.id).toBe('app.morechard.com');
    expect(typeof body.options.challenge).toBe('string');
  });

  it('rejects an invalid platform value', async () => {
    const { db } = makeMockDb();
    const env = { DB: db, CACHE: makeMockKV(), APP_URL: 'https://app.morechard.com' } as unknown as Env;
    const request = makeAuthedRequest('https://api.morechard.com/auth/webauthn/register/options', { platform: 'carrier-pigeon' }, makeAuth());

    const res = await handleWebauthnRegisterOptions(request, env);
    expect(res.status).toBe(400);
  });
});

describe('handleWebauthnRegisterVerify — native path', () => {
  it('stores the public key and derives a stable credential_id', async () => {
    const { db, inserted } = makeMockDb();
    const env = { DB: db, CACHE: makeMockKV(), APP_URL: 'https://app.morechard.com' } as unknown as Env;
    const auth = makeAuth({ role: 'child' });

    // Pre-store a challenge the way register/options would have.
    await env.CACHE.put('webauthn:challenge:user_1', 'some-challenge');

    const publicKey = toBase64Url(crypto.getRandomValues(new Uint8Array(65)));
    const request = makeAuthedRequest(
      'https://api.morechard.com/auth/webauthn/register/verify',
      { platform: 'native', publicKey },
      auth,
    );

    const res = await handleWebauthnRegisterVerify(request, env);
    expect(res.status).toBe(200);
    expect(inserted).toHaveLength(1);
  });

  it('rejects when the challenge is missing or already used', async () => {
    const { db } = makeMockDb();
    const env = { DB: db, CACHE: makeMockKV(), APP_URL: 'https://app.morechard.com' } as unknown as Env;
    const publicKey = toBase64Url(crypto.getRandomValues(new Uint8Array(65)));
    const request = makeAuthedRequest(
      'https://api.morechard.com/auth/webauthn/register/verify',
      { platform: 'native', publicKey },
      makeAuth(),
    );

    const res = await handleWebauthnRegisterVerify(request, env);
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd worker && npx vitest run src/routes/webauthn.test.ts`
Expected: FAIL — `Cannot find module './webauthn.js'`.

- [ ] **Step 4: Write the implementation**

```typescript
// worker/src/routes/webauthn.ts
//
// Real, server-verified WebAuthn (web) and native-ECDSA-keypair (Capacitor
// app) registration + login. See
// docs/superpowers/specs/2026-07-16-webauthn-verification-design.md for
// the full design.
//
// POST /auth/webauthn/register/options  (authenticated) — start registration
// POST /auth/webauthn/register/verify   (authenticated) — finish registration
// POST /auth/webauthn/login/options     (public)         — start login
// POST /auth/webauthn/login/verify      (public)         — finish login, issues a session

import {
  generateRegistrationOptions, verifyRegistrationResponse,
  generateAuthenticationOptions, verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  RegistrationResponseJSON, AuthenticationResponseJSON,
  VerifiedRegistrationResponse, VerifiedAuthenticationResponse,
} from '@simplewebauthn/server';
import * as Sentry from '@sentry/cloudflare';
import { z } from 'zod';
import { Env } from '../types.js';
import { json, error } from '../lib/response.js';
import { parseValidatedBody } from '../lib/validate.js';
import { resolveReturnOrigin } from '../lib/appUrl.js';
import { nanoid } from '../lib/nanoid.js';
import type { JwtPayload } from '../lib/jwt.js';
import {
  toBase64Url, fromBase64Url, deriveNativeCredentialId, verifyNativeSignature,
  storeChallenge, consumeChallenge,
} from '../lib/webauthn.js';
import { issueParentJwt, issueChildJwt } from './auth.js';

type AuthedRequest = Request & { auth: JwtPayload };

const platformSchema = z.enum(['web', 'native']);
const roleSchema = z.enum(['parent', 'child']);

const registerOptionsSchema = z.object({ platform: platformSchema, displayName: z.string().optional() });

// `response`'s exact shape is a deeply-nested WebAuthn structure
// (id/rawId/response.clientDataJSON/response.attestationObject/...) —
// @simplewebauthn/server's own verify call is the real validator for its
// contents; zod here only confirms we received a JSON object at all.
const registerVerifySchema = z.discriminatedUnion('platform', [
  z.object({ platform: z.literal('web'), response: z.record(z.string(), z.unknown()) }),
  z.object({ platform: z.literal('native'), publicKey: z.string().min(1) }),
]);

const loginOptionsSchema = z.object({
  user_id: z.string().min(1),
  role: roleSchema,
  platform: platformSchema,
});

const loginVerifySchema = z.discriminatedUnion('platform', [
  z.object({
    platform: z.literal('web'), user_id: z.string().min(1), role: roleSchema,
    response: z.record(z.string(), z.unknown()),
  }),
  z.object({
    platform: z.literal('native'), user_id: z.string().min(1), role: roleSchema,
    public_key: z.string().min(1), signature: z.string().min(1),
  }),
]);

function rpFrom(request: Request, env: Env): { origin: string; rpID: string } {
  const origin = resolveReturnOrigin(request, env);
  return { origin, rpID: new URL(origin).hostname };
}

// ── Registration ──────────────────────────────────────────────────────────

export async function handleWebauthnRegisterOptions(request: Request, env: Env): Promise<Response> {
  const auth = (request as AuthedRequest).auth;
  if (!auth) return error('Unauthorised', 401);

  const parsed = await parseValidatedBody(request, registerOptionsSchema);
  if (parsed instanceof Response) return parsed;

  if (parsed.platform === 'native') {
    const challenge = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
    await storeChallenge(env, auth.sub, challenge);
    return json({ platform: 'native', challenge });
  }

  const { rpID } = rpFrom(request, env);
  const existing = await env.DB
    .prepare('SELECT credential_id FROM webauthn_credentials WHERE user_id = ? AND type = ?')
    .bind(auth.sub, 'webauthn')
    .all<{ credential_id: string }>();

  const options = await generateRegistrationOptions({
    rpName: 'Morechard',
    rpID,
    userName: auth.sub,
    userID: new TextEncoder().encode(auth.sub),
    userDisplayName: parsed.displayName ?? auth.sub,
    attestationType: 'none',
    authenticatorSelection: {
      authenticatorAttachment: 'platform',
      userVerification: 'required',
      residentKey: 'preferred',
    },
    excludeCredentials: existing.results.map(r => ({ id: r.credential_id })),
  });

  await storeChallenge(env, auth.sub, options.challenge);
  return json({ platform: 'web', options });
}

export async function handleWebauthnRegisterVerify(request: Request, env: Env): Promise<Response> {
  const auth = (request as AuthedRequest).auth;
  if (!auth) return error('Unauthorised', 401);

  const parsed = await parseValidatedBody(request, registerVerifySchema);
  if (parsed instanceof Response) return parsed;

  const challenge = await consumeChallenge(env, auth.sub);
  if (!challenge) return error('Challenge expired or not found', 400);

  if (parsed.platform === 'native') {
    const credentialId = await deriveNativeCredentialId(parsed.publicKey);
    await env.DB
      .prepare(`INSERT INTO webauthn_credentials (id, user_id, role, credential_id, public_key, type, counter, created_at)
                VALUES (?,?,?,?,?,'native-ecdsa',0,?)`)
      .bind(nanoid(), auth.sub, auth.role, credentialId, parsed.publicKey, Math.floor(Date.now() / 1000))
      .run();
    return json({ ok: true });
  }

  const { origin, rpID } = rpFrom(request, env);
  let verification: VerifiedRegistrationResponse;
  try {
    verification = await verifyRegistrationResponse({
      response: parsed.response as unknown as RegistrationResponseJSON,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });
  } catch {
    return error('Registration verification failed', 400);
  }
  if (!verification.verified || !verification.registrationInfo) {
    return error('Registration verification failed', 400);
  }

  const { credential } = verification.registrationInfo;
  await env.DB
    .prepare(`INSERT INTO webauthn_credentials (id, user_id, role, credential_id, public_key, type, counter, created_at)
              VALUES (?,?,?,?,?,'webauthn',?,?)`)
    .bind(nanoid(), auth.sub, auth.role, credential.id, toBase64Url(credential.publicKey), credential.counter, Math.floor(Date.now() / 1000))
    .run();

  return json({ ok: true });
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd worker && npx vitest run src/routes/webauthn.test.ts`
Expected: PASS (5 tests). (Login handlers referenced by imports above don't exist yet — that's fine, they're written in Task 5 in the same file; this step only tests the registration handlers, so add the login handlers as empty stubs temporarily if TypeScript complains about the `issueParentJwt`/`issueChildJwt` imports being unused — no, those ARE used in Task 5's code, not this task's; if `tsc`/vitest complains about anything unrelated to registration, re-check Step 4 was copied verbatim.)

- [ ] **Step 6: Commit**

```bash
git add worker/package.json worker/package-lock.json worker/src/routes/webauthn.ts worker/src/routes/webauthn.test.ts
git commit -m "feat(worker): WebAuthn registration endpoints (web + native)"
```

---

### Task 5: Worker — WebAuthn login endpoints (issues a real session)

**Files:**
- Modify: `worker/src/routes/webauthn.ts` (append login handlers)
- Modify: `worker/src/routes/webauthn.test.ts` (append login tests)

**Interfaces:**
- Consumes: `issueParentJwt`, `issueChildJwt` from `./auth.js` (Task 3).
- Produces (used by Task 6): `export async function handleWebauthnLoginOptions(request: Request, env: Env): Promise<Response>` (public, no auth), `export async function handleWebauthnLoginVerify(request: Request, env: Env): Promise<Response>` (public, no auth).

- [ ] **Step 1: Write the failing tests (append to `webauthn.test.ts`)**

```typescript
// Append to worker/src/routes/webauthn.test.ts
import { handleWebauthnLoginOptions, handleWebauthnLoginVerify } from './webauthn.js';

function makePlainRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://app.morechard.com' },
    body: JSON.stringify(body),
  });
}

describe('handleWebauthnLoginOptions', () => {
  it('404s when the user has no registered credential of that type', async () => {
    const dbWithEmptyAll = {
      prepare: () => ({
        bind: () => ({ async all() { return { results: [] }; } }),
      }),
    } as unknown as D1Database;
    const env = { DB: dbWithEmptyAll, CACHE: makeMockKV(), APP_URL: 'https://app.morechard.com' } as unknown as Env;
    const request = makePlainRequest('https://api.morechard.com/auth/webauthn/login/options', {
      user_id: 'user_1', role: 'parent', platform: 'native',
    });

    const res = await handleWebauthnLoginOptions(request, env);
    expect(res.status).toBe(404);
  });

  it('returns a native challenge for a registered native credential', async () => {
    const dbWithOneCred = {
      prepare: () => ({
        bind: () => ({ async all() { return { results: [{ credential_id: 'cred_1' }] }; } }),
      }),
    } as unknown as D1Database;
    const env = { DB: dbWithOneCred, CACHE: makeMockKV(), APP_URL: 'https://app.morechard.com' } as unknown as Env;
    const request = makePlainRequest('https://api.morechard.com/auth/webauthn/login/options', {
      user_id: 'user_1', role: 'parent', platform: 'native',
    });

    const res = await handleWebauthnLoginOptions(request, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { platform: string; challenge: string };
    expect(body.platform).toBe('native');
  });
});

describe('handleWebauthnLoginVerify — native path', () => {
  it('rejects when the signature does not match the stored public key', async () => {
    const keyPair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const spki = await crypto.subtle.exportKey('spki', keyPair.publicKey);
    const publicKey = toBase64Url(spki);

    const db = {
      prepare(sql: string) {
        return {
          bind: () => ({
            async first() {
              if (sql.includes('FROM users')) return { family_id: 'fam_1' };
              if (sql.includes('FROM webauthn_credentials')) return { public_key: publicKey };
              return null;
            },
            async run() { return { success: true, meta: {} }; },
          }),
        };
      },
    } as unknown as D1Database;
    const cache = makeMockKV();
    const env = { DB: db, CACHE: cache, JWT_SECRET: 'test-secret', APP_URL: 'https://app.morechard.com' } as unknown as Env;

    await cache.put('webauthn:challenge:user_1', 'the-real-challenge');

    const request = makePlainRequest('https://api.morechard.com/auth/webauthn/login/verify', {
      user_id: 'user_1', role: 'parent', platform: 'native',
      public_key: publicKey,
      signature: toBase64Url(crypto.getRandomValues(new Uint8Array(64))), // garbage signature
    });

    const res = await handleWebauthnLoginVerify(request, env);
    expect(res.status).toBe(401);
  });

  it('issues a session (cookie) on a genuine signature', async () => {
    const keyPair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const spki = await crypto.subtle.exportKey('spki', keyPair.publicKey);
    const publicKey = toBase64Url(spki);

    const db = {
      prepare(sql: string) {
        return {
          bind: () => ({
            async first() {
              if (sql.includes('FROM users')) return { family_id: 'fam_1' };
              if (sql.includes('FROM webauthn_credentials')) return { public_key: publicKey };
              return null;
            },
            async run() { return { success: true, meta: {} }; },
          }),
        };
      },
    } as unknown as D1Database;
    const cache = makeMockKV();
    const env = { DB: db, CACHE: cache, JWT_SECRET: 'test-secret', APP_URL: 'https://app.morechard.com' } as unknown as Env;

    const challengeB64Url = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
    await cache.put('webauthn:challenge:user_1', challengeB64Url);

    const signature = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      keyPair.privateKey,
      (await import('../lib/webauthn.js')).fromBase64Url(challengeB64Url),
    );

    const request = makePlainRequest('https://api.morechard.com/auth/webauthn/login/verify', {
      user_id: 'user_1', role: 'parent', platform: 'native',
      public_key: publicKey,
      signature: toBase64Url(signature),
    });

    const res = await handleWebauthnLoginVerify(request, env);
    expect(res.status).toBe(200);
    const setCookies = (res.headers as Headers & { getSetCookie(): string[] }).getSetCookie();
    expect(setCookies.some(c => c.startsWith('mc_token=') && c.includes('HttpOnly'))).toBe(true);
  });

  it('rejects when the challenge is missing/expired', async () => {
    const db = { prepare: () => ({ bind: () => ({ async first() { return null; } }) }) } as unknown as D1Database;
    const env = { DB: db, CACHE: makeMockKV(), APP_URL: 'https://app.morechard.com' } as unknown as Env;
    const request = makePlainRequest('https://api.morechard.com/auth/webauthn/login/verify', {
      user_id: 'user_1', role: 'parent', platform: 'native',
      public_key: 'x', signature: 'y',
    });

    const res = await handleWebauthnLoginVerify(request, env);
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd worker && npx vitest run src/routes/webauthn.test.ts`
Expected: FAIL — `handleWebauthnLoginOptions`/`handleWebauthnLoginVerify` are not exported yet.

- [ ] **Step 3: Append the implementation to `worker/src/routes/webauthn.ts`**

```typescript
// ── Login ─────────────────────────────────────────────────────────────────

export async function handleWebauthnLoginOptions(request: Request, env: Env): Promise<Response> {
  const parsed = await parseValidatedBody(request, loginOptionsSchema);
  if (parsed instanceof Response) return parsed;
  const { user_id, role, platform } = parsed;

  const type = platform === 'web' ? 'webauthn' : 'native-ecdsa';
  const rows = await env.DB
    .prepare('SELECT credential_id FROM webauthn_credentials WHERE user_id = ? AND role = ? AND type = ?')
    .bind(user_id, role, type)
    .all<{ credential_id: string }>();

  if (rows.results.length === 0) return error('No credential registered', 404);

  if (platform === 'native') {
    const challenge = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
    await storeChallenge(env, user_id, challenge);
    return json({ platform: 'native', challenge });
  }

  const { rpID } = rpFrom(request, env);
  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: rows.results.map(r => ({ id: r.credential_id })),
    userVerification: 'required',
  });

  await storeChallenge(env, user_id, options.challenge);
  return json({ platform: 'web', options });
}

export async function handleWebauthnLoginVerify(request: Request, env: Env): Promise<Response> {
  const parsed = await parseValidatedBody(request, loginVerifySchema);
  if (parsed instanceof Response) return parsed;
  const { user_id, role } = parsed;

  const challenge = await consumeChallenge(env, user_id);
  if (!challenge) return error('Challenge expired or not found', 400);

  const userRow = await env.DB
    .prepare('SELECT family_id FROM users WHERE id = ?')
    .bind(user_id)
    .first<{ family_id: string }>();
  if (!userRow) return error('Invalid credentials', 401);

  if (parsed.platform === 'native') {
    const credentialId = await deriveNativeCredentialId(parsed.public_key);
    const credRow = await env.DB
      .prepare('SELECT public_key FROM webauthn_credentials WHERE user_id = ? AND role = ? AND type = ? AND credential_id = ?')
      .bind(user_id, role, 'native-ecdsa', credentialId)
      .first<{ public_key: string }>();
    if (!credRow || credRow.public_key !== parsed.public_key) return error('Invalid credentials', 401);

    const valid = await verifyNativeSignature(parsed.public_key, parsed.signature, challenge);
    if (!valid) return error('Invalid credentials', 401);

    await env.DB
      .prepare('UPDATE webauthn_credentials SET last_used_at = ? WHERE credential_id = ?')
      .bind(Math.floor(Date.now() / 1000), credentialId)
      .run();

    return role === 'parent'
      ? issueParentJwt(user_id, userRow.family_id, request, env)
      : issueChildJwt(user_id, userRow.family_id, request, env);
  }

  const response = parsed.response as unknown as AuthenticationResponseJSON;
  const credRow = await env.DB
    .prepare('SELECT credential_id, public_key, counter FROM webauthn_credentials WHERE user_id = ? AND role = ? AND type = ? AND credential_id = ?')
    .bind(user_id, role, 'webauthn', response.id)
    .first<{ credential_id: string; public_key: string; counter: number }>();
  if (!credRow) return error('Invalid credentials', 401);

  const { origin, rpID } = rpFrom(request, env);
  let verification: VerifiedAuthenticationResponse;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: credRow.credential_id,
        publicKey: fromBase64Url(credRow.public_key),
        counter: credRow.counter,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('counter value') && msg.includes('was lower than expected')) {
      // A stored counter that didn't increase is the textbook signal of a
      // cloned hardware authenticator — log distinctly so a dedicated
      // Sentry alert rule can watch this fingerprint, same pattern as
      // 'stripe-payment-failure' in routes/stripe.ts.
      Sentry.captureMessage('WebAuthn credential counter regression: possible clone', {
        level: 'error',
        fingerprint: ['webauthn-clone-detected', credRow.credential_id],
        extra: { user_id, role, credential_id: credRow.credential_id },
      });
    }
    return error('Invalid credentials', 401);
  }
  if (!verification.verified) return error('Invalid credentials', 401);

  await env.DB
    .prepare('UPDATE webauthn_credentials SET counter = ?, last_used_at = ? WHERE credential_id = ?')
    .bind(verification.authenticationInfo.newCounter, Math.floor(Date.now() / 1000), credRow.credential_id)
    .run();

  return role === 'parent'
    ? issueParentJwt(user_id, userRow.family_id, request, env)
    : issueChildJwt(user_id, userRow.family_id, request, env);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd worker && npx vitest run src/routes/webauthn.test.ts`
Expected: PASS (all tests from Tasks 4 and 5, ~9 total).

- [ ] **Step 5: Commit**

```bash
git add worker/src/routes/webauthn.ts worker/src/routes/webauthn.test.ts
git commit -m "feat(worker): WebAuthn login endpoints — issues a real session, logs clone-detection to Sentry"
```

---

### Task 6: Worker — wire the 4 routes into `index.ts`

**Files:**
- Modify: `worker/src/index.ts` (add import, add 4 route entries)

**Interfaces:**
- Consumes: all 4 handlers from `./routes/webauthn.js` (Tasks 4–5), existing `withAuth` helper (`index.ts:1047`).

- [ ] **Step 1: Manual verification step (no unit test — this is routing glue)**

Routing correctness is verified by Step 3's full-suite run plus the unit tests already written in Tasks 4–5 (which call the handlers directly, bypassing `index.ts`'s dispatch — this task only wires them into the URL-matching chain, which has no independent logic to unit-test beyond "does this path/method combination exist").

- [ ] **Step 2: Add the import**

Near the other route imports in `worker/src/index.ts` (alongside the `./routes/auth.js` import), add:

```ts
import {
  handleWebauthnRegisterOptions, handleWebauthnRegisterVerify,
  handleWebauthnLoginOptions, handleWebauthnLoginVerify,
} from './routes/webauthn.js';
```

- [ ] **Step 3: Register the public login routes**

In the public-routes block (before line 636's `requireAuth` call — add these right after the existing `/auth/slt/exchange` entry, matching the file's existing plain-path-equality style):

```ts
if (path === '/auth/webauthn/login/options' && method === 'POST') return handleWebauthnLoginOptions(request, env);
if (path === '/auth/webauthn/login/verify' && method === 'POST') return handleWebauthnLoginVerify(request, env);
```

- [ ] **Step 4: Register the authenticated registration routes**

In the authenticated-routes block (after line 642's CSRF check, alongside the existing `/auth/me` entry using the `withAuth` wrapper):

```ts
if (path === '/auth/webauthn/register/options' && method === 'POST') return withAuth(request, auth, env, handleWebauthnRegisterOptions);
if (path === '/auth/webauthn/register/verify' && method === 'POST') return withAuth(request, auth, env, handleWebauthnRegisterVerify);
```

- [ ] **Step 5: Run the full worker test suite**

Run: `cd worker && npx tsc --noEmit && npm test`
Expected: zero TypeScript errors, all tests passing (all of Tasks 1–5's tests plus every pre-existing test).

- [ ] **Step 6: Commit**

```bash
git add worker/src/index.ts
git commit -m "feat(worker): wire WebAuthn register/login routes into the request dispatcher"
```

---

### Task 7: App — native ECDSA keypair module (`webauthnNative.ts`)

**Files:**
- Modify: root `package.json` (add `@aparajita/capacitor-biometric-auth`), `app/package.json` (add `@simplewebauthn/browser` — used in Task 9, installed now alongside the native dependency for one combined install step)
- Create: `app/src/lib/webauthnNative.ts`
- Test: `app/src/lib/webauthnNative.test.ts`

**Interfaces:**
- Consumes: `BiometricAuth`, `BiometryError`, `BiometryErrorType` from `@aparajita/capacitor-biometric-auth`.
- Produces (used by Task 9): `export async function isNativeBiometricsAvailable(): Promise<boolean>`, `export async function registerNativeKey(userId: string): Promise<NativeKeyResult>`, `export async function signNativeChallenge(userId: string, challengeB64Url: string): Promise<NativeSignResult>`, `export async function clearNativeKey(userId: string): Promise<void>`, and the exported types `NativeKeyResult`, `NativeSignResult`.

- [ ] **Step 1: Check Capacitor 8 compatibility before installing**

Run: `npm view @aparajita/capacitor-biometric-auth peerDependencies`
Expected: shows a `@capacitor/core` peer range that includes `^8` (this repo is on `@capacitor/core ^8.3.1` per root `package.json`). If it doesn't, stop and report — do not force-install an incompatible peer version.

- [ ] **Step 2: Install the dependencies**

Run (from repo root): `npm install @aparajita/capacitor-biometric-auth@^10.0.0` (root `package.json`, alongside the other Capacitor plugins)
Run: `cd app && npm install @simplewebauthn/browser@^13.3.0` (app `package.json`)
Expected: both `package.json`/`package-lock.json` files updated.

- [ ] **Step 3: Write the failing test for `webauthnNative.ts`**

```typescript
// app/src/lib/webauthnNative.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@aparajita/capacitor-biometric-auth', () => ({
  BiometricAuth: {
    checkBiometry: vi.fn(async () => ({ isAvailable: true })),
    authenticate: vi.fn(async () => undefined),
  },
  BiometryError: class BiometryError extends Error {
    code: string;
    constructor(message: string, code: string) { super(message); this.code = code; }
  },
  BiometryErrorType: {
    userCancel: 'userCancel',
    biometryNotAvailable: 'biometryNotAvailable',
    authenticationFailed: 'authenticationFailed',
  },
}));

import { BiometricAuth, BiometryError, BiometryErrorType } from '@aparajita/capacitor-biometric-auth';
import {
  isNativeBiometricsAvailable, registerNativeKey, signNativeChallenge, clearNativeKey,
} from './webauthnNative';

function deleteVaultDb(): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase('morechard-webauthn-vault');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}

beforeEach(async () => {
  vi.clearAllMocks();
  (BiometricAuth.checkBiometry as ReturnType<typeof vi.fn>).mockResolvedValue({ isAvailable: true });
  (BiometricAuth.authenticate as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  await deleteVaultDb();
});

function toBase64Url(input: ArrayBuffer): string {
  const bytes = new Uint8Array(input);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

describe('isNativeBiometricsAvailable', () => {
  it('reflects checkBiometry().isAvailable', async () => {
    expect(await isNativeBiometricsAvailable()).toBe(true);
    (BiometricAuth.checkBiometry as ReturnType<typeof vi.fn>).mockResolvedValue({ isAvailable: false });
    expect(await isNativeBiometricsAvailable()).toBe(false);
  });

  it('returns false if checkBiometry throws', async () => {
    (BiometricAuth.checkBiometry as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('no plugin'));
    expect(await isNativeBiometricsAvailable()).toBe(false);
  });
});

describe('registerNativeKey', () => {
  it('generates and persists a key pair, returning a usable base64url public key', async () => {
    const result = await registerNativeKey('user_1');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.publicKey).not.toMatch(/[+/=]/);
      expect(BiometricAuth.authenticate).toHaveBeenCalledOnce();
    }
  });

  it('does not generate a key if the biometric prompt is denied', async () => {
    (BiometricAuth.authenticate as ReturnType<typeof vi.fn>).mockRejectedValue(
      new BiometryError('cancelled', BiometryErrorType.userCancel),
    );
    const result = await registerNativeKey('user_1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('denied');
  });

  it('reports unavailable when the device has no biometry', async () => {
    (BiometricAuth.checkBiometry as ReturnType<typeof vi.fn>).mockResolvedValue({ isAvailable: false });
    const result = await registerNativeKey('user_1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('unavailable');
  });
});

describe('signNativeChallenge — real key round trip', () => {
  it('signs a challenge with the previously registered key, verifiable against the exported public key', async () => {
    const reg = await registerNativeKey('user_1');
    expect(reg.ok).toBe(true);
    if (!reg.ok) return;

    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const challengeB64Url = toBase64Url(challenge.buffer as ArrayBuffer);

    const result = await signNativeChallenge('user_1', challengeB64Url);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.publicKey).toBe(reg.publicKey);

    // Independently verify the signature to prove the private key really
    // signed this exact challenge (catches export-format mismatches).
    const spkiBytes = Uint8Array.from(atob(result.publicKey.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    const publicKey = await crypto.subtle.importKey('spki', spkiBytes, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    const sigBytes = Uint8Array.from(atob(result.signature.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, publicKey, sigBytes, challenge);
    expect(valid).toBe(true);
  });

  it('reports unavailable when no key has been registered on this device', async () => {
    const result = await signNativeChallenge('never_registered_user', 'AAAA');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('unavailable');
  });
});

describe('clearNativeKey', () => {
  it('removes the stored key so signing afterward reports unavailable', async () => {
    await registerNativeKey('user_1');
    await clearNativeKey('user_1');
    const result = await signNativeChallenge('user_1', 'AAAA');
    expect(result.ok).toBe(false);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd app && npx vitest run src/lib/webauthnNative.test.ts`
Expected: FAIL — `Cannot find module './webauthnNative'`.

- [ ] **Step 5: Write `webauthnNative.ts`**

```typescript
// app/src/lib/webauthnNative.ts
//
// Native (Capacitor) equivalent of a WebAuthn credential: a non-extractable
// ECDSA P-256 key pair generated with Web Crypto, persisted directly in
// IndexedDB (CryptoKey objects support structured clone — the exact same
// technique already shipped for the encrypted bank vault in
// localBankDetails.ts), and gated behind a native biometric prompt
// (Face ID / Touch ID / fingerprint) before every use.
//
// This is deliberately NOT true Secure-Enclave/Android-Keystore-backed
// signing — that would require custom native Swift/Kotlin plugin code,
// untestable on real hardware in this environment. The private key is
// WebView-sandboxed app data, matching the security bar this app already
// accepts elsewhere (Keychain-stored JWT, encrypted IndexedDB bank vault).
// See docs/superpowers/specs/2026-07-16-webauthn-verification-design.md.

import { BiometricAuth, BiometryError, BiometryErrorType } from '@aparajita/capacitor-biometric-auth';

const DB_NAME = 'morechard-webauthn-vault';
const DB_VERSION = 1;
const KEY_STORE = 'keys';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(KEY_STORE)) db.createObjectStore(KEY_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGet<T>(db: IDBDatabase, key: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(KEY_STORE, 'readonly').objectStore(KEY_STORE).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

function idbPut(db: IDBDatabase, value: unknown, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(KEY_STORE, 'readwrite').objectStore(KEY_STORE).put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function idbDelete(db: IDBDatabase, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(KEY_STORE, 'readwrite').objectStore(KEY_STORE).delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function toBase64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(input: string): Uint8Array {
  const padded = input + '='.repeat((4 - (input.length % 4)) % 4);
  const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function classifyBiometryError(err: unknown): 'unavailable' | 'denied' | 'error' {
  if (err instanceof BiometryError) {
    switch (err.code) {
      case BiometryErrorType.userCancel:
      case BiometryErrorType.appCancel:
      case BiometryErrorType.systemCancel:
      case BiometryErrorType.userFallback:
      case BiometryErrorType.authenticationFailed:
      case BiometryErrorType.biometryLockout:
        return 'denied';
      case BiometryErrorType.biometryNotAvailable:
      case BiometryErrorType.biometryNotEnrolled:
      case BiometryErrorType.passcodeNotSet:
      case BiometryErrorType.noDeviceCredential:
      case BiometryErrorType.invalidContext:
      case BiometryErrorType.notInteractive:
        return 'unavailable';
      default:
        return 'error';
    }
  }
  return 'error';
}

export async function isNativeBiometricsAvailable(): Promise<boolean> {
  try {
    const result = await BiometricAuth.checkBiometry();
    return result.isAvailable;
  } catch {
    return false;
  }
}

export type NativeKeyResult =
  | { ok: true; publicKey: string }
  | { ok: false; reason: 'unavailable' | 'denied' | 'error'; message?: string };

/**
 * Registers a new native biometric credential for `userId`: prompts for
 * biometrics FIRST, and only generates + persists a key pair if that
 * prompt succeeds. Never generates a key on a denied/cancelled prompt.
 */
export async function registerNativeKey(userId: string): Promise<NativeKeyResult> {
  try {
    const available = await isNativeBiometricsAvailable();
    if (!available) return { ok: false, reason: 'unavailable' };

    await BiometricAuth.authenticate({ reason: 'Set up biometric sign-in' });
    // Only reached if authenticate() resolved without throwing.

    const keyPair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
    const db = await openDb();
    await idbPut(db, keyPair, userId);

    const spki = await crypto.subtle.exportKey('spki', keyPair.publicKey);
    return { ok: true, publicKey: toBase64Url(spki) };
  } catch (err) {
    const reason = classifyBiometryError(err);
    return { ok: false, reason, message: err instanceof Error ? err.message : String(err) };
  }
}

export type NativeSignResult =
  | { ok: true; publicKey: string; signature: string }
  | { ok: false; reason: 'unavailable' | 'denied' | 'error'; message?: string };

/**
 * Signs `challengeB64Url` with `userId`'s stored private key. Every call
 * re-triggers the biometric prompt — never cached, never skipped. If the
 * key is missing (IndexedDB cleared, or never registered), reports
 * 'unavailable' — callers should treat this identically to "never
 * registered" and fall back to password/PIN.
 */
export async function signNativeChallenge(userId: string, challengeB64Url: string): Promise<NativeSignResult> {
  try {
    const db = await openDb();
    const keyPair = await idbGet<CryptoKeyPair>(db, userId);
    if (!keyPair) return { ok: false, reason: 'unavailable' };

    const available = await isNativeBiometricsAvailable();
    if (!available) return { ok: false, reason: 'unavailable' };

    await BiometricAuth.authenticate({ reason: 'Sign in' });
    // Only reached if authenticate() resolved without throwing.

    const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, keyPair.privateKey, fromBase64Url(challengeB64Url));
    const spki = await crypto.subtle.exportKey('spki', keyPair.publicKey);
    return { ok: true, publicKey: toBase64Url(spki), signature: toBase64Url(signature) };
  } catch (err) {
    const reason = classifyBiometryError(err);
    return { ok: false, reason, message: err instanceof Error ? err.message : String(err) };
  }
}

export async function clearNativeKey(userId: string): Promise<void> {
  const db = await openDb();
  await idbDelete(db, userId);
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd app && npx vitest run src/lib/webauthnNative.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json app/package.json app/package-lock.json app/src/lib/webauthnNative.ts app/src/lib/webauthnNative.test.ts
git commit -m "feat(app): native ECDSA keypair module, biometric-gated via @aparajita/capacitor-biometric-auth"
```

---

### Task 8: App — `api.ts` WebAuthn request wrappers

**Files:**
- Modify: `app/src/lib/api.ts` (add 4 thin wrapper functions)

**Interfaces:**
- Consumes: the module-private `request<T>()` helper already in `api.ts`.
- Produces (used by Task 9): `webauthnRegisterOptions`, `webauthnRegisterVerify`, `webauthnLoginOptions`, `webauthnLoginVerify` — typed thin wrappers matching this file's existing convention (e.g. `createFamily`).

- [ ] **Step 1: Write the test**

```typescript
// Append to a new describe block in an existing or new test file —
// app/src/lib/api.test.ts doesn't currently exist; these thin wrappers are
// pure pass-throughs to the already-tested `request()` helper, so this is
// a light smoke test of the request shape, not a network integration test.
// Create: app/src/lib/api.webauthn.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: vi.fn(() => false) } }));
vi.mock('capacitor-secure-storage-plugin', () => ({ SecureStoragePlugin: { get: vi.fn(), set: vi.fn(), remove: vi.fn() } }));

const originalFetch = globalThis.fetch;

beforeEach(() => {
  globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })) as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

import {
  webauthnRegisterOptions, webauthnRegisterVerify, webauthnLoginOptions, webauthnLoginVerify,
} from './api';

describe('webauthn api.ts wrappers', () => {
  it('webauthnRegisterOptions POSTs to /auth/webauthn/register/options', async () => {
    await webauthnRegisterOptions('native');
    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toContain('/auth/webauthn/register/options');
    expect(JSON.parse(call[1].body)).toEqual({ platform: 'native' });
  });

  it('webauthnRegisterVerify POSTs the given payload to /auth/webauthn/register/verify', async () => {
    await webauthnRegisterVerify({ platform: 'native', publicKey: 'abc' });
    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toContain('/auth/webauthn/register/verify');
  });

  it('webauthnLoginOptions POSTs user_id/role/platform to /auth/webauthn/login/options', async () => {
    await webauthnLoginOptions('user_1', 'parent', 'web');
    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toContain('/auth/webauthn/login/options');
    expect(JSON.parse(call[1].body)).toEqual({ user_id: 'user_1', role: 'parent', platform: 'web' });
  });

  it('webauthnLoginVerify POSTs the given payload to /auth/webauthn/login/verify', async () => {
    await webauthnLoginVerify({ platform: 'native', user_id: 'user_1', role: 'parent', public_key: 'pk', signature: 'sig' });
    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toContain('/auth/webauthn/login/verify');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run src/lib/api.webauthn.test.ts`
Expected: FAIL — the 4 named exports don't exist yet.

- [ ] **Step 3: Add the wrapper functions to `api.ts`**

Add near the other auth-related functions (e.g. after `childLogin`):

```ts
export type WebauthnRegisterOptionsResult =
  | { platform: 'native'; challenge: string }
  | { platform: 'web'; options: Record<string, unknown> };

export async function webauthnRegisterOptions(
  platform: 'web' | 'native',
  displayName?: string,
): Promise<WebauthnRegisterOptionsResult> {
  return request('/auth/webauthn/register/options', { method: 'POST', body: JSON.stringify({ platform, displayName }) });
}

export type WebauthnRegisterVerifyBody =
  | { platform: 'web'; response: Record<string, unknown> }
  | { platform: 'native'; publicKey: string };

export async function webauthnRegisterVerify(body: WebauthnRegisterVerifyBody): Promise<{ ok: true }> {
  return request('/auth/webauthn/register/verify', { method: 'POST', body: JSON.stringify(body) });
}

export type WebauthnLoginOptionsResult =
  | { platform: 'native'; challenge: string }
  | { platform: 'web'; options: Record<string, unknown> };

export async function webauthnLoginOptions(
  userId: string,
  role: 'parent' | 'child',
  platform: 'web' | 'native',
): Promise<WebauthnLoginOptionsResult> {
  return request('/auth/webauthn/login/options', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, role, platform }),
  });
}

export type WebauthnLoginVerifyBody =
  | { platform: 'web'; user_id: string; role: 'parent' | 'child'; response: Record<string, unknown> }
  | { platform: 'native'; user_id: string; role: 'parent' | 'child'; public_key: string; signature: string };

export async function webauthnLoginVerify(body: WebauthnLoginVerifyBody): Promise<{ token: string; expires_in: number }> {
  return request('/auth/webauthn/login/verify', { method: 'POST', body: JSON.stringify(body) });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run src/lib/api.webauthn.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/api.ts app/src/lib/api.webauthn.test.ts
git commit -m "feat(app): api.ts wrappers for the 4 WebAuthn endpoints"
```

---

### Task 9: App — rewrite `biometrics.ts` internals (real ceremonies, same exported API)

**Files:**
- Modify: `app/src/lib/biometrics.ts` (full rewrite of internals — exported function names/signatures unchanged)
- Create: `app/src/lib/biometrics.test.ts` (no test file currently exists for this module)

**Interfaces:**
- Consumes: `webauthnRegisterOptions`, `webauthnRegisterVerify`, `webauthnLoginOptions`, `webauthnLoginVerify`, `setToken`, `getUserId`, `getRole` from `./api.js` (Task 8); `isNativeBiometricsAvailable`, `registerNativeKey`, `signNativeChallenge`, `clearNativeKey` from `./webauthnNative.js` (Task 7); `startRegistration`, `startAuthentication` from `@simplewebauthn/browser`; `primeAuthState` from `./authState.js`; `Capacitor` from `@capacitor/core`.
- Produces: unchanged public API — `isBiometricsAvailable(): Promise<boolean>`, `registerBiometrics(userId: string, displayName: string): Promise<BiometricResult>`, `challengeBiometrics(): Promise<BiometricResult>`, `hasBiometricCredential(): boolean`, `clearBiometricCredential(): void`. **Zero changes needed at any of the 5 existing call sites.**

- [ ] **Step 1: Write the failing test**

```typescript
// app/src/lib/biometrics.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: vi.fn(() => false) } }));

vi.mock('@simplewebauthn/browser', () => ({
  startRegistration: vi.fn(async () => ({ id: 'cred_abc', rawId: 'cred_abc', response: {}, type: 'public-key' })),
  startAuthentication: vi.fn(async () => ({ id: 'cred_abc', rawId: 'cred_abc', response: {}, type: 'public-key' })),
}));

vi.mock('./webauthnNative', () => ({
  isNativeBiometricsAvailable: vi.fn(async () => true),
  registerNativeKey: vi.fn(async () => ({ ok: true, publicKey: 'native-pubkey' })),
  signNativeChallenge: vi.fn(async () => ({ ok: true, publicKey: 'native-pubkey', signature: 'native-sig' })),
  clearNativeKey: vi.fn(async () => undefined),
}));

const apiMocks = vi.hoisted(() => ({
  webauthnRegisterOptions: vi.fn(),
  webauthnRegisterVerify: vi.fn(async () => ({ ok: true })),
  webauthnLoginOptions: vi.fn(),
  webauthnLoginVerify: vi.fn(async () => ({ token: 'jwt.token.here', expires_in: 3600 })),
  setToken: vi.fn(async () => undefined),
  getUserId: vi.fn(() => 'user_1'),
  getRole: vi.fn(() => 'parent' as const),
}));
vi.mock('./api', () => apiMocks);

vi.mock('./authState', () => ({ primeAuthState: vi.fn(async () => undefined) }));

import { Capacitor } from '@capacitor/core';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import * as nativeModule from './webauthnNative';
import { primeAuthState } from './authState';
import {
  isBiometricsAvailable, registerBiometrics, challengeBiometrics,
  hasBiometricCredential, clearBiometricCredential,
} from './biometrics';

beforeEach(() => {
  vi.clearAllMocks();
  (Capacitor.isNativePlatform as ReturnType<typeof vi.fn>).mockReturnValue(false);
  localStorage.clear();
  apiMocks.getUserId.mockReturnValue('user_1');
  apiMocks.getRole.mockReturnValue('parent');
});

describe('registerBiometrics — web platform', () => {
  it('runs the real WebAuthn ceremony and marks the device registered on success', async () => {
    apiMocks.webauthnRegisterOptions.mockResolvedValue({ platform: 'web', options: { challenge: 'x' } });
    const result = await registerBiometrics('user_1', 'Ada');
    expect(result.ok).toBe(true);
    expect(startRegistration).toHaveBeenCalledOnce();
    expect(apiMocks.webauthnRegisterVerify).toHaveBeenCalledWith({ platform: 'web', response: expect.any(Object) });
    expect(hasBiometricCredential()).toBe(true);
  });

  it('does not mark the device registered if the ceremony is cancelled', async () => {
    apiMocks.webauthnRegisterOptions.mockResolvedValue({ platform: 'web', options: { challenge: 'x' } });
    (startRegistration as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('NotAllowedError'));
    const result = await registerBiometrics('user_1', 'Ada');
    expect(result.ok).toBe(false);
    expect(hasBiometricCredential()).toBe(false);
  });
});

describe('registerBiometrics — native platform', () => {
  beforeEach(() => (Capacitor.isNativePlatform as ReturnType<typeof vi.fn>).mockReturnValue(true));

  it('runs the native ceremony and marks the device registered on success', async () => {
    apiMocks.webauthnRegisterOptions.mockResolvedValue({ platform: 'native', challenge: 'chal' });
    const result = await registerBiometrics('user_1', 'Ada');
    expect(result.ok).toBe(true);
    expect(nativeModule.registerNativeKey).toHaveBeenCalledWith('user_1');
    expect(apiMocks.webauthnRegisterVerify).toHaveBeenCalledWith({ platform: 'native', publicKey: 'native-pubkey' });
    expect(hasBiometricCredential()).toBe(true);
  });

  it('does not mark the device registered if the native key step fails', async () => {
    apiMocks.webauthnRegisterOptions.mockResolvedValue({ platform: 'native', challenge: 'chal' });
    (nativeModule.registerNativeKey as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, reason: 'denied' });
    const result = await registerBiometrics('user_1', 'Ada');
    expect(result.ok).toBe(false);
    expect(hasBiometricCredential()).toBe(false);
  });
});

describe('challengeBiometrics', () => {
  it('returns unavailable immediately if this device was never registered', async () => {
    const result = await challengeBiometrics();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('unavailable');
    expect(apiMocks.webauthnLoginOptions).not.toHaveBeenCalled();
  });

  it('on web: runs the assertion, verifies, sets the token, and re-primes authState', async () => {
    localStorage.setItem('mc_biometric_registered', '1');
    apiMocks.webauthnLoginOptions.mockResolvedValue({ platform: 'web', options: { challenge: 'x' } });

    const result = await challengeBiometrics();
    expect(result.ok).toBe(true);
    expect(startAuthentication).toHaveBeenCalledOnce();
    expect(apiMocks.setToken).toHaveBeenCalledWith('jwt.token.here');
    expect(primeAuthState).toHaveBeenCalledOnce();
  });

  it('on native: signs via webauthnNative and treats a missing local key as unavailable (re-registration path)', async () => {
    (Capacitor.isNativePlatform as ReturnType<typeof vi.fn>).mockReturnValue(true);
    localStorage.setItem('mc_biometric_registered', '1');
    (nativeModule.signNativeChallenge as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, reason: 'unavailable' });

    const result = await challengeBiometrics();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('unavailable');
  });
});

describe('hasBiometricCredential / clearBiometricCredential', () => {
  it('reflects and clears the local registration flag synchronously', () => {
    expect(hasBiometricCredential()).toBe(false);
    localStorage.setItem('mc_biometric_registered', '1');
    expect(hasBiometricCredential()).toBe(true);
    clearBiometricCredential();
    expect(hasBiometricCredential()).toBe(false);
  });
});

describe('isBiometricsAvailable', () => {
  it('delegates to the platform authenticator check on web', async () => {
    Object.defineProperty(window, 'PublicKeyCredential', {
      value: { isUserVerifyingPlatformAuthenticatorAvailable: vi.fn(async () => true) },
      configurable: true,
    });
    expect(await isBiometricsAvailable()).toBe(true);
  });

  it('delegates to isNativeBiometricsAvailable on native', async () => {
    (Capacitor.isNativePlatform as ReturnType<typeof vi.fn>).mockReturnValue(true);
    expect(await isBiometricsAvailable()).toBe(true);
    expect(nativeModule.isNativeBiometricsAvailable).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run src/lib/biometrics.test.ts`
Expected: FAIL — current `biometrics.ts` doesn't call any of the mocked modules.

- [ ] **Step 3: Rewrite `biometrics.ts`**

```typescript
// app/src/lib/biometrics.ts
//
// Real, server-verified biometric login. On web this is a genuine WebAuthn
// ceremony (@simplewebauthn/browser); on native (Capacitor) it's an ECDSA
// key pair gated by a native biometric prompt (webauthnNative.ts). Either
// way, a successful check both unlocks the device AND (re)issues a real
// login session — see
// docs/superpowers/specs/2026-07-16-webauthn-verification-design.md.
//
// Exported function names/signatures are unchanged from the previous
// (unverified) version so every existing call site — Stage3SecureApp,
// JoinFamilyScreen, PinManagementSettings, useGatekeeper, LockScreen —
// needs zero changes.

import { Capacitor } from '@capacitor/core';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import {
  webauthnRegisterOptions, webauthnRegisterVerify, webauthnLoginOptions, webauthnLoginVerify,
  setToken, getUserId, getRole,
} from './api';
import {
  isNativeBiometricsAvailable, registerNativeKey, signNativeChallenge, clearNativeKey,
} from './webauthnNative';
import { primeAuthState } from './authState';

export type BiometricResult =
  | { ok: true; method: 'biometrics' }
  | { ok: false; reason: 'unavailable' | 'denied' | 'error'; message?: string }

const REGISTERED_FLAG_KEY = 'mc_biometric_registered';

/** True if this device/platform supports biometric authentication at all. */
export async function isBiometricsAvailable(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) return isNativeBiometricsAvailable();
  try {
    if (!window.PublicKeyCredential) return false;
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/**
 * Registers a real, server-verified biometric credential for this device.
 * Called once during "Secure your App" setup — always while the caller
 * already holds a valid session (registration is an authenticated
 * endpoint), so `userId`/role are derived server-side from that session,
 * not trusted from any client input.
 */
export async function registerBiometrics(userId: string, displayName: string): Promise<BiometricResult> {
  try {
    const available = await isBiometricsAvailable();
    if (!available) return { ok: false, reason: 'unavailable' };

    if (Capacitor.isNativePlatform()) {
      await webauthnRegisterOptions('native', displayName); // primes the server-side challenge
      const keyResult = await registerNativeKey(userId);
      if (!keyResult.ok) return { ok: false, reason: keyResult.reason, message: keyResult.message };

      await webauthnRegisterVerify({ platform: 'native', publicKey: keyResult.publicKey });
      localStorage.setItem(REGISTERED_FLAG_KEY, '1');
      return { ok: true, method: 'biometrics' };
    }

    const optionsResult = await webauthnRegisterOptions('web', displayName);
    if (optionsResult.platform !== 'web') return { ok: false, reason: 'error', message: 'unexpected platform in server response' };

    const response = await startRegistration({ optionsJSON: optionsResult.options as never });
    await webauthnRegisterVerify({ platform: 'web', response: response as unknown as Record<string, unknown> });
    localStorage.setItem(REGISTERED_FLAG_KEY, '1');
    return { ok: true, method: 'biometrics' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('NotAllowedError') || msg.toLowerCase().includes('cancel')) {
      return { ok: false, reason: 'denied' };
    }
    return { ok: false, reason: 'error', message: msg };
  }
}

/**
 * Issues a biometric challenge. On success this both proves "still you" AND
 * (re)issues a real session — a successful check here is sufficient to
 * re-authenticate even if the underlying cookie/token had fully expired.
 */
export async function challengeBiometrics(): Promise<BiometricResult> {
  if (!hasBiometricCredential()) return { ok: false, reason: 'unavailable' };

  const userId = getUserId();
  const role = getRole();
  if (!userId || !role) return { ok: false, reason: 'unavailable' };

  try {
    const available = await isBiometricsAvailable();
    if (!available) return { ok: false, reason: 'unavailable' };

    if (Capacitor.isNativePlatform()) {
      const optionsResult = await webauthnLoginOptions(userId, role, 'native');
      if (optionsResult.platform !== 'native') return { ok: false, reason: 'error' };

      const signResult = await signNativeChallenge(userId, optionsResult.challenge);
      if (!signResult.ok) return { ok: false, reason: signResult.reason, message: signResult.message };

      const verifyResult = await webauthnLoginVerify({
        platform: 'native', user_id: userId, role,
        public_key: signResult.publicKey, signature: signResult.signature,
      });
      await setToken(verifyResult.token);
      await primeAuthState();
      return { ok: true, method: 'biometrics' };
    }

    const optionsResult = await webauthnLoginOptions(userId, role, 'web');
    if (optionsResult.platform !== 'web') return { ok: false, reason: 'error' };

    const assertion = await startAuthentication({ optionsJSON: optionsResult.options as never });
    const verifyResult = await webauthnLoginVerify({
      platform: 'web', user_id: userId, role, response: assertion as unknown as Record<string, unknown>,
    });
    await setToken(verifyResult.token); // no-op on web — the cookie is already set by the response
    await primeAuthState();
    return { ok: true, method: 'biometrics' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('NotAllowedError') || msg.toLowerCase().includes('cancel')) {
      return { ok: false, reason: 'denied' };
    }
    return { ok: false, reason: 'error', message: msg };
  }
}

/**
 * Synchronous local check — "did registration succeed on this device."
 * The real credential (public key) lives server-side; this is just a fast,
 * synchronous UI-gating flag, not the source of truth. If the client-side
 * key/ceremony state is ever actually missing when challenged (IndexedDB
 * cleared, stale pre-upgrade localStorage-only state), `challengeBiometrics`
 * / `registerNativeKey`'s own checks report 'unavailable' at that point —
 * this flag only controls whether we *attempt* the flow at all.
 */
export function hasBiometricCredential(): boolean {
  return localStorage.getItem(REGISTERED_FLAG_KEY) === '1';
}

export function clearBiometricCredential(): void {
  localStorage.removeItem(REGISTERED_FLAG_KEY);
  const userId = getUserId();
  if (userId && Capacitor.isNativePlatform()) void clearNativeKey(userId);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run src/lib/biometrics.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Run the app test suite and typecheck**

Run: `cd app && npx tsc -b --noEmit && npx vitest run`
Expected: zero new TypeScript errors (only the pre-existing, out-of-scope `localBankDetails.ts:135` error), all tests passing.

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/biometrics.ts app/src/lib/biometrics.test.ts
git commit -m "feat(app): rewrite biometrics.ts to run real, server-verified WebAuthn/native ceremonies"
```

---

### Task 10: Final verification, production migration, and docs

- [ ] **Step 1: Worker — full suite**

Run: `cd worker && npx tsc --noEmit && npm test`
Expected: zero TypeScript errors, full suite green.

- [ ] **Step 2: App — full suite**

Run: `cd app && npx tsc -b --noEmit && npx vitest run`
Expected: zero TypeScript errors except the pre-existing `localBankDetails.ts:135` one, full suite green.

- [ ] **Step 3: Apply the migration to production**

This is the first step in this plan that touches the live `morechard` database — only do this once Steps 1–2 are both green.

Run: `cd worker && npx wrangler d1 migrations apply morechard --remote --env production`
Expected: `0087_webauthn_credentials.sql` applied, no errors.

- [ ] **Step 4: Update the roadmap and security audit docs**

In `CLAUDE.md`, under the `### **Infrastructure**` section (next to the JWT cookie migration line added previously), add:

```markdown
- [x] WebAuthn server-side verification shipped — web uses real `@simplewebauthn/server`/`browser` (COSE public key, signature-counter clone-detection with a dedicated Sentry alert fingerprint `webauthn-clone-detected`); native (Capacitor) uses a Web-Crypto ECDSA key pair in IndexedDB gated by a native biometric prompt (`@aparajita/capacitor-biometric-auth`), no custom Swift/Kotlin. Both both unlock the device and re-issue a real session on success. Closes finding #1 from the 2026-07-15 production security audit. Spec: `docs/superpowers/specs/2026-07-16-webauthn-verification-design.md`; plan: `docs/superpowers/plans/2026-07-16-webauthn-verification.md`. No live device/browser verification was possible in the build environment — ships verified by unit tests + code review only; needs real end-to-end verification on actual hardware.
```

In `docs/security/audits/2026-07-15-production-security-audit.md`, update finding #1's row (currently "**Deferred.** ... flagged as the highest-value remaining item.") to:

```markdown
| 1 | WebAuthn/biometric check (`app/src/lib/biometrics.ts`) is client-side only — the challenge/signature is never sent to or verified by the worker. Trivially bypassable; presented to users as a real security control. | **Fixed (Pass 7).** Real server-side verification shipped: web via `@simplewebauthn/server`/`browser` (COSE public key, real attestation/assertion verification, signature-counter clone-detection alerting to Sentry); native via a Web-Crypto ECDSA key pair in IndexedDB gated by a biometric prompt. See `docs/superpowers/specs/2026-07-16-webauthn-verification-design.md`. |
```

Add a "Pass 7" entry to the remediation log (after the Pass 6 entry) summarizing the same file list as Step 4's roadmap note, and update the "Open items for the next audit pass" list to remove WebAuthn (item 1) — leaving items 2–8 renumbered, plus a new item noting the still-outstanding live device/browser verification for this feature (mirroring how the JWT migration's Playwright gap was tracked).

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md docs/security/audits/2026-07-15-production-security-audit.md
git commit -m "docs: mark WebAuthn server-side verification as shipped"
```
