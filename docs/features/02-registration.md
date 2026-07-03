---
feature: 02-registration
title: Registration Flow
---

### Purpose

Onboards a lead parent through a 3–4 step wizard that creates the family account, verifies email via magic link, and configures app security (PIN or biometrics). Co-parenting households get an additional step to generate an invite code for the second parent. Children are added post-registration from the dashboard to avoid partial-account API calls.

### Methodology

**State machine** — `RegistrationShell` owns a `RegistrationState` object and a `step` integer (1–4). Each stage component calls `onNext(patch)` to merge its fields into state and trigger the shell's `advanceStep` handler.

**Step transitions:**

- **Step 1 (About You)** — Collects display name, email, password, parenting mode, governance mode, and consent flags. Records analytics consent immediately via `grantAnalyticsConsent()` or `setAnalyticsConsent(false)`. No API call; advances to Step 2.
- **Step 2 (Family Setup)** — Collects currency and locale. On first pass, calls `POST /api/families` (`createFamily`) to create the account, then `POST /auth/magic-link` (`requestMagicLink`) to send a verification email. Pending consent values are written to `localStorage` for posting after JWT is available. Renders a `CheckEmailScreen` holding state until the user clicks the magic link.
- **Step 3 (Secure your App)** — `Stage3SecureApp` handles biometric enrollment (WebAuthn) or 4-digit PIN setup locally. No server call. If single-parent, marks `done = true`; if co-parenting, advances to Step 4.
- **Step 4 (Co-Parent Bridge)** — Generates or displays an invite code. Calls `saveRegistrationStep(4, { coparent_invited })` (`POST /api/registration/step`). On complete, marks `done = true`.
- **Completion** — `WelcomeNudge` (or `WelcomeOrchardScreen`) is shown, then `onComplete` fires with `family_id`, JWT token, `display_name`, `user_id`, auth method, and PIN — passing control back to the app shell.

**Progress bar** — Calculated as `step / totalSteps * 100`; totalSteps is 3 (single) or 4 (co-parenting).

**Referral codes** — Read from `localStorage` key `morechard_referral_code` at Step 2 and passed to `createFamily`; cleared after successful creation.

### Dependencies

- **External packages**: React (`useState`), WebAuthn (via `biometrics.ts`)
- **Internal modules**: `@/lib/api` (`createFamily`, `requestMagicLink`, `saveRegistrationStep`), `@/lib/locale` (`detectLocale`), `@/lib/analytics` (`grantAnalyticsConsent`, `setAnalyticsConsent`), `@/lib/biometrics`, `Stage1ParentIdentity`, `Stage2FamilyConstitution`, `Stage3SecureApp`, `Stage3ChildOnboarding`, `Stage4CoParentBridge`, `WelcomeOrchardScreen`, `WelcomeNudge`
- **APIs / services**: Cloudflare Workers (`POST /api/families`, `POST /auth/magic-link`, `POST /api/registration/step`); Cloudflare D1 (via worker); transactional email provider for magic-link delivery
