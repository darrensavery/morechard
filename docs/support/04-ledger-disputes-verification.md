# 04 · Ledger, Disputes & Verification

Covers the immutable SHA-256 ledger, governance modes (Amicable vs. Standard), the 48-hour dispute window, public hash verification, and the court-ready PDF audit export.

**The single most important fact in the whole product:**
> **The ledger is immutable. Entries are never edited or deleted.** Every row's `record_hash` is chained to the previous row's hash (SHA-256). A correction is a **reversal entry** that references the original — never an edit. If you promise a user "I'll just delete/fix that entry," you are promising something the system is architecturally built to refuse.

Other key facts:
- Amounts are **integers** (pence / grosz / cents) — no floats, ever.
- **Governance modes** (`verify_mode` on `families`):
  - **Amicable** → entries are `verified_auto` immediately, with a **48-hour dispute window** (`dispute_before = created_at + 48h`). After 48h the entry is permanent and undisputable.
  - **Standard** → entries start `pending` and require the **second parent** to approve before they finalise (double-lock).

---

## Balance confusion

### Symptom: "The balance in Morechard doesn't match my child's actual money / bank"
**Fact:** Morechard is a **record of ownership, not a bank**. The balance is what has been *earned and recorded*, not cash sitting anywhere. It will differ from a real bank balance because:
- Approved-but-not-yet-paid earnings show in Morechard but the cash hasn't physically changed hands.
- Physical cash the child spent outside the app isn't reflected unless logged.

**Resolve:** Explain "Total Funds / Available Balance" = the recorded ledger balance, not a bank account. This is a *feature* for separated families — it removes the "how much does she owe him for the grass cutting?" argument by being the shared, agreed record. Encourage them to log purchases so the record stays in sync with reality.

### Symptom: "There's a wrong entry in the ledger — please delete it"
**Resolve:** We cannot delete or edit ledger entries (immutability is the legal/integrity guarantee). The correct fix is a **reversal entry** that offsets the mistake, leaving a full audit trail (original + correction both visible). Walk the parent through recording the correcting entry. Never promise a deletion.

---

## Disputes (Amicable mode, 48-hour window)

### Symptom: "I want to dispute a transaction the other parent logged"
**Facts:** In Amicable mode, either parent can dispute a `verified_auto` entry **within 48 hours** (`POST /api/ledger/:id/dispute`). The dispute does **not** alter the disputed row (still immutable). Instead it raises a **governance request** to switch the family to Standard mode, which the **second parent must confirm** (72h to respond).

| Response | Meaning | Resolution |
|----------|---------|------------|
| `Only auto-verified entries can be disputed` | Entry isn't `verified_auto` (already pending/standard) | Nothing to dispute via this path |
| `Dispute window has closed (48h elapsed)` (409) | >48h since the entry | The entry is now permanent; disputes are time-boxed by design |
| `A pending governance request already exists` (409) | One dispute/mode-change is already open | Resolve the existing request first (second parent confirms/declines) |

**Resolve:** If within 48h, they dispute from the ledger entry; then the *other* parent gets a governance request to confirm the switch to Standard mode. If the window closed, explain disputes are deliberately time-limited so the record can become final — the remedy now is a mutually-agreed reversal entry.

### Symptom: "We switched governance modes and now approvals need two people / behave differently"
**Fact:** This is expected. **Standard** = every ledger write needs the second parent's approval (Pending state). **Amicable** = auto-verified with a 48h dispute window. Mode changes require a **mutual-consent handshake** between parents — one requests, the other confirms.
**Resolve:** Confirm which mode they're in (`verify_mode` via Toolkit). If they want to change it, both parents must agree via the governance handshake. A single-parent family stuck in Standard mode with no second approver should switch to Amicable.

---

## Public hash verification

**Facts:** Anyone can verify a ledger chain-head hash publicly, no login required (`GET /api/verify/:hash`, screen `VerifyLedgerHashScreen`). PDF exports print the chain-head hash as a **scannable QR code** + a clickable `/verify/:hash` link, so a co-parent or court can jump straight to an auto-verified result.

### Symptom: "The verification page says the hash is invalid / not found"
**Diagnose:**
1. Confirm they're pasting the **full** chain-head hash exactly (no truncation, no extra spaces). Hashes are long hex strings — a single wrong character fails.
2. Confirm they're verifying a hash that was actually a chain head at export time.

**Resolve:** Best path is to scan the **QR code** from the PDF rather than typing the hash. If a genuinely-exported hash fails verification, that is a **P1 integrity concern** — escalate immediately with the PDF and hash; it may indicate chain tampering or a data issue.

---

## Court-ready PDF audit export

**Facts:** `GET /api/export/pdf` produces tiered reports:
- **Basic / Behavioral** tiers — available broadly.
- **Forensic** tier (full legal citations, hash verification) — **gated behind Shield AI** (`has_shield`).
Reachable via **Settings → Data & Exports**. The AI Mentor never uses "legal/court" language unless the parent explicitly asks — but the export itself is explicitly a legal-grade document.

### Symptom: "The forensic/legal export is locked"
**Diagnose:** The forensic tier requires **Shield AI** (`has_shield = 1`). Check the family's license state (Toolkit).
**Resolve:** If they don't have Shield, the basic/behavioral export is still available free. The forensic tier requires purchasing (or upgrading to) Shield AI — see [06-billing-payments-stripe.md](06-billing-payments-stripe.md) for the upgrade-credit path (they only pay the difference).

### Symptom: "The PDF export failed / timed out"
**Resolve:** Retry once. If it repeatedly fails for a family with a large ledger, capture the family_id and escalate (possible generation timeout) — check Sentry for the export route.

---

## Escalation triggers for this domain
- **Any hash verification failure on a genuinely-exported hash → P1, engineering immediately.** This touches data integrity and the legal value proposition.
- `Ledger chain integrity failure — contact support` (500 on a ledger write) → P1. The hash chain couldn't be extended; escalate with family_id and Sentry trace.
- A family needing a governance mode change they can't complete (e.g. co-parent unreachable, stuck governance request) → engineering.
- Court/legal request for data authenticity assistance → escalate to Darren (may have legal implications).
