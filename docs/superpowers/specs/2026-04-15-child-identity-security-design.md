# Child Identity & Security — Design Spec
**Date:** 2026-04-15
**Scope:** Manage Family > Child > Identity & Security section (3 features)

---

## 1. Display Name (Rename Child)

### What it does
Parent taps "Display Name" → a slide-up sheet opens, pre-filled with the child's current name. Parent edits and saves. The child's `display_name` in `users` is updated immediately and reflected everywhere (child list, dashboard header, insights tab).

### Worker endpoint
`PATCH /api/child/:child_id/display-name`
- Requires parent JWT; caller must share the same `family_id` as the child.
- Body: `{ display_name: string }`
- Validates: non-empty, max 40 chars, trimmed.
- Returns: `{ ok: true, display_name: string }`

### UI behaviour
- Sheet: single `<input>` pre-filled with `child.display_name`.
- Trim on every `onChange` event before comparison — `value.trim()` is what drives the disabled state and is what gets sent to the API. A name of `"Leo "` is treated identically to `"Leo"` at the UI layer; the worker also trims before writing.
- Save button disabled when: trimmed value is empty **or** trimmed value equals the current name (no-ghost rule).
- On success: sheet closes, parent receives a "Name updated" toast, child list re-fetches so the new name is visible immediately.
- On error: inline error message below the input; sheet stays open.

---

## 2. Reset Child PIN

### What it does
Parent taps "Reset PIN" → a sheet opens with the Morechard 4-digit numeric keypad. Parent enters a new 4-digit PIN for the child. On submit, the child's `pin_hash` is updated via the existing endpoint.

### Worker endpoint
`POST /auth/child/set-pin` — **already exists**. No worker changes needed.
- Body: `{ child_id, pin }` (pin = 4 digits)
- Requires parent JWT.

### UI behaviour
- Sheet: standard 4-digit dot-display + numeric keypad (reuse existing PIN entry component/pattern).
- Heading: "Set a new PIN for [child name]" — everyday language, no mention of "secret key."
- Haptic feedback: fire `navigator.vibrate(10)` on each keypad digit tap (10ms, subtle). Guarded behind `if ('vibrate' in navigator)` — no-op on unsupported devices (iOS Safari, desktop). Provides the tactile "fintech" sense of security without forcing a library.
- On 4 digits entered: auto-submits (no separate confirm button, consistent with the rest of the app).
- On success: sheet closes + "PIN updated" success toast. This explicit confirmation is the key integrity signal for the parent.
- On error: keypad clears, inline error shown ("Something went wrong — try again").

### Copy fix
`SettingsRow` description: change from `"Generate a new 6-digit secret key"` → `"Update this child's 4-digit login PIN"`.

---

## 3. Login History

### Overview
A full sub-screen (same routing pattern as `ChildProfileSettings` inside `FamilySettings`). Shows a chronological, grouped, device-friendly log of the child's PIN logins.

### Data pipeline

**Schema — `child_logins` table** (already exists in migration `0008_app_tables.sql`):
```
child_id    TEXT  NOT NULL REFERENCES users(id)
logged_at   INTEGER                          -- unixepoch
ip_address  TEXT
```
Two columns need to be added via a new migration: `user_agent TEXT` and `session_jti TEXT` (FK to `sessions.jti`). The `session_jti` is required to accurately determine `is_current` — we JOIN `child_logins.session_jti` against `sessions WHERE revoked_at IS NULL`.

**Worker change — `handleChildLogin`:**  
After the successful session INSERT, also INSERT into `child_logins`:
```sql
INSERT INTO child_logins (child_id, logged_at, ip_address, user_agent, session_jti)
VALUES (?, ?, ?, ?, ?)
```

**New worker endpoint:**  
`GET /api/child/:child_id/login-history`
- Requires parent JWT; must share same `family_id` as child.
- Returns last 50 rows ordered by `logged_at DESC` (enforced at the DB query level — keeps the table lean for now; a scheduled cleanup job is a future concern).
- Response: `{ logins: LoginEntry[] }` where `LoginEntry = { id, logged_at, ip_address, device_label, device_type, is_current }`
  - `device_label` and `device_type` are computed server-side from `user_agent` (see UA parsing below).
  - `is_current`: `true` when `child_logins.session_jti` is found in `sessions` with `revoked_at IS NULL` AND `user_id = child_id`. This specifically checks the **child's** active sessions — not the parent's. If the child is currently logged in on their tablet in the other room, that entry pulses green. The parent's own session is irrelevant to this check.

### UA parsing (server-side, worker)
Pure string matching — no external library. Priority order:

| Signal in UA string | `device_label` | `device_type` |
|---|---|---|
| iPad | "iPad" | `tablet` |
| Android + (Tablet\|Tab\|large screen heuristic) | "Android Tablet" | `tablet` |
| iPhone | "iPhone" | `mobile` |
| Android (no tablet signal) | "Android Phone" | `mobile` |
| Windows | "Windows PC" | `desktop` |
| Macintosh / Mac OS X | "Mac" | `desktop` |
| Linux (non-Android) | "Linux PC" | `desktop` |
| CrOS | "Chromebook" | `desktop` |
| Anything else / null | "Unknown Device" | `desktop` |

Append browser name when recognisable: Edge, Chrome, Firefox, Safari. Separator is ` · ` (space-middot-space) — not a dash — for legibility on small mobile screens. Examples: "iPhone · Safari", "Windows PC · Chrome", "Unknown Device" (no browser appended when device is unknown).

### UI — `ChildLoginHistory` component

**Routing:** `ChildProfileSettings` gains an `activeView` state (`'root' | 'login-history'`). Tapping "Login History" sets it to `'login-history'`; the component renders `ChildLoginHistory` with a back button that returns to `'root'`.

**Layout:**
- `SectionHeader` with child name + "Login History" subtitle + back arrow.
- Entries grouped by day label: "Today", "Yesterday", then "Mon 14 Apr" etc.
- Each entry:
  - **Left:** device type icon (mobile = phone icon, tablet = tablet icon, desktop = monitor icon)
  - **Centre:** `device_label` (bold, 14px) on top; IP address dimmed below (12px, muted colour)
  - **Right:** relative time ("2 hours ago", "3 days ago") — full ISO datetime on `title` attribute for hover/long-press tooltip
  - **Current session indicator:** tiny pulsing green dot (CSS `animate-pulse`) overlaid on the device icon's top-right corner, shown when `is_current === true`
- Empty state: centred message "No login history yet — logins will appear here once [child name] signs in."
- Loading state: 2–3 skeleton rows.

**Data fetching:** fetched on mount, no auto-refresh (parent is reviewing history, not monitoring live).

---

## Out of scope
- Cleanup/purge job for old login records (future work).
- Child-facing login history view.
- Geolocation lookup from IP address.

---

## Files affected

| File | Change |
|---|---|
| `worker/migrations/0024_child_logins_user_agent.sql` | ADD COLUMN user_agent TEXT + session_jti TEXT to child_logins |
| `worker/src/routes/auth.ts` | INSERT into child_logins on successful child login |
| `worker/src/routes/settings.ts` | New PATCH /api/child/:id/display-name + GET /api/child/:id/login-history |
| `worker/src/index.ts` | Wire new routes |
| `app/src/lib/api.ts` | Add `renameChild()` + `getChildLoginHistory()` API functions |
| `app/src/components/settings/sections/ChildProfileSettings.tsx` | Wire all 3 rows; add activeView routing; add DisplayNameSheet + ResetPinSheet |
| `app/src/components/settings/sections/ChildLoginHistory.tsx` | New component |
| `app/src/components/settings/sections/FamilySettings.tsx` | Pass new callbacks through to ChildProfileSettings |
| `app/src/components/dashboard/ParentSettingsTab.tsx` | Handle new callbacks |
