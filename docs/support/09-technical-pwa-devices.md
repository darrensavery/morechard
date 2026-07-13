# 09 · Technical, PWA, Devices, Region & Language

Covers installing the app (PWA/Android), cross-device behaviour, offline/sync, push notifications, deep links, region/currency, and language.

**Key facts:**
- Morechard is a **PWA** (installable web app) with an Android build (App Links / deep links). It runs on Cloudflare (Pages + Workers + D1).
- **Device identity: one device = one user.** A device is linked to a single user (parent or child). This is core to the child-safety model.
- Data lives server-side in D1 — the app is not offline-first for writes. A connection is needed to log chores, approve, upload proof, etc.

---

## Installing & running the app

### Symptom: "How do I install it / it's not in the app store"
**Fact:** Morechard is primarily a **PWA** — installed from the browser ("Add to Home Screen"), not necessarily the app store. On Android there's also a native build.
**Resolve:** Guide them: open `app.morechard.com` in their browser → browser menu → "Add to Home Screen" / "Install app." It then behaves like a native app.

### Symptom: "The app looks blank / stuck on a loading (orchard) message"
**Diagnose:** Rotating loading messages ("Checking the soil…") are normal for a moment. A persistent blank/loading screen is usually:
- A stale cached PWA build after a deploy.
- No network.

**Resolve:** Hard-refresh / fully close and reopen the app. If it persists, have them clear the site cache (or reinstall the PWA). Confirm connectivity. If many users report a persistent blank screen right after a release, escalate — could be a bad deploy.

### Symptom: "It logged me out / lost my data after clearing browser data or reinstalling"
**Diagnose:** The **session token** and some device-local data (e.g. saved bank handles — see [05](05-goals-savings-payment-bridge.md)) live in local storage. Clearing browser data logs them out; **server data (ledger, chores, goals, balances) is safe in D1.**
**Resolve:** They just need to log back in (parent: magic link/password; child: re-enter PIN, or be re-invited if the device was fully unlinked). Reassure them account data isn't lost — only the local session.

---

## Cross-device & sync

### Symptom: "I don't see the same thing on my phone and my partner's phone"
**Diagnose:** In co-parenting mode, **households are private silos** — each parent sees their own household's chores; only the shared ledger is common. So different views can be *correct*. Also check both are logged into the **same family** and have synced (reopen app).
**Resolve:** Clarify the silo model (this is a feature for separated families). If they expect a genuinely shared item to appear and it doesn't after refresh on both devices, capture family_id and escalate (sync/consistency).

### Symptom: "My child logged in on a new device and their old device stopped working"
**Fact:** One device = one user, and child sessions are device-scoped. Re-linking on a new device may require a fresh invite code (see [02](02-onboarding-invites-family.md)). This is expected behaviour for the child-safety model, not a bug.

---

## Push notifications

**Facts:** Push (allowance-day notifications, etc.) is part of the PWA optimisation track and depends on the user granting browser/OS notification permission. (Full offline caching + push is still being hardened — Phase 8.)

### Symptom: "I'm not getting notifications"
**Diagnose:**
1. Did they grant notification permission when prompted? (Browser/OS setting.)
2. iOS PWAs historically restrict web push — behaviour varies by iOS version and requires the app be installed to the home screen.
**Resolve:** Have them enable notifications in the OS/browser settings for Morechard and ensure the PWA is installed (not just open in a tab). If permissions are granted and still nothing arrives, note the platform/OS version and escalate.

---

## Deep links / App Links (Android)

**Facts:** Android App Links let `https://app.morechard.com/...` links (e.g. `auth/verify`) open the app directly. Verification relies on `assetlinks.json`. On-device verification only runs at install time.

### Symptom: "Magic/verify links open a browser instead of the app" (Android)
**Diagnose:** App Links verification can be in `ask`/`legacy_failure` state, or they're on a build where verification didn't complete.
**Resolve:** The link still works in the browser — completing auth there is fine. If they want it to open the app directly, a reinstall of a verified build is needed. This is mostly a polish item; the browser fallback is fully functional. Persistent failures on production builds → engineering (may need the release cert fingerprint in `assetlinks.json`).

---

## Region, currency & language

**Facts:**
- **Currency is locked at registration** (`base_currency`: GBP/PLN/USD) as an anti-arbitrage measure. UK cards can't buy PLN pricing, etc.
- **Language is independent of currency** — users can toggle UI/AI language (EN-GB / EN-US / PL) regardless of payment region.
- US region swaps "Pocket Money" → "Allowance" (and optionally "Chore" → "Job/Task"); PL uses a formal AI persona.

### Symptom: "My currency is wrong / I want to change country"
**Fact:** Currency is fixed at registration and not self-serve changeable (see [02](02-onboarding-invites-family.md)).
**Resolve:** New account with little data → re-register in the right region. Established account → a currency **rebase** is an engineering operation (it writes a "Rebase" ledger entry to preserve the hash chain). Escalate with family_id and target region.

### Symptom: "I want the app in Polish/English"
**Resolve:** Point them to the **language toggle in Settings** — it's independent of their currency/region. No payment or account change needed.

### Symptom: "The US version says 'Allowance' not 'Pocket Money'" (or vice versa)
**Fact:** Intended regional terminology. US = "Allowance"; UK = "Pocket Money." Not a bug.

---

## Escalation triggers for this domain
- Persistent blank/loading screen across many users right after a deploy → engineering (possible bad release).
- Genuinely shared data not syncing across two devices in the same family/household → engineering with family_id.
- Currency rebase for an established account → engineering.
- Production Android App Links stuck in `legacy_failure` → engineering (cert fingerprint in `assetlinks.json`).
