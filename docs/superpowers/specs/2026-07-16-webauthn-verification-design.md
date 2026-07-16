# WebAuthn Server-Side Verification — Design Spec

**Date:** 2026-07-16
**Status:** Approved, ready for implementation planning
**Closes:** Finding #1 from the 2026-07-15 production security audit (`docs/security/audits/2026-07-15-production-security-audit.md`) — the other half of the original handoff at `docs/dev/handoff-2026-07-15-webauthn-jwt-redesign.md` (the JWT cookie migration half shipped in Pass 6).

## Problem

`app/src/lib/biometrics.ts` performs a real `navigator.credentials.create()`/`.get()` ceremony but never sends the public key anywhere — it only stores the credential *ID* client-side (`localStorage['mc_biometric_id']`) and, on unlock, checks that *an assertion object came back*. The signature is never verified by anyone, client or server. This is presented to users as a real security control but is trivially bypassable (any code path that can fake "an assertion came back" defeats it). There is no D1 table for credentials at all.

## Scope decisions (from brainstorming)

- **Covers both parent and child accounts** — matches today's parity (both roles can register biometrics).
- **Unifies "unlock" and "login"**: every successful verification both satisfies the local re-auth gate *and* (re)issues a real session cookie/JWT, using the exact session-issuing code already built in the JWT cookie migration (Pass 6). No separate "just prove it's still you" mode — a successful WebAuthn/native-biometric check always leaves the device holding a valid session.
- **Covers native (Capacitor) from the start**, via a different mechanism from web (below) — not deferred as a follow-up.
- **No migration UX** — pre-launch, no live users. Any existing `mc_biometric_id`-only client state is treated as "never registered" and silently falls into the existing registration flow the first time it's needed.

## Architecture overview

One challenge-response security model, two client ceremonies (web vs. native), one D1 table, one set of worker endpoints.

```
                    ┌─────────────────────────┐
                    │   webauthn_credentials   │  (D1)
                    │ user_id, credential_id,  │
                    │ public_key, type, counter│
                    │ role, timestamps         │
                    └───────────┬─────────────┘
                                │
        ┌───────────────────────┴───────────────────────┐
        │                                                │
   Web ceremony                                   Native ceremony
   @simplewebauthn/*                              Web Crypto + IndexedDB
   real WebAuthn credential                        + @aparajita/capacitor-
   (platform authenticator)                          biometric-auth prompt
        │                                                │
        └───────────────────────┬───────────────────────┘
                                 │
                    worker/src/routes/webauthn.ts
              /auth/webauthn/{register,login}/{options,verify}
                                 │
                    issueParentJwt / issueChildJwt
                    (existing, unchanged — sets the
                     same HttpOnly cookie + session row
                     as every other login path)
```

### Challenge storage

Challenges (registration and login) are random bytes generated server-side, stored in the existing `CACHE` KV namespace with a short TTL (2 minutes), keyed `webauthn:challenge:<user_id>`, and deleted on successful verify (one-time use). Not a new D1 table — no cleanup cron needed, KV expires them for free. Accepted trade-off: KV is eventually consistent, so there's a theoretical (and at this app's write volume, unobserved-in-practice) chance a challenge write and its verify read land on different edge nodes moments apart. Documented as a known V1 limitation; escalate to Durable Objects or a D1 row only if it's ever actually observed.

### D1 schema — `webauthn_credentials` (new migration, `0087_webauthn_credentials.sql`)

```sql
CREATE TABLE webauthn_credentials (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('parent', 'child')),
  credential_id TEXT NOT NULL UNIQUE,       -- base64url, no padding — see encoding note below
  public_key    TEXT NOT NULL,               -- base64url, no padding — COSE key (web) or SPKI (native)
  type          TEXT NOT NULL CHECK (type IN ('webauthn', 'native-ecdsa')),
  counter       INTEGER NOT NULL DEFAULT 0,  -- WebAuthn clone-detection; unused (0) for native
  device_label  TEXT,                        -- e.g. "iPhone — Safari" for settings UI
  created_at    INTEGER NOT NULL,
  last_used_at  INTEGER
);
CREATE INDEX idx_webauthn_credentials_user ON webauthn_credentials(user_id);
```

`user_id` matches the existing `users.id` for parents and the child's row id for children (same identifiers `issueParentJwt`/the child-login path already use) — no new identity concept.

**`credential_id` on the native path** — there's no WebAuthn ceremony to hand us one, so the worker derives it deterministically: `credential_id = base64url(SHA-256(spkiPublicKeyBytes))`. Deterministic (not a random UUID) so re-running registration with the same key pair can't silently create duplicate rows, and the `UNIQUE` constraint means a second registration attempt with the same key is caught by D1 rather than producing an ambiguous duplicate.

**Encoding consistency** — `@simplewebauthn/server` works natively in base64url (RFC 4648 §5, unpadded), so every value stored in this table (both `credential_id` and `public_key`, both ceremony types) is normalized to base64url-no-padding *before* it's written. One shared helper (`worker/src/lib/webauthn.ts`, e.g. `toBase64Url`/`fromBase64Url`) is used on both the web and native code paths — the native path's `crypto.subtle.exportKey('spki', ...)` produces a raw `ArrayBuffer` that must go through the same encode step, not a different one, so a stored native key and a stored web key are byte-for-byte comparable in format even though their contents (SPKI vs. COSE) differ.

**Native public key reconstruction for verification** — the worker must `crypto.subtle.importKey('spki', rawBytes, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'])` using the exact same format the client exported with (`spki`, P-256), then `crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, publicKey, signature, challengeBytes)`. Any mismatch in curve or hash between client export and server import fails silently (verify returns `false`, not an error) — worth a unit test that round-trips a real generated key pair through export → base64url → import → verify to catch a format mismatch immediately rather than discovering it against a live device later.

### Endpoints (`worker/src/routes/webauthn.ts`, new)

- `POST /auth/webauthn/register/options` — **authenticated** (must already have a valid session; registration happens right after login/join, matching today's `Stage3SecureApp`/`JoinFamilyScreen`/`PinManagementSettings` flows). Generates and stores a challenge, returns it plus RP info (`rp.id = window.location.hostname` equivalent, `app.morechard.com` in production) for the web ceremony, or just the raw challenge bytes for the native ceremony.
- `POST /auth/webauthn/register/verify` — **authenticated**. Web: verifies the attestation via `@simplewebauthn/server`'s `verifyRegistrationResponse`, extracts the COSE public key + credential ID (both normalized to base64url), inserts the row (`type = 'webauthn'`). Native: verifies nothing cryptographically here (there's no attestation, just a freshly generated public key) — derives `credential_id` as `base64url(SHA-256(spkiPublicKeyBytes))` (see D1 schema note below), inserts the row (`type = 'native-ecdsa'`) associated with the authenticated user. Both paths are gated by the same authenticated-session requirement, so an attacker can't register a credential for an account they don't already control.
- `POST /auth/webauthn/login/options` — **public** (this is the pre-session, "prove it's you" entry point). Request carries the claimed `user_id`/`role` (from the device's local identity — not secret, not itself a security boundary, exactly like `family_id`/`child_id` in today's PIN login). Looks up that user's credential(s), generates and stores a challenge scoped to them, returns it (+ `allowCredentials` for web).
- `POST /auth/webauthn/login/verify` — **public**. Web: `@simplewebauthn/server`'s `verifyAuthenticationResponse` against the stored public key + counter; on success, **compares the new counter to the stored one** — if it didn't strictly increase, reject the login and raise a Sentry security alert (see below) instead of merely failing quietly. Native: raw ECDSA signature verification (`crypto.subtle.verify`-equivalent, available in the Workers runtime) of the challenge against the stored SPKI public key; no counter check (no clone-detection signal exists on this path — an accepted, documented gap given the chosen trade-off). On success (either path): delete the used challenge, call `issueParentJwt`/the child-JWT equivalent exactly as today's login handlers do, return the same cookies.

### Web ceremony

`@simplewebauthn/browser` (app) + `@simplewebauthn/server` (worker) — the standard library pair recommended in the original handoff research. Real platform-authenticator credential, real COSE public key, real attestation/assertion verification, real signature-counter clone-detection.

### Native ceremony

No custom Swift/Kotlin. Client-side:
1. **Registration**: `@aparajita/capacitor-biometric-auth`'s prompt must resolve *success* before anything else happens. Only then: `crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, /* extractable */ false, ['sign'])`, persist the non-extractable `CryptoKey` object directly in IndexedDB (same technique already shipped for the encrypted bank vault in `localBankDetails.ts` — structured-clone supports non-extractable `CryptoKey`s), export and POST the public key to `/auth/webauthn/register/verify`.
2. **Login/unlock**: fetch a challenge, trigger the native biometric prompt again (never cached, never skipped — every sign operation re-prompts), and only on prompt success read the key back from IndexedDB and `crypto.subtle.sign()` the challenge, POST the signature to `/auth/webauthn/login/verify`.
3. **Key loss recovery**: if IndexedDB has been cleared (iOS can do this under severe storage pressure) — i.e. the client has no local key but the server still has a registered credential — the sign step simply can't happen. Client treats this identically to "never registered": falls back to password/PIN, then silently offers re-registration through the existing flow. Same branch handles this and the "old localStorage-only state" case from the no-migration decision above — one code path, not two.

### Session issuance

Both `login/verify` paths, on success, call the existing `issueParentJwt(userId, familyId, request, env)` (parent) or the equivalent child-JWT issuance used by `handleChildLogin` today — unchanged functions, already setting the `HttpOnly` cookie + session-marker cookie per the Pass 6 cookie model. No new session concept.

### Security event logging

Web-path counter regression is logged the same way the existing `stripe-payment-failure` pattern works (`worker/src/routes/stripe.ts`):

```ts
Sentry.captureMessage(`WebAuthn credential counter regression: possible clone`, {
  level: 'error',
  fingerprint: ['webauthn-clone-detected', credentialId],
  extra: { user_id, role, stored_counter, received_counter },
});
```

Distinct fingerprint so it groups into its own Sentry issue and can back a dedicated alert rule later, same as the Stripe failure pattern. The login attempt is rejected regardless (401), independent of whether Sentry capture succeeds.

## Error handling summary

| Scenario | Behavior |
|---|---|
| Client has no local credential (never registered, or IndexedDB/localStorage lost it) | Falls back to password/PIN/magic-link; silently offers re-registration afterward via the existing flow |
| Server has no matching credential for a client's local device identity | Same as above — one shared code path |
| Web: signature counter didn't strictly increase | Reject login (401), Sentry security alert with dedicated fingerprint |
| Native: signature verification fails | Reject login (401); no clone-detection signal exists for this path (accepted, documented limitation) |
| Challenge missing/expired/already used | Reject with a generic error (don't leak which case) |
| KV replication lag causes a spurious "challenge not found" | Accepted V1 trade-off given current write volume; escalate storage mechanism later only if actually observed |

## Testing approach

- **Worker unit tests**: registration/verification logic tested against precomputed WebAuthn test vectors (the standard approach `@simplewebauthn/server`'s own test suite uses) for the web path, and synthetic Web-Crypto-generated keypairs/signatures for the native raw-ECDSA path. Both fully testable without a browser or physical device. Explicitly includes a native key round-trip test (generate → export SPKI → base64url encode → store → decode → import → verify a real signature) to catch any client/server format mismatch in CI rather than against a live device later.
- **No live device/browser verification is possible in this environment** — same limitation already disclosed on the JWT cookie migration (`wrangler dev --remote` returns 503 on every route here) plus no iOS/Android device or emulator attached in this session. Ships verified by unit tests + code review only. Real end-to-end verification (actual Face ID/Touch ID prompts, actual browser WebAuthn ceremony, actual native biometric-auth plugin behavior) needs to happen on real hardware afterward — same caveat as the still-outstanding Android App Links verification item already tracked in `CLAUDE.md`.

## Out of scope / explicitly deferred

- Migration UX for pre-existing registrations (not needed — no live users yet).
- Any change to the underlying session/cookie model (unchanged from Pass 6).
- Multi-credential management UI (e.g. "remove this device's biometric login" in settings) — not designed here; the schema supports multiple credentials per user, but no UI is specified for managing them beyond re-registration overwriting/adding a row.
- Hardware-backed Secure Enclave/Android Keystore signing on native — deliberately traded for the Web Crypto + IndexedDB approach to avoid untestable custom native code; documented as a lower security bar than true hardware-bound keys, consistent with this app's existing risk acceptance elsewhere (Keychain-stored JWT, encrypted IndexedDB bank vault).
