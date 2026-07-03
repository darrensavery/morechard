---
feature: 17-demo-mode
title: Demo Mode
---

### Purpose

Demo Mode gives professionals (advisers, press, educators) and post-trial Core parents a sandboxed view of the full Morechard parent dashboard using a shared, pre-seeded "Thomson family" account — without requiring them to create a real family or supply payment details. It exists to reduce conversion friction and capture upgrade interest signals from users who hit paywalled features during the demo.

### Methodology

**Entry paths (two distinct flows)**

- **Professional path** (`POST /auth/demo/register`): Collects name, email, and marketing consent via `DemoRegisterScreen`. Upserts a row into `demo_registrations` (conflict on email updates `last_active_at`) and issues a short-lived JWT (2-hour TTL) bound to `demo-family-thomson` / `demo-user-sarah`. The client stores the token and a `mc_demo_user_type = 'professional'` flag in localStorage, then hard-navigates to `/parent`.

- **Post-trial Core parent path** (`POST /auth/demo/enter`): Requires an existing valid JWT. Reads the caller's `users` row, upserts `demo_registrations` with `user_type = 'demo_parent'`, and issues a fresh demo JWT replacing their real session token. No form is shown.

**Demo JWT** is stateless — no `sessions` row is written, making it non-revocable. The payload carries `demo_user_type` (`professional` | `demo_parent`) and `family_id: 'demo-family-thomson'` so all downstream route handlers operate on the shared demo dataset.

**Upgrade interest capture** (`POST /auth/demo/notify`): Any caller with a demo JWT (or regular JWT) can register interest in `shield`, `ai_mentor`, or `learning_lab`. Writes to `upgrade_interest` table with `INSERT OR IGNORE` (one row per user per feature).

**Session check** (`GET /auth/demo/active`): Returns `{ active: boolean, demo_user_type }` by inspecting `family_id` on the JWT — no DB query needed.

**`DemoUpsellCard`**: UI component shown inside the demo session that presents paywalled features and calls `/auth/demo/notify` when the user taps a notify button.

### Dependencies

- **External packages**: None beyond the Worker runtime; no third-party npm packages specific to this feature.
- **Internal modules**: `../lib/response.ts` (`json`, `error`), `../lib/jwt.ts` (`signJwt`, `JwtPayload`), `@/lib/api.ts` (`apiUrl`, `setToken`), `@/lib/deviceIdentity.ts` (`setDeviceIdentity`), `@/components/ui/Logo`, `@/lib/utils` (`cn`)
- **APIs / services**: Cloudflare D1 (`demo_registrations`, `upgrade_interest`, `users` tables); no external third-party services.
