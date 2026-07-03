---
feature: 15-coparenting-governance
title: Co-parenting & Governance
---

### Purpose

Enables co-parenting households to manage family membership and reach mutual agreement before changing verification behaviour. Specifically, it provides a two-parent mutual consent handshake before switching `verify_mode` between `amicable` (auto-approve chore completions) and `standard` (manual approval required), and allows the lead parent to invite a second parent into the family via a typed 6-character code.

### Methodology

**Governance handshake (verify_mode changes)**

- `POST /api/governance/request` — the initiating parent proposes a mode change. A row is inserted into `family_governance_log` with `status = 'pending'` and a 72-hour expiry. Only one pending request may exist per family at a time (409 if blocked).
- `POST /api/governance/:id/confirm` — the *other* parent confirms. The initiating parent cannot self-confirm. On success, an atomic D1 batch updates both the log row (`status = 'confirmed'`) and `families.verify_mode` in a single transaction.
- `POST /api/governance/:id/reject` — either parent may reject; log is updated to `status = 'rejected'`, family mode is unchanged.
- `POST /api/governance/expire` — called by a Cloudflare Cron Trigger; bulk-updates any `pending` rows past their `expires_at` to `status = 'expired'`.
- `GET /api/governance?family_id=` — returns the full log for a family (JWT-scoped); appends a human-readable `action_taken` label used by the PDF export and UI.

All outcomes (confirmed, rejected, expired) are retained permanently as a legal audit trail.

**Co-parent invite flow**

- Lead parent calls `POST /auth/invite/generate` with `role: 'co-parent'` — only the `lead` parent_role may do this (enforced via `family_roles` lookup).
- A 6-character alphanumeric code (no ambiguous chars, rejection-sampling to eliminate modulo bias) is inserted into `invite_codes` with a 72-hour TTL.
- Invitee calls `POST /auth/invite/peek` (validates without redeeming) then `POST /auth/invite/redeem` with display_name, email, and password. Redeem creates a new user row, links them to the family via `family_roles`, marks the code redeemed, and returns a 365-day JWT.

**UI**
- `FamilySettings.tsx` — displays current verify_mode, surfaces the governance request flow.
- `Stage4CoParentBridge.tsx` — registration step that generates and displays the co-parent invite code.
- `JoinFamilyScreen.tsx` — co-parent enters the 6-character code to join.

### Dependencies

- **External packages**: `nanoid` (via internal wrapper), Cloudflare D1 (database), Cloudflare Cron Triggers (expire job)
- **Internal modules**: `../lib/response.ts` (json/error helpers, clientIp), `../lib/jwt.ts` (JwtPayload, signJwt), `../lib/logger.ts`, `../lib/crypto.ts` (hashPassword), `../lib/nanoid.ts`, `../types.ts` (Env, InviteRole)
- **APIs / services**: Cloudflare D1 tables — `family_governance_log`, `families`, `invite_codes`, `family_roles`, `users`
