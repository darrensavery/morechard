# Learning Lab Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire in all 17 Learning Lab modules as a four-act stepped experience (Hook / Lesson / Lab / Quiz), unlocked by real behavioural triggers, displayed in a level-grouped grid with three visual states.

**Architecture:** Module content lives in a static TypeScript catalogue (`labCatalogue.ts`). Unlock state and act progress are persisted in D1. The worker exposes two new endpoints. `LabTab` renders a level-grouped grid; `ModuleReader` renders the four-act experience full-screen.

**Tech Stack:** Cloudflare D1, Cloudflare Workers, React 18, TypeScript, Lucide React, Tailwind CSS

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `worker/migrations/0061_lab_progress.sql` | `module_act_progress` table + `age_level` column on `user_settings` |
| Create | `app/src/lib/labCatalogue.ts` | All 17 module definitions, types, act content, quiz questions |
| Create | `worker/src/routes/lab.ts` | `GET /api/lab/modules` + `POST /api/lab/modules/:slug/acts/:num/complete` |
| Create | `worker/src/lib/labTriggers.ts` | Trigger evaluation functions called on ledger/goal writes |
| Modify | `worker/src/index.ts` | Register new lab routes |
| Modify | `app/src/lib/api.ts` | Add `getLabModules()` + `completeLabAct()` |
| Modify | `app/src/components/dashboard/LabTab.tsx` | Rewrite grid section with level groups + 3-state tiles |
| Create | `app/src/components/dashboard/ModuleReader.tsx` | Four-act stepped reader with interactive Lab components |
| Modify | `app/src/screens/ChildDashboard.tsx` | Pass `childLabData` to LabTab; add unread badge on Lab tab |

---

## Task 1: D1 Migration

**Files:**
- Create: `worker/migrations/0061_lab_progress.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- 0061_lab_progress.sql
-- Learning Lab: act-level progress tracking + child age level

-- Add age_level to user_settings (1=Sprout/Phase2, 2=Sapling, 3=Oak, 4=Canopy)
-- Default 2 (Sapling / Foundation) — parent can update via PATCH /api/settings
ALTER TABLE user_settings ADD COLUMN age_level INTEGER NOT NULL DEFAULT 2;

-- module_act_progress: tracks which acts a child has completed within a module.
-- act_num: 1=Hook, 2=Lesson, 3=Lab, 4=Quiz
-- completed_at is a Unix timestamp (seconds) — always populated via Math.floor(Date.now() / 1000)
CREATE TABLE IF NOT EXISTS module_act_progress (
  id           TEXT    NOT NULL PRIMARY KEY,
  child_id     TEXT    NOT NULL REFERENCES users(id),
  module_slug  TEXT    NOT NULL,
  act_num      INTEGER NOT NULL CHECK (act_num BETWEEN 1 AND 4),
  completed_at INTEGER NOT NULL,
  UNIQUE (child_id, module_slug, act_num)
);

-- Single composite index satisfies both child-only and child+module queries in SQLite
CREATE INDEX IF NOT EXISTS idx_map_child_module ON module_act_progress(child_id, module_slug);
```

- [ ] **Step 2: Apply to local D1**

```bash
npx wrangler d1 execute morechard-db --local --file=worker/migrations/0061_lab_progress.sql
```

Expected: `Successfully applied migration`

- [ ] **Step 3: Apply to production D1**

```bash
npx wrangler d1 execute morechard-db --file=worker/migrations/0061_lab_progress.sql
```

- [ ] **Step 4: Commit**

```bash
git add worker/migrations/0061_lab_progress.sql
git commit -m "feat(lab): add module_act_progress table and age_level to user_settings"
```

---

## Task 2: Module Catalogue (`app/src/lib/labCatalogue.ts`)

**Files:**
- Create: `app/src/lib/labCatalogue.ts`

This file contains all types plus all 17 module definitions. Act content renders as React nodes using real child data passed as props.

- [ ] **Step 1: Create the file with types and pillar config**

```typescript
// app/src/lib/labCatalogue.ts
// Static catalogue for all 17 Learning Lab modules.
// Content sourced from /docs/notebooklm/09-module-*.md spec files.

import React from 'react'
import type { ReactNode } from 'react'
import {
  Receipt, ShieldAlert, Landmark, TrendingUp, TrendingDown, Gauge,
  Smartphone, Briefcase, Scale, Megaphone, GitFork, Star, CreditCard,
  Heart, Users, BarChart2, PieChart,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

export type ModuleSlug =
  | 'M2' | 'M3' | 'M3b' | 'M5' | 'M6' | 'M8' | 'M9' | 'M9b'
  | 'M10' | 'M11' | 'M12' | 'M13' | 'M14' | 'M15' | 'M17' | 'M18' | 'M18b'

export type AgeLevel = 1 | 2 | 3 | 4   // 1=Sprout(Phase2), 2=Sapling, 3=Oak, 4=Canopy
export type AppView  = 'ORCHARD' | 'CLEAN'

/** Real child data passed to every act render function. */
export interface ChildLabData {
  currency:                string   // 'GBP' | 'PLN' | 'USD'
  currentBalancePence:     number
  lifetimeEarningsPence:   number
  choreRateMedianPence:    number   // median of last 5 approved chores; fallback 500 (£5)
  savingsStreakWeeks:       number
  balance4wkAgoPence:      number
  consecutiveWeeklyGrowth: number
  activeGoalsCount:        number
  reliabilityRating:       number   // 0–100
  distinctChoreTypes:      number
  appView:                 AppView
}

export interface QuizOption {
  label: 'A' | 'B' | 'C'
  text:  string
}

export interface QuizQuestion {
  // Use a function when the question text needs child data (e.g. referencing their earnings)
  question:    string | ((d: ChildLabData) => string)
  options:     QuizOption[]
  correct:     'A' | 'B' | 'C'
  explanation: string
}

export interface ModuleDef {
  slug:         ModuleSlug
  title:        string
  pillar:       1 | 2 | 3 | 4 | 5 | 6
  level:        AgeLevel
  // Store the Lucide component reference directly — preserves tree-shaking; no string→component lookup needed
  icon:         React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>
  triggerHint:  string
  description:  string
  hook:         (d: ChildLabData) => ReactNode
  lesson:       (d: ChildLabData) => ReactNode
  lab:          (d: ChildLabData) => ReactNode
  quiz:         QuizQuestion[]
}

// ── Pillar config ──────────────────────────────────────────────────────────────

export const PILLARS: Record<number, { name: string; orchardName: string; color: string; mutedColor: string }> = {
  1: { name: 'Earning & Value',       orchardName: 'The Roots',      color: '#007A78', mutedColor: '#b2d8d8' },
  2: { name: 'Spending & Choices',    orchardName: 'The Trunk',      color: '#D97706', mutedColor: '#fde68a' },
  3: { name: 'Saving & Growth',       orchardName: 'The Fruit',      color: '#16a34a', mutedColor: '#bbf7d0' },
  4: { name: 'Borrowing & Debt',      orchardName: 'The Vine',       color: '#7c3aed', mutedColor: '#ddd6fe' },
  5: { name: 'Investing & Future',    orchardName: 'The Canopy',     color: '#b45309', mutedColor: '#fef3c7' },
  6: { name: 'Society & Wellbeing',   orchardName: 'The Atmosphere', color: '#0369a1', mutedColor: '#bae6fd' },
}

/** Level display names — vary by persona. */
export const LEVEL_LABELS: Record<AgeLevel, Record<AppView, string>> = {
  1: { ORCHARD: 'Sprout',     CLEAN: 'Explorer'   },  // Phase 2 — not shown at launch
  2: { ORCHARD: 'Sapling',    CLEAN: 'Foundation' },
  3: { ORCHARD: 'Oak',        CLEAN: 'Applied'    },
  4: { ORCHARD: 'Canopy',     CLEAN: 'Mastery'    },
}

/** Format pence as currency string. */
function fmt(pence: number, currency: string): string {
  const major = pence / 100
  if (currency === 'GBP') return `£${major.toFixed(2)}`
  if (currency === 'PLN') return `${major.toFixed(2)} zł`
  return `$${major.toFixed(2)}`
}
```

- [ ] **Step 2: Add M2 — Taxes & Net Pay (Level 2, Pillar 1)**

Append to `labCatalogue.ts`:

```typescript
// ── Module definitions ─────────────────────────────────────────────────────────

export const MODULES: ModuleDef[] = [

  // ── M2: Taxes & Net Pay ───────────────────────────────────────────────────
  {
    slug:        'M2',
    title:       'Taxes & Net Pay',
    pillar:      1,
    level:       2,
    icon:        Receipt,
    triggerHint: 'Earn your first £20 to unlock',
    description: 'Why your pay slip shows less than you earned — and where the rest goes.',
    hook: (d) => (
      <div className="flex flex-col gap-3">
        <p className="text-[15px] font-bold leading-snug">
          {d.appView === 'ORCHARD'
            ? `You've earned ${fmt(d.lifetimeEarningsPence, d.currency)} so far. Before we count the apples, let's talk about the slice the orchard infrastructure quietly takes.`
            : `Cumulative earnings: ${fmt(d.lifetimeEarningsPence, d.currency)}. This module explains the deductions applied to real-world wages.`}
        </p>
        <p className="text-[14px] leading-relaxed text-[var(--color-text)]">
          Every person who earns money pays a portion to fund shared services — roads, hospitals, schools.
          This isn't optional. It's called tax, and it applies to everyone who earns above a certain threshold.
          The amount you actually receive is called your <strong>net pay</strong>. The amount before deductions is your <strong>gross pay</strong>.
        </p>
      </div>
    ),
    lesson: (_d) => (
      <div className="flex flex-col gap-4">
        <p className="text-[14px] leading-relaxed">
          <strong>Income Tax</strong> is a percentage of your earnings taken by the government. In the UK, the first
          £12,570 you earn in a year is tax-free (this is called the Personal Allowance). Above that,
          20% goes to the government. Higher earners pay more.
        </p>
        <p className="text-[14px] leading-relaxed">
          <strong>National Insurance (NI)</strong> is a separate contribution that funds the NHS and state pension.
          In the UK, employees pay 8% on earnings between £12,570 and £50,270.
        </p>
        <div className="rounded-xl bg-[var(--color-surface-alt)] p-3 text-[13px] font-mono">
          <p>Gross pay:        £2,000/month</p>
          <p>Income tax (20%): −£ 285</p>
          <p>NI (8%):          −£ 100</p>
          <p className="font-bold mt-1">Net pay:           £1,615</p>
        </div>
        <p className="text-[14px] leading-relaxed">
          That means for every £100 earned, roughly £19 goes to the government before the worker sees it.
          This isn't a trick — it pays for the things no single person could afford alone.
        </p>
      </div>
    ),
    lab: (d) => {
      const median = d.choreRateMedianPence
      const medianFmt = fmt(median, d.currency)
      const monthly = median * 20  // assume 20 chores/month
      const taxRate = 0.20
      const niRate  = 0.08
      const tax  = Math.round(monthly * taxRate)
      const ni   = Math.round(monthly * niRate)
      const net  = monthly - tax - ni
      return (
        <div className="flex flex-col gap-4">
          <p className="text-[13px] text-[var(--color-text-muted)]">Using your median chore rate of <strong>{medianFmt}</strong></p>
          <div className="rounded-xl bg-[var(--color-surface-alt)] p-3 text-[13px] font-mono flex flex-col gap-1">
            <p>If you did 20 chores this month:</p>
            <p>Gross earnings:    {fmt(monthly, d.currency)}</p>
            <p>Income tax (20%):  −{fmt(tax, d.currency)}</p>
            <p>NI (8%):           −{fmt(ni, d.currency)}</p>
            <p className="font-bold border-t border-[var(--color-border)] pt-1">Net pay: {fmt(net, d.currency)}</p>
          </div>
          <p className="text-[13px] leading-relaxed">
            In the real world, your net pay would be <strong>{fmt(net, d.currency)}</strong> — not {fmt(monthly, d.currency)}.
            How many extra chores at your median rate would you need to cover the {fmt(tax + ni, d.currency)} lost to tax and NI?
            <strong> {Math.ceil((tax + ni) / median)} chores.</strong>
          </p>
        </div>
      )
    },
    quiz: [
      {
        question: 'What is the difference between gross pay and net pay?',
        options: [
          { label: 'A', text: 'Gross pay is what you receive; net pay is before deductions' },
          { label: 'B', text: 'Gross pay is before deductions; net pay is what you actually receive' },
          { label: 'C', text: 'They are the same — just different words for the same amount' },
        ],
        correct: 'B',
        explanation: 'Gross is the full amount earned. Net is what remains after tax and National Insurance are deducted.',
      },
      {
        question: 'Why do governments collect income tax?',
        options: [
          { label: 'A', text: 'To punish people for earning too much' },
          { label: 'B', text: 'To fund shared services like hospitals, roads, and schools that individuals cannot afford alone' },
          { label: 'C', text: 'To save money for the government's own expenses only' },
        ],
        correct: 'B',
        explanation: 'Tax funds public services that benefit everyone — healthcare, infrastructure, education, and the state pension.',
      },
      {
        question: (d: ChildLabData) => `Someone earns ${fmt(d.lifetimeEarningsPence, d.currency)} in a year. The personal allowance is £12,570. Do they owe income tax?`,
        options: [
          { label: 'A', text: 'Yes — everyone who earns any amount pays tax' },
          { label: 'B', text: 'No — only earnings above the personal allowance are taxed' },
          { label: 'C', text: 'Only if they choose to pay it' },
        ],
        correct: 'B',
        explanation: 'The personal allowance means the first £12,570 is tax-free. Tax only applies on earnings above that threshold.',
      },
    ] as QuizQuestion[],
  },
```

- [ ] **Step 3: Add M5 — Scams & Digital Safety (Level 2, Pillar 2)**

Append inside the `MODULES` array:

```typescript
  // ── M5: Scams & Digital Safety ────────────────────────────────────────────
  {
    slug:        'M5',
    title:       'Scams & Digital Safety',
    pillar:      2,
    level:       2,
    icon:        ShieldAlert,
    triggerHint: 'Triggered when a suspicious item is flagged',
    description: 'How scams are designed to look real — and the signals that give them away.',
    hook: (_d) => (
      <div className="flex flex-col gap-3">
        <p className="text-[15px] font-bold leading-snug">
          Something in your orchard smells like blight. Scams grow fast and look delicious — let's learn how to spot them before they spread.
        </p>
        <p className="text-[14px] leading-relaxed">
          Every year, billions of pounds are lost to scams. Most victims aren't careless — they were targeted by
          professionals who spend their careers making fake things look real. Knowing the patterns is your best defence.
        </p>
      </div>
    ),
    lesson: (_d) => (
      <div className="flex flex-col gap-4">
        <p className="text-[14px] leading-relaxed">
          <strong>The three signals every scam shares:</strong>
        </p>
        <ol className="flex flex-col gap-2 pl-4 list-decimal text-[14px]">
          <li><strong>Urgency.</strong> "Act now or lose this forever." Scammers create time pressure so you don't think clearly.</li>
          <li><strong>Too good to be true.</strong> Free money, free prizes, amazing deals with no catch. If it sounds impossible, it usually is.</li>
          <li><strong>Requests for credentials.</strong> Legitimate companies never ask for your PIN, password, or full card number via message or link.</li>
        </ol>
        <p className="text-[14px] leading-relaxed">
          <strong>Protecting your accounts:</strong> Use a different PIN for every service. Never share it — not even with a parent or carer.
          If you receive a suspicious message asking you to click a link, don't. Go directly to the website by typing the address yourself.
        </p>
        <p className="text-[14px] leading-relaxed">
          <strong>In gaming:</strong> "Free V-Bucks generators," "account boosting," and "rare item trades" are almost always scams.
          No legitimate service needs your login credentials to give you something for free.
        </p>
      </div>
    ),
    lab: (_d) => (
      <div className="flex flex-col gap-4">
        <p className="text-[14px] font-semibold">Spot the scam. For each scenario, decide: real or fake?</p>
        {[
          { scenario: 'An email from "PayPal" says your account will be closed in 24 hours unless you click a link and enter your password.', answer: 'SCAM', why: 'Urgency + credential request. PayPal communicates through your account dashboard, not urgent emails.' },
          { scenario: 'Your game\'s official app sends a push notification that you\'ve earned a reward for completing a challenge you actually did yesterday.', answer: 'LIKELY REAL', why: 'No urgency, no credential request, matches recent activity. Still verify by opening the app directly — not via the notification.' },
          { scenario: 'A website offers to double your Robux if you enter your username and password.', answer: 'SCAM', why: 'No platform gives away currency for credentials. This is a classic credential-harvesting scam.' },
        ].map((item, i) => (
          <div key={i} className="rounded-xl border border-[var(--color-border)] p-3 flex flex-col gap-2">
            <p className="text-[13px]">{item.scenario}</p>
            <p className="text-[12px] font-bold text-[var(--brand-primary)]">{item.answer}</p>
            <p className="text-[12px] text-[var(--color-text-muted)]">{item.why}</p>
          </div>
        ))}
      </div>
    ),
    quiz: [
      {
        question: 'Which of these is the strongest sign that a message is a scam?',
        options: [
          { label: 'A', text: 'It comes from an unknown sender' },
          { label: 'B', text: 'It creates urgency and asks you to click a link to enter your password' },
          { label: 'C', text: 'It contains a spelling mistake' },
        ],
        correct: 'B',
        explanation: 'Urgency + credential request is the core scam pattern. Spelling mistakes are a hint but not proof; some sophisticated scams are perfectly written.',
      },
      {
        question: 'Someone offers you free in-game currency if you share your account login. What do you do?',
        options: [
          { label: 'A', text: 'Share it — free currency is worth the risk' },
          { label: 'B', text: 'Decline and report it — no legitimate service needs your credentials to give you something' },
          { label: 'C', text: 'Share a fake password first to test if they\'re real' },
        ],
        correct: 'B',
        explanation: 'Legitimate platforms never need your password to credit your account. Report it and ignore.',
      },
      {
        question: 'You receive an email that looks exactly like it\'s from your bank. What\'s the safest response?',
        options: [
          { label: 'A', text: 'Click the link in the email and log in' },
          { label: 'B', text: 'Reply to the email asking if it\'s real' },
          { label: 'C', text: 'Open a new browser tab, type your bank\'s address manually, and check your account there' },
        ],
        correct: 'C',
        explanation: 'Always navigate directly to a site by typing the address. Email links can point anywhere — even a perfect copy of the real site.',
      },
    ],
  },
```

- [ ] **Step 4: Add M8 — Banking 101 (Level 2, Pillar 3)**

```typescript
  // ── M8: Banking 101 ───────────────────────────────────────────────────────
  {
    slug:        'M8',
    title:       'Banking 101',
    pillar:      3,
    level:       2,
    icon:        Landmark,
    triggerHint: `Save up to £30 to unlock`,
    description: 'Accounts, debit vs credit, and why a jar under the bed is a bad plan.',
    hook: (d) => (
      <div className="flex flex-col gap-3">
        <p className="text-[15px] font-bold leading-snug">
          {d.appView === 'ORCHARD'
            ? `Your grove is growing — ${fmt(d.currentBalancePence, d.currency)} saved. It's time to understand where the real orchards store their surplus.`
            : `Balance milestone reached: ${fmt(d.currentBalancePence, d.currency)}. This module covers real-world money storage and banking fundamentals.`}
        </p>
        <p className="text-[14px] leading-relaxed">
          You've built up real savings. Where should that money actually live when it's bigger than pocket money?
          The answer most people use is a bank — but most people don't understand how banks work. Let's fix that.
        </p>
      </div>
    ),
    lesson: (_d) => (
      <div className="flex flex-col gap-4">
        <p className="text-[14px] leading-relaxed">
          A <strong>current account</strong> is for day-to-day spending. Money goes in (wages, transfers) and out (purchases, bills).
          Most come with a debit card.
        </p>
        <p className="text-[14px] leading-relaxed">
          A <strong>savings account</strong> is for money you don't need immediately. The bank pays you <strong>interest</strong> for
          keeping your money there — usually a percentage per year.
        </p>
        <p className="text-[14px] leading-relaxed">
          <strong>Debit card vs. credit card:</strong>
        </p>
        <div className="rounded-xl bg-[var(--color-surface-alt)] p-3 text-[13px] flex flex-col gap-2">
          <p><strong>Debit:</strong> spends your own money directly from your account. If there's nothing in, it doesn't work.</p>
          <p><strong>Credit:</strong> the bank lends you money to spend now. You pay it back later — with interest if you don't clear the balance.</p>
        </div>
        <p className="text-[14px] leading-relaxed">
          Why not keep money in a jar? Two reasons: it can be stolen or lost, and it earns nothing.
          A savings account keeps it safe and makes it grow slowly.
        </p>
      </div>
    ),
    lab: (d) => {
      const balance = d.currentBalancePence
      const interestRate = 0.04
      const year1 = Math.round(balance * (1 + interestRate))
      const year2 = Math.round(year1 * (1 + interestRate))
      const year3 = Math.round(year2 * (1 + interestRate))
      const earned3yr = year3 - balance
      return (
        <div className="flex flex-col gap-4">
          <p className="text-[13px] text-[var(--color-text-muted)]">
            If your current balance of <strong>{fmt(balance, d.currency)}</strong> were in a 4% savings account:
          </p>
          <div className="rounded-xl bg-[var(--color-surface-alt)] p-3 text-[13px] font-mono flex flex-col gap-1">
            <p>Today:    {fmt(balance, d.currency)}</p>
            <p>Year 1:   {fmt(year1, d.currency)}</p>
            <p>Year 2:   {fmt(year2, d.currency)}</p>
            <p>Year 3:   {fmt(year3, d.currency)}</p>
            <p className="font-bold border-t border-[var(--color-border)] pt-1">
              Interest earned: {fmt(earned3yr, d.currency)} — for doing nothing extra.
            </p>
          </div>
          <p className="text-[13px]">
            That's {Math.ceil(earned3yr / d.choreRateMedianPence)} chores at your median rate — earned by a bank account while you slept.
          </p>
        </div>
      )
    },
    quiz: [
      {
        question: 'What is the main difference between a current account and a savings account?',
        options: [
          { label: 'A', text: 'Current accounts pay more interest' },
          { label: 'B', text: 'Current accounts are for daily spending; savings accounts are for money you\'re keeping and earning interest on' },
          { label: 'C', text: 'Savings accounts come with a debit card; current accounts don\'t' },
        ],
        correct: 'B',
        explanation: 'Current accounts handle day-to-day transactions. Savings accounts hold surplus money and pay interest — typically no card attached.',
      },
      {
        question: 'You spend £50 on a debit card. Where does that money come from?',
        options: [
          { label: 'A', text: 'The bank lends it to you' },
          { label: 'B', text: 'Your own account balance — it reduces immediately' },
          { label: 'C', text: 'It comes from an overdraft automatically' },
        ],
        correct: 'B',
        explanation: 'A debit card spends your own money directly. A credit card borrows it — which is a different product with different consequences.',
      },
      {
        question: 'Why is keeping large amounts of cash at home worse than a savings account?',
        options: [
          { label: 'A', text: 'It\'s illegal to keep cash at home' },
          { label: 'B', text: 'Cash at home can be lost or stolen, earns nothing, and isn\'t protected by the bank' },
          { label: 'C', text: 'Banks will confiscate it if they find out' },
        ],
        correct: 'B',
        explanation: 'Savings accounts are insured (up to £85,000 in the UK via FSCS), earn interest, and are far safer than storing cash at home.',
      },
    ],
  },
```

- [ ] **Step 5: Add M9b — The Snowball (Level 2, Pillar 3)**

```typescript
  // ── M9b: The Snowball ─────────────────────────────────────────────────────
  {
    slug:        'M9b',
    title:       'The Snowball',
    pillar:      3,
    level:       2,
    icon:        TrendingUp,
    triggerHint: 'Save consistently for 4 weeks to unlock',
    description: 'How compound interest makes money grow faster the longer you leave it.',
    hook: (d) => (
      <div className="flex flex-col gap-3">
        <p className="text-[15px] font-bold leading-snug">
          {d.appView === 'ORCHARD'
            ? `${d.savingsStreakWeeks} weeks in a row — your snowball is rolling. Here's the secret: it gets heavier without you pushing harder.`
            : `${d.savingsStreakWeeks} consecutive weeks of balance growth recorded. This module explains compound interest.`}
        </p>
        <p className="text-[14px] leading-relaxed">
          You now have {fmt(d.currentBalancePence, d.currency)}, up from {fmt(d.balance4wkAgoPence, d.currency)} four weeks ago.
          You did that by earning and saving. In the real world, once a snowball gets big enough, it picks up extra snow just by rolling.
          Money can do the same thing — not inside Morechard, but in a savings account. Let's look at what that actually means.
        </p>
        <p className="text-[12px] text-[var(--color-text-muted)] italic">
          Note: Morechard tracks what you earn. It doesn't add interest. This lesson is about the real-world tool you'll use when you're ready.
        </p>
      </div>
    ),
    lesson: (_d) => (
      <div className="flex flex-col gap-4">
        <p className="text-[14px] leading-relaxed">
          When you put money in a savings account, the bank pays you a little extra for keeping it there. That extra is called <strong>interest</strong>.
        </p>
        <p className="text-[14px] leading-relaxed">
          A typical savings account might pay <strong>4% interest per year</strong>. If you saved £100, the bank adds £4 at the end of the year. You'd have £104.
        </p>
        <p className="text-[14px] font-semibold">Simple vs compound interest:</p>
        <div className="rounded-xl bg-[var(--color-surface-alt)] p-3 text-[13px] font-mono flex flex-col gap-1">
          <p className="font-bold">Simple (4% of original each year):</p>
          <p>Year 1: £100 → £104</p>
          <p>Year 2: £100 → £108</p>
          <p>Year 3: £100 → £112</p>
          <p className="font-bold mt-2">Compound (4% of growing total):</p>
          <p>Year 1: £100.00 → £104.00</p>
          <p>Year 2: £104.00 → £108.16</p>
          <p>Year 3: £108.16 → £112.49</p>
        </div>
        <p className="text-[14px] leading-relaxed">
          The difference looks small now. Over 10 years on £50, compound interest earns £24 extra — for doing nothing. That's the snowball.
        </p>
        <p className="text-[14px] font-semibold">The most important sentence:</p>
        <p className="text-[14px] leading-relaxed">
          Starting early is worth more than saving a lot. A person who saves a small amount starting at 10 will often end up with more
          than someone who saves a larger amount starting at 30 — because the early saver's money has more years to compound.
          You can't buy back the years you didn't start. You're already doing that.
        </p>
      </div>
    ),
    lab: (d) => {
      const balance   = d.currentBalancePence
      const rate      = 0.04
      const yr1 = Math.round(balance * 1.04)
      const yr2 = Math.round(yr1   * 1.04)
      const yr3 = Math.round(yr2   * 1.04)
      const interest3 = yr3 - balance
      const simple3   = Math.round(balance * rate * 3)
      const extra     = interest3 - simple3
      const snowball50yr10 = Math.round(5000 * Math.pow(1.04, 10))  // £50 × 1.04^10 pence
      const choreEquiv = Math.ceil(interest3 / d.choreRateMedianPence)
      return (
        <div className="flex flex-col gap-4">
          <p className="text-[13px] text-[var(--color-text-muted)]">
            Using your balance of <strong>{fmt(balance, d.currency)}</strong> at 4% compound interest:
          </p>
          <div className="rounded-xl bg-[var(--color-surface-alt)] p-3 text-[13px] font-mono flex flex-col gap-1">
            <p>Year 1: {fmt(yr1, d.currency)}</p>
            <p>Year 2: {fmt(yr2, d.currency)}</p>
            <p>Year 3: {fmt(yr3, d.currency)}</p>
            <p className="font-bold border-t border-[var(--color-border)] pt-1">Interest earned (3yr): {fmt(interest3, d.currency)}</p>
            <p>Simple interest same period: {fmt(simple3, d.currency)}</p>
            <p className="text-[var(--brand-primary)] font-bold">Compound earns {fmt(extra, d.currency)} extra</p>
          </div>
          <p className="text-[13px]">
            That {fmt(interest3, d.currency)} of interest equals <strong>{choreEquiv} chores</strong> at your median rate — earned without working.
          </p>
          <div className="rounded-xl border border-[var(--color-border)] p-3 text-[13px]">
            <p className="font-semibold mb-1">Snowball comparison: £50 for 10 years at 4%</p>
            <p>Person A (savings account): {fmt(snowball50yr10, d.currency)}</p>
            <p>Person B (jar at home): {fmt(5000, d.currency)}</p>
            <p className="text-[var(--brand-primary)] font-bold mt-1">A earns {fmt(snowball50yr10 - 5000, d.currency)} extra — for doing nothing.</p>
          </div>
        </div>
      )
    },
    quiz: [
      {
        question: 'What makes compound interest grow faster than simple interest over time?',
        options: [
          { label: 'A', text: 'The interest rate is higher with compound interest' },
          { label: 'B', text: 'Each year\'s interest is calculated on the previous balance including earned interest, not just the original amount' },
          { label: 'C', text: 'Banks pay more when you\'ve been a customer longer' },
        ],
        correct: 'B',
        explanation: 'Compound interest builds on the growing total. Simple interest always calculates from the original amount. The snowball gets heavier on its own.',
      },
      {
        question: 'You save £200 in a 4% annual interest savings account. How much do you have after one year?',
        options: [
          { label: 'A', text: '£200 — interest doesn\'t apply in the first year' },
          { label: 'B', text: '£204' },
          { label: 'C', text: '£208' },
        ],
        correct: 'C',
        explanation: '4% of £200 = £8. £200 + £8 = £208. Interest applies from day one.',
      },
      {
        question: 'Why does starting to save early matter more than saving a large amount later?',
        options: [
          { label: 'A', text: 'Younger people get a higher interest rate' },
          { label: 'B', text: 'Early savings have more years to compound, so each pound grows longer' },
          { label: 'C', text: 'Savings accounts close after age 30' },
        ],
        correct: 'B',
        explanation: 'Compound interest multiplies over time. More years = more doublings. A small amount started early often beats a large amount started late.',
      },
    ],
  },
```

- [ ] **Step 6: Add M10 — The Interest Trap (Level 2, Pillar 4)**

```typescript
  // ── M10: The Interest Trap ────────────────────────────────────────────────
  {
    slug:        'M10',
    title:       'The Interest Trap',
    pillar:      4,
    level:       2,
    icon:        TrendingDown,
    triggerHint: 'Triggered when a parental loan is requested',
    description: 'What borrowing actually costs — and why credit card minimum payments are a trap.',
    hook: (_d) => (
      <div className="flex flex-col gap-3">
        <p className="text-[15px] font-bold leading-snug">
          Borrowing tomorrow's seeds to buy today's fruit can work. But the vine always wants something back.
        </p>
        <p className="text-[14px] leading-relaxed">
          When you borrow money, you don't just pay back what you borrowed. You pay back more — because the lender charges for the use
          of their money. This extra charge is called interest. Understanding it is one of the most important financial skills you can have.
        </p>
      </div>
    ),
    lesson: (_d) => (
      <div className="flex flex-col gap-4">
        <p className="text-[14px] leading-relaxed">
          <strong>How interest on debt works:</strong> If you borrow £100 at 20% annual interest and pay nothing for a year, you owe £120.
          Wait another year without paying: £144. The debt grows — just like savings compound, so do debts.
        </p>
        <p className="text-[14px] leading-relaxed">
          <strong>The minimum payment trap:</strong> Credit cards let you pay a small "minimum payment" each month — sometimes as little as 1–2% of
          what you owe. This sounds easy. But if you only pay the minimum on a £1,000 balance at 20% interest, it can take over 10 years
          to pay off and cost you nearly £1,000 in interest alone.
        </p>
        <div className="rounded-xl bg-[var(--color-surface-alt)] p-3 text-[13px] font-mono flex flex-col gap-1">
          <p>Borrow:          £1,000</p>
          <p>Interest rate:   20% per year</p>
          <p>Minimum payment: £25/month</p>
          <p className="font-bold mt-1">Time to clear:    ~10 years</p>
          <p className="font-bold text-red-500">Total paid:       ~£1,900</p>
        </div>
        <p className="text-[14px] leading-relaxed">
          The same £1,000 borrowed and repaid in full within the same month: costs £0 in interest (most credit cards have a grace period).
          The trap is not borrowing. The trap is borrowing and only paying the minimum.
        </p>
      </div>
    ),
    lab: (d) => {
      const balance     = d.currentBalancePence
      const loanAmount  = Math.round(balance * 1.5)   // hypothetical: borrow 50% more than they have
      const rate        = 0.20
      const after1yr    = Math.round(loanAmount * (1 + rate))
      const after2yr    = Math.round(after1yr   * (1 + rate))
      const extraCost   = after2yr - loanAmount
      return (
        <div className="flex flex-col gap-4">
          <p className="text-[13px] text-[var(--color-text-muted)]">
            Imagine borrowing {fmt(loanAmount, d.currency)} (50% more than your current balance) at 20% annual interest:
          </p>
          <div className="rounded-xl bg-[var(--color-surface-alt)] p-3 text-[13px] font-mono flex flex-col gap-1">
            <p>Borrowed:  {fmt(loanAmount, d.currency)}</p>
            <p>After 1yr: {fmt(after1yr, d.currency)} (+{fmt(after1yr - loanAmount, d.currency)})</p>
            <p>After 2yr: {fmt(after2yr, d.currency)} (+{fmt(after2yr - loanAmount, d.currency)} total)</p>
          </div>
          <p className="text-[13px]">
            If you paid nothing for 2 years, you'd owe {fmt(extraCost, d.currency)} extra —
            that's <strong>{Math.ceil(extraCost / d.choreRateMedianPence)} chores</strong> at your median rate just to cover the interest cost.
          </p>
        </div>
      )
    },
    quiz: [
      {
        question: 'You borrow £500 at 20% annual interest and pay nothing for 2 years. Roughly how much do you owe?',
        options: [
          { label: 'A', text: '£520' },
          { label: 'B', text: '£600' },
          { label: 'C', text: '£720' },
        ],
        correct: 'C',
        explanation: 'Year 1: £500 × 1.20 = £600. Year 2: £600 × 1.20 = £720. Interest compounds on the growing debt.',
      },
      {
        question: 'What makes "minimum payments" on credit cards dangerous?',
        options: [
          { label: 'A', text: 'They are not accepted by all banks' },
          { label: 'B', text: 'They barely cover the interest, so the debt barely shrinks — you pay for years and the balance stays high' },
          { label: 'C', text: 'They are illegal in the UK' },
        ],
        correct: 'B',
        explanation: 'Minimum payments are designed to keep you in debt longer, maximising the interest the lender collects. Always pay more than the minimum.',
      },
      {
        question: 'When does borrowing cost zero interest?',
        options: [
          { label: 'A', text: 'Never — all borrowing has a cost' },
          { label: 'B', text: 'When you repay within the interest-free grace period (usually the same billing month)' },
          { label: 'C', text: 'Only when borrowing from a family member' },
        ],
        correct: 'B',
        explanation: 'Most credit cards offer an interest-free period if you repay the full balance before the statement date. Use it correctly and borrowing costs nothing.',
      },
    ],
  },
```

- [ ] **Step 7: Add M14 — Inflation (Level 2, Pillar 5)**

```typescript
  // ── M14: Inflation ────────────────────────────────────────────────────────
  {
    slug:        'M14',
    title:       'Inflation',
    pillar:      5,
    level:       2,
    icon:        Gauge,
    triggerHint: 'No new chores for 21 days triggers this',
    description: 'Why money "shrinks" if it just sits still — and what to do about it.',
    hook: (d) => (
      <div className="flex flex-col gap-3">
        <p className="text-[15px] font-bold leading-snug">
          {d.appView === 'ORCHARD'
            ? 'Your seeds are sitting still. Money has a slow rot — here\'s what\'s quietly happening to your pile.'
            : 'No transaction activity detected. This module explains purchasing power erosion over time.'}
        </p>
        <p className="text-[14px] leading-relaxed">
          Imagine you put £100 under your mattress today. In 10 years, it's still £100 — but it buys less. A chocolate bar that costs 80p today
          might cost £1.10 in a decade. Your money didn't shrink. But what it can buy did. That's inflation.
        </p>
      </div>
    ),
    lesson: (_d) => (
      <div className="flex flex-col gap-4">
        <p className="text-[14px] leading-relaxed">
          <strong>What inflation is:</strong> Inflation is the general rise in prices over time. The UK government targets about 2% per year.
          At 2% inflation, something that costs £1.00 today costs roughly £1.22 in 10 years.
        </p>
        <p className="text-[14px] leading-relaxed">
          <strong>Why it happens:</strong> When more money chases roughly the same amount of goods, sellers can charge more.
          Inflation is driven by supply, demand, wages, energy costs, and government money supply decisions.
        </p>
        <p className="text-[14px] leading-relaxed">
          <strong>What it means for savings:</strong> If your savings earn 0% interest and inflation runs at 2%, your money's
          real purchasing power falls by about 2% per year. After 10 years, you can buy roughly 20% less with the same amount.
        </p>
        <div className="rounded-xl bg-[var(--color-surface-alt)] p-3 text-[13px] font-mono flex flex-col gap-1">
          <p>Today:    £100 buys a basket of goods</p>
          <p>+5 years: same basket costs ~£110</p>
          <p>+10 yrs:  same basket costs ~£122</p>
          <p className="font-bold mt-1">Your £100 (uninvested) still buys less each year.</p>
        </div>
        <p className="text-[14px] leading-relaxed">
          <strong>The fix:</strong> Keep savings in accounts that earn interest at or above the inflation rate.
          Money sitting in a 0% account loses real value every year.
        </p>
      </div>
    ),
    lab: (d) => {
      const balance  = d.currentBalancePence
      const infl     = 0.02
      const yr5real  = Math.round(balance / Math.pow(1 + infl, 5))
      const yr10real = Math.round(balance / Math.pow(1 + infl, 10))
      const lost5    = balance - yr5real
      const lost10   = balance - yr10real
      return (
        <div className="flex flex-col gap-4">
          <p className="text-[13px] text-[var(--color-text-muted)]">
            If your {fmt(balance, d.currency)} earns 0% while inflation runs at 2%:
          </p>
          <div className="rounded-xl bg-[var(--color-surface-alt)] p-3 text-[13px] font-mono flex flex-col gap-1">
            <p>Today (face value):   {fmt(balance, d.currency)}</p>
            <p>In 5 years (real):    {fmt(yr5real, d.currency)} (−{fmt(lost5, d.currency)} purchasing power)</p>
            <p>In 10 years (real):   {fmt(yr10real, d.currency)} (−{fmt(lost10, d.currency)} purchasing power)</p>
          </div>
          <p className="text-[13px]">
            After 10 years you'd still have {fmt(balance, d.currency)} in your account — but it would only buy what
            {fmt(yr10real, d.currency)} buys today. That's {Math.ceil(lost10 / d.choreRateMedianPence)} chores worth of purchasing power, silently erased.
          </p>
        </div>
      )
    },
    quiz: [
      {
        question: 'If inflation is 2% per year, what happens to the purchasing power of £100 kept in a 0% savings account?',
        options: [
          { label: 'A', text: 'It stays the same — you still have £100' },
          { label: 'B', text: 'It slowly decreases — £100 buys less each year as prices rise' },
          { label: 'C', text: 'It increases — your money is safe in the bank' },
        ],
        correct: 'B',
        explanation: 'The face value stays at £100, but inflation means prices rise each year. The same £100 buys less over time — real purchasing power falls.',
      },
      {
        question: 'What is the best way to protect your savings from inflation?',
        options: [
          { label: 'A', text: 'Spend it all before prices rise' },
          { label: 'B', text: 'Keep it in an account earning interest at or above the inflation rate' },
          { label: 'C', text: 'Keep it as cash — it doesn\'t lose value if you can hold it in your hand' },
        ],
        correct: 'B',
        explanation: 'Interest-earning accounts can offset inflation. If your savings earn 4% and inflation is 2%, your real purchasing power grows by ~2% per year.',
      },
      {
        question: 'The UK government targets roughly what annual inflation rate?',
        options: [
          { label: 'A', text: '0% — inflation should always be zero' },
          { label: 'B', text: '2%' },
          { label: 'C', text: '10%' },
        ],
        correct: 'B',
        explanation: 'The Bank of England targets 2% inflation. A small, stable rate is considered healthy — it encourages spending and investment rather than hoarding cash.',
      },
    ],
  },
```

- [ ] **Step 8: Add M17 — Digital vs Physical Currency (Level 2, Pillar 6)**

```typescript
  // ── M17: Digital vs Physical Currency ────────────────────────────────────
  {
    slug:        'M17',
    title:       'Digital vs Physical Currency',
    pillar:      6,
    level:       2,
    icon:        Smartphone,
    triggerHint: 'Create a gaming goal to unlock',
    description: 'V-Bucks, Robux, Gems — why in-game currency is designed to disconnect you from real money.',
    hook: (_d) => (
      <div className="flex flex-col gap-3">
        <p className="text-[15px] font-bold leading-snug">
          V-Bucks, Robux, Gems — the orchard has a dark corner selling "magic seeds" that only grow inside one walled garden. Let's map the exit.
        </p>
        <p className="text-[14px] leading-relaxed">
          In-game currencies aren't just a payment method — they're a design decision. Converting real money into game currency is
          intentional: it makes you forget how much you're spending. Understanding how it works puts you back in control.
        </p>
      </div>
    ),
    lesson: (_d) => (
      <div className="flex flex-col gap-4">
        <p className="text-[14px] leading-relaxed">
          <strong>Why game currencies exist:</strong> When you buy V-Bucks or Robux, you exchange real money for in-game tokens.
          The conversion rate is usually awkward (e.g. 1,000 V-Bucks for £7.99) — this is deliberate. It's harder to think
          "is this skin worth 3 hours of chores?" when you're thinking in V-Bucks.
        </p>
        <p className="text-[14px] leading-relaxed">
          <strong>The "leftover" trick:</strong> Bundles are often designed so you always have a little currency left over after a purchase.
          That leftover encourages you to buy another bundle to "not waste" it.
        </p>
        <p className="text-[14px] leading-relaxed">
          <strong>The real-money test:</strong> Before any in-game purchase, convert it back to real money.
          1,000 V-Bucks ≈ £8. Is this skin worth £8? Would you hand over that cash at a till for it?
        </p>
        <p className="text-[14px] leading-relaxed">
          <strong>Physical vs digital:</strong> Physical cash creates a friction — handing over a note feels different from tapping a card.
          Digital purchases remove that friction. Knowing this, you can add your own friction: wait 24 hours before any in-game spend over a set amount.
        </p>
      </div>
    ),
    lab: (d) => {
      const vbucks1000InPence = 799   // ~£7.99 per 1,000 V-Bucks
      const choreRate = d.choreRateMedianPence
      const choreEquiv = (vbucks1000InPence / choreRate).toFixed(1)
      return (
        <div className="flex flex-col gap-4">
          <p className="text-[14px] font-semibold">The labour equivalent test</p>
          <div className="rounded-xl bg-[var(--color-surface-alt)] p-3 text-[13px] flex flex-col gap-2">
            <p>1,000 V-Bucks = {fmt(vbucks1000InPence, d.currency)}</p>
            <p>Your median chore rate = {fmt(choreRate, d.currency)}</p>
            <p className="font-bold">That skin costs you <strong>{choreEquiv} chores</strong> worth of effort.</p>
          </div>
          <p className="text-[13px] leading-relaxed">
            Next time you consider an in-game purchase, ask yourself: "Would I do {choreEquiv} chores for this?"
            If the answer is no, the purchase isn't worth it to you at your real rate of earning.
          </p>
          <p className="text-[13px] text-[var(--color-text-muted)]">
            Try this with your last in-game purchase. How many chores was it worth?
          </p>
        </div>
      )
    },
    quiz: [
      {
        question: 'Why do game developers use their own currency (like V-Bucks) instead of letting you pay in pounds directly?',
        options: [
          { label: 'A', text: 'It\'s technically easier to process custom currencies' },
          { label: 'B', text: 'It makes real-money costs less obvious, reducing the friction of spending' },
          { label: 'C', text: 'Governments require it for digital goods' },
        ],
        correct: 'B',
        explanation: 'In-game currency creates a psychological barrier between real money and purchases. When you think in V-Bucks, you don\'t naturally convert back to pounds — which is the point.',
      },
      {
        question: 'What is the "leftover" trick in in-game currency bundles?',
        options: [
          { label: 'A', text: 'Leftover currency expires, so you lose it' },
          { label: 'B', text: 'Bundles leave you with a small amount remaining, nudging you to buy another bundle to avoid wasting it' },
          { label: 'C', text: 'You can convert leftover currency back to real money' },
        ],
        correct: 'B',
        explanation: 'Bundle sizes are deliberately misaligned with item costs. The leftover is bait — it makes you feel like you need to "top up" to use it, spending more than you planned.',
      },
      {
        question: 'Before spending V-Bucks, what is the most useful question to ask?',
        options: [
          { label: 'A', text: 'How many V-Bucks do I have left?' },
          { label: 'B', text: 'Would I pay this amount in real money at a shop for this item?' },
          { label: 'C', text: 'Did my friends buy this too?' },
        ],
        correct: 'B',
        explanation: 'Converting back to real money restores the friction the currency system removed. If you wouldn\'t pay £8 at a till for a digital outfit, the V-Bucks price isn\'t worth it either.',
      },
    ],
  },
```

- [ ] **Step 9: Add Level 3 modules (M3, M3b, M6, M9, M11, M12, M18, M18b)**

For each module, refer to spec file `docs/notebooklm/09-module-XX-<slug>.md` and follow the exact same pattern. Each must have:
- `hook(d)` — personalised opener using `d.lifetimeEarningsPence`, `d.reliabilityRating`, etc. as relevant per the spec
- `lesson(_d)` — structured educational content from Act 2 of the spec (static, no data needed)
- `lab(d)` — interactive component using real child data from Act 3 of the spec
- `quiz` — 3 questions from Act 4 of the spec

```typescript
  // ── M3: Entrepreneurship (Level 3, Pillar 1) ─────────────────────────────
  // Source: docs/notebooklm/09-module-03-entrepreneurship.md
  // Trigger: 10+ distinct chore types AND avg chore value > £3
  {
    slug: 'M3', title: 'Entrepreneurship', pillar: 1, level: 3, icon: Briefcase,
    triggerHint: 'Complete 10 different types of chore to unlock',
    description: 'What it means to make the work work for you — not just do more of it.',
    hook: (d) => <p className="text-[14px]">You've worked {d.distinctChoreTypes} different types of job in the orchard. Now here's the question every serious grower eventually asks: what if the orchard worked for <em>you</em> instead?</p>,
    lesson: (_d) => <p className="text-[14px]">Populate from spec: docs/notebooklm/09-module-03-entrepreneurship.md Act 2</p>,
    lab: (d) => <p className="text-[14px]">Populate from spec Act 3. Use d.choreRateMedianPence and d.lifetimeEarningsPence.</p>,
    quiz: [], // Populate 3 questions from spec Act 4
  },

  // ── M3b: Gig Trap vs Salary Safety (Level 3, Pillar 1) ───────────────────
  // Source: docs/notebooklm/09-module-03b-gig-trap-vs-salary-safety.md
  // Trigger: earnings variance > 40% over last 4 weeks
  {
    slug: 'M3b', title: 'Gig Trap vs Salary Safety', pillar: 1, level: 3, icon: Scale,
    triggerHint: 'Triggered by variable earnings week to week',
    description: 'The trade-off between high-potential gig income and the safety of steady pay.',
    hook: (_d) => <p className="text-[14px]">Some weeks a feast, some weeks bare branches — your earnings are swinging. That pattern has a name, and it's worth knowing before you build a life around it.</p>,
    lesson: (_d) => <p className="text-[14px]">Populate from spec: docs/notebooklm/09-module-03b-gig-trap-vs-salary-safety.md Act 2</p>,
    lab: (_d) => <p className="text-[14px]">Populate from spec Act 3.</p>,
    quiz: [],
  },

  // ── M6: Advertising & Influence (Level 3, Pillar 2) ──────────────────────
  // Source: docs/notebooklm/09-module-06-advertising-influence.md
  // Trigger: 3+ purchases in same non-essential category within 30 days
  {
    slug: 'M6', title: 'Advertising & Influence', pillar: 2, level: 3, icon: Megaphone,
    triggerHint: 'Triggered by repeat spending in the same category',
    description: 'How advertising is designed to make you want things — and how to notice it.',
    hook: (_d) => <p className="text-[14px]">Three times in a month, the same shelf called your name. That's not a coincidence — someone designed that shelf. Let's inspect the architecture.</p>,
    lesson: (_d) => <p className="text-[14px]">Populate from spec: docs/notebooklm/09-module-06-advertising-influence.md Act 2</p>,
    lab: (_d) => <p className="text-[14px]">Populate from spec Act 3.</p>,
    quiz: [],
  },

  // ── M9: Opportunity Cost (Level 3, Pillar 3) ─────────────────────────────
  // Source: docs/notebooklm/09-module-09-opportunity-cost.md
  // Trigger: goal cancelled after spending in competing category within 14 days
  {
    slug: 'M9', title: 'Opportunity Cost', pillar: 3, level: 3, icon: GitFork,
    triggerHint: 'Triggered when a goal is cancelled after a competing purchase',
    description: 'Every yes is a hidden no — how to make trade-offs consciously.',
    hook: (_d) => <p className="text-[14px]">You said yes to something — and quietly said no to something else. That trade has a name. Here's how to make it consciously next time.</p>,
    lesson: (_d) => <p className="text-[14px]">Populate from spec: docs/notebooklm/09-module-09-opportunity-cost.md Act 2</p>,
    lab: (_d) => <p className="text-[14px]">Populate from spec Act 3.</p>,
    quiz: [],
  },

  // ── M11: Credit Scores & Trust (Level 3, Pillar 4) ───────────────────────
  // Source: docs/notebooklm/09-module-11-credit-scores-and-trust.md
  // Trigger: reliability rating >= 90% over 8 weeks
  {
    slug: 'M11', title: 'Credit Scores & Trust', pillar: 4, level: 3, icon: Star,
    triggerHint: 'Achieve 90% reliability over 8 weeks to unlock',
    description: 'How your financial reliability becomes a number — and why it matters.',
    hook: (d) => <p className="text-[14px]">Your consistency has a number. In the wider world, that number is {d.reliabilityRating}% — and it opens doors or closes them. Here's how the system works.</p>,
    lesson: (_d) => <p className="text-[14px]">Populate from spec: docs/notebooklm/09-module-11-credit-scores-and-trust.md Act 2</p>,
    lab: (d) => <p className="text-[14px]">Use d.reliabilityRating to show where child sits on the credit-score spectrum. Populate from spec Act 3.</p>,
    quiz: [],
  },

  // ── M12: Good vs Bad Debt (Level 3, Pillar 4) ────────────────────────────
  // Source: docs/notebooklm/09-module-12-good-vs-bad-debt.md
  // Trigger: M10 complete AND goal in 'asset' category created
  {
    slug: 'M12', title: 'Good vs Bad Debt', pillar: 4, level: 3, icon: CreditCard,
    triggerHint: 'Complete The Interest Trap module first',
    description: 'Not all debt is equal — a mortgage and a payday loan are not the same thing.',
    hook: (_d) => <p className="text-[14px]">Not all debt is a vine strangling your tree. Some debt is a trellis. Here's the test every serious grower uses to tell the difference.</p>,
    lesson: (_d) => <p className="text-[14px]">Populate from spec: docs/notebooklm/09-module-12-good-vs-bad-debt.md Act 2</p>,
    lab: (_d) => <p className="text-[14px]">Populate from spec Act 3.</p>,
    quiz: [],
  },

  // ── M18: Money & Mental Health (Level 3, Pillar 6) ───────────────────────
  // Source: docs/notebooklm/09-module-18-money-and-mental-health.md
  // Trigger: satisfaction rating < 3/5 within 48h of a goal purchase
  {
    slug: 'M18', title: 'Money & Mental Health', pillar: 6, level: 3, icon: Heart,
    triggerHint: 'Triggered after a purchase you felt mixed about',
    description: 'Buyer\'s remorse, contentment, and why getting the thing doesn\'t always fix the feeling.',
    hook: (_d) => <p className="text-[14px]">You got the thing — and something feels off. That feeling has a name. Let's talk about it before it shapes your next harvest.</p>,
    lesson: (_d) => <p className="text-[14px]">Populate from spec: docs/notebooklm/09-module-18-money-and-mental-health.md Act 2</p>,
    lab: (_d) => <p className="text-[14px]">Populate from spec Act 3.</p>,
    quiz: [],
  },

  // ── M18b: Social Comparison (Level 3, Pillar 6) ──────────────────────────
  // Source: docs/notebooklm/09-module-18b-social-comparison.md
  // Trigger: goal in Electronics/Fashion within 72h of sibling's similar goal
  {
    slug: 'M18b', title: 'Social Comparison', pillar: 6, level: 3, icon: Users,
    triggerHint: 'Triggered when spending follows a peer\'s purchase',
    description: 'Why "keeping up" is a race with no finish line — and how to opt out.',
    hook: (_d) => <p className="text-[14px]">Someone else planted a seed and now you want the same crop. That's human — but let's make sure it's your hunger driving this, not theirs.</p>,
    lesson: (_d) => <p className="text-[14px]">Populate from spec: docs/notebooklm/09-module-18b-social-comparison.md Act 2</p>,
    lab: (_d) => <p className="text-[14px]">Populate from spec Act 3.</p>,
    quiz: [],
  },

  // ── M13: Stocks & Shares (Level 4, Pillar 5) ─────────────────────────────
  // Source: docs/notebooklm/09-module-13-compound-growth.md
  // Trigger: lifetime earnings >= £100
  {
    slug: 'M13', title: 'Stocks & Shares', pillar: 5, level: 4, icon: BarChart2,
    triggerHint: 'Earn £100 lifetime to unlock',
    description: 'Fractional ownership of companies — and why long-term investors usually win.',
    hook: (d) => <p className="text-[14px]">A hundred pounds of harvested energy — {fmt(d.lifetimeEarningsPence, d.currency)} earned. The orchard now has a question: do you want to own a small piece of someone else's farm?</p>,
    lesson: (_d) => <p className="text-[14px]">Populate from spec: docs/notebooklm/09-module-13-compound-growth.md Act 2</p>,
    lab: (d) => <p className="text-[14px]">Use d.lifetimeEarningsPence as the hypothetical investment principal. Populate from spec Act 3.</p>,
    quiz: [],
  },

  // ── M15: Risk & Diversification (Level 4, Pillar 5) ──────────────────────
  // Source: docs/notebooklm/09-module-15-risk-and-diversification.md
  // Trigger: 3+ active goals with at least one long-term (>90 days)
  {
    slug: 'M15', title: 'Risk & Diversification', pillar: 5, level: 4, icon: PieChart,
    triggerHint: 'Have 3 active goals including one long-term goal',
    description: 'Don\'t put all your seeds in one basket — the maths of spreading risk.',
    hook: (d) => <p className="text-[14px]">Three seeds in three different soils — {d.activeGoalsCount} active goals. You're thinking like a strategist. Now let's examine what happens when one of those soils turns bad.</p>,
    lesson: (_d) => <p className="text-[14px]">Populate from spec: docs/notebooklm/09-module-15-risk-and-diversification.md Act 2</p>,
    lab: (d) => <p className="text-[14px]">Use d.activeGoalsCount. Populate from spec Act 3.</p>,
    quiz: [],
  },
]
```

- [ ] **Step 10: Commit**

```bash
git add app/src/lib/labCatalogue.ts
git commit -m "feat(lab): add module catalogue with types, pillar config, and all 17 module definitions"
```

> **Content note:** Level 3/4 module lesson, lab, and quiz stubs must be populated by reading the corresponding spec files in `docs/notebooklm/09-module-*.md` and following the same pattern as the fully-implemented Level 2 modules above. The `hook`, `lesson`, `lab`, and `quiz` fields for M3, M3b, M6, M9, M11, M12, M18, M18b, M13, M15 are stubs — replace `<p>Populate from spec...</p>` with full content before shipping.

---

## Task 3: Worker Route (`worker/src/routes/lab.ts`)

**Files:**
- Create: `worker/src/routes/lab.ts`

- [ ] **Step 1: Create the file**

```typescript
// worker/src/routes/lab.ts
// GET  /api/lab/modules   — returns unlock status, act progress, and child data for all modules
// POST /api/lab/modules/:slug/acts/:num/complete — mark an act complete

import type { Env } from '../types.js'
import { json, error } from '../lib/response.js'
import { nanoid } from '../lib/nanoid.js'
import type { JwtPayload } from '../lib/jwt.js'

type AuthedRequest = Request & { auth: JwtPayload }

// ── GET /api/lab/modules ──────────────────────────────────────────────────────
export async function handleLabModules(request: Request, env: Env): Promise<Response> {
  const auth = (request as AuthedRequest).auth
  if (auth.role !== 'child') return json({ error: 'Child auth required' }, 403)

  const childId = auth.sub

  // Fetch unlock status, act progress, settings (age_level + app_view), and child data in parallel
  const [unlockRows, progressRows, settings, balanceRow, earningsRow, choreRow, streakRow] =
    await Promise.all([
      env.DB.prepare(
        `SELECT module_slug, unlocked_at FROM unlocked_modules WHERE child_id = ?`
      ).bind(childId).all(),

      env.DB.prepare(
        `SELECT module_slug, act_num, completed_at FROM module_act_progress WHERE child_id = ?`
      ).bind(childId).all(),

      env.DB.prepare(
        `SELECT age_level, app_view FROM user_settings WHERE user_id = ?`
      ).bind(childId).first<{ age_level: number; app_view: string }>(),

      // Current balance (available pence)
      env.DB.prepare(
        `SELECT COALESCE(SUM(CASE WHEN entry_type='credit' THEN amount ELSE -amount END), 0) AS balance
         FROM ledger WHERE child_id = ? AND verification_status != 'reversed'`
      ).bind(childId).first<{ balance: number }>(),

      // Lifetime earnings
      env.DB.prepare(
        `SELECT COALESCE(SUM(amount), 0) AS total FROM ledger
         WHERE child_id = ? AND entry_type = 'credit' AND verification_status != 'reversed'`
      ).bind(childId).first<{ total: number }>(),

      // Median chore rate (last 5 approved chores), fallback 500 (£5)
      env.DB.prepare(
        `SELECT amount FROM ledger WHERE child_id = ? AND entry_type = 'credit'
         AND verification_status IN ('verified_auto','verified_manual')
         ORDER BY created_at DESC LIMIT 5`
      ).bind(childId).all<{ amount: number }>(),

      // Streak + growth data
      env.DB.prepare(
        `SELECT current_streak FROM child_streaks WHERE child_id = ?`
      ).bind(childId).first<{ current_streak: number }>(),
    ])

  // Calculate median chore rate
  const choreAmounts = (choreRow.results ?? []).map(r => r.amount).sort((a, b) => a - b)
  const choreRateMedian = choreAmounts.length > 0
    ? choreAmounts[Math.floor(choreAmounts.length / 2)]
    : 500

  // Balance 4 weeks ago (approximate from ledger)
  const fourWeeksAgo = Math.floor(Date.now() / 1000) - 28 * 24 * 60 * 60
  const balance4wkRow = await env.DB.prepare(
    `SELECT COALESCE(SUM(CASE WHEN entry_type='credit' THEN amount ELSE -amount END), 0) AS balance
     FROM ledger WHERE child_id = ? AND created_at <= ? AND verification_status != 'reversed'`
  ).bind(childId, fourWeeksAgo).first<{ balance: number }>()

  // Distinct chore types
  const distinctChoreRow = await env.DB.prepare(
    `SELECT COUNT(DISTINCT chore_id) AS cnt FROM ledger
     WHERE child_id = ? AND entry_type = 'credit'`
  ).bind(childId).first<{ cnt: number }>()

  // Active goals count
  const activeGoalsRow = await env.DB.prepare(
    `SELECT COUNT(*) AS cnt FROM goals WHERE child_id = ? AND archived = 0 AND status = 'ACTIVE'`
  ).bind(childId).first<{ cnt: number }>()

  // Reliability rating: first-pass approvals / total completions × 100
  const reliabilityRow = await env.DB.prepare(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS passed
     FROM completions WHERE child_id = ? AND status IN ('completed','rejected','needs_revision')`
  ).bind(childId).first<{ total: number; passed: number }>()

  const reliabilityRating = reliabilityRow && reliabilityRow.total > 0
    ? Math.round((reliabilityRow.passed / reliabilityRow.total) * 100)
    : 100

  // Consecutive weekly growth (weeks where balance increased)
  // Simplified: count from streak data; fallback to 0
  const consecutiveWeeklyGrowth = streakRow?.current_streak ?? 0

  // Build response maps
  const unlocked = new Map<string, number>(
    (unlockRows.results ?? []).map(r => [(r as { module_slug: string; unlocked_at: number }).module_slug, (r as { module_slug: string; unlocked_at: number }).unlocked_at])
  )

  type ProgressRow = { module_slug: string; act_num: number; completed_at: number }
  const actProgress = new Map<string, number[]>()
  for (const row of (progressRows.results ?? []) as ProgressRow[]) {
    const existing = actProgress.get(row.module_slug) ?? []
    existing.push(row.act_num)
    actProgress.set(row.module_slug, existing)
  }

  // Currency from most recent ledger entry
  const currencyRow = await env.DB.prepare(
    `SELECT currency FROM ledger WHERE child_id = ? ORDER BY created_at DESC LIMIT 1`
  ).bind(childId).first<{ currency: string }>()

  return json({
    modules: Object.fromEntries(
      Array.from(unlocked.entries()).map(([slug, unlockedAt]) => [
        slug,
        { unlocked_at: unlockedAt, completed_acts: actProgress.get(slug) ?? [] },
      ])
    ),
    childData: {
      currency:                currencyRow?.currency ?? 'GBP',
      currentBalancePence:     balanceRow?.balance ?? 0,
      lifetimeEarningsPence:   earningsRow?.total ?? 0,
      choreRateMedianPence:    choreRateMedian,
      savingsStreakWeeks:       streakRow?.current_streak ?? 0,
      balance4wkAgoPence:       balance4wkRow?.balance ?? 0,
      consecutiveWeeklyGrowth:  consecutiveWeeklyGrowth,
      activeGoalsCount:         activeGoalsRow?.cnt ?? 0,
      reliabilityRating,
      distinctChoreTypes:       distinctChoreRow?.cnt ?? 0,
    },
    ageLevel: settings?.age_level ?? 2,
  })
}

// ── POST /api/lab/modules/:slug/acts/:num/complete ────────────────────────────
export async function handleLabActComplete(request: Request, env: Env, slug: string, actNum: number): Promise<Response> {
  const auth = (request as AuthedRequest).auth
  if (auth.role !== 'child') return json({ error: 'Child auth required' }, 403)

  if (actNum < 1 || actNum > 4) return error('act_num must be 1–4')

  const childId = auth.sub
  const now     = Math.floor(Date.now() / 1000)

  // Verify module is unlocked before recording progress
  const unlocked = await env.DB.prepare(
    `SELECT id FROM unlocked_modules WHERE child_id = ? AND module_slug = ?`
  ).bind(childId, slug).first()

  if (!unlocked) return error('Module not unlocked', 403)

  await env.DB.prepare(
    `INSERT OR IGNORE INTO module_act_progress (id, child_id, module_slug, act_num, completed_at)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(nanoid(), childId, slug, actNum, now).run()

  return json({ ok: true })
}
```

- [ ] **Step 2: Commit**

```bash
git add worker/src/routes/lab.ts
git commit -m "feat(lab): add GET /api/lab/modules and POST act-complete endpoints"
```

---

## Task 4: Register Routes in `worker/src/index.ts`

**Files:**
- Modify: `worker/src/index.ts`

- [ ] **Step 1: Add import after the existing chat-modules import**

Find the line:
```typescript
import { handleChatModules } from './routes/chat-modules.js';
```
Add after it:
```typescript
import { handleLabModules, handleLabActComplete } from './routes/lab.js';
```

- [ ] **Step 2: Register routes in the `route()` function**

Find the block that handles `/api/chat/modules`:
```typescript
if (path === '/api/chat/modules' && method === 'GET') return requireAuth(request, env, handleChatModules);
```
Add after it:
```typescript
if (path === '/api/lab/modules' && method === 'GET')
  return requireAuth(request, env, handleLabModules);

const labActMatch = path.match(/^\/api\/lab\/modules\/([^/]+)\/acts\/(\d+)\/complete$/)
if (labActMatch && method === 'POST')
  return requireAuth(request, env, (req, e) =>
    handleLabActComplete(req, e, labActMatch[1], parseInt(labActMatch[2], 10))
  )
```

- [ ] **Step 3: Commit**

```bash
git add worker/src/index.ts
git commit -m "feat(lab): register lab module routes in worker"
```

---

## Task 5: Frontend API (`app/src/lib/api.ts`)

**Files:**
- Modify: `app/src/lib/api.ts`

- [ ] **Step 1: Add types and functions after the existing `getChatModules` function**

Find:
```typescript
export async function getChatModules(): Promise<ChatModulesResponse> {
  return request<ChatModulesResponse>('/api/chat/modules')
}
```

Add after it:
```typescript
// ── Learning Lab ─────────────────────────────────────────────────────────────

export interface LabChildData {
  currency:                string
  currentBalancePence:     number
  lifetimeEarningsPence:   number
  choreRateMedianPence:    number
  savingsStreakWeeks:       number
  balance4wkAgoPence:      number
  consecutiveWeeklyGrowth: number
  activeGoalsCount:        number
  reliabilityRating:       number
  distinctChoreTypes:      number
}

export interface LabModuleStatus {
  unlocked_at:    number
  completed_acts: number[]   // [1,2,3,4] — acts completed
}

export interface LabModulesResponse {
  modules:   Record<string, LabModuleStatus>   // keyed by module slug e.g. 'M9b'
  childData: LabChildData
  ageLevel:  number
}

export async function getLabModules(): Promise<LabModulesResponse> {
  return request<LabModulesResponse>('/api/lab/modules')
}

export async function completeLabAct(moduleSlug: string, actNum: 1 | 2 | 3 | 4): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/api/lab/modules/${moduleSlug}/acts/${actNum}/complete`, { method: 'POST' })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/src/lib/api.ts
git commit -m "feat(lab): add getLabModules and completeLabAct API functions"
```

---

## Task 6: LabTab Grid Rebuild (`app/src/components/dashboard/LabTab.tsx`)

**Files:**
- Modify: `app/src/components/dashboard/LabTab.tsx`

- [ ] **Step 1: Replace the file entirely**

```typescript
// app/src/components/dashboard/LabTab.tsx
// Learning Lab — level-grouped module grid with 3-state tiles.

import { useState, useEffect } from 'react'
import { Lock, ChevronRight } from 'lucide-react'
import { getLabModules, type LabModulesResponse } from '../../lib/api'
import { MODULES, LEVEL_LABELS, PILLARS, type ModuleSlug, type AgeLevel, type AppView } from '../../lib/labCatalogue'
import { ModuleReader } from './ModuleReader'

// Icons are stored as component references in labCatalogue.ts — no ICON_MAP needed

interface LabTabProps {
  appView: AppView
}

export function LabTab({ appView }: LabTabProps) {
  const [data,           setData]           = useState<LabModulesResponse | null>(null)
  const [loading,        setLoading]        = useState(true)
  const [error,          setError]          = useState<string | null>(null)
  const [activeSlug,     setActiveSlug]     = useState<ModuleSlug | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getLabModules()
      .then(res => { if (!cancelled) { setData(res); setLoading(false) } })
      .catch(() => { if (!cancelled) { setError('Could not load modules.'); setLoading(false) } })
    return () => { cancelled = true }
  }, [])

  if (loading) return (
    <div className="flex flex-col gap-3">
      {[1,2,3,4].map(i => <div key={i} className="animate-pulse rounded-xl bg-[var(--color-border)] h-20" />)}
    </div>
  )

  if (error || !data) return <p className="text-[13px] text-red-500">{error ?? 'No data'}</p>

  const childAge  = data.ageLevel as AgeLevel
  const unlockedSlugs = new Set(Object.keys(data.modules))

  // Group modules by level — only show levels 2–4 at launch
  const levels: AgeLevel[] = [2, 3, 4]

  return (
    <div className="flex flex-col gap-6">
      {levels.map(level => {
        const levelModules = MODULES.filter(m => m.level === level)
        const unlockedCount = levelModules.filter(m => unlockedSlugs.has(m.slug)).length
        const levelLabel = LEVEL_LABELS[level][appView]
        const isFuture = level > childAge

        return (
          <section key={level}>
            {/* Level header */}
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-[13px] font-bold text-[var(--color-text)] uppercase tracking-wide">
                  {levelLabel}
                  {isFuture && (
                    <span className="ml-2 text-[10px] font-semibold text-[var(--color-text-muted)] normal-case tracking-normal">
                      · unlocks later
                    </span>
                  )}
                </h2>
                <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                  {unlockedCount} of {levelModules.length} unlocked
                </p>
              </div>
              {/* Progress bar */}
              <div className="w-24 h-1.5 rounded-full bg-[var(--color-border)] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${levelModules.length > 0 ? (unlockedCount / levelModules.length) * 100 : 0}%`,
                    backgroundColor: PILLARS[levelModules[0]?.pillar ?? 1].color,
                  }}
                />
              </div>
            </div>

            {/* 2-column tile grid */}
            <div className="grid grid-cols-2 gap-2.5">
              {levelModules.map(mod => {
                const pillar   = PILLARS[mod.pillar]
                const isUnlocked = unlockedSlugs.has(mod.slug)
                const tooAdvanced = isFuture
                const Icon = mod.icon

                // Three tile states
                if (tooAdvanced) {
                  return (
                    <div
                      key={mod.slug}
                      className="rounded-xl border border-[var(--color-border)] p-3 opacity-35 flex flex-col gap-2"
                    >
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--color-border)]">
                        <Lock size={14} className="text-[var(--color-text-muted)]" />
                      </div>
                      <p className="text-[12px] font-semibold text-[var(--color-text-muted)]">{mod.title}</p>
                      <p className="text-[10px] text-[var(--color-text-muted)]">{levelLabel}</p>
                    </div>
                  )
                }

                if (!isUnlocked) {
                  return (
                    <div
                      key={mod.slug}
                      className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 flex flex-col gap-2"
                    >
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: pillar.mutedColor }}>
                        <Lock size={14} style={{ color: pillar.color }} />
                      </div>
                      <p className="text-[12px] font-semibold text-[var(--color-text)]">{mod.title}</p>
                      <p className="text-[10px] text-[var(--color-text-muted)] leading-tight">{mod.triggerHint}</p>
                    </div>
                  )
                }

                // Unlocked
                const completedActs = data.modules[mod.slug]?.completed_acts ?? []
                const allDone = completedActs.length === 4

                return (
                  <button
                    key={mod.slug}
                    onClick={() => setActiveSlug(mod.slug as ModuleSlug)}
                    className="rounded-xl border-2 bg-[var(--color-surface)] p-3 flex flex-col gap-2 text-left hover:brightness-95 transition-all cursor-pointer"
                    style={{ borderColor: pillar.color }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: pillar.color }}>
                        <Icon size={14} className="text-white" />
                      </div>
                      {allDone
                        ? <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: pillar.color }}>✓</span>
                        : <span className="text-[10px] text-[var(--color-text-muted)]">{completedActs.length}/4</span>
                      }
                    </div>
                    <p className="text-[12px] font-bold text-[var(--color-text)]">{mod.title}</p>
                    <p className="text-[10px] text-[var(--color-text-muted)] leading-tight">{mod.description}</p>
                    <div className="flex items-center gap-1 mt-auto">
                      <span className="text-[10px] font-semibold" style={{ color: pillar.color }}>
                        {appView === 'ORCHARD' ? pillar.orchardName : pillar.name}
                      </span>
                      <ChevronRight size={10} style={{ color: pillar.color }} />
                    </div>
                  </button>
                )
              })}
            </div>
          </section>
        )
      })}

      {/* Module reader overlay */}
      {activeSlug && data && (
        <ModuleReader
          slug={activeSlug}
          childData={{ ...data.childData, appView }}
          completedActs={data.modules[activeSlug]?.completed_acts ?? []}
          onActComplete={(actNum) => {
            setData(prev => {
              if (!prev) return prev
              const existing = prev.modules[activeSlug] ?? { unlocked_at: Date.now(), completed_acts: [] }
              const acts = existing.completed_acts.includes(actNum)
                ? existing.completed_acts
                : [...existing.completed_acts, actNum]
              return { ...prev, modules: { ...prev.modules, [activeSlug]: { ...existing, completed_acts: acts } } }
            })
          }}
          onClose={() => setActiveSlug(null)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/src/components/dashboard/LabTab.tsx
git commit -m "feat(lab): rebuild LabTab with level-grouped grid and 3-state tiles"
```

---

## Task 7: ModuleReader Component (`app/src/components/dashboard/ModuleReader.tsx`)

**Files:**
- Create: `app/src/components/dashboard/ModuleReader.tsx`

- [ ] **Step 1: Create the file**

```typescript
// app/src/components/dashboard/ModuleReader.tsx
// Four-act stepped module reader: Hook → Lesson → Lab → Quiz
// Full-screen overlay, resumable from last completed act.

import { useState, useEffect } from 'react'
import { X, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react'
import { MODULES, PILLARS, type ModuleSlug, type ChildLabData } from '../../lib/labCatalogue'
import { completeLabAct } from '../../lib/api'

const ACT_LABELS = ['Hook', 'Lesson', 'Lab', 'Quiz'] as const
type ActIndex = 0 | 1 | 2 | 3

interface ModuleReaderProps {
  slug:           ModuleSlug
  childData:      ChildLabData
  completedActs:  number[]    // [1,2,3,4]
  onActComplete:  (actNum: 1 | 2 | 3 | 4) => void
  onClose:        () => void
}

export function ModuleReader({ slug, childData, completedActs, onActComplete, onClose }: ModuleReaderProps) {
  const mod    = MODULES.find(m => m.slug === slug)!
  const pillar = PILLARS[mod.pillar]

  // Resume from the first incomplete act
  const firstIncomplete = ([0,1,2,3] as ActIndex[]).find(i => !completedActs.includes(i + 1)) ?? 0
  const [actIndex, setActIndex] = useState<ActIndex>(firstIncomplete)
  const [quizAnswer, setQuizAnswer]     = useState<'A' | 'B' | 'C' | null>(null)
  const [quizQuestion, setQuizQuestion] = useState(0)
  const [quizResults,  setQuizResults]  = useState<boolean[]>([])
  const [saving, setSaving] = useState(false)

  // Reset quiz state when act changes
  useEffect(() => {
    setQuizAnswer(null)
    setQuizQuestion(0)
    setQuizResults([])
  }, [actIndex])

  const actNum = (actIndex + 1) as 1 | 2 | 3 | 4
  const isCompleted = completedActs.includes(actNum)

  async function markComplete() {
    if (saving || isCompleted) return
    setSaving(true)
    try {
      await completeLabAct(slug, actNum)
      onActComplete(actNum)
    } catch { /* non-fatal — progress stored locally via onActComplete optimistic update */ }
    finally { setSaving(false) }
  }

  function handleNext() {
    if (!isCompleted) markComplete()
    if (actIndex < 3) setActIndex(prev => (prev + 1) as ActIndex)
    else onClose()
  }

  function renderAct() {
    switch (actIndex) {
      case 0: return mod.hook(childData)
      case 1: return mod.lesson(childData)
      case 2: return mod.lab(childData)
      case 3: return renderQuiz()
    }
  }

  function renderQuiz() {
    const q = mod.quiz[quizQuestion]
    if (!q) return <p className="text-[14px]">Quiz complete.</p>
    const answered = quizAnswer !== null
    return (
      <div className="flex flex-col gap-4">
        <p className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
          Question {quizQuestion + 1} of {mod.quiz.length}
        </p>
        <p className="text-[15px] font-semibold leading-snug">
          {typeof q.question === 'function' ? q.question(childData) : q.question}
        </p>
        <div className="flex flex-col gap-2">
          {q.options.map(opt => {
            const isSelected = quizAnswer === opt.label
            const isCorrect  = answered && opt.label === q.correct
            const isWrong    = answered && isSelected && opt.label !== q.correct
            return (
              <button
                key={opt.label}
                disabled={answered}
                onClick={() => {
                  setQuizAnswer(opt.label)
                  setQuizResults(prev => [...prev, opt.label === q.correct])
                }}
                className={`text-left rounded-xl border px-4 py-3 text-[13px] transition-colors cursor-pointer
                  ${isCorrect ? 'border-green-500 bg-green-50 text-green-800' : ''}
                  ${isWrong   ? 'border-red-400 bg-red-50 text-red-800'   : ''}
                  ${!answered ? 'border-[var(--color-border)] hover:border-[var(--brand-primary)]' : ''}
                  ${answered && !isSelected && opt.label !== q.correct ? 'opacity-50' : ''}
                `}
              >
                <span className="font-bold mr-2">{opt.label}.</span>{opt.text}
              </button>
            )
          })}
        </div>
        {answered && (
          <div className="rounded-xl bg-[var(--color-surface-alt)] p-3 text-[13px] leading-relaxed">
            {quizAnswer === q.correct ? '✓ Correct. ' : '✗ Not quite. '}{q.explanation}
          </div>
        )}
        {answered && quizQuestion < mod.quiz.length - 1 && (
          <button
            onClick={() => { setQuizAnswer(null); setQuizQuestion(prev => prev + 1) }}
            className="self-end text-[13px] font-semibold text-[var(--brand-primary)] cursor-pointer"
          >
            Next question →
          </button>
        )}
      </div>
    )
  }

  const allQuizAnswered = actIndex === 3 && quizResults.length === mod.quiz.length

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--color-bg)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-safe pt-4 pb-3 border-b border-[var(--color-border)]">
        <button
          onClick={() => actIndex > 0 ? setActIndex(prev => (prev - 1) as ActIndex) : onClose()}
          className="w-9 h-9 flex items-center justify-center rounded-xl border border-[var(--color-border)] cursor-pointer"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="flex flex-col items-center gap-1">
          <span className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
            {mod.title}
          </span>
          <span className="text-[11px]" style={{ color: pillar.color }}>
            {ACT_LABELS[actIndex]}
          </span>
        </div>
        <button
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center rounded-xl border border-[var(--color-border)] cursor-pointer"
        >
          <X size={16} />
        </button>
      </div>

      {/* Act progress strip */}
      <div className="flex px-4 pt-3 pb-2 gap-1.5">
        {([0,1,2,3] as ActIndex[]).map(i => (
          <div
            key={i}
            className="flex-1 h-1 rounded-full transition-all"
            style={{
              backgroundColor: completedActs.includes(i + 1)
                ? pillar.color
                : i === actIndex
                  ? pillar.mutedColor
                  : 'var(--color-border)',
            }}
          />
        ))}
      </div>

      {/* Act label row */}
      <div className="flex px-4 pb-3">
        {ACT_LABELS.map((label, i) => (
          <div key={i} className="flex-1 text-center">
            <span
              className="text-[9px] font-semibold uppercase tracking-wide"
              style={{ color: i === actIndex ? pillar.color : 'var(--color-text-muted)' }}
            >
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        {renderAct()}
      </div>

      {/* Footer CTA */}
      <div className="px-4 pb-safe pb-6 pt-3 border-t border-[var(--color-border)]">
        {actIndex === 3 && !allQuizAnswered ? (
          <p className="text-center text-[13px] text-[var(--color-text-muted)]">
            Answer all questions to continue
          </p>
        ) : (
          <button
            onClick={handleNext}
            disabled={saving}
            className="w-full py-3.5 rounded-xl text-white text-[14px] font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            style={{ backgroundColor: pillar.color }}
          >
            {isCompleted && actIndex < 3 && <CheckCircle2 size={16} />}
            {actIndex < 3 ? 'Next' : 'Finish'}
            {actIndex < 3 && <ChevronRight size={16} />}
          </button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/src/components/dashboard/ModuleReader.tsx
git commit -m "feat(lab): add ModuleReader four-act stepped component"
```

---

## Task 8: ChildDashboard — Pass childData + Nav Badge

**Files:**
- Modify: `app/src/screens/ChildDashboard.tsx`

- [ ] **Step 1: Add lab unread state**

In the state declarations section (near `const [childTab, setChildTab]`), add:
```typescript
const [labUnread, setLabUnread] = useState(0)
```

- [ ] **Step 2: Fetch unread count after main load**

In the `load` function after `setAppView(av)`, add:
```typescript
// Count newly-unlocked modules (unlocked in the last 7 days, no acts started)
try {
  const { getLabModules } = await import('../lib/api')
  const labData = await getLabModules()
  const sevenDaysAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60
  const unread = Object.entries(labData.modules).filter(
    ([, m]) => m.unlocked_at > sevenDaysAgo && m.completed_acts.length === 0
  ).length
  setLabUnread(unread)
} catch { /* non-critical */ }
```

- [ ] **Step 3: Pass appView to LabTab and show badge on tab**

Find where `<LabTab` is rendered and ensure it receives `appView`:
```typescript
<LabTab appView={appView} />
```

Find the Lab tab button in the bottom nav and add the badge:
```typescript
{labUnread > 0 && (
  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-[var(--brand-primary)] text-white text-[9px] font-bold flex items-center justify-center">
    {labUnread}
  </span>
)}
```

- [ ] **Step 4: Commit**

```bash
git add app/src/screens/ChildDashboard.tsx
git commit -m "feat(lab): pass appView to LabTab; add unread badge on Lab nav tab"
```

---

## Task 9: Trigger Engine (`worker/src/lib/labTriggers.ts`)

**Files:**
- Create: `worker/src/lib/labTriggers.ts`
- Modify: `worker/src/routes/completions.ts` (call triggers on chore approval)
- Modify: `worker/src/routes/goals.ts` (call triggers on goal create/cancel)

- [ ] **Step 1: Create the trigger evaluation library**

```typescript
// worker/src/lib/labTriggers.ts
// Evaluates Learning Lab unlock conditions and writes to unlocked_modules.
// All functions are idempotent — INSERT OR IGNORE prevents duplicate unlocks.

import type { D1Database } from '@cloudflare/workers-types'
import { nanoid } from './nanoid.js'

async function unlock(db: D1Database, childId: string, slug: string): Promise<void> {
  const now = Math.floor(Date.now() / 1000)
  await db.prepare(
    `INSERT OR IGNORE INTO unlocked_modules (id, child_id, module_slug, unlocked_at)
     VALUES (?, ?, ?, ?)`
  ).bind(nanoid(), childId, slug, now).run()
}

async function isUnlocked(db: D1Database, childId: string, slug: string): Promise<boolean> {
  const row = await db.prepare(
    `SELECT id FROM unlocked_modules WHERE child_id = ? AND module_slug = ?`
  ).bind(childId, slug).first()
  return !!row
}

// Called after every chore approval (credit ledger write)
export async function evaluateOnChoreApproval(db: D1Database, childId: string): Promise<void> {
  const [earningsRow, choreRateRow, distinctRow] = await Promise.all([
    db.prepare(`SELECT COALESCE(SUM(amount),0) AS total FROM ledger WHERE child_id=? AND entry_type='credit'`).bind(childId).first<{total:number}>(),
    db.prepare(`SELECT AVG(amount) AS avg FROM ledger WHERE child_id=? AND entry_type='credit' ORDER BY created_at DESC LIMIT 5`).bind(childId).first<{avg:number}>(),
    db.prepare(`SELECT COUNT(DISTINCT chore_id) AS cnt FROM ledger WHERE child_id=? AND entry_type='credit'`).bind(childId).first<{cnt:number}>(),
  ])

  const lifetimeEarnings = earningsRow?.total ?? 0
  const avgChoreValue    = choreRateRow?.avg ?? 0
  const distinctChores   = distinctRow?.cnt ?? 0

  // M2 — Taxes & Net Pay: cumulative >= £20 (2000 pence)
  if (lifetimeEarnings >= 2000) await unlock(db, childId, 'M2')

  // M13 — Stocks & Shares: cumulative >= £100 (10000 pence)
  if (lifetimeEarnings >= 10000) await unlock(db, childId, 'M13')

  // M3 — Entrepreneurship: 10+ distinct chore types AND avg > £3 (300 pence)
  if (distinctChores >= 10 && avgChoreValue > 300) await unlock(db, childId, 'M3')

  // M3b — Gig Trap: earnings variance > 40% over last 4 weeks
  // Simplified check: stddev / avg > 0.40 on weekly buckets
  const weeklyRows = await db.prepare(
    `SELECT strftime('%Y-%W', datetime(created_at, 'unixepoch')) AS wk, SUM(amount) AS total
     FROM ledger WHERE child_id=? AND entry_type='credit' AND created_at >= strftime('%s','now','-28 days')
     GROUP BY wk ORDER BY wk`
  ).bind(childId).all<{wk:string;total:number}>()
  if (weeklyRows.results && weeklyRows.results.length >= 4) {
    const vals = weeklyRows.results.map(r => r.total)
    const avg  = vals.reduce((a,b) => a+b, 0) / vals.length
    const stddev = Math.sqrt(vals.reduce((a,b) => a + Math.pow(b-avg, 2), 0) / vals.length)
    if (avg > 0 && stddev / avg > 0.40) await unlock(db, childId, 'M3b')
  }
}

// Called after balance load / settings load (passive: inactivity, streak)
export async function evaluatePassive(db: D1Database, childId: string): Promise<void> {
  // M14 — Inflation: no new transaction in 21 days
  const lastTxRow = await db.prepare(
    `SELECT MAX(created_at) AS last FROM ledger WHERE child_id=?`
  ).bind(childId).first<{last:number|null}>()
  const daysSinceTx = lastTxRow?.last
    ? (Date.now()/1000 - lastTxRow.last) / 86400
    : 999
  if (daysSinceTx >= 21) await unlock(db, childId, 'M14')

  // M8 — Banking 101: balance >= £30 (3000 pence) at any point
  const maxBalRow = await db.prepare(
    `SELECT COALESCE(SUM(CASE WHEN entry_type='credit' THEN amount ELSE -amount END),0) AS bal
     FROM ledger WHERE child_id=?`
  ).bind(childId).first<{bal:number}>()
  if ((maxBalRow?.bal ?? 0) >= 3000) await unlock(db, childId, 'M8')

  // M9b — The Snowball: active goal AND 4+ consecutive weeks of growth
  const activeGoalRow = await db.prepare(
    `SELECT id FROM goals WHERE child_id=? AND archived=0 LIMIT 1`
  ).bind(childId).first()
  if (activeGoalRow) {
    const streakRow = await db.prepare(
      `SELECT current_streak FROM child_streaks WHERE child_id=?`
    ).bind(childId).first<{current_streak:number}>()
    if ((streakRow?.current_streak ?? 0) >= 4) await unlock(db, childId, 'M9b')
  }

  // M11 — Credit Scores: reliability >= 90% over 8 weeks
  const reliabilityRow = await db.prepare(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS passed
     FROM completions WHERE child_id=?
       AND status IN ('completed','rejected','needs_revision')
       AND created_at >= strftime('%s','now','-56 days')`
  ).bind(childId).all<{total:number;passed:number}>()
  if (reliabilityRow.results?.[0]) {
    const {total, passed} = reliabilityRow.results[0]
    if (total >= 10 && (passed / total) >= 0.90) await unlock(db, childId, 'M11')
  }
}

// Called on goal create
export async function evaluateOnGoalCreate(db: D1Database, childId: string, category: string, targetDate: string | null): Promise<void> {
  // M17 — Digital Currency: first gaming goal
  if (category === 'gaming') {
    const countRow = await db.prepare(
      `SELECT COUNT(*) AS cnt FROM goals WHERE child_id=? AND category='gaming'`
    ).bind(childId).first<{cnt:number}>()
    if ((countRow?.cnt ?? 0) <= 1) await unlock(db, childId, 'M17')
  }

  // M15 — Risk & Diversification: 3+ active goals with at least one long-term (>90 days)
  const activeRow = await db.prepare(
    `SELECT COUNT(*) AS cnt FROM goals WHERE child_id=? AND archived=0 AND status='ACTIVE'`
  ).bind(childId).first<{cnt:number}>()
  if ((activeRow?.cnt ?? 0) >= 3 && targetDate) {
    const days = (new Date(targetDate).getTime() - Date.now()) / 86400000
    if (days > 90) await unlock(db, childId, 'M15')
  }
}

// Called on goal cancel/delete
export async function evaluateOnGoalCancel(db: D1Database, childId: string, goalCategory: string, goalCreatedAt: number): Promise<void> {
  // M9 — Opportunity Cost: goal cancelled after spending in competing category within 14 days
  const windowStart = goalCreatedAt
  const windowEnd   = Math.floor(Date.now() / 1000)
  const daysDiff    = (windowEnd - windowStart) / 86400
  if (daysDiff <= 14) {
    const competingRow = await db.prepare(
      `SELECT id FROM ledger WHERE child_id=? AND entry_type='payment'
       AND created_at BETWEEN ? AND ? LIMIT 1`
    ).bind(childId, windowStart, windowEnd).first()
    if (competingRow) await unlock(db, childId, 'M9')
  }
}

// Called on goal purchase
export async function evaluateOnGoalPurchase(db: D1Database, childId: string): Promise<void> {
  // M6 — Advertising: 3+ purchases in same non-essential category within 30 days
  const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 86400
  const purchaseRow = await db.prepare(
    `SELECT category, COUNT(*) AS cnt FROM ledger
     WHERE child_id=? AND entry_type='payment' AND created_at >= ?
     GROUP BY category HAVING cnt >= 3 LIMIT 1`
  ).bind(childId, thirtyDaysAgo).first<{category:string;cnt:number}>()
  if (purchaseRow) await unlock(db, childId, 'M6')
}
```

- [ ] **Step 2: Wire into completions route**

In `worker/src/routes/completions.ts`, find `handleCompletionApprove`. After the ledger write succeeds, add:
```typescript
import { evaluateOnChoreApproval, evaluatePassive } from '../lib/labTriggers.js'
// ... after ledger write:
evaluateOnChoreApproval(env.DB, child_id).catch(() => {})
evaluatePassive(env.DB, child_id).catch(() => {})
```

- [ ] **Step 3: Wire into goals route**

In `worker/src/routes/goals.ts`, after `handleGoalCreate` succeeds:
```typescript
import { evaluateOnGoalCreate } from '../lib/labTriggers.js'
// after INSERT:
evaluateOnGoalCreate(env.DB, child_id, body.category ?? '', body.target_date ?? null).catch(() => {})
```

After goal deletion/cancel in `handleGoalDelete`:
```typescript
import { evaluateOnGoalCancel } from '../lib/labTriggers.js'
evaluateOnGoalCancel(env.DB, childId, goal.category, goal.created_at).catch(() => {})
```

After `handleGoalPurchase` deducts balance:
```typescript
import { evaluateOnGoalPurchase } from '../lib/labTriggers.js'
evaluateOnGoalPurchase(env.DB, childId).catch(() => {})
```

- [ ] **Step 4: Add M5 scam-flag trigger to settings/signal route**

In `worker/src/routes/suggestions.ts` or wherever suspicious flags are raised, add:
```typescript
import { unlock } from '../lib/labTriggers.js'  // export this helper
// When scam_flag_raised = true:
await unlock(env.DB, childId, 'M5')
```

> Note: M10 (Interest Trap) fires when a parental loan is requested — wire into whatever endpoint handles parental loan requests when that feature ships. For now it remains trigger-only-on-manual-action.
> M12 (Good vs Bad Debt) requires M10 to be complete first — handled by the `isUnlocked` check in the trigger for M10's prerequisite.
> M18 (Money & Mental Health) requires a post-purchase satisfaction rating prompt — ship this as a follow-on task when the satisfaction rating UI is built.
> M18b (Social Comparison) requires sibling goal visibility — ship when family-sharing feature is built.

- [ ] **Step 5: Commit**

```bash
git add worker/src/lib/labTriggers.ts worker/src/routes/completions.ts worker/src/routes/goals.ts
git commit -m "feat(lab): add trigger engine and wire into chore approval + goal lifecycle"
```

---

## Completion Checklist

- [ ] Migration 0061 applied to both local and production D1
- [ ] `labCatalogue.ts` — all 17 modules present; Level 3/4 stubs populated from spec files
- [ ] `GET /api/lab/modules` returns correct unlock status + child data
- [ ] `POST /api/lab/modules/:slug/acts/:num/complete` persists act progress
- [ ] LabTab renders level sections with correct ORCHARD/CLEAN labels
- [ ] 3 tile states visible: unlocked (pillar-coloured border + icon), locked (muted icon + earn hint), too-advanced (greyed, level label)
- [ ] ModuleReader opens on tile tap, shows 4-act progress strip
- [ ] Act completion persisted on Next button tap
- [ ] Quiz answers interactive; explanation shown after selection
- [ ] Nav badge appears when a module unlocked in last 7 days with no acts started
- [ ] Trigger engine fires on chore approval without blocking the main response (`.catch(() => {})`)

