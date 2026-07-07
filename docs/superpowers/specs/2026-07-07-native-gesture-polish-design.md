# Native Gesture Polish — Design

## Problem

Morechard was built PWA-first, and several UI patterns still behave like web
widgets instead of a native app: bottom sheets that only close via backdrop
tap or an X button, an AI mentor carousel with no dismiss affordance, a toast
that lacks swipe-to-dismiss, no haptic feedback on most confirm/dismiss
actions, and instant (non-animated) tab switches.

## Goals

- Every bottom sheet gets a visible drag handle + swipe-down-to-close,
  consistently, via one shared primitive.
- Mentor cards get an explicit close (X) — swipe stays reserved for paging
  between cards (already works via scroll-snap).
- MicroToast gets swipe-to-dismiss in addition to its existing timeout/×.
- Haptic feedback (`tick()` from `app/src/lib/haptics.ts`) fires on the native
  interaction moments a real app would tap: sheet dismiss, card dismiss,
  chore approve/reject, goal boost/purchase confirm, toggle switches.
- Tab switches (child + parent bottom nav) get a short fade/slide transition
  instead of an instant DOM swap.

## Non-goals

- Pull-to-refresh — genuinely a new feature (needs per-tab refetch wiring),
  not a gesture-polish fix. Deferred to a future spec if wanted.
- No new dependency. Everything is built on the existing `useDragToClose`
  hook and `haptics.ts` — no gesture library added.

## Design

### 1. `BaseSheet` (new, `app/src/components/ui/BaseSheet.tsx`)

Wraps the existing `useDragToClose` hook + handle bar markup + backdrop
click-to-close + `useAndroidBack(true, onClose)` into one component:

```tsx
<BaseSheet onClose={onClose} maxHeight="92svh">
  {/* sheet content */}
</BaseSheet>
```

Internally reuses `useDragToClose` (unchanged) — this is a composition
wrapper, not a rewrite of the drag logic.

### 2. Sheet migration

Migrate onto `BaseSheet`, replacing hand-rolled backdrop/close markup:
JarSettingsSheet, JarDetailSheet, VoidExpenseSheet, SpendGuideSheet,
ChoreGuideSheet, GiveRequestSheet, ReviewPromptSheet, PaymentConfirmSheet,
PaymentBridgeSheet.

Sheets already on `useDragToClose` directly (CreateChoreSheet,
AddExpenseSheet, RateGuideSheet, LogSpendSheet, ExpenseDetailSheet,
HistoryTab, SavingsGrove) are left as-is unless the migration is trivial —
no forced rewrite of working code.

### 3. `SwipeDismissCard` (new, `app/src/components/ui/SwipeDismissCard.tsx`)

Horizontal swipe past a threshold (~80px, either direction) fades + slides
the card out and calls `onDismiss`. Used only where dismiss ≠ navigate:

- `MicroToast` — swipe-to-dismiss added alongside existing timeout/×.

Mentor cards do **not** use `SwipeDismissCard` (swipe is reserved for the
existing carousel paging). Instead, `LiveBriefingCard` gets an explicit
close (X) button that hides the card for the session (local state, not a
server write).

### 4. Haptics sweep

Route `ChildBottomNav`'s local `triggerHaptic()` (raw `navigator.vibrate`)
through the shared `tick()` so native builds fire a real Capacitor haptic
instead of only the web vibrate fallback. Remove the duplicate function.

Add `tick()` calls at: `BaseSheet` dismiss (on the drag-close success path),
`SwipeDismissCard` dismiss, chore approve/reject, goal boost/purchase
confirm, and toggle switches (JarSettings, ChoreSheet auto-approve/proof
toggles).

### 5. Tab-switch transition

Add a short (~150ms) CSS fade/slide on tab content change in the
`ChildDashboard`/`ParentDashboard` tab-body wrapper (keyed on active tab),
not inside `ChildBottomNav`/`ParentBottomNav` themselves (those only render
the nav bar, not tab content).

## Testing

- Existing sheet tests (if any) continue to pass after `BaseSheet` migration
  — behavior (close on backdrop tap, close on drag >120px, Android back
  closes) is unchanged, only the markup is deduplicated.
- Manual pass on a device/emulator (or Chrome device-toolbar touch
  emulation) for: sheet drag-close, MicroToast swipe-dismiss, mentor card X
  close, tab-switch fade, haptic firing (native build only — web falls back
  to `navigator.vibrate`).
