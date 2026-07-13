# 05 · Goals, Savings & Payment Bridge

Covers savings goals (the "Savings Grove"), parent boosting/gifting, goal purchase/deduction, and the Payment Bridge (marking payouts as delivered + payment handles + smart copy).

**Key facts:**
- A child can have up to **5 active goals**. Goals have a `sort_order`; archiving (`DELETE /api/goals/:id`) hides but preserves history.
- **Purchasing a goal** (`POST /api/goals/:id/purchase`) marks it reached and deducts from the recorded balance via a ledger entry.
- Parents can **contribute/boost** a fixed amount to a goal (`POST /api/goals/:id/contribute`).
- **The Payment Bridge is delivery-status only.** `mark-paid` stamps `paid_out_at` on completions — it does **not** write to the ledger and does **not** move money. It's a "have I physically handed this over yet?" flag.

---

## Savings goals

### Symptom: "My child can't add another goal"
**Diagnose:** The cap is **5 active goals** per child. Archived goals don't count.
**Resolve:** Archive a completed/abandoned goal to free a slot, then add the new one. Archived goals remain in history.

### Symptom: "I deleted a goal — is the saved money gone?"
**Fact:** Archiving a goal does **not** touch the balance. Money "saved toward" a goal in Morechard is a *view* over the child's recorded funds, not a locked-away pot. The balance is unchanged; the goal just disappears from the active list.

### Symptom: "My child bought a goal but the balance didn't drop / dropped twice"
**Diagnose:** Goal purchase writes a ledger deduction. If the balance looks wrong:
1. Check the ledger tail (Toolkit) for the purchase entry.
2. A double-drop would be a duplicate purchase entry — capture the goal id and ledger ids.

**Resolve:** If the single deduction is present and correct, the balance is right (remind them purchases reduce available balance). If there's a genuine duplicate ledger entry, this needs a **reversal entry** (never a deletion) — escalate for the correction.

### Symptom: "I boosted/gifted money to my child's goal but they didn't see it"
**Diagnose:** A parent contribution is recorded against the goal. Confirm the contribution posted (goal detail / ledger). Child device may need a refresh.
**Resolve:** Reopen the child app to sync. If the contribution genuinely didn't post, capture goal id + amount and escalate.

### Symptom (child): "It congratulated me on a 'Harvest' — what does that mean?"
**Fact:** Reaching a big savings goal triggers a "Harvest time 🌿" celebration. It's a cosmetic success moment (Orchard metaphor). Nothing to fix — reassure it just means they hit their goal.

---

## Payment Bridge — "Mark as paid"

**This is the #1 source of "I paid but my child didn't get the money" confusion. Read this carefully.**

**What it is:** After a parent physically pays a child (bank transfer, cash, PayPal, etc.), they tap **Mark as paid** to record that the payout was *delivered*. This stamps `paid_out_at`. It removes the amount from the "unpaid" summary so the parent knows what's still outstanding.

**What it is NOT:** It does not send money. It does not change the ledger balance. Morechard never touches funds.

### Symptom: "I marked it paid but my child says they didn't receive the money"
**Resolve:** "Mark as paid" is only a *note to the parent* that they've handed the money over. If the child hasn't received it, the parent still needs to **actually send/hand over the money** through their real payment method. The app cannot have failed to "send" anything because it never sends — it only records that the parent says they paid. Encourage them to complete the real-world payment.

### Symptom: "I marked the wrong item as paid" / "it says already paid"
**Facts:** `mark-paid` is idempotent — marking an already-paid item just returns the existing `paid_out_at` (`was_already_paid: true`), it doesn't double-anything. Batch marking (`mark-paid-batch`) is all-or-nothing, max 100 at once.
**Resolve:** There's no user-facing "un-mark paid" in the standard flow. If a parent genuinely needs a `paid_out_at` cleared (marked the wrong child), capture the completion id and escalate — it's a delivery-flag fix, not a ledger change, so it's low-risk but requires an operator.

### Symptom: "Cannot mark paid — completion is 'awaiting_review'" (409)
**Fact:** Only **completed** (approved) completions can be marked paid. You can't pay out something the parent hasn't approved yet.
**Resolve:** Approve the completion first (see [03](03-chores-completions-approvals.md)), then mark it paid.

---

## Payment handles & Smart Copy

**Facts:** Parents can store a child's payment handles — **Monzo, Revolut, PayPal, Venmo** (`PATCH /api/child/:id/payment-handles`; leading `@` is stripped automatically). These power deep-links to the parent's banking app. **Smart Copy** covers UK bank transfer and Zelle (copies the details for manual paste).
> ⚠️ Bank-details storage is currently in device `localStorage` (temporary) — a future release moves it to an encrypted vault. Do not treat stored handles as securely synced across devices yet.

### Symptom: "The 'Pay with Monzo/Revolut/PayPal/Venmo' button doesn't open the app"
**Diagnose:** These are deep-links into the parent's banking app. They fail if:
- The banking app isn't installed on that device.
- The handle is wrong/empty.
- The OS blocked the deep-link.

**Resolve:** Confirm the handle is set correctly (no `@`, correct username) and the target app is installed. If the deep-link won't fire, fall back to **Smart Copy** (copy the details and paste into the banking app manually).

### Symptom: "My saved bank details disappeared when I switched phones"
**Fact:** Bank details currently live in local device storage, not synced. Switching devices loses them until they re-enter. This is a known limitation pending the encrypted vault. Reassure them no data was leaked — it simply wasn't synced.

---

## BLIK (Poland)
**Fact:** BLIK payment support is **deferred** to the Poland market push — it is not live yet. If a PL user asks for BLIK, it's on the roadmap, not a bug.

---

## Escalation triggers for this domain
- Genuine duplicate ledger deduction on a goal purchase → engineering (needs a reversal entry).
- A `paid_out_at` stamped on the wrong completion that the user needs cleared → operator (low-risk delivery-flag fix).
- Contribution/boost that debited a parent but never credited the goal → engineering with goal id + amount.
