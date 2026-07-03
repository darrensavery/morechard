---
feature: 12-data-export
title: Data Export
---

### Purpose

Data Export gives parents a GDPR Article 20-compliant mechanism to download all family data as structured JSON, and a tiered PDF report system that serves everything from a basic chore summary to a forensic chain-of-custody document suitable for separated-family legal proceedings. The three report tiers gate access by licence: Core gets basic, AI Mentor unlocks behavioral, Shield AI unlocks forensic.

### Methodology

**JSON export — `GET /api/export/json`**
- Fetches family, users, ledger, governance log, status log, currency snapshots, and bilingual labels in a single parallel D1 query set.
- Enriches ledger rows with human-readable `category_label` and `dispute_code_label` via the `bilingual_labels` table and the requested `lang` (en/pl).
- Returns a `Content-Disposition: attachment` JSON file. Contains `export_meta` block citing GDPR Article 20.

**PDF export — `GET /api/export/pdf`**
- `tier` param selects `basic | behavioral | forensic`. Server enforces licence gates against `has_ai_mentor` and `has_shield` columns on `families`; a crafted request cannot bypass the frontend.
- All three tiers fetch family, ledger (with child display name joined), governance log, and bilingual labels.
- `behavioral` additionally fetches `ledger_status_log` and `learning_module_unlocks`.
- `forensic` additionally fetches `completions` (with device fingerprint, Haversine distance, IP, user agent), `chore_reward_edits`, and a merged login history from `sessions` + `child_logins`. GPS coordinates and IPs are read server-side and rendered directly into the PDF — they are never returned to client state.
- A document fingerprint (SHA-256 of family_id + row count + timestamp + tier) is computed; a short `MCH-XXXX-XXXX-XXXX-XXXX` UUID is embedded in the report.
- HTML is built by tier-specific builder functions then rendered to PDF via Cloudflare Browser Rendering (Puppeteer). Falls back to an HTML download if the `BROWSER` binding is absent (local dev).

**UI — `DataSettings.tsx` / `useExportManager.ts`**
- `useExportManager` hook manages per-format loading state and triggers the appropriate endpoint with `family_id` and `lang`.
- `DataSettings` section renders the export controls inside Settings, gating PDF tier buttons by licence flags from family context.

### Dependencies

- **External packages**: `@cloudflare/puppeteer` (PDF rendering)
- **Internal modules**: `../lib/response.js` (`error` helper), `../lib/hash.js` (`sha256`), `../lib/logger.js`, `../types.js` (`Env`); app-side: `useExportManager.ts`, `DataSettings.tsx`
- **APIs / services**: Cloudflare D1 (all data queries), Cloudflare Browser Rendering (`env.BROWSER` binding for Puppeteer PDF generation)
