# Child Invite Code Regenerate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Invite Code" row to the child profile settings screen that lets a parent view or regenerate their child's 6-digit login code at any time.

**Architecture:** A new backend endpoint `POST /auth/child/:childId/invite` invalidates any existing unredeemed code for that child and issues a fresh one. The frontend adds a new settings row + bottom sheet in `ChildProfileSettings.tsx` that calls this endpoint and displays the code with copy/share actions.

**Tech Stack:** Cloudflare Workers (TypeScript), Cloudflare D1, React + Tailwind, Web Share API, Clipboard API.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `worker/src/routes/invite.ts` | Modify | Add `handleRegenerateChildInvite` handler |
| `worker/src/index.ts` | Modify | Wire `POST /auth/child/:childId/invite` route |
| `app/src/lib/api.ts` | Modify | Add `regenerateChildInvite()` API function |
| `app/src/components/settings/sections/ChildProfileSettings.tsx` | Modify | Add invite code row + bottom sheet |

---

## Task 1: Backend — `handleRegenerateChildInvite`

**Files:**
- Modify: `worker/src/routes/invite.ts`

- [ ] **Step 1: Add the handler at the bottom of invite.ts (before the closing of the file)**

Open `worker/src/routes/invite.ts`. Add after the `handleAddChild` function (after line ~341), before any other exports:

```typescript
// ── POST /auth/child/:childId/invite ─────────────────────────────────────────
// Parent regenerates a child invite code. Invalidates any existing unredeemed
// code for this child and issues a fresh one valid for 72h.
// Returns: { invite_code: string; expires_at: number }
export async function handleRegenerateChildInvite(request: Request, env: Env, childId: string): Promise<Response> {
  const caller = (request as AuthedRequest).auth;
  if (!caller || caller.role !== 'parent') return error('Unauthorised', 401);

  // Verify the child belongs to the caller's family
  const child = await env.DB
    .prepare(`SELECT id FROM users WHERE id = ? AND family_id = ?`)
    .bind(childId, caller.family_id)
    .first<{ id: string }>();

  if (!child) return error('Child not found', 404);

  const code      = generateCode();
  const now       = Math.floor(Date.now() / 1000);
  const expiresAt = now + INVITE_TTL;

  // Invalidate all existing unredeemed codes for this child, then insert fresh one
  await env.DB.batch([
    env.DB.prepare(`
      DELETE FROM invite_codes
      WHERE child_id = ? AND redeemed_at IS NULL
    `).bind(childId),

    env.DB.prepare(`
      INSERT INTO invite_codes (code, family_id, created_by, role, expires_at, child_id)
      VALUES (?, ?, ?, 'child', ?, ?)
    `).bind(code, caller.family_id, caller.sub, expiresAt, childId),
  ]);

  return json({ invite_code: code, expires_at: expiresAt }, 200);
}
```

- [ ] **Step 2: Commit**

```bash
git add "worker/src/routes/invite.ts"
git commit -m "feat(worker): add handleRegenerateChildInvite endpoint"
```

---

## Task 2: Backend — Wire the Route

**Files:**
- Modify: `worker/src/index.ts`

- [ ] **Step 1: Import the new handler**

In `worker/src/index.ts`, find the existing import of `handleAddChild` from `invite.ts`:

```typescript
  handleAddChild,
```

Change it to:

```typescript
  handleAddChild,
  handleRegenerateChildInvite,
```

- [ ] **Step 2: Add the route**

In `worker/src/index.ts`, find the block containing:

```typescript
  if (path === '/auth/child/add'               && method === 'POST') return withAuth(request, auth, env, handleAddChild);
```

Add the new route immediately after it:

```typescript
  const regenChildInviteMatch = path.match(/^\/auth\/child\/([^/]+)\/invite$/);
  if (regenChildInviteMatch && method === 'POST') return withAuth(request, auth, env, (req, e) => handleRegenerateChildInvite(req, e, regenChildInviteMatch[1]));
```

- [ ] **Step 3: Commit**

```bash
git add "worker/src/index.ts"
git commit -m "feat(worker): wire POST /auth/child/:childId/invite route"
```

---

## Task 3: Frontend — API Function

**Files:**
- Modify: `app/src/lib/api.ts`

- [ ] **Step 1: Add the API function**

In `app/src/lib/api.ts`, find the `generateInvite` function:

```typescript
export async function generateInvite(role: 'child' | 'co-parent'): Promise<{ code: string; expires_at: number }> {
```

Add the new function directly after it:

```typescript
export async function regenerateChildInvite(childId: string): Promise<{ invite_code: string; expires_at: number }> {
  return request(`/auth/child/${encodeURIComponent(childId)}/invite`, {
    method: 'POST',
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/src/lib/api.ts"
git commit -m "feat(api): add regenerateChildInvite function"
```

---

## Task 4: Frontend — Invite Code Row + Sheet in ChildProfileSettings

**Files:**
- Modify: `app/src/components/settings/sections/ChildProfileSettings.tsx`

- [ ] **Step 1: Import the new API function**

Find the existing import line:

```typescript
import { renameChild, setChildPin as apiSetChildPin, setPaymentHandles, getFamilyId } from '../../../lib/api'
```

Replace with:

```typescript
import { renameChild, setChildPin as apiSetChildPin, setPaymentHandles, getFamilyId, regenerateChildInvite } from '../../../lib/api'
```

- [ ] **Step 2: Add the InviteCodeSheet component**

Find the comment `// ── Reset PIN Sheet ───` (around line 56). Add the new sheet component directly **above** it:

```typescript
// ── Invite Code Sheet ─────────────────────────────────────────────────────────

function InviteCodeSheet({
  child, onClose,
}: { child: ChildRecord; onClose: () => void }) {
  const [code,    setCode]    = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [copied,  setCopied]  = useState(false)

  useEffect(() => {
    let cancelled = false
    regenerateChildInvite(child.id)
      .then(res => { if (!cancelled) { setCode(res.invite_code); setLoading(false) } })
      .catch(() => { if (!cancelled) { setError('Could not generate code — please try again.'); setLoading(false) } })
    return () => { cancelled = true }
  }, [child.id])

  async function copyCode() {
    if (!code) return
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function shareCode() {
    if (!code) return
    const text = `Join ${child.display_name}'s family on Morechard! Download the app at app.morechard.com and enter code: ${code}`
    if (navigator.share) {
      await navigator.share({ text })
    } else {
      await copyCode()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-[var(--color-surface)] rounded-t-2xl p-6 space-y-5"
        onClick={e => e.stopPropagation()}
      >
        <div className="text-center space-y-1">
          <p className="text-[17px] font-bold text-[var(--color-text)]">
            {child.display_name}&apos;s Invite Code
          </p>
          <p className="text-[12px] text-[var(--color-text-muted)]">
            Share this code so {child.display_name} can log in on their device
          </p>
        </div>

        {loading && (
          <p className="text-center text-[14px] text-[var(--color-text-muted)] py-4">Generating…</p>
        )}

        {error && (
          <p className="text-center text-[13px] text-red-500">{error}</p>
        )}

        {code && !loading && (
          <>
            <div className="flex justify-center">
              <p className="text-[40px] font-extrabold tracking-[0.25em] text-[var(--brand-primary)] font-mono select-all">
                {code}
              </p>
            </div>
            <p className="text-[11px] text-[var(--color-text-muted)] text-center">
              Valid for 72 hours · Single use · Generating a new code invalidates the old one
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={copyCode}
                className="flex-1 py-3 rounded-xl text-[14px] font-bold border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-alt)] transition-colors cursor-pointer"
              >
                {copied ? '✓ Copied' : 'Copy Code'}
              </button>
              <button
                type="button"
                onClick={shareCode}
                className="flex-1 py-3 rounded-xl text-[14px] font-bold bg-[var(--brand-primary)] text-white hover:opacity-90 transition-opacity cursor-pointer"
              >
                Share
              </button>
            </div>
          </>
        )}

        <button
          type="button"
          onClick={onClose}
          className="w-full text-[13px] text-[var(--color-text-muted)] hover:underline cursor-pointer pt-1"
        >
          Close
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Add useEffect to the React imports**

Find the existing import:

```typescript
import { useState } from 'react'
import type { FormEvent } from 'react'
```

Replace with:

```typescript
import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
```

- [ ] **Step 4: Add sheet state to ChildProfileSettings component**

Inside `ChildProfileSettings`, find the existing state declarations (around line 350):

```typescript
  const [showPinSheet, setShowPinSheet] = useState(false)
```

Add immediately after:

```typescript
  const [showInviteSheet, setShowInviteSheet] = useState(false)
```

- [ ] **Step 5: Render the sheet**

Find the existing sheet render at the top of the return:

```typescript
      {showPinSheet && (
        <ResetPinSheet
          child={child}
          onSuccess={onPinResetSuccess}
          onClose={() => setShowPinSheet(false)}
        />
      )}
```

Add the invite sheet render directly after it:

```typescript
      {showInviteSheet && (
        <InviteCodeSheet
          child={child}
          onClose={() => setShowInviteSheet(false)}
        />
      )}
```

- [ ] **Step 6: Add the Invite Code settings row**

In the Identity & Security `SectionCard`, find the Login History row:

```typescript
            <SettingsRow
              icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>}
              label="Login History"
              description="Recent sessions and device activity"
              onClick={() => setActiveView('login-history')}
            />
```

Add the new row **before** Login History:

```typescript
            <SettingsRow
              icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>}
              label="Invite Code"
              description="Get a 6-digit code so your child can log in"
              onClick={() => setShowInviteSheet(true)}
            />
```

- [ ] **Step 7: Verify the app builds without TypeScript errors**

```bash
cd "e:/Web-Video Design/Claude/Apps/Pocket Money/app"
npm run build 2>&1 | tail -20
```

Expected: no TypeScript errors, build succeeds.

- [ ] **Step 8: Commit**

```bash
git add "app/src/components/settings/sections/ChildProfileSettings.tsx" "app/src/lib/api.ts"
git commit -m "feat(settings): add Invite Code row and sheet to child profile"
```

---

## Task 5: Manual Smoke Test

- [ ] **Step 1: Start dev server**

```bash
cd "e:/Web-Video Design/Claude/Apps/Pocket Money"
npm run dev
```

- [ ] **Step 2: Test the flow**

1. Log in as parent
2. Go to Settings → Family → tap Henry's name
3. Confirm new "Invite Code" row appears under Identity & Security
4. Tap it — sheet slides up, shows "Generating…" briefly then a 6-character uppercase code
5. Tap "Copy Code" — code copies to clipboard, button briefly shows "✓ Copied"
6. Tap "Share" — triggers Web Share sheet (or falls back to copy on desktop)
7. Close the sheet, tap "Invite Code" again — a **new** code is generated (old one is invalidated)

- [ ] **Step 3: Verify in D1 (optional)**

In Cloudflare D1 dashboard, run:

```sql
SELECT code, redeemed_at, expires_at FROM invite_codes WHERE child_id = '<henrys-child-id>' ORDER BY rowid DESC LIMIT 5;
```

Expect: only the most recent row has `redeemed_at IS NULL`. All prior rows for this child should be deleted (the handler uses `DELETE` before inserting).

---

## Self-Review Notes

- Spec requirement "invalidate old code" — covered: `DELETE FROM invite_codes WHERE child_id = ? AND redeemed_at IS NULL` runs before the insert.
- Spec requirement "copy + share" — covered: clipboard + Web Share API with copy fallback.
- Spec requirement "expiry note" — covered: "Valid for 72 hours" label in the sheet.
- Type consistency: `regenerateChildInvite` returns `{ invite_code, expires_at }` (matches handler), sheet reads `res.invite_code` — consistent.
- The `useEffect` cancellation flag prevents state updates on unmounted components.
