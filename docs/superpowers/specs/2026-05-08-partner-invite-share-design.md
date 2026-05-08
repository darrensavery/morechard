# Partner Invite Code — Share Button Design

**Date:** 2026-05-08  
**Status:** Approved

---

## Overview

When a parent generates a partner invite code in the Manage Family section of Settings, add a **Share** button that triggers the native OS share sheet (Web Share API). Desktop browsers that don't support `navigator.share` fall back to clipboard copy with a brief confirmation label.

---

## UI Changes

**File:** `app/src/components/settings/sections/FamilySettings.tsx` (lines 392–397)

### Before

```
Share this code (expires ...):
VN5HKC
Clear
```

### After

```
Share this code (expires ...):
VN5HKC
[Share]   [Clear]
```

- Share and Clear are inline, rendered as small text-weight actions below the code.
- Share is slightly more visually prominent than Clear (e.g. standard text colour vs muted).
- Clear retains its existing muted style and `onClick={() => setInviteCode(null)}` behaviour.

---

## Share Behaviour

### Primary path — `navigator.share` (mobile)

```ts
navigator.share({
  title: 'Join my family on Morechard!',
  text: `Join my family on Morechard! Download the app at app.morechard.com and use invite code ${inviteCode} to join.`,
  url: 'https://app.morechard.com',
})
```

- Guard with `if (navigator.share)` before calling.
- The OS share sheet surfaces WhatsApp, Messenger, SMS, Email, and any other apps installed on the device — no custom platform list needed.
- Errors (user cancel, share failure) are caught and silently ignored.

### Fallback path — clipboard copy (desktop)

- When `navigator.share` is undefined, call `copyText()` from `app/src/lib/clipboard.ts` with the same text string.
- Replace the Share button label with **"Copied!"** for 1.5 s, then revert to "Share".
- Use a local `useState<boolean>` (`copied`) to drive the label swap.

---

## State

One new piece of local state in `FamilySettings.tsx`:

```ts
const [copied, setCopied] = useState(false);
```

Used only for the desktop fallback label. No other state changes.

---

## No New Files

All changes are self-contained in `FamilySettings.tsx`. The `copyText` utility already exists at `app/src/lib/clipboard.ts`.

---

## Share Message

> "Join my family on Morechard! Download the app at app.morechard.com and use invite code **{inviteCode}** to join."

The `url` field (`https://app.morechard.com`) is passed separately so platforms that display link previews (iMessage, WhatsApp) render it correctly.

---

## Out of Scope

- Custom platform picker UI (not needed — OS sheet handles this).
- Deep-link invite URL encoding (invite code is text-only for now).
- BLIK or regional share variants.
