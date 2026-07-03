---
feature: 05-ledger
title: Immutable Ledger & Hash Chain
---

### Purpose

Provides tamper-evident financial transaction records for families, particularly co-parents who need court-admissible proof of earnings and payments. Every ledger write is chained via SHA-256 so any retroactive modification to a row breaks all subsequent hashes — making silent tampering detectable. An auto-verify dispute window gives separated parents 48 hours to challenge any entry before it becomes permanent.

### Methodology

**Core write flow — `POST /api/ledger`**
- Fetches the family's `verify_mode` (`amicable` or `standard`) to determine whether the new entry is `verified_auto` or `pending`.
- Calls `fetchAndVerifyChainTip`: reads the latest row for the family, recomputes its hash, and throws if the stored hash does not match — rejecting the insert rather than silently extending a corrupted chain.
- Computes `record_hash = SHA-256(id || family_id || child_id || amount || currency || entry_type || previous_hash)` using the Web Crypto API (`crypto.subtle.digest`). The genesis row seeds `previous_hash` with 64 zeroes.
- Inserts the new row with `dispute_before = created_at + 48h` when `verified_auto`.

**Dispute flow — `POST /api/ledger/:id/dispute`**
- Authenticated parent can raise a dispute within the 48-hour window on any `verified_auto` entry.
- Does not mutate the ledger row (immutable by design); instead creates a `family_governance_log` record requesting a mode switch from `amicable` → `standard`, which requires the second parent to confirm.

**Public verification — `GET /api/verify/:hash`**
- No authentication required. Given a chain-head hash (from a PDF export), looks up the family and walks every row in insertion order, recomputing each hash via `verifyChain`. Returns `{ valid, entryCount, chainHeadHash }` or `{ valid: false, brokenAt: <row id> }`.

**Read — `GET /api/ledger`**
- Paginates by `family_id` + optional `child_id`. Maximum 200 rows per request.

**UI**
- `HistoryTab.tsx` — displays paginated ledger entries per child.
- `VerifyLedgerHashScreen.tsx` — public-facing screen to paste a hash and confirm chain integrity.

### Dependencies

- **External packages / services**: Cloudflare D1 (ledger table, families table, family_roles table, family_governance_log table); Web Crypto API (`crypto.subtle`) — built into the Workers runtime.
- **Internal modules**: `worker/src/lib/hash.ts` (`computeRecordHash`, `fetchAndVerifyChainTip`, `verifyChain`, `GENESIS_HASH`); `worker/src/lib/response.ts` (`json`, `error`, `clientIp`); `worker/src/lib/logger.ts`; `worker/src/lib/jwt.ts` (auth type).
- **APIs / services**: None — the feature is self-contained within the Cloudflare Worker and D1. The public verify endpoint is consumed by the PDF export feature (Shield AI) and can be called unauthenticated by any third party given a hash.
