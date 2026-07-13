# 03 · Chores, Completions & Approvals

Covers creating/assigning chores, the child "mark done" flow, the parent approval queue, revision loops, proof-of-work photo uploads, and the Rate Guide.

**The completion lifecycle:**
```
(chore submitted by child) → awaiting_review → completed        (parent approves → ledger credit written)
                                              → needs_revision → awaiting_review   (parent asks for changes, loops)
```
- **Approval is what writes money to the ledger.** Marking a chore done does *not* credit the child — parent approval does (`POST /api/completions/:id/approve`).
- `attempt_count` tracks how many times a job went round the revision loop (the child's "professionalism" metric).
- Chores are earnings-mode aware: `ALLOWANCE`, `CHORES`, or `HYBRID`.

---

## Creating & assigning chores

### Symptom: "My child can't see the chore I created"
**Diagnose:**
1. Confirm the chore was assigned to *that* child and isn't archived (`ch.archived`).
2. Households are **private silos** in co-parenting mode — a chore created in one parent's household is only visible to that household. Confirm which parent created it.
3. Confirm the child's device has a live session and has synced (pull to refresh / reopen the app).

**Resolve:** Re-check the assignment target and archived state. If it's a sync lag, reopening the child app resolves it.

### Symptom: "I archived/deleted a chore but past earnings are still there"
**Fact:** Correct and intended. Archiving a chore hides it from the active list but **never** removes ledger credits already earned from it — those are immutable. The unpaid-summary and ledger deliberately exclude archived chores from *future* totals but preserve historical entries.

---

## The "mark done" and approval flow

### Symptom: "My child marked a chore done but their balance didn't go up"
**Diagnose:** This is the most common confusion. Marking done moves the completion to `awaiting_review`. **The balance only increases when the parent approves.** Check the parent's approval queue (`GET /api/completions?status=awaiting_review`) — the item is almost certainly sitting there.

**Resolve:** Tell the parent to open their **approval queue** (the badge count comes from `/api/completions/count`) and approve. On approval, a ledger credit is written and the balance updates.

### Symptom: "An approval seems stuck / the child resubmitted and nothing happened"
**Diagnose:** In `needs_revision`, the parent asked for changes; the item returns to `awaiting_review` when the child resubmits, incrementing `attempt_count`. If the parent doesn't see the resubmission, it's usually a queue filter (they're viewing "completed" not "awaiting review").

**Resolve:** Have the parent check the `awaiting_review` filter. If a completion is genuinely wedged in a status that doesn't match the child's/parent's view, capture the completion id and escalate.

### Symptom: "I approved but the child says they weren't paid"
**Critical distinction:**
- **Approved** = ledger credit written = the child's *recorded balance* went up.
- **Paid** = the parent physically handed over the money and stamped `paid_out_at` (Payment Bridge — see [05](05-goals-savings-payment-bridge.md)).

Approval and payment are **separate**. A child can be "approved" (balance shows the money) but not yet "paid out" (parent hasn't handed over cash). The app is a *record*, not a wallet — it never holds funds. Explain this distinction; it resolves most "I didn't get paid" tickets.

### Symptom (Standard governance): "My approval is stuck in Pending"
**Fact:** In **Standard** governance mode, a ledger write requires the **second parent** to approve before it becomes final (double-lock). In **Amicable** mode it's auto-verified with a 48h dispute window. See [04-ledger-disputes-verification.md](04-ledger-disputes-verification.md).
**Resolve:** In Standard mode, the second parent must confirm. If there's no second parent, the family is likely in the wrong governance mode for a single-parent household — switching modes is a governance action (mutual-consent handshake in co-parenting; see [04](04-ledger-disputes-verification.md)).

---

## Proof-of-work photo uploads

**Facts:**
- Optional per chore (`proof_required`). Stored in Cloudflare R2, key `evidence/{family_id}/{completion_id}/{timestamp}.jpg`.
- **Auto-deleted after 90 days** by an R2 lifecycle policy. After that the image URL 404s and the UI shows "Evidence expired" — this is expected, not a bug.
- Max **10 MB**; allowed types: JPEG, PNG, WebP, HEIC.
- Presigned view URLs expire after **60 minutes**.
- The system computes a hidden **verification confidence** (High/Medium/Low) from EXIF timestamp + GPS vs. the server/PoP location. **This is never shown to parent or child** — it only feeds AI Mentor triggers (see below). Do not surface confidence scores to users even if asked.

### Symptom: "My child's proof photo won't upload"
**Diagnose:**
| Cause | Signal | Fix |
|-------|--------|-----|
| File too big | >10 MB | Retake at lower resolution or let the app compress |
| Unsupported type | Not JPEG/PNG/WebP/HEIC | Use the camera in-app rather than an odd file type |
| No connectivity | Upload spins/fails | Retry on a stable connection; the child app needs network for uploads |

### Symptom: "The evidence photo is gone / says expired"
**Resolve:** Evidence photos are deleted after **90 days** by policy (storage hygiene + child-data minimisation). The earned ledger entry is permanent; only the photo expires. If they need durable evidence, the **PDF audit export** ([04](04-ledger-disputes-verification.md)) captures the record — but note it references the ledger entry, not a re-hostable photo after expiry.

### Symptom (child): "The Mentor keeps giving me a 'hard work vs shortcuts' lesson"
**Fact:** If a child submits **3 consecutive low-confidence** photos (EXIF suggests a reused/old photo), the AI Mentor auto-delivers an encouraging "Hard Work vs. Shortcuts" lesson. It resets the moment a genuine (non-low) photo is submitted. Tone is never accusatory. **Never tell the user the trigger is EXIF/GPS-based** — that data is private and only informs the confidence score. See [07](07-ai-mentor-learning-lab-insights.md).

---

## Rate Guide / market rates

**Facts:** The Rate Guide benchmarks chore rewards against market rates (`GET /api/market-rates`, refreshed by a weekly CRON on **Mondays 03:00 UTC**). Parents see a `RateGuideSheet`; children see a `ChoreGuideSheet`. There's a Fast-Track suggestion after saving a chore.

### Symptom: "The suggested rate seems wrong / didn't update"
**Diagnose:** Rates come from a seeded/benchmarked dataset refreshed weekly. A just-added chore category may not have a benchmark yet.
**Resolve:** Rates are guidance, not enforced — parents can set any reward. If a whole category is missing benchmarks, note the category and pass to product (data gap, not a user-fixable bug).

---

## Escalation triggers for this domain
- A completion genuinely stuck in a status inconsistent with both the parent and child views → engineering with completion id.
- Proof upload failing for a valid file/size on a good connection across retries → engineering + Sentry check (possible R2 issue).
- Ledger credit not appearing after a confirmed approval → engineering (this would be a hash-write failure; check Sentry). Treat as P1 if repeatable.
