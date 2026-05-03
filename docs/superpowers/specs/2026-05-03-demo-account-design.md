# Demo Account — Design Spec
**Date:** 2026-05-03
**Status:** Approved for implementation

---

## Overview

A shared, pre-populated demo account ("the Thomson family") that allows two distinct audiences to experience Morechard without creating their own family:

1. **Professionals** (solicitors, mediators, family lawyers) — evaluate the Shield AI forensic PDF capability on behalf of clients
2. **Post-trial Core users** — experience AI Mentor and Shield features they don't currently have access to, as an upsell mechanism

The demo is a single shared D1 family (`is_demo = true`). Professionals can add one chore and mark it complete to feel the approval flow, but cannot edit seed data. Demo parents can add/edit chores. All data resets nightly at midnight UTC.

---

## Entry Points

### 1. Welcome Screen — Professional Path

A small text link is added to the welcome/landing screen, styled consistently with "Already have an account? Sign In":

> *"A solicitor or mediator? Explore our professional demo →"*

Tapping opens a lightweight registration screen collecting:
- Full name
- Email address
- Marketing consent checkbox (styled radio checkbox, consistent with parental registration, pre-unchecked):
  > *"Morechard may contact me with product updates and feedback questions. Unsubscribe any time."*
- Expectation-setting copy:
  > *"You'll get instant access to a fully populated demo account — the Thomson family — complete with chore history, ledger entries, and a downloadable forensic PDF report. The account is shared and resets to its original state every night at midnight."*
- "Enter Demo" button

No password required. On submit, a `demo_registrations` row is written and the user is authenticated into the Thomson demo session with `user_type: 'professional'`.

### 2. Post-Trial Core Upsell Card

Shown only to authenticated users whose 14-day trial has expired and who are on the Core plan (no AI Mentor). An upsell banner/card appears on the dashboard:

> *"Explore the full AI Mentor and Shield features using our demo family, the Thomsons. You can add and edit chores to get a feel for the app. Note: the demo resets every night at midnight."*

Tapping goes directly into the Thomson demo — no registration form, as their details are already captured. A `demo_registrations` row is written using their existing `users` record with `user_type: 'demo_parent'`. Marketing consent is not re-requested (already captured at original registration).

---

## The Thomson Family — Seed Data

### Family Structure

| Role | Name | Details |
|---|---|---|
| Lead parent | Sarah Thomson | Primary carer |
| Co-parent | Mark Thomson | Separated, has parental responsibility |
| Child 1 | Ellie Thomson | Age 13, Oak tier (Lvl 3) |
| Child 2 | Jake Thomson | Age 10, Sapling tier (Lvl 2) |

### Scenario Backstory

Sarah and Mark separated 8 months ago. Mark disputes whether chores are being fairly assigned and paid. There is a 6-week period in the ledger where two payments were delayed and one was disputed. This gives the forensic PDF a genuine, realistic story — exactly what a solicitor needs to evaluate the product's value.

### Chore & Ledger History

- 6 months of chore history across both children (~120 ledger entries)
- All ledger entries hash-chained for integrity
- 3 disputed transactions: marked, timestamped, with parent notes from both Sarah and Mark
- 2 late approvals (>48hrs) with full audit trail visible in the forensic PDF
- Current open chores for each child visible on the dashboard

### Goals

**Ellie:**
- Active goal: New trainers — 68% funded

**Jake:**
- Completed goal: Football — paid out (visible in history)
- Active goal: Gaming headset — 34% funded

### Learning Lab Progression

**Ellie (13, Oak — Lvl 3):**

Completed (15 modules):
- Pillar 1: M2 (Taxes & Net Pay), M3 (Entrepreneurship), M3b (Gig Trap vs Salary Safety)
- Pillar 2: M5 (Scams & Digital Safety), M6 (Advertising & Influence)
- Pillar 3: M8 (Banking 101), M9 (Opportunity Cost), M9b (The Snowball)
- Pillar 4: M10 (The Interest Trap), M11 (Credit Scores & Trust), M12 (Good vs Bad Debt)
- Pillar 5: M14 (Inflation)
- Pillar 6: M17 (Digital vs Physical Currency), M18 (Money & Mental Health)

In progress: M18b — Social Comparison (3 of 4 acts complete). AI Mentor briefing references her M12 completion (Good vs Bad Debt) in the weekly insight.

**Jake (10, Sapling — Lvl 2):**

Completed (3 modules):
- M2 (Taxes & Net Pay), M5 (Scams & Digital Safety), M8 (Banking 101)

In progress: M9b — The Snowball (Act 2 of 4 complete). Streak badge visible on dashboard.

### AI Mentor Briefing

Pre-generated static seed briefings for both children — no live AI call required. Briefings reference Pillar numbers explicitly and are tied to completed module milestones. Sarah's weekly parent briefing is also pre-seeded.

### Rate Guide

Two of the Thomson chores display Rate Guide market-rate comparisons, showcasing the feature to evaluators.

### Forensic PDF

A pre-generated static PDF seeded as a file in the demo. It covers the full 6-month Thomson window and is downloadable via the same UI as a real export. The download triggers the normal Shield export flow.

The PDF must explicitly include:
- **Timestamped audit log** — for every chore: who created it, who approved or disputed it, and when. For mediators, the *process* of a dispute is often more important than the outcome.
- **3 disputed transactions** highlighted with full dispute timeline (raised by, responded by, resolution status)
- **2 late approvals** (>48hrs) flagged with elapsed time
- **Hash verification section** — chain-of-custody proof that no entry has been altered

---

## Access Rules

### Shared Rules (All Demo Users)

- Cannot change email, password, or family settings
- Cannot delete the family, children, or any seed data (rows flagged `is_seed = true` are write-protected)
- Session expires after 2 hours of inactivity
- A persistent banner displays at the top of every screen:
  > *"You're viewing the Thomson demo account. Resets nightly at midnight."*

### Professional (`user_type: 'professional'`)

- Can add a single chore and mark it complete — enough to feel the parent approval flow end-to-end (their test chore appears in the audit trail, reinforcing the PDF's value). Cannot edit or delete seed chores.
- Full access to all Shield features: forensic PDF download, hash-chain verification, audit trail
- AI Mentor briefings fully visible (static seed)
- Learning Lab visible but not interactive
- Upsell prompts suppressed — professionals are evaluating, not buying

### Demo Parent (`user_type: 'demo_parent'`)

- Can add and edit chores
- Can approve/reject chore completions
- Cannot delete or modify seeded ledger entries, goals, or Learning Lab progress
- Shield PDF locked behind upsell prompt:
  > *"Upgrade to Shield AI to unlock forensic exports"*
- AI Mentor briefing locked behind upsell prompt:
  > *"Upgrade to Complete AI to unlock your AI Mentor"*
- Learning Lab locked behind upsell prompt:
  > *"Upgrade to see Ellie and Jake's full curriculum"*
- Upsell prompts show what the feature looks like but do not link to a payment page (paywall not yet built — Phase 7). Each prompt includes a "Notify me when this is available" button which writes a row to `upgrade_interest` (feature, user_id, timestamp) — converting dead-end intent into a warm lead list for the Phase 7 paywall launch.

---

## Nightly Reset (Cron Job)

A Cloudflare Worker cron job runs at **midnight UTC** daily, scoped exclusively to `WHERE family_id = <thomson_family_id> AND is_demo = 1`:

1. Deletes all non-seed rows created by demo parent users (chores, approvals, ledger entries added after seed timestamp)
2. Restores any seed rows modified during the day (e.g. chore status changes)
3. Resets goal progress to seed values
4. Resets Learning Lab progress to seed values
5. Clears any AI briefing cache entries so the static seed briefing is restored

The reset is silent — no notification to users. The banner copy sets the expectation at all times.

Registered in `wrangler.toml` alongside the existing Monday 03:00 UTC rate-guide cron.

---

## Database Changes

### `families` table
- Add `is_demo BOOLEAN DEFAULT 0` — identifies the Thomson family row

### `demo_registrations` table (new)

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT | UUID |
| `name` | TEXT | From registration |
| `email` | TEXT | From registration or existing `users` row |
| `user_type` | TEXT | `'professional'` or `'demo_parent'` |
| `marketing_consent` | BOOLEAN | From opt-in checkbox |
| `registered_at` | INTEGER | Unix timestamp |
| `last_active_at` | INTEGER | Updated each session |

### `upgrade_interest` table (new)

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT | UUID |
| `user_id` | TEXT | FK to `users` |
| `feature` | TEXT | `'shield'`, `'ai_mentor'`, `'learning_lab'` |
| `registered_at` | INTEGER | Unix timestamp |

One row per user per feature — `INSERT OR IGNORE` to prevent duplicates. Internal use only — warm lead list for Phase 7 paywall launch.

### Seed tables
- All seeded rows across `chores`, `ledger`, `goals`, `unlocked_modules` gain `is_seed BOOLEAN DEFAULT 0`
- Write operations on demo family check `is_seed` before allowing modification or deletion

---

## Lead Follow-Up

`demo_registrations` is for internal use only — never surfaced in the app. Query directly via D1 or a simple admin endpoint to see who has tried the demo and when they were last active. Automated follow-up email tooling is deferred to Phase 7/8.

---

## Marketing Consent & Legal

A styled radio checkbox (consistent with parental registration UI, pre-unchecked) is shown to all new demo registrants:

> *"Morechard may contact me with product updates and feedback questions. Unsubscribe any time."*

This covers:
- **UK (PECR + UK GDPR):** Explicit consent satisfies the requirement; no LIA needed
- **EU (GDPR + ePrivacy):** Explicit consent is the safest position across all member states including stricter markets (DE, AT)
- **US (CAN-SPAM):** Consent not legally required but collected anyway for consistency

Consent is not re-requested from existing Core users entering the demo via the upsell card.

---

## Out of Scope

- Automated follow-up emails (Phase 7/8)
- Per-user isolated demo copies (Option C, rejected — infrastructure overhead not justified)
- Web-only demo path bypassing app download (rejected — undersells the mobile experience)
- Payment/upgrade flow from upsell prompts (Phase 7 paywall)
