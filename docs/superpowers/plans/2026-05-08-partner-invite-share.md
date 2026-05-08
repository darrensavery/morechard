# Partner Invite Code Share Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Share button below the partner invite code that triggers the native OS share sheet, with a clipboard-copy fallback on desktop.

**Architecture:** All changes are self-contained in `FamilySettings.tsx`. A `copied` boolean state drives the desktop fallback label swap. `navigator.share` is feature-detected at call time; if absent, `copyText()` from the existing clipboard utility is used instead.

**Tech Stack:** React (useState), Web Share API (`navigator.share`), existing `copyText` utility at `app/src/lib/clipboard.ts`.

---

### Task 1: Add `copied` state and `handleShare` handler

**Files:**
- Modify: `app/src/components/settings/sections/FamilySettings.tsx:67-103`

- [ ] **Step 1: Add `copied` state after the existing `genningInvite` state (line 69)**

  Current block (lines 67–69):
  ```tsx
  const [inviteCode,    setInviteCode]    = useState<string | null>(null)
  const [inviteExpiry,  setInviteExpiry]  = useState<string | null>(null)
  const [genningInvite, setGenningInvite] = useState(false)
  ```

  Replace with:
  ```tsx
  const [inviteCode,    setInviteCode]    = useState<string | null>(null)
  const [inviteExpiry,  setInviteExpiry]  = useState<string | null>(null)
  const [genningInvite, setGenningInvite] = useState(false)
  const [copied,        setCopied]        = useState(false)
  ```

- [ ] **Step 2: Add `handleShare` function after `handleGenerateInvite` (after line 103)**

  ```tsx
  async function handleShare() {
    const text = `Join my family on Morechard! Download the app at app.morechard.com and use invite code ${inviteCode} to join.`
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join my family on Morechard!',
          text,
          url: 'https://app.morechard.com',
        })
      } catch {
        // user cancelled or share failed — ignore
      }
    } else {
      await copyText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }
  ```

- [ ] **Step 3: Add `copyText` import at the top of the file**

  Current import block (line 9):
  ```tsx
  import { useState, type FormEvent } from 'react'
  ```

  Add after it:
  ```tsx
  import { copyText } from '../../../lib/clipboard'
  ```

- [ ] **Step 4: Verify the file compiles**

  Run: `npm run build --prefix "e:/Web-Video Design/Claude/Apps/Pocket Money/app"`

  Expected: build completes with no TypeScript errors referencing `FamilySettings.tsx`.

- [ ] **Step 5: Commit**

  ```bash
  git add "app/src/components/settings/sections/FamilySettings.tsx"
  git commit -m "feat(settings): add handleShare + copied state for partner invite"
  ```

---

### Task 2: Update the invite code UI to show Share and Clear inline

**Files:**
- Modify: `app/src/components/settings/sections/FamilySettings.tsx:392-397`

- [ ] **Step 1: Replace the invite code display block**

  Current (lines 392–397):
  ```tsx
  {inviteCode ? (
    <div className="space-y-1">
      <p className="text-[13px] text-[var(--color-text-muted)]">Share this code (expires {inviteExpiry}):</p>
      <p className="text-[22px] font-extrabold tracking-widest text-[var(--color-text)]">{inviteCode}</p>
      <button onClick={() => setInviteCode(null)} className="text-[12px] text-[var(--color-text-muted)] hover:underline cursor-pointer">Clear</button>
    </div>
  ) : (
  ```

  Replace with:
  ```tsx
  {inviteCode ? (
    <div className="space-y-1">
      <p className="text-[13px] text-[var(--color-text-muted)]">Share this code (expires {inviteExpiry}):</p>
      <p className="text-[22px] font-extrabold tracking-widest text-[var(--color-text)]">{inviteCode}</p>
      <div className="flex items-center gap-4">
        <button
          onClick={handleShare}
          className="text-[12px] font-semibold text-[var(--color-text)] hover:underline cursor-pointer"
        >
          {copied ? 'Copied!' : 'Share'}
        </button>
        <button
          onClick={() => setInviteCode(null)}
          className="text-[12px] text-[var(--color-text-muted)] hover:underline cursor-pointer"
        >
          Clear
        </button>
      </div>
    </div>
  ) : (
  ```

- [ ] **Step 2: Build to confirm no errors**

  Run: `npm run build --prefix "e:/Web-Video Design/Claude/Apps/Pocket Money/app"`

  Expected: clean build, no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add "app/src/components/settings/sections/FamilySettings.tsx"
  git commit -m "feat(settings): show Share button next to Clear on partner invite code"
  ```

---

### Task 3: Manual smoke test

- [ ] **Step 1: Start the dev server**

  ```bash
  npm run dev --prefix "e:/Web-Video Design/Claude/Apps/Pocket Money/app"
  ```

- [ ] **Step 2: Mobile path — open on a phone or Chrome DevTools mobile emulation**

  1. Navigate to Settings → Manage Family.
  2. Tap **Generate invite code** — code and expiry appear.
  3. Tap **Share** — native OS share sheet appears with WhatsApp, Messenger, SMS, Email options.
  4. The share text reads: `"Join my family on Morechard! Download the app at app.morechard.com and use invite code XXXXXX to join."`
  5. Cancel the sheet — no error shown in the UI.
  6. Tap **Clear** — code disappears, Generate button returns.

- [ ] **Step 3: Desktop fallback path**

  1. Open in a desktop browser (Chrome/Firefox — `navigator.share` not available).
  2. Generate a code, tap **Share**.
  3. Button label changes to **Copied!** for ~1.5 s, then reverts to **Share**.
  4. Paste clipboard contents — confirm the full share message is present.

- [ ] **Step 4: Commit if any fixes were needed during smoke test**

  ```bash
  git add -p
  git commit -m "fix(settings): smoke-test corrections to partner invite share"
  ```
