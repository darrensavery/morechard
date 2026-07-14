---
feature: 21-settings-profile
title: Settings & Profile Management
---

### Purpose

Provides parents with a unified control plane to manage their own account identity, family structure (children and co-parents), child-specific security and payment rules, app appearance, and active device sessions. Gives parents granular per-child configuration including growth paths, account locks, overdraft policy, and payment method whitelisting without requiring child involvement.

### Methodology

**API layer** (`worker/src/routes/settings.ts`):
- `GET /api/settings/profile` — returns authenticated user's name, email, avatar, family locale/currency/mode, and plan tier
- `PATCH /api/settings/profile` — updates display name, email, avatar seed, or family-level pocket money day and overdraft policy
- `GET /api/settings/family` — lists all children with their PIN lock state, growth path, and payment config
- `PATCH /api/settings/children/:childId` — updates per-child fields: display name, goal contribution cap, account lock, growth path (`orchard`/`clean`/`hybrid`), payment whitelist, and `parent_message`
- `GET /api/settings/sessions` — returns all active JWT sessions for the family, enriched with device/OS detection from stored user-agent strings
- `DELETE /api/settings/sessions/:sessionId` — revokes a specific session token

**UI layer**:
- `ProfileSettings` — avatar picker (DiceBear seed selection), inline name/email editing with optimistic PATCH calls, family locale display, danger-zone uproot action
- `ChildProfileSettings` — tabbed view (Identity, Payment, Growth, Account) driving PATCH calls per section; account lock toggle writes directly to `families.children` via the child endpoint
- `FamilySettings` — renders children list with quick-lock toggles, co-parent invite flow (generates a shareable 6-digit code), shared expense split selector, pocket money day picker, and overdraft policy radio group
- `AppearanceSettings` — theme (light/dark/system) and language stored in `localStorage`/context; no API call
- `ActiveSessionsSettings` — polls `GET /sessions`, displays device icon + relative timestamp, issues `DELETE` on revoke with immediate optimistic removal from list
- `SupportSettings` — in-app "Contact Support" form (posts to support-agent backend, creates Zoho Desk ticket), external help desk link to `https://support.morechard.com`, privacy policy, terms; reads `VITE_APP_VERSION` for display

### Dependencies

- **External packages**: `date-fns` (relative time in session list), DiceBear avatar API (CDN image URLs)
- **Internal modules**: `app/src/lib/api.ts` (authenticated fetch wrapper), `useAuth` hook (JWT + family context), `useToast` (feedback on PATCH success/failure), shared `Sheet`/`Dialog` UI primitives
- **APIs / services**: Cloudflare D1 (all reads/writes via Worker), Cloudflare Workers JWT validation on every settings endpoint; no external payment or AI calls in this feature
