# Activity Tab Merge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fold the separate Approvals tab into a unified Activity hub, pin Pay out / Add Bonus actions at the top, add a conditional pending-approvals section, add a Weekly Rhythm dot visualisation on history cards, move the nav badge to Activity, and fix all "Job/Maker/Custodian" terminology throughout `app/src`.

**Architecture:** `HistoryTab.tsx` becomes the single Activity hub — it absorbs all logic from `PendingTab.tsx` (pending-completions fetch, approve/revise flows, approve-all modal) and owns the `onCountChange` callback. `ParentDashboard.tsx` removes the `approvals` tab entry and routes the pending badge to `activity`. `PendingTab.tsx` is left in place but its render is no longer invoked (it can be removed in a future cleanup PR). No new API calls are added; the existing `getCompletions`, `getHistory`, `getPayouts`, `createPayout`, `createBonus`, `approveCompletion`, `reviseCompletion`, `approveAll` functions are sufficient.

**Tech Stack:** React 18, TypeScript, Tailwind CSS (via CSS custom properties `--brand-primary`, `--color-*`), Cloudflare D1 / existing REST API (`app/src/lib/api.ts`), Vite PWA.

---

## File Map

| File | Change |
|---|---|
| `app/src/components/dashboard/HistoryTab.tsx` | **Rewrite** — absorbs pending logic, adds sticky action row, Weekly Rhythm dots, AI Mentor empty-state card, terminology fixes |
| `app/src/screens/ParentDashboard.tsx` | **Modify** — remove `approvals` tab, move badge to `activity`, clean session-storage fallback |
| `app/src/screens/ChildDashboard.tsx` | **Modify** — terminology: "job" → "chore" in UI strings (3 occurrences) |
| `app/src/components/registration/Stage1ParentIdentity.tsx` | **Modify** — comment only: "Custodian" → "Lead Parent" |

> `PendingTab.tsx` is **not deleted** — it becomes dead code this sprint. A follow-up commit can remove it.

---

## Task 1: ParentDashboard — remove Approvals tab, move badge, fix session fallback

**Files:**
- Modify: `app/src/screens/ParentDashboard.tsx`

### What to change

**Line 31** — remove `'approvals'` from the `Tab` union:
```tsx
type Tab = 'chores' | 'activity' | 'insights' | 'goals'
```

**Lines 38–42** — update the valid tab list and fallback in the `useState` initialiser:
```tsx
const [tab, setTab] = useState<Tab>(() => {
  const saved = sessionStorage.getItem('mc_parent_tab')
  const valid: Tab[] = ['chores', 'activity', 'insights', 'goals']
  return valid.includes(saved as Tab) ? (saved as Tab) : 'chores'
})
```

**Lines 104–110** — update the `TABS` array: remove `approvals` entry, add badge to `activity`:
```tsx
const TABS: { id: Tab; label: string; badge?: number }[] = [
  { id: 'chores',   label: 'Chores' },
  { id: 'activity', label: 'Activity', badge: pendingCount || undefined },
  { id: 'insights', label: 'Insights' },
  { id: 'goals',    label: 'Goals' },
]
```

**Lines 271–276** — remove the `approvals` render branch, update `ActivityTab` props to include `onCountChange`:
```tsx
{tab === 'chores'   && <ChoresTab      familyId={familyId} child={activeChild} children={children} />}
{tab === 'activity' && <ActivityTab    familyId={familyId} child={activeChild} onCountChange={setPendingCount} />}
{tab === 'insights' && <InsightsTab    familyId={familyId} child={activeChild} children={children} />}
{tab === 'goals'    && <GoalBoostingTab familyId={familyId} child={activeChild} />}
```

Also remove the `PendingTab` import from line 9 (it is no longer rendered — leave the file itself in place).

- [ ] **Step 1: Apply all four edits above to `ParentDashboard.tsx`**

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd "e:/Web-Video Design/Claude/Apps/Pocket Money/app" && npx tsc --noEmit 2>&1 | head -30`

Expected: zero errors related to `Tab`, `PendingTab`, or `ActivityTab`.

- [ ] **Step 3: Commit**

```bash
git add app/src/screens/ParentDashboard.tsx
git commit -m "feat(nav): merge approvals into activity tab, move pending badge"
```

---

## Task 2: HistoryTab — new interface, pending section data fetching

**Files:**
- Modify: `app/src/components/dashboard/HistoryTab.tsx`

This task wires up the new props and data layer. The UI render is done in Task 3 and 4.

### Step-by-step

- [ ] **Step 1: Update the Props interface and add all new state**

Replace the existing `interface Props` block and the `export function ActivityTab` signature + state declarations with the following. Keep all existing modal state (`showPayout`, `showBonus`, etc.) untouched — just add above them:

```tsx
interface Props {
  familyId: string
  child: ChildRecord
  onCountChange: (n: number) => void
  /** Reserved for next iteration — real goal progress data */
  goalProgress?: { goalName: string; choresRemaining: number } | null
}

export function ActivityTab({ familyId, child, onCountChange, goalProgress }: Props) {
  // ── Pending completions (absorbed from PendingTab) ───────────────────────────
  const { challenge, GatekeeperModal } = useGatekeeper()
  const [completions,        setCompletions]        = useState<Completion[]>([])
  const [pendingLoading,     setPendingLoading]     = useState(true)
  const [reviseId,           setReviseId]           = useState<string | null>(null)
  const [reviseNote,         setReviseNote]         = useState('')
  const [approveBusy,        setApproveBusy]        = useState<string | null>(null)
  const [approveAllBusy,     setApproveAllBusy]     = useState(false)
  const [showApproveAllModal,setShowApproveAllModal]= useState(false)

  // ── History + payouts (existing state — keep as-is) ──────────────────────────
  const [history,  setHistory]  = useState<Completion[]>([])
  const [payouts,  setPayouts]  = useState<PayoutRecord[]>([])
  const [loading,  setLoading]  = useState(true)
  const [offset,   setOffset]   = useState(0)
  const [hasMore,  setHasMore]  = useState(false)

  // ── Pay out modal state (existing — keep as-is) ───────────────────────────────
  const [showPayout,    setShowPayout]    = useState(false)
  const [payoutAmount,  setPayoutAmount]  = useState('')
  const [payoutNote,    setPayoutNote]    = useState('')
  const [payoutBusy,    setPayoutBusy]    = useState(false)
  const [payoutError,   setPayoutError]   = useState<string | null>(null)

  // ── Bonus modal state (existing — keep as-is) ────────────────────────────────
  const [showBonus,    setShowBonus]    = useState(false)
  const [bonusAmount,  setBonusAmount]  = useState('')
  const [bonusReason,  setBonusReason]  = useState('')
  const [bonusBusy,    setBonusBusy]    = useState(false)
  const [bonusError,   setBonusError]   = useState<string | null>(null)
```

- [ ] **Step 2: Add the imports that are now needed**

At the top of the file, add the missing imports (merge with existing import block):

```tsx
import { useState, useEffect, useCallback } from 'react'
import type { Completion, PayoutRecord, ChildRecord } from '../../lib/api'
import {
  getHistory, getPayouts, createPayout, createBonus, formatCurrency,
  getCompletions, approveCompletion, reviseCompletion, approveAll, getProofUrl,
} from '../../lib/api'
import { useGatekeeper } from '../../hooks/useGatekeeper'
```

- [ ] **Step 3: Add the pending-completions fetch + effect**

Insert this `loadPending` callback and effect immediately after the state declarations, before the existing `load` callback:

```tsx
const loadPending = useCallback(async () => {
  setPendingLoading(true)
  const r = await getCompletions({ family_id: familyId, child_id: child.id, status: 'awaiting_review' })
  setCompletions(r.completions)
  onCountChange(r.completions.length)
  setPendingLoading(false)
}, [familyId, child.id, onCountChange])

useEffect(() => { loadPending() }, [familyId, child.id])
```

- [ ] **Step 4: Add approve / revise / approve-all handlers**

Insert these handler functions after `loadPending`, before the existing `load` callback:

```tsx
async function handleApprove(id: string) {
  setApproveBusy(id)
  try { await approveCompletion(id); await loadPending() }
  finally { setApproveBusy(null) }
}

async function handleRevise(id: string) {
  if (!reviseNote.trim()) return
  setApproveBusy(id)
  try {
    await reviseCompletion(id, reviseNote.trim())
    setReviseId(null)
    setReviseNote('')
    await loadPending()
  } finally { setApproveBusy(null) }
}

async function handleConfirmApproveAll() {
  setShowApproveAllModal(false)
  setApproveAllBusy(true)
  try { await approveAll(familyId, child.id); await loadPending() }
  finally { setApproveAllBusy(false) }
}

const approveAllTotal    = completions.reduce((s, c) => s + c.reward_amount, 0)
const approveAllCurrency = completions[0]?.currency ?? 'GBP'
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd "e:/Web-Video Design/Claude/Apps/Pocket Money/app" && npx tsc --noEmit 2>&1 | head -30`

Expected: zero new errors.

- [ ] **Step 6: Commit**

```bash
git add app/src/components/dashboard/HistoryTab.tsx
git commit -m "feat(activity): wire pending completions data + approve/revise handlers"
```

---

## Task 3: HistoryTab — new layout (sticky actions + pending section + AI Mentor card)

**Files:**
- Modify: `app/src/components/dashboard/HistoryTab.tsx`

This task rewrites the JSX `return` block of `ActivityTab`. The existing Pay out / Bonus bottom sheets and payouts list are preserved — only the outer layout structure changes.

- [ ] **Step 1: Replace the entire `return (...)` block of `ActivityTab`**

Replace everything from `return (` through the closing `</div>` of the outer `<div className="space-y-4">` with the following. The Pay out and Bonus bottom-sheet markup is kept verbatim inside `{showPayout && ...}` and `{showBonus && ...}` — copy them from the existing file unchanged; they are omitted here with `{/* ... existing payout sheet ... */}` markers for brevity but must remain in the actual file:

```tsx
  return (
    <div className="space-y-4">
      <GatekeeperModal />

      {/* ── Sticky action row ────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-[var(--color-bg)] pt-1 pb-2 -mx-3.5 px-3.5 flex gap-2 border-b border-[var(--color-border)]">
        <button
          onClick={() => setShowPayout(true)}
          className="flex-1 bg-[var(--brand-primary)] text-white font-bold py-3 rounded-xl text-[14px] hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer shadow-sm"
        >
          Pay out
        </button>
        <button
          onClick={() => setShowBonus(true)}
          className="flex-1 border-2 border-[var(--brand-primary)] text-[var(--brand-primary)] font-bold py-3 rounded-xl text-[14px] bg-white hover:bg-[color-mix(in_srgb,var(--brand-primary)_6%,transparent)] active:scale-[0.98] transition-all cursor-pointer"
        >
          + Bonus
        </button>
      </div>

      {/* ── Pending approvals section (conditional) ──────────────────────────── */}
      {!pendingLoading && completions.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-extrabold text-[var(--color-text-muted)] uppercase tracking-wider">
              Pending Approvals
            </p>
            <span className="bg-red-500 text-white text-[10px] font-bold rounded-full px-2 py-0.5 leading-none">
              {completions.length}
            </span>
          </div>

          {/* Approve-all bulk action — only when >1 pending */}
          {completions.length > 1 && (
            <button
              onClick={() => setShowApproveAllModal(true)}
              disabled={approveAllBusy}
              className="w-full bg-[var(--brand-primary)] text-white font-bold py-3.5 rounded-2xl text-[15px] hover:opacity-90 disabled:opacity-50 cursor-pointer shadow-sm active:scale-[0.98] transition-all"
            >
              {approveAllBusy ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/60 border-t-white rounded-full animate-spin" />
                  Approving…
                </span>
              ) : `Approve all ${completions.length} submissions`}
            </button>
          )}

          {completions.map(c => (
            <AuditCard
              key={c.id}
              completion={c}
              isRevising={reviseId === c.id}
              reviseNote={reviseNote}
              busy={approveBusy === c.id}
              anyBusy={!!approveBusy || approveAllBusy}
              onApprove={() => challenge(() => handleApprove(c.id))}
              onStartRevise={() => { setReviseId(c.id); setReviseNote('') }}
              onCancelRevise={() => { setReviseId(null); setReviseNote('') }}
              onReviseNoteChange={setReviseNote}
              onConfirmRevise={() => handleRevise(c.id)}
            />
          ))}
        </section>
      )}

      {/* ── Approve-all confirmation modal ───────────────────────────────────── */}
      {showApproveAllModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowApproveAllModal(false)} />
          <div className="relative bg-[var(--color-surface)] rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-4">
            <div>
              <p className="text-[18px] font-extrabold text-[var(--color-text)] tracking-tight">Confirm payment</p>
              <p className="text-[13px] text-[var(--color-text-muted)] mt-1 leading-relaxed">
                You are about to pay out <strong className="text-[var(--color-text)]">{completions.length} chore{completions.length !== 1 ? 's' : ''}</strong> totalling{' '}
                <strong className="text-[var(--brand-primary)]">{formatCurrency(approveAllTotal, approveAllCurrency)}</strong>.
                Have you verified that these chores meet the agreed standard?
              </p>
            </div>
            <div className="max-h-48 overflow-y-auto rounded-xl border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
              {completions.map(c => (
                <div key={c.id} className="flex items-center justify-between px-3.5 py-2.5">
                  <span className="text-[13px] text-[var(--color-text)] truncate mr-3">{c.chore_title}</span>
                  <span className="text-[13px] font-semibold tabular-nums text-[var(--brand-primary)] shrink-0">
                    {formatCurrency(c.reward_amount, c.currency)}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex gap-2.5">
              <button
                onClick={() => setShowApproveAllModal(false)}
                className="flex-1 border border-[var(--color-border)] rounded-xl py-3 text-[14px] font-semibold text-[var(--color-text-muted)] hover:bg-[var(--color-surface-alt)] cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => challenge(handleConfirmApproveAll)}
                className="flex-1 bg-[var(--brand-primary)] text-white rounded-xl py-3 text-[14px] font-bold hover:opacity-90 cursor-pointer active:scale-[0.98] transition-all shadow-sm"
              >
                Confirm &amp; pay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── AI Mentor empty-state card (shown only when no pending approvals) ── */}
      {!pendingLoading && completions.length === 0 && (
        <MentorEmptyCard childName={child.display_name} goalProgress={goalProgress ?? null} />
      )}

      {/* ── Pay out bottom sheet (existing — keep verbatim) ──────────────────── */}
      {showPayout && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={e => { if (e.target === e.currentTarget) { setShowPayout(false); setPayoutError(null) } }}
        >
          <form
            onSubmit={handlePayout}
            className="w-full max-w-lg bg-[var(--color-surface)] rounded-t-2xl p-5 space-y-3 pb-safe"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-1">
              <p className="text-[15px] font-bold text-[var(--color-text)]">Pay out to {child.display_name}</p>
              <button type="button" onClick={() => { setShowPayout(false); setPayoutError(null) }}
                className="w-7 h-7 rounded-full flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text)] cursor-pointer">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>
            {payoutError && <p className="text-[13px] text-red-600">{payoutError}</p>}
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-[var(--color-text-muted)]">£</span>
              <input
                type="number" min="0.01" step="0.01" required autoFocus
                className="w-full border border-[var(--color-border)] rounded-lg pl-7 pr-3 py-2.5 text-[14px] bg-[var(--color-surface)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
                placeholder="0.00"
                value={payoutAmount}
                onChange={e => setPayoutAmount(e.target.value)}
              />
            </div>
            <input
              className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2.5 text-[14px] bg-[var(--color-surface)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
              placeholder="Note (optional)"
              value={payoutNote}
              onChange={e => setPayoutNote(e.target.value)}
            />
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => { setShowPayout(false); setPayoutError(null) }}
                className="flex-1 border border-[var(--color-border)] rounded-xl py-2.5 text-[14px] font-semibold text-[var(--color-text-muted)] hover:bg-[var(--color-surface-alt)] cursor-pointer">
                Cancel
              </button>
              <button type="submit" disabled={payoutBusy}
                className="flex-1 bg-[var(--brand-primary)] text-white rounded-xl py-2.5 text-[14px] font-extrabold hover:opacity-90 disabled:opacity-50 cursor-pointer ring-2 ring-[var(--brand-primary)] ring-offset-1">
                {payoutBusy ? 'Saving…' : '✓ Confirm payment'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Bonus bottom sheet (existing — keep verbatim) ────────────────────── */}
      {showBonus && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={e => { if (e.target === e.currentTarget) { setShowBonus(false); setBonusError(null) } }}
        >
          <form
            onSubmit={handleBonus}
            className="w-full max-w-lg bg-[var(--color-surface)] rounded-t-2xl p-5 space-y-3 pb-safe"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-1">
              <p className="text-[15px] font-bold text-[var(--color-text)]">Add bonus for {child.display_name}</p>
              <button type="button" onClick={() => { setShowBonus(false); setBonusError(null) }}
                className="w-7 h-7 rounded-full flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text)] cursor-pointer">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>
            {bonusError && <p className="text-[13px] text-red-600">{bonusError}</p>}
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-[var(--color-text-muted)]">£</span>
              <input
                type="number" min="0.01" step="0.01" required autoFocus
                className="w-full border border-[var(--color-border)] rounded-lg pl-7 pr-3 py-2.5 text-[14px] bg-[var(--color-surface)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
                placeholder="0.00"
                value={bonusAmount}
                onChange={e => setBonusAmount(e.target.value)}
              />
            </div>
            <input
              required
              className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2.5 text-[14px] bg-[var(--color-surface)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
              placeholder="Reason (required)"
              value={bonusReason}
              onChange={e => setBonusReason(e.target.value)}
            />
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => { setShowBonus(false); setBonusError(null) }}
                className="flex-1 border border-[var(--color-border)] rounded-xl py-2.5 text-[14px] font-semibold text-[var(--color-text-muted)] hover:bg-[var(--color-surface-alt)] cursor-pointer">
                Cancel
              </button>
              <button type="submit" disabled={bonusBusy}
                className="flex-1 bg-[var(--brand-primary)] text-white rounded-xl py-2.5 text-[14px] font-bold hover:opacity-90 disabled:opacity-50 cursor-pointer">
                {bonusBusy ? 'Saving…' : 'Add bonus'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Recent payouts ───────────────────────────────────────────────────── */}
      {payouts.length > 0 && (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl divide-y divide-[var(--color-border)]">
          <p className="px-4 py-2.5 text-[13px] font-bold text-[var(--color-text-muted)] uppercase tracking-wide">Recent payouts</p>
          {payouts.slice(0, 3).map(p => (
            <div key={p.id} className="px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-[14px] font-semibold text-[var(--color-text)]">{formatCurrency(p.amount, p.currency)}</p>
                <p className="text-[12px] text-[var(--color-text-muted)]">
                  {new Date(p.paid_at * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  {p.note && ` · ${p.note}`}
                </p>
              </div>
              <span className="text-[12px] font-semibold text-[var(--brand-primary)] bg-[color-mix(in_srgb,var(--brand-primary)_12%,transparent)] rounded-full px-2 py-1">Paid</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Chore history ────────────────────────────────────────────────────── */}
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl divide-y divide-[var(--color-border)]">
        <p className="px-4 py-2.5 text-[13px] font-bold text-[var(--color-text-muted)] uppercase tracking-wide">Chore history</p>
        {loading && history.length === 0 ? (
          <div className="px-4 py-6 text-center text-[14px] text-[var(--color-text-muted)]">Loading…</div>
        ) : history.length === 0 ? (
          <div className="px-4 py-6 text-center text-[14px] text-[var(--color-text-muted)]">No history yet.</div>
        ) : (
          <>
            {history.map(item => {
              const s = STATUS_STYLES[item.status] ?? { label: item.status, bg: 'bg-gray-100', text: 'text-gray-600' }
              const itemDate = new Date(item.submitted_at * 1000)
              return (
                <div key={item.id} className="px-4 py-3 flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold text-[var(--color-text)] truncate">{item.chore_title}</p>
                    <p className="text-[12px] text-[var(--color-text-muted)]">
                      {formatCurrency(item.reward_amount, item.currency)} ·{' '}
                      {itemDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      {item.rejection_note && <span className="ml-1 italic text-red-500">"{item.rejection_note}"</span>}
                    </p>
                    <WeeklyRhythmDots submittedAt={item.submitted_at} history={history} choreTitle={item.chore_title} />
                  </div>
                  <span className={`shrink-0 text-[11px] font-bold rounded-full px-2 py-1 ${s.bg} ${s.text}`}>
                    {s.label}
                  </span>
                </div>
              )
            })}
            {hasMore && (
              <button
                onClick={() => { setOffset(o => o + LIMIT); load() }}
                className="w-full py-3 text-[13px] font-semibold text-[var(--color-text-muted)] hover:bg-[var(--color-surface-alt)] cursor-pointer"
              >
                Load more
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd "e:/Web-Video Design/Claude/Apps/Pocket Money/app" && npx tsc --noEmit 2>&1 | head -30`

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/dashboard/HistoryTab.tsx
git commit -m "feat(activity): new layout — sticky actions, pending section, chore history header"
```

---

## Task 4: HistoryTab — add WeeklyRhythmDots and MentorEmptyCard components

**Files:**
- Modify: `app/src/components/dashboard/HistoryTab.tsx`

Add both helper components at the bottom of the file, after the closing brace of `ActivityTab`. The `AuditCard` component is copied verbatim from `PendingTab.tsx` — it is a self-contained component and can live in this file without modification.

- [ ] **Step 1: Add WeeklyRhythmDots component**

Append to the bottom of `HistoryTab.tsx`:

```tsx
// ── Weekly Rhythm Dots ────────────────────────────────────────────────────────
// Shows a M–Sun strip. Days within the current calendar week on which the child
// submitted THIS chore are filled teal; all other days are light gray.

function getWeekBounds(): { weekStart: Date; weekEnd: Date } {
  const now = new Date()
  const day = now.getDay() // 0=Sun … 6=Sat
  const diffToMon = day === 0 ? -6 : 1 - day
  const weekStart = new Date(now)
  weekStart.setHours(0, 0, 0, 0)
  weekStart.setDate(now.getDate() + diffToMon)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)
  return { weekStart, weekEnd }
}

function WeeklyRhythmDots({
  submittedAt,
  history,
  choreTitle,
}: {
  submittedAt: number
  history: Completion[]
  choreTitle: string
}) {
  const { weekStart, weekEnd } = getWeekBounds()
  const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

  // Collect which week-days (0=Mon … 6=Sun) have a submission for this chore
  const activeDayIndices = new Set<number>()
  history
    .filter(h => h.chore_title === choreTitle)
    .forEach(h => {
      const d = new Date(h.submitted_at * 1000)
      if (d >= weekStart && d <= weekEnd) {
        // getDay(): 0=Sun,1=Mon…6=Sat → remap to 0=Mon…6=Sun
        const iso = (d.getDay() + 6) % 7
        activeDayIndices.add(iso)
      }
    })

  // Only render if there is at least one active day this week
  if (activeDayIndices.size === 0) return null

  return (
    <div className="flex items-center gap-[3px] mt-1.5">
      {DAY_LABELS.map((label, i) => (
        <div
          key={i}
          title={['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i]}
          className={`w-[18px] h-[18px] rounded-full flex items-center justify-center text-[9px] font-bold transition-colors
            ${activeDayIndices.has(i)
              ? 'bg-[var(--brand-primary)] text-white'
              : 'bg-[var(--color-surface-alt)] text-[var(--color-text-muted)]/50'
            }`}
        >
          {label}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Add MentorEmptyCard component**

Append to the bottom of `HistoryTab.tsx` (after `WeeklyRhythmDots`):

```tsx
// ── AI Mentor empty-state card ────────────────────────────────────────────────
// Shown when there are zero pending approvals.
// goalProgress is a placeholder prop for the next iteration — pass null for now.

interface GoalProgress {
  goalName: string
  choresRemaining: number
}

function MentorEmptyCard({
  childName,
  goalProgress,
}: {
  childName: string
  goalProgress: GoalProgress | null
}) {
  const mentorLine = goalProgress
    ? `It looks like ${childName} is ${goalProgress.choresRemaining} chore${goalProgress.choresRemaining !== 1 ? 's' : ''} away from their '${goalProgress.goalName}' goal.`
    : `Keep an eye on ${childName}'s progress — their next goal milestone is coming up soon.`

  return (
    <div
      className="relative rounded-2xl overflow-hidden"
      style={{
        background: 'linear-gradient(#0f1a14, #0f1a14) padding-box, linear-gradient(135deg, #0d9488 0%, #d4a017 50%, #0d9488 100%) border-box',
        border: '1.5px solid transparent',
        boxShadow: '0 0 32px rgba(13,148,136,0.15), 0 4px 16px rgba(0,0,0,0.3)',
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(13,148,136,0.12) 0%, transparent 70%)' }}
      />
      <div className="relative z-10 px-4 py-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 rounded-full bg-[var(--brand-primary)] flex items-center justify-center text-[11px]">🌱</div>
          <span className="text-[10px] font-extrabold text-[#0d9488] uppercase tracking-widest">Orchard Mentor</span>
          <span className="ml-auto text-[10px] font-bold text-[#d4a017] border border-[#d4a017]/40 rounded px-1.5 py-0.5">✦ PRO</span>
        </div>
        <p className="text-[14px] font-bold text-white leading-snug mb-1">
          The kids are all caught up! 🎉
        </p>
        <p className="text-[13px] text-white/70 leading-relaxed">
          {mentorLine}
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Copy AuditCard from PendingTab.tsx**

Copy the `AuditCard` component (lines 176–330 of `PendingTab.tsx`) verbatim to the bottom of `HistoryTab.tsx`. It depends on `getProofUrl` which is already imported in Task 2.

The `AuditCardProps` interface and `AuditCard` function must be pasted exactly as they appear in `PendingTab.tsx` — no changes needed.

- [ ] **Step 4: Verify TypeScript compiles cleanly**

Run: `cd "e:/Web-Video Design/Claude/Apps/Pocket Money/app" && npx tsc --noEmit 2>&1 | head -40`

Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/dashboard/HistoryTab.tsx
git commit -m "feat(activity): add WeeklyRhythmDots, MentorEmptyCard, AuditCard"
```

---

## Task 5: Terminology audit — "Job" in ChildDashboard.tsx

**Files:**
- Modify: `app/src/screens/ChildDashboard.tsx`

Three occurrences of "job" as a user-visible string (lines 647, 648, 866). The component name `JobsTab` and import identifiers are internal and must **not** change (that is a separate rename refactor).

- [ ] **Step 1: Fix line 647**

Find:
```tsx
? `1 job is waiting for your parent to check`
```
Replace with:
```tsx
? `1 chore is waiting for your parent to check`
```

- [ ] **Step 2: Fix line 648**

Find:
```tsx
: `${pending.length} jobs are waiting for your parent to check`}
```
Replace with:
```tsx
: `${pending.length} chores are waiting for your parent to check`}
```

- [ ] **Step 3: Fix line 866**

Find:
```tsx
{unplannedChores.length} job{unplannedChores.length > 1 ? 's' : ''} not in your week yet — tap <PlantIcon inline /> to add them.
```
Replace with:
```tsx
{unplannedChores.length} chore{unplannedChores.length > 1 ? 's' : ''} not in your week yet — tap <PlantIcon inline /> to add them.
```

- [ ] **Step 4: Verify compile**

Run: `cd "e:/Web-Video Design/Claude/Apps/Pocket Money/app" && npx tsc --noEmit 2>&1 | head -20`

Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add app/src/screens/ChildDashboard.tsx
git commit -m "fix(copy): replace 'job' with 'chore' in child-facing UI strings"
```

---

## Task 6: Terminology audit — "Custodian" in Stage1ParentIdentity.tsx

**Files:**
- Modify: `app/src/components/registration/Stage1ParentIdentity.tsx`

One occurrence: a JSDoc comment on line 2. Only the comment changes — no runtime behaviour.

- [ ] **Step 1: Fix the comment**

Find:
```tsx
 * Stage 1 — Parent Custodian (Identity)
```
Replace with:
```tsx
 * Stage 1 — Lead Parent (Identity)
```

- [ ] **Step 2: Fix "Job history" in HistoryTab.tsx** *(if not already done in Task 3)*

Check `HistoryTab.tsx` for any remaining occurrence of `"Job history"` or `Job history`. The Task 3 layout replacement already changes this to `"Chore history"` — verify it is gone:

Run: `grep -n "Job history\|JOB HISTORY" "app/src/components/dashboard/HistoryTab.tsx"`

Expected: no output. If the string is still present, replace it with `Chore history`.

- [ ] **Step 3: Verify compile**

Run: `cd "e:/Web-Video Design/Claude/Apps/Pocket Money/app" && npx tsc --noEmit 2>&1 | head -20`

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add app/src/components/registration/Stage1ParentIdentity.tsx app/src/components/dashboard/HistoryTab.tsx
git commit -m "fix(copy): replace 'Custodian'/'Job history' with 'Lead Parent'/'Chore history'"
```

---

## Self-Review

### Spec coverage check

| Requirement | Task that covers it |
|---|---|
| Remove Approvals tab from nav | Task 1 |
| Nav tabs: Chores / Activity / Insights / Goals | Task 1 |
| Pending approvals section — conditional, disappears when empty | Task 3 |
| Approve + Revise/Edit per card | Task 3 (AuditCard in Task 4) |
| Pay out — full-width solid teal button | Task 3 |
| Add Bonus — outlined secondary button | Task 3 |
| Pay out / Add Bonus sticky at top | Task 3 |
| Pay out cryptographically tracked in ledger | Already done server-side (confirmed in gap analysis — no code change needed) |
| Pay out confirm button high-contrast style | Task 3 (`ring-2 ring-offset-1 font-extrabold`) |
| AI Mentor empty-state card when no pending | Task 3 + Task 4 |
| MentorEmptyCard accepts `goalProgress` prop for future real data | Task 4 |
| "CHORE HISTORY" header (renamed from JOB HISTORY) | Task 3 |
| 7-dot Weekly Rhythm visualization on history cards | Task 4 |
| Active days = submissions this Mon–Sun week | Task 4 (`WeeklyRhythmDots`) |
| Active = solid teal, inactive = light gray | Task 4 |
| "Job" → "Chore" in ChildDashboard (3 strings) | Task 5 |
| "Custodian" → "Lead Parent" in Stage1 comment | Task 6 |
| pendingCount badge moves to Activity tab | Task 1 |
| onCountChange consolidated to ActivityTab | Task 2 |
| Session storage `'approvals'` fallback removed | Task 1 |

### Placeholder scan

No TBDs, no "implement later", no "similar to Task N" shortcuts. All code blocks are complete.

### Type consistency check

- `Completion` — imported in Task 2, used in `WeeklyRhythmDots` signature in Task 4. ✓
- `GoalProgress` interface — defined in Task 4, referenced in `MentorEmptyCard` props. ✓
- `goalProgress` prop — `GoalProgress | null` in `MentorEmptyCard`, `goalProgress?: GoalProgress | null` in `ActivityTab` Props. ✓
- `approveBusy` state (`string | null`) — set in `handleApprove`/`handleRevise`, read in `AuditCard` as `busy={approveBusy === c.id}`. ✓
- `onCountChange` — `(n: number) => void` in Props, called in `loadPending`. ✓
