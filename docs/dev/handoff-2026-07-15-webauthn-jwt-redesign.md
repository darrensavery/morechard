# Handoff: WebAuthn + JWT Storage Redesign — SHIPPED

Originally written to resume a paused brainstorming session in a fresh
conversation. Both projects it describes are now complete. Kept as a
historical pointer (the changelog references this file directly) rather
than deleted — but the content has moved to the docs below, so **read those
instead of this file for anything you need to act on.**

## What shipped, and where the detail actually lives

1. **JWT cookie migration** (web: httpOnly cookie; native: Keychain/Keystore
   secure storage) — closes the "XSS = long-lived account takeover" path.
   - Design: `docs/superpowers/specs/2026-07-15-jwt-cookie-migration-design.md`
   - Plan: `docs/superpowers/plans/2026-07-15-jwt-cookie-migration.md`
   - Changelog: `docs/dev/changelog.md`, 2026-07-16 entries

2. **WebAuthn server-side verification** — closes the "client-side biometric
   theatre" gap. Real credential/public-key verification on web
   (`@simplewebauthn/*`), a parallel Web Crypto + IndexedDB ECDSA ceremony on
   native, unified with session issuance (a successful check always
   (re)issues a real session via the same `issueParentJwt`/child-JWT path
   the cookie migration built).
   - Design: `docs/superpowers/specs/2026-07-16-webauthn-verification-design.md`
   - Plan: `docs/superpowers/plans/2026-07-16-webauthn-verification.md`
   - Changelog: `docs/dev/changelog.md`, 2026-07-16 entries

3. **Audit status**: both items are now closed in
   `docs/security/audits/2026-07-15-production-security-audit.md` — check
   that file's "Open items" section for what's still outstanding overall
   (it's the living source of truth, not this file).

## The one thing genuinely still open from both specs

**No live device/browser verification was possible in the build
environment** for either project (`wrangler dev --remote` 503s there, no
iOS/Android device or emulator attached) — both shipped verified by unit
tests + code review only. Real end-to-end verification on actual hardware
(a real browser WebAuthn ceremony, a real native biometric prompt, a real
cookie round-trip in a mobile browser) is the outstanding follow-up — same
category as the still-open Android App Links on-device verification item
in `CLAUDE.md`.
