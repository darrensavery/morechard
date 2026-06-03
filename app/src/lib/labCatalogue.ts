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
  currency:                string
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

/** Per-act time estimates in minutes. Vary by module complexity. */
export interface ActMinutes {
  hook:   number
  lesson: number
  lab:    number
  quiz:   number
}

export function totalMinutes(am: ActMinutes): number {
  return am.hook + am.lesson + am.lab + am.quiz
}

export function remainingMinutes(am: ActMinutes, completedActs: number[]): number {
  const actKeys: (keyof ActMinutes)[] = ['hook', 'lesson', 'lab', 'quiz']
  return actKeys.reduce((sum, key, i) => {
    return completedActs.includes(i + 1) ? sum : sum + am[key]
  }, 0)
}

export interface ModuleDef {
  slug:         ModuleSlug
  title:        string
  pillar:       1 | 2 | 3 | 4 | 5 | 6
  level:        AgeLevel
  // Store the Lucide component reference directly — preserves tree-shaking
  icon:         React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>
  triggerHint:  string
  description:  string
  actMinutes:   ActMinutes
  hook:         (d: ChildLabData) => ReactNode
  lesson:       (d: ChildLabData) => ReactNode
  lab:          (d: ChildLabData) => ReactNode
  quiz:         QuizQuestion[]
}

// ── Pillar config ──────────────────────────────────────────────────────────────

export const PILLARS: Record<number, { name: string; orchardName: string; color: string; mutedColor: string }> = {
  1: { name: 'Earning & Value',     orchardName: 'The Roots',      color: '#007A78', mutedColor: '#b2d8d8' },
  2: { name: 'Spending & Choices',  orchardName: 'The Trunk',      color: '#D97706', mutedColor: '#fde68a' },
  3: { name: 'Saving & Growth',     orchardName: 'The Fruit',      color: '#16a34a', mutedColor: '#bbf7d0' },
  4: { name: 'Borrowing & Debt',    orchardName: 'The Vine',       color: '#7c3aed', mutedColor: '#ddd6fe' },
  5: { name: 'Investing & Future',  orchardName: 'The Canopy',     color: '#b45309', mutedColor: '#fef3c7' },
  6: { name: 'Society & Wellbeing', orchardName: 'The Atmosphere', color: '#0369a1', mutedColor: '#bae6fd' },
}

/** Level display names — vary by persona. */
export const LEVEL_LABELS: Record<AgeLevel, Record<AppView, string>> = {
  1: { ORCHARD: 'Sprout',     CLEAN: 'Explorer'   },
  2: { ORCHARD: 'Sapling',    CLEAN: 'Foundation' },
  3: { ORCHARD: 'Oak',        CLEAN: 'Applied'    },
  4: { ORCHARD: 'Canopy',     CLEAN: 'Mastery'    },
}

/** Format pence as currency string. */
export function fmtPence(pence: number, currency: string): string {
  const major = pence / 100
  if (currency === 'GBP') return `£${major.toFixed(2)}`
  if (currency === 'PLN') return `${major.toFixed(2)} zł`
  return `$${major.toFixed(2)}`
}

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
    actMinutes:  { hook: 2, lesson: 5, lab: 7, quiz: 4 },  // 18 min total
    hook: (d) => React.createElement('div', { className: 'flex flex-col gap-3' },
      React.createElement('p', { className: 'text-[15px] font-bold leading-snug' },
        d.appView === 'ORCHARD'
          ? `You've earned ${fmtPence(d.lifetimeEarningsPence, d.currency)} so far. Before we count the apples, let's talk about the slice the orchard infrastructure quietly takes.`
          : `Cumulative earnings: ${fmtPence(d.lifetimeEarningsPence, d.currency)}. This module explains the deductions applied to real-world wages.`
      ),
      React.createElement('p', { className: 'text-[14px] leading-relaxed text-[var(--color-text)]' },
        'Every person who earns money pays a portion to fund shared services — roads, hospitals, schools. This isn\'t optional. It\'s called tax. The amount you actually receive is called your ',
        React.createElement('strong', null, 'net pay'),
        '. The amount before deductions is your ',
        React.createElement('strong', null, 'gross pay'),
        '.'
      )
    ),
    lesson: (_d) => React.createElement('div', { className: 'flex flex-col gap-4' },
      React.createElement('p', { className: 'text-[14px] leading-relaxed' },
        React.createElement('strong', null, 'Income Tax'),
        ' is a percentage of your earnings taken by the government. In the UK, the first £12,570 you earn in a year is tax-free (the Personal Allowance). Above that, 20% goes to the government.'
      ),
      React.createElement('p', { className: 'text-[14px] leading-relaxed' },
        React.createElement('strong', null, 'National Insurance (NI)'),
        ' is a separate contribution that funds the NHS and state pension. Employees pay 8% on earnings between £12,570 and £50,270.'
      ),
      React.createElement('div', { className: 'rounded-xl bg-[var(--color-surface-alt)] p-3 text-[13px] font-mono flex flex-col gap-1' },
        React.createElement('p', null, 'Gross pay:         £2,000/month'),
        React.createElement('p', null, 'Income tax (20%):  −£285'),
        React.createElement('p', null, 'NI (8%):           −£100'),
        React.createElement('p', { className: 'font-bold mt-1' }, 'Net pay:            £1,615')
      ),
      React.createElement('p', { className: 'text-[14px] leading-relaxed' },
        'For every £100 earned, roughly £19 goes to the government before the worker sees it. This pays for the things no single person could afford alone.'
      )
    ),
    lab: (d) => {
      const median  = d.choreRateMedianPence
      const monthly = median * 20
      const tax     = Math.round(monthly * 0.20)
      const ni      = Math.round(monthly * 0.08)
      const net     = monthly - tax - ni
      return React.createElement('div', { className: 'flex flex-col gap-4' },
        React.createElement('p', { className: 'text-[13px] text-[var(--color-text-muted)]' },
          'Using your median chore rate of ', React.createElement('strong', null, fmtPence(median, d.currency))
        ),
        React.createElement('div', { className: 'rounded-xl bg-[var(--color-surface-alt)] p-3 text-[13px] font-mono flex flex-col gap-1' },
          React.createElement('p', null, `If you did 20 chores this month:`),
          React.createElement('p', null, `Gross earnings:   ${fmtPence(monthly, d.currency)}`),
          React.createElement('p', null, `Income tax (20%): −${fmtPence(tax, d.currency)}`),
          React.createElement('p', null, `NI (8%):          −${fmtPence(ni, d.currency)}`),
          React.createElement('p', { className: 'font-bold border-t border-[var(--color-border)] pt-1' }, `Net pay: ${fmtPence(net, d.currency)}`)
        ),
        React.createElement('p', { className: 'text-[13px] leading-relaxed' },
          `In the real world, your net pay would be ${fmtPence(net, d.currency)} — not ${fmtPence(monthly, d.currency)}. To cover the ${fmtPence(tax + ni, d.currency)} lost to tax and NI, you'd need `,
          React.createElement('strong', null, `${Math.ceil((tax + ni) / median)} extra chores`),
          ' at your median rate.'
        )
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
          { label: 'C', text: 'To save money for the government\'s own expenses only' },
        ],
        correct: 'B',
        explanation: 'Tax funds public services that benefit everyone — healthcare, infrastructure, education, and the state pension.',
      },
      {
        question: (d: ChildLabData) => `Someone earns ${fmtPence(d.lifetimeEarningsPence, d.currency)} in a year. The personal allowance is £12,570. Do they owe income tax?`,
        options: [
          { label: 'A', text: 'Yes — everyone who earns any amount pays tax' },
          { label: 'B', text: 'No — only earnings above the personal allowance are taxed' },
          { label: 'C', text: 'Only if they choose to pay it' },
        ],
        correct: 'B',
        explanation: 'The personal allowance means the first £12,570 is tax-free. Tax only applies on earnings above that threshold.',
      },
    ],
  },

  // ── M5: Scams & Digital Safety ────────────────────────────────────────────
  {
    slug:        'M5',
    title:       'Scams & Digital Safety',
    pillar:      2,
    level:       2,
    icon:        ShieldAlert,
    triggerHint: 'Triggered when a suspicious item is flagged',
    description: 'How scams are designed to look real — and the signals that give them away.',
    actMinutes:  { hook: 1, lesson: 4, lab: 5, quiz: 4 },  // 14 min total
    hook: (_d) => React.createElement('div', { className: 'flex flex-col gap-3' },
      React.createElement('p', { className: 'text-[15px] font-bold leading-snug' },
        'Something in your orchard smells like blight. Scams grow fast and look delicious — let\'s learn how to spot them before they spread.'
      ),
      React.createElement('p', { className: 'text-[14px] leading-relaxed' },
        'Every year, billions of pounds are lost to scams. Most victims aren\'t careless — they were targeted by professionals who spend their careers making fake things look real. Knowing the patterns is your best defence.'
      )
    ),
    lesson: (_d) => React.createElement('div', { className: 'flex flex-col gap-4' },
      React.createElement('p', { className: 'text-[14px] font-semibold' }, 'The three signals every scam shares:'),
      React.createElement('ol', { className: 'flex flex-col gap-2 pl-4 list-decimal text-[14px]' },
        React.createElement('li', null, React.createElement('strong', null, 'Urgency. '), '"Act now or lose this forever." Scammers create time pressure so you don\'t think clearly.'),
        React.createElement('li', null, React.createElement('strong', null, 'Too good to be true. '), 'Free money, free prizes, amazing deals with no catch. If it sounds impossible, it usually is.'),
        React.createElement('li', null, React.createElement('strong', null, 'Requests for credentials. '), 'Legitimate companies never ask for your PIN, password, or full card number via message or link.')
      ),
      React.createElement('p', { className: 'text-[14px] leading-relaxed' },
        React.createElement('strong', null, 'Protecting your accounts: '),
        'Use a different PIN for every service. Never share it — not even with a parent or carer. If you receive a suspicious message asking you to click a link, don\'t. Go directly to the website by typing the address yourself.'
      ),
      React.createElement('p', { className: 'text-[14px] leading-relaxed' },
        React.createElement('strong', null, 'In gaming: '),
        '"Free V-Bucks generators," "account boosting," and "rare item trades" are almost always scams. No legitimate service needs your login credentials to give you something for free.'
      )
    ),
    lab: (_d) => React.createElement('div', { className: 'flex flex-col gap-4' },
      React.createElement('p', { className: 'text-[14px] font-semibold' }, 'Spot the scam. For each scenario, decide: real or fake?'),
      ...[
        { scenario: 'An email from "PayPal" says your account will be closed in 24 hours unless you click a link and enter your password.', answer: 'SCAM', why: 'Urgency + credential request. PayPal communicates through your account dashboard, not urgent emails.' },
        { scenario: 'Your game\'s official app sends a push notification that you\'ve earned a reward for completing a challenge you actually did yesterday.', answer: 'LIKELY REAL', why: 'No urgency, no credential request, matches recent activity. Still verify by opening the app directly — not via the notification.' },
        { scenario: 'A website offers to double your Robux if you enter your username and password.', answer: 'SCAM', why: 'No platform gives away currency for credentials. This is a classic credential-harvesting scam.' },
      ].map((item, i) => React.createElement('div', { key: i, className: 'rounded-xl border border-[var(--color-border)] p-3 flex flex-col gap-2' },
        React.createElement('p', { className: 'text-[13px]' }, item.scenario),
        React.createElement('p', { className: 'text-[12px] font-bold text-[var(--brand-primary)]' }, item.answer),
        React.createElement('p', { className: 'text-[12px] text-[var(--color-text-muted)]' }, item.why)
      ))
    ),
    quiz: [
      {
        question: 'Which is the strongest sign that a message is a scam?',
        options: [
          { label: 'A', text: 'It comes from an unknown sender' },
          { label: 'B', text: 'It creates urgency and asks you to click a link to enter your password' },
          { label: 'C', text: 'It contains a spelling mistake' },
        ],
        correct: 'B',
        explanation: 'Urgency + credential request is the core scam pattern. Spelling mistakes are a hint but not proof — some sophisticated scams are perfectly written.',
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

  // ── M8: Banking 101 ───────────────────────────────────────────────────────
  {
    slug:        'M8',
    title:       'Banking 101',
    pillar:      3,
    level:       2,
    icon:        Landmark,
    triggerHint: 'Save up to £30 to unlock',
    description: 'Accounts, debit vs credit, and why a jar under the bed is a bad plan.',
    actMinutes:  { hook: 2, lesson: 5, lab: 6, quiz: 3 },  // 16 min total
    hook: (d) => React.createElement('div', { className: 'flex flex-col gap-3' },
      React.createElement('p', { className: 'text-[15px] font-bold leading-snug' },
        d.appView === 'ORCHARD'
          ? `Your grove is growing — ${fmtPence(d.currentBalancePence, d.currency)} saved. It's time to understand where the real orchards store their surplus.`
          : `Balance milestone reached: ${fmtPence(d.currentBalancePence, d.currency)}. This module covers real-world money storage and banking fundamentals.`
      ),
      React.createElement('p', { className: 'text-[14px] leading-relaxed' },
        'You\'ve built up real savings. Where should that money actually live when it\'s bigger than pocket money? The answer most people use is a bank — but most people don\'t understand how banks work. Let\'s fix that.'
      )
    ),
    lesson: (_d) => React.createElement('div', { className: 'flex flex-col gap-4' },
      React.createElement('p', { className: 'text-[14px] leading-relaxed' },
        'A ', React.createElement('strong', null, 'current account'), ' is for day-to-day spending. Money goes in (wages, transfers) and out (purchases, bills). Most come with a debit card.'
      ),
      React.createElement('p', { className: 'text-[14px] leading-relaxed' },
        'A ', React.createElement('strong', null, 'savings account'), ' is for money you don\'t need immediately. The bank pays you ', React.createElement('strong', null, 'interest'), ' for keeping your money there — usually a percentage per year.'
      ),
      React.createElement('p', { className: 'text-[14px] font-semibold' }, 'Debit card vs credit card:'),
      React.createElement('div', { className: 'rounded-xl bg-[var(--color-surface-alt)] p-3 text-[13px] flex flex-col gap-2' },
        React.createElement('p', null, React.createElement('strong', null, 'Debit:'), ' spends your own money directly from your account. If there\'s nothing in, it doesn\'t work.'),
        React.createElement('p', null, React.createElement('strong', null, 'Credit:'), ' the bank lends you money to spend now. You pay it back later — with interest if you don\'t clear the balance.')
      ),
      React.createElement('p', { className: 'text-[14px] leading-relaxed' },
        'Why not keep money in a jar? Two reasons: it can be stolen or lost, and it earns nothing. A savings account keeps it safe and makes it grow slowly.'
      )
    ),
    lab: (d) => {
      const balance = d.currentBalancePence
      const yr1 = Math.round(balance * 1.04)
      const yr2 = Math.round(yr1 * 1.04)
      const yr3 = Math.round(yr2 * 1.04)
      const earned = yr3 - balance
      return React.createElement('div', { className: 'flex flex-col gap-4' },
        React.createElement('p', { className: 'text-[13px] text-[var(--color-text-muted)]' },
          'If your current balance of ', React.createElement('strong', null, fmtPence(balance, d.currency)), ' were in a 4% savings account:'
        ),
        React.createElement('div', { className: 'rounded-xl bg-[var(--color-surface-alt)] p-3 text-[13px] font-mono flex flex-col gap-1' },
          React.createElement('p', null, `Today:   ${fmtPence(balance, d.currency)}`),
          React.createElement('p', null, `Year 1:  ${fmtPence(yr1, d.currency)}`),
          React.createElement('p', null, `Year 2:  ${fmtPence(yr2, d.currency)}`),
          React.createElement('p', null, `Year 3:  ${fmtPence(yr3, d.currency)}`),
          React.createElement('p', { className: 'font-bold border-t border-[var(--color-border)] pt-1' },
            `Interest earned: ${fmtPence(earned, d.currency)} — for doing nothing extra.`
          )
        ),
        React.createElement('p', { className: 'text-[13px]' },
          `That's ${Math.ceil(earned / d.choreRateMedianPence)} chores at your median rate — earned by a bank account while you slept.`
        )
      )
    },
    quiz: [
      {
        question: 'What is the main difference between a current account and a savings account?',
        options: [
          { label: 'A', text: 'Current accounts pay more interest' },
          { label: 'B', text: 'Current accounts are for daily spending; savings accounts hold money and earn interest' },
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
        explanation: 'A debit card spends your own money directly. A credit card borrows it — a different product with different consequences.',
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

  // ── M9b: The Snowball ─────────────────────────────────────────────────────
  {
    slug:        'M9b',
    title:       'The Snowball',
    pillar:      3,
    level:       2,
    icon:        TrendingUp,
    triggerHint: 'Save consistently for 4 weeks to unlock',
    description: 'How compound interest makes money grow faster the longer you leave it.',
    actMinutes:  { hook: 2, lesson: 6, lab: 10, quiz: 4 }, // 22 min — numerically rich Lab
    hook: (d) => React.createElement('div', { className: 'flex flex-col gap-3' },
      React.createElement('p', { className: 'text-[15px] font-bold leading-snug' },
        d.appView === 'ORCHARD'
          ? `${d.savingsStreakWeeks} weeks in a row — your snowball is rolling. Here's the secret: it gets heavier without you pushing harder.`
          : `${d.savingsStreakWeeks} consecutive weeks of balance growth recorded. This module explains compound interest.`
      ),
      React.createElement('p', { className: 'text-[14px] leading-relaxed' },
        `You now have ${fmtPence(d.currentBalancePence, d.currency)}, up from ${fmtPence(d.balance4wkAgoPence, d.currency)} four weeks ago. You did that by earning and saving. In the real world, once a snowball gets big enough, it picks up extra snow just by rolling. Money can do the same thing — not inside Morechard, but in a savings account.`
      ),
      React.createElement('p', { className: 'text-[12px] text-[var(--color-text-muted)] italic' },
        'Note: Morechard tracks what you earn. It doesn\'t add interest. This lesson is about the real-world tool you\'ll use when you\'re ready.'
      )
    ),
    lesson: (_d) => React.createElement('div', { className: 'flex flex-col gap-4' },
      React.createElement('p', { className: 'text-[14px] leading-relaxed' },
        'When you put money in a savings account, the bank pays you a little extra for keeping it there. That extra is called ', React.createElement('strong', null, 'interest'), '. A typical savings account might pay 4% per year. If you saved £100, the bank adds £4 at the end of the year. You\'d have £104.'
      ),
      React.createElement('p', { className: 'text-[14px] font-semibold' }, 'Simple vs compound interest:'),
      React.createElement('div', { className: 'rounded-xl bg-[var(--color-surface-alt)] p-3 text-[13px] font-mono flex flex-col gap-1' },
        React.createElement('p', { className: 'font-bold' }, 'Simple (4% of original each year):'),
        React.createElement('p', null, 'Year 1: £100 → £104'),
        React.createElement('p', null, 'Year 2: £100 → £108'),
        React.createElement('p', null, 'Year 3: £100 → £112'),
        React.createElement('p', { className: 'font-bold mt-2' }, 'Compound (4% of growing total):'),
        React.createElement('p', null, 'Year 1: £100.00 → £104.00'),
        React.createElement('p', null, 'Year 2: £104.00 → £108.16'),
        React.createElement('p', null, 'Year 3: £108.16 → £112.49')
      ),
      React.createElement('p', { className: 'text-[14px] leading-relaxed' },
        'The difference looks small now. Over 10 years on £50, compound interest earns £24 extra — for doing nothing. That\'s the snowball. Starting early is worth more than saving a lot. You can\'t buy back the years you didn\'t start. You\'re already doing that.'
      )
    ),
    lab: (d) => {
      const balance    = d.currentBalancePence
      const yr1 = Math.round(balance * 1.04)
      const yr2 = Math.round(yr1 * 1.04)
      const yr3 = Math.round(yr2 * 1.04)
      const compound3  = yr3 - balance
      const simple3    = Math.round(balance * 0.04 * 3)
      const extra      = compound3 - simple3
      const snowball   = Math.round(5000 * Math.pow(1.04, 10))
      const choreEquiv = Math.ceil(compound3 / d.choreRateMedianPence)
      return React.createElement('div', { className: 'flex flex-col gap-4' },
        React.createElement('p', { className: 'text-[13px] text-[var(--color-text-muted)]' },
          'Using your balance of ', React.createElement('strong', null, fmtPence(balance, d.currency)), ' at 4% compound interest:'
        ),
        React.createElement('div', { className: 'rounded-xl bg-[var(--color-surface-alt)] p-3 text-[13px] font-mono flex flex-col gap-1' },
          React.createElement('p', null, `Year 1: ${fmtPence(yr1, d.currency)}`),
          React.createElement('p', null, `Year 2: ${fmtPence(yr2, d.currency)}`),
          React.createElement('p', null, `Year 3: ${fmtPence(yr3, d.currency)}`),
          React.createElement('p', { className: 'font-bold border-t border-[var(--color-border)] pt-1' }, `Interest earned (3yr): ${fmtPence(compound3, d.currency)}`),
          React.createElement('p', null, `Simple interest same period: ${fmtPence(simple3, d.currency)}`),
          React.createElement('p', { style: { color: 'var(--brand-primary)', fontWeight: 'bold' } }, `Compound earns ${fmtPence(extra, d.currency)} extra`)
        ),
        React.createElement('p', { className: 'text-[13px]' },
          `That ${fmtPence(compound3, d.currency)} of interest equals `, React.createElement('strong', null, `${choreEquiv} chores`), ' at your median rate — earned without working.'
        ),
        React.createElement('div', { className: 'rounded-xl border border-[var(--color-border)] p-3 text-[13px]' },
          React.createElement('p', { className: 'font-semibold mb-1' }, 'Snowball comparison: £50 for 10 years at 4%'),
          React.createElement('p', null, `Person A (savings account): ${fmtPence(snowball, d.currency)}`),
          React.createElement('p', null, `Person B (jar at home): ${fmtPence(5000, d.currency)}`),
          React.createElement('p', { style: { color: 'var(--brand-primary)', fontWeight: 'bold' }, className: 'mt-1' },
            `A earns ${fmtPence(snowball - 5000, d.currency)} extra — for doing nothing.`
          )
        )
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

  // ── M10: The Interest Trap ────────────────────────────────────────────────
  {
    slug:        'M10',
    title:       'The Interest Trap',
    pillar:      4,
    level:       2,
    icon:        TrendingDown,
    triggerHint: 'Triggered when a parental loan is requested',
    description: 'What borrowing actually costs — and why minimum payments are a trap.',
    actMinutes:  { hook: 2, lesson: 5, lab: 7, quiz: 3 },  // 17 min total
    hook: (_d) => React.createElement('div', { className: 'flex flex-col gap-3' },
      React.createElement('p', { className: 'text-[15px] font-bold leading-snug' },
        'Borrowing tomorrow\'s seeds to buy today\'s fruit can work. But the vine always wants something back.'
      ),
      React.createElement('p', { className: 'text-[14px] leading-relaxed' },
        'When you borrow money, you don\'t just pay back what you borrowed. You pay back more — because the lender charges for the use of their money. This extra charge is called interest. Understanding it is one of the most important financial skills you can have.'
      )
    ),
    lesson: (_d) => React.createElement('div', { className: 'flex flex-col gap-4' },
      React.createElement('p', { className: 'text-[14px] leading-relaxed' },
        React.createElement('strong', null, 'How interest on debt works: '),
        'If you borrow £100 at 20% annual interest and pay nothing for a year, you owe £120. Wait another year: £144. The debt grows — just like savings compound, so do debts.'
      ),
      React.createElement('p', { className: 'text-[14px] leading-relaxed' },
        React.createElement('strong', null, 'The minimum payment trap: '),
        'Credit cards let you pay a small "minimum payment" each month — sometimes just 1–2% of what you owe. If you only pay the minimum on a £1,000 balance at 20% interest, it can take over 10 years to pay off and cost nearly £1,000 in interest alone.'
      ),
      React.createElement('div', { className: 'rounded-xl bg-[var(--color-surface-alt)] p-3 text-[13px] font-mono flex flex-col gap-1' },
        React.createElement('p', null, 'Borrow:           £1,000'),
        React.createElement('p', null, 'Interest rate:    20% per year'),
        React.createElement('p', null, 'Minimum payment:  £25/month'),
        React.createElement('p', { className: 'font-bold mt-1' }, 'Time to clear:    ~10 years'),
        React.createElement('p', { className: 'font-bold text-red-500' }, 'Total paid:       ~£1,900')
      ),
      React.createElement('p', { className: 'text-[14px] leading-relaxed' },
        'The trap is not borrowing. The trap is borrowing and only paying the minimum.'
      )
    ),
    lab: (d) => {
      const loan    = Math.round(d.currentBalancePence * 1.5)
      const after1  = Math.round(loan * 1.20)
      const after2  = Math.round(after1 * 1.20)
      const extra   = after2 - loan
      return React.createElement('div', { className: 'flex flex-col gap-4' },
        React.createElement('p', { className: 'text-[13px] text-[var(--color-text-muted)]' },
          `Imagine borrowing ${fmtPence(loan, d.currency)} (50% more than your current balance) at 20% annual interest:`
        ),
        React.createElement('div', { className: 'rounded-xl bg-[var(--color-surface-alt)] p-3 text-[13px] font-mono flex flex-col gap-1' },
          React.createElement('p', null, `Borrowed:  ${fmtPence(loan, d.currency)}`),
          React.createElement('p', null, `After 1yr: ${fmtPence(after1, d.currency)} (+${fmtPence(after1 - loan, d.currency)})`),
          React.createElement('p', null, `After 2yr: ${fmtPence(after2, d.currency)} (+${fmtPence(extra, d.currency)} total)`)
        ),
        React.createElement('p', { className: 'text-[13px]' },
          `If you paid nothing for 2 years, you'd owe ${fmtPence(extra, d.currency)} extra — that's `,
          React.createElement('strong', null, `${Math.ceil(extra / d.choreRateMedianPence)} chores`),
          ' at your median rate just to cover the interest.'
        )
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

  // ── M14: Inflation ────────────────────────────────────────────────────────
  {
    slug:        'M14',
    title:       'Inflation',
    pillar:      5,
    level:       2,
    icon:        Gauge,
    triggerHint: 'No new chores for 21 days triggers this',
    description: 'Why money "shrinks" if it just sits still — and what to do about it.',
    actMinutes:  { hook: 1, lesson: 5, lab: 6, quiz: 3 },  // 15 min total
    hook: (d) => React.createElement('div', { className: 'flex flex-col gap-3' },
      React.createElement('p', { className: 'text-[15px] font-bold leading-snug' },
        d.appView === 'ORCHARD'
          ? 'Your seeds are sitting still. Money has a slow rot — here\'s what\'s quietly happening to your pile.'
          : 'No transaction activity detected. This module explains purchasing power erosion over time.'
      ),
      React.createElement('p', { className: 'text-[14px] leading-relaxed' },
        `Imagine you put ${fmtPence(d.currentBalancePence, d.currency)} under your mattress today. In 10 years, it's still ${fmtPence(d.currentBalancePence, d.currency)} — but it buys less. A chocolate bar that costs 80p today might cost £1.10 in a decade. Your money didn't shrink. But what it can buy did. That's inflation.`
      )
    ),
    lesson: (_d) => React.createElement('div', { className: 'flex flex-col gap-4' },
      React.createElement('p', { className: 'text-[14px] leading-relaxed' },
        React.createElement('strong', null, 'What inflation is: '),
        'Inflation is the general rise in prices over time. The UK government targets about 2% per year. At 2% inflation, something that costs £1.00 today costs roughly £1.22 in 10 years.'
      ),
      React.createElement('p', { className: 'text-[14px] leading-relaxed' },
        React.createElement('strong', null, 'What it means for savings: '),
        'If your savings earn 0% interest and inflation runs at 2%, your money\'s real purchasing power falls by about 2% per year. After 10 years, you can buy roughly 20% less with the same amount.'
      ),
      React.createElement('div', { className: 'rounded-xl bg-[var(--color-surface-alt)] p-3 text-[13px] font-mono flex flex-col gap-1' },
        React.createElement('p', null, 'Today:    £100 buys a basket of goods'),
        React.createElement('p', null, '+5 years: same basket costs ~£110'),
        React.createElement('p', null, '+10 yrs:  same basket costs ~£122'),
        React.createElement('p', { className: 'font-bold mt-1' }, 'Your £100 (uninvested) buys less each year.')
      ),
      React.createElement('p', { className: 'text-[14px] leading-relaxed' },
        React.createElement('strong', null, 'The fix: '),
        'Keep savings in accounts that earn interest at or above the inflation rate. Money sitting in a 0% account loses real value every year.'
      )
    ),
    lab: (d) => {
      const balance  = d.currentBalancePence
      const yr5real  = Math.round(balance / Math.pow(1.02, 5))
      const yr10real = Math.round(balance / Math.pow(1.02, 10))
      return React.createElement('div', { className: 'flex flex-col gap-4' },
        React.createElement('p', { className: 'text-[13px] text-[var(--color-text-muted)]' },
          `If your ${fmtPence(balance, d.currency)} earns 0% while inflation runs at 2%:`
        ),
        React.createElement('div', { className: 'rounded-xl bg-[var(--color-surface-alt)] p-3 text-[13px] font-mono flex flex-col gap-1' },
          React.createElement('p', null, `Today (face value):   ${fmtPence(balance, d.currency)}`),
          React.createElement('p', null, `In 5 years (real):    ${fmtPence(yr5real, d.currency)} (−${fmtPence(balance - yr5real, d.currency)} purchasing power)`),
          React.createElement('p', null, `In 10 years (real):   ${fmtPence(yr10real, d.currency)} (−${fmtPence(balance - yr10real, d.currency)} purchasing power)`)
        ),
        React.createElement('p', { className: 'text-[13px]' },
          `After 10 years you'd still have ${fmtPence(balance, d.currency)} in your account — but it would only buy what ${fmtPence(yr10real, d.currency)} buys today. That's `,
          React.createElement('strong', null, `${Math.ceil((balance - yr10real) / d.choreRateMedianPence)} chores`),
          ' worth of purchasing power, silently erased.'
        )
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

  // ── M17: Digital vs Physical Currency ────────────────────────────────────
  {
    slug:        'M17',
    title:       'Digital vs Physical Currency',
    pillar:      6,
    level:       2,
    icon:        Smartphone,
    triggerHint: 'Create a gaming goal to unlock',
    description: 'V-Bucks, Robux, Gems — why in-game currency disconnects you from real money.',
    actMinutes:  { hook: 1, lesson: 4, lab: 5, quiz: 3 },  // 13 min — concise Lab
    hook: (_d) => React.createElement('div', { className: 'flex flex-col gap-3' },
      React.createElement('p', { className: 'text-[15px] font-bold leading-snug' },
        'V-Bucks, Robux, Gems — the orchard has a dark corner selling "magic seeds" that only grow inside one walled garden. Let\'s map the exit.'
      ),
      React.createElement('p', { className: 'text-[14px] leading-relaxed' },
        'In-game currencies aren\'t just a payment method — they\'re a design decision. Converting real money into game currency is intentional: it makes you forget how much you\'re spending. Understanding how it works puts you back in control.'
      )
    ),
    lesson: (_d) => React.createElement('div', { className: 'flex flex-col gap-4' },
      React.createElement('p', { className: 'text-[14px] leading-relaxed' },
        React.createElement('strong', null, 'Why game currencies exist: '),
        'When you buy V-Bucks or Robux, you exchange real money for in-game tokens. The conversion rate is usually awkward (e.g. 1,000 V-Bucks for £7.99) — this is deliberate. It\'s harder to think "is this skin worth 3 hours of chores?" when you\'re thinking in V-Bucks.'
      ),
      React.createElement('p', { className: 'text-[14px] leading-relaxed' },
        React.createElement('strong', null, 'The "leftover" trick: '),
        'Bundles are often designed so you always have a little currency left over after a purchase. That leftover encourages you to buy another bundle to "not waste" it.'
      ),
      React.createElement('p', { className: 'text-[14px] leading-relaxed' },
        React.createElement('strong', null, 'The real-money test: '),
        'Before any in-game purchase, convert it back to real money. 1,000 V-Bucks ≈ £8. Is this skin worth £8? Would you hand over that cash at a till for it?'
      )
    ),
    lab: (d) => {
      const vbucks1000 = 799
      const rate       = d.choreRateMedianPence
      const choreEquiv = (vbucks1000 / rate).toFixed(1)
      return React.createElement('div', { className: 'flex flex-col gap-4' },
        React.createElement('p', { className: 'text-[14px] font-semibold' }, 'The labour equivalent test'),
        React.createElement('div', { className: 'rounded-xl bg-[var(--color-surface-alt)] p-3 text-[13px] flex flex-col gap-2' },
          React.createElement('p', null, `1,000 V-Bucks = ${fmtPence(vbucks1000, d.currency)}`),
          React.createElement('p', null, `Your median chore rate = ${fmtPence(rate, d.currency)}`),
          React.createElement('p', { className: 'font-bold' }, `That skin costs you ${choreEquiv} chores worth of effort.`)
        ),
        React.createElement('p', { className: 'text-[13px] leading-relaxed' },
          `Next time you consider an in-game purchase, ask yourself: "Would I do ${choreEquiv} chores for this?" If the answer is no, the purchase isn't worth it at your real rate of earning.`
        )
      )
    },
    quiz: [
      {
        question: 'Why do game developers use their own currency instead of letting you pay in pounds directly?',
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
        explanation: 'Bundle sizes are deliberately misaligned with item costs. The leftover is bait — it makes you feel like you need to top up, spending more than you planned.',
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

  // ── Level 3 modules — stubs (populate lesson/lab/quiz from spec docs) ─────

  {
    slug: 'M3', title: 'Entrepreneurship', pillar: 1, level: 3, icon: Briefcase, actMinutes: { hook: 2, lesson: 7, lab: 8, quiz: 3 },  // 20 min
    triggerHint: 'Complete 10 different types of chore to unlock',
    description: 'What it means to make the work work for you — not just do more of it.',
    hook: (d) => React.createElement('p', { className: 'text-[14px] leading-relaxed' },
      `You've worked ${d.distinctChoreTypes} different types of job. Now here's the question every serious grower eventually asks: what if the orchard worked for `, React.createElement('em', null, 'you'), ' instead?'
    ),
    lesson: (_d) => React.createElement('p', { className: 'text-[14px] text-[var(--color-text-muted)]' }, 'Content coming soon — see docs/notebooklm/09-module-03-entrepreneurship.md Act 2'),
    lab: (_d) => React.createElement('p', { className: 'text-[14px] text-[var(--color-text-muted)]' }, 'Interactive lab coming soon'),
    quiz: [],
  },

  {
    slug: 'M3b', title: 'Gig Trap vs Salary Safety', pillar: 1, level: 3, icon: Scale, actMinutes: { hook: 2, lesson: 6, lab: 8, quiz: 3 },  // 19 min
    triggerHint: 'Triggered by variable earnings week to week',
    description: 'The trade-off between high-potential gig income and the safety of steady pay.',
    hook: (_d) => React.createElement('p', { className: 'text-[14px] leading-relaxed' },
      'Some weeks a feast, some weeks bare branches — your earnings are swinging. That pattern has a name, and it\'s worth knowing before you build a life around it.'
    ),
    lesson: (_d) => React.createElement('p', { className: 'text-[14px] text-[var(--color-text-muted)]' }, 'Content coming soon — see docs/notebooklm/09-module-03b-gig-trap-vs-salary-safety.md Act 2'),
    lab: (_d) => React.createElement('p', { className: 'text-[14px] text-[var(--color-text-muted)]' }, 'Interactive lab coming soon'),
    quiz: [],
  },

  {
    slug: 'M6', title: 'Advertising & Influence', pillar: 2, level: 3, icon: Megaphone, actMinutes: { hook: 1, lesson: 5, lab: 6, quiz: 4 },  // 16 min
    triggerHint: 'Triggered by repeat spending in the same category',
    description: 'How advertising is designed to make you want things — and how to notice it.',
    hook: (_d) => React.createElement('p', { className: 'text-[14px] leading-relaxed' },
      'Three times in a month, the same shelf called your name. That\'s not a coincidence — someone designed that shelf. Let\'s inspect the architecture.'
    ),
    lesson: (_d) => React.createElement('p', { className: 'text-[14px] text-[var(--color-text-muted)]' }, 'Content coming soon — see docs/notebooklm/09-module-06-advertising-influence.md Act 2'),
    lab: (_d) => React.createElement('p', { className: 'text-[14px] text-[var(--color-text-muted)]' }, 'Interactive lab coming soon'),
    quiz: [],
  },

  {
    slug: 'M9', title: 'Opportunity Cost', pillar: 3, level: 3, icon: GitFork, actMinutes: { hook: 2, lesson: 6, lab: 7, quiz: 3 },  // 18 min
    triggerHint: 'Triggered when a goal is cancelled after a competing purchase',
    description: 'Every yes is a hidden no — how to make trade-offs consciously.',
    hook: (_d) => React.createElement('p', { className: 'text-[14px] leading-relaxed' },
      'You said yes to something — and quietly said no to something else. That trade has a name. Here\'s how to make it consciously next time.'
    ),
    lesson: (_d) => React.createElement('p', { className: 'text-[14px] text-[var(--color-text-muted)]' }, 'Content coming soon — see docs/notebooklm/09-module-09-opportunity-cost.md Act 2'),
    lab: (_d) => React.createElement('p', { className: 'text-[14px] text-[var(--color-text-muted)]' }, 'Interactive lab coming soon'),
    quiz: [],
  },

  {
    slug: 'M11', title: 'Credit Scores & Trust', pillar: 4, level: 3, icon: Star, actMinutes: { hook: 2, lesson: 5, lab: 7, quiz: 3 },  // 17 min
    triggerHint: 'Achieve 90% reliability over 8 weeks to unlock',
    description: 'How your financial reliability becomes a number — and why it matters.',
    hook: (d) => React.createElement('p', { className: 'text-[14px] leading-relaxed' },
      `Your consistency has a number. In the wider world, that number is ${d.reliabilityRating}% — and it opens doors or closes them. Here's how the system works.`
    ),
    lesson: (_d) => React.createElement('p', { className: 'text-[14px] text-[var(--color-text-muted)]' }, 'Content coming soon — see docs/notebooklm/09-module-11-credit-scores-and-trust.md Act 2'),
    lab: (_d) => React.createElement('p', { className: 'text-[14px] text-[var(--color-text-muted)]' }, 'Interactive lab coming soon'),
    quiz: [],
  },

  {
    slug: 'M12', title: 'Good vs Bad Debt', pillar: 4, level: 3, icon: CreditCard, actMinutes: { hook: 2, lesson: 7, lab: 8, quiz: 4 },  // 21 min — builds on M10
    triggerHint: 'Complete The Interest Trap module first',
    description: 'Not all debt is equal — a mortgage and a payday loan are not the same thing.',
    hook: (_d) => React.createElement('p', { className: 'text-[14px] leading-relaxed' },
      'Not all debt is a vine strangling your tree. Some debt is a trellis. Here\'s the test every serious grower uses to tell the difference.'
    ),
    lesson: (_d) => React.createElement('p', { className: 'text-[14px] text-[var(--color-text-muted)]' }, 'Content coming soon — see docs/notebooklm/09-module-12-good-vs-bad-debt.md Act 2'),
    lab: (_d) => React.createElement('p', { className: 'text-[14px] text-[var(--color-text-muted)]' }, 'Interactive lab coming soon'),
    quiz: [],
  },

  {
    slug: 'M18', title: 'Money & Mental Health', pillar: 6, level: 3, icon: Heart, actMinutes: { hook: 1, lesson: 5, lab: 5, quiz: 4 },  // 15 min — reflective, less numerical
    triggerHint: 'Triggered after a purchase you felt mixed about',
    description: 'Buyer\'s remorse, contentment, and why getting the thing doesn\'t fix the feeling.',
    hook: (_d) => React.createElement('p', { className: 'text-[14px] leading-relaxed' },
      'You got the thing — and something feels off. That feeling has a name. Let\'s talk about it before it shapes your next harvest.'
    ),
    lesson: (_d) => React.createElement('p', { className: 'text-[14px] text-[var(--color-text-muted)]' }, 'Content coming soon — see docs/notebooklm/09-module-18-money-and-mental-health.md Act 2'),
    lab: (_d) => React.createElement('p', { className: 'text-[14px] text-[var(--color-text-muted)]' }, 'Interactive lab coming soon'),
    quiz: [],
  },

  {
    slug: 'M18b', title: 'Social Comparison', pillar: 6, level: 3, icon: Users, actMinutes: { hook: 1, lesson: 4, lab: 6, quiz: 3 },  // 14 min
    triggerHint: 'Triggered when spending follows a peer\'s purchase',
    description: 'Why "keeping up" is a race with no finish line — and how to opt out.',
    hook: (_d) => React.createElement('p', { className: 'text-[14px] leading-relaxed' },
      'Someone else planted a seed and now you want the same crop. That\'s human — but let\'s make sure it\'s your hunger driving this, not theirs.'
    ),
    lesson: (_d) => React.createElement('p', { className: 'text-[14px] text-[var(--color-text-muted)]' }, 'Content coming soon — see docs/notebooklm/09-module-18b-social-comparison.md Act 2'),
    lab: (_d) => React.createElement('p', { className: 'text-[14px] text-[var(--color-text-muted)]' }, 'Interactive lab coming soon'),
    quiz: [],
  },

  // ── Level 4 modules ───────────────────────────────────────────────────────

  {
    slug: 'M13', title: 'Stocks & Shares', pillar: 5, level: 4, icon: BarChart2, actMinutes: { hook: 2, lesson: 8, lab: 10, quiz: 5 }, // 25 min — most complex Level 4
    triggerHint: 'Earn £100 lifetime to unlock',
    description: 'Fractional ownership of companies — and why long-term investors usually win.',
    hook: (d) => React.createElement('p', { className: 'text-[14px] leading-relaxed' },
      `${fmtPence(d.lifetimeEarningsPence, d.currency)} earned. The orchard now has a question: do you want to own a small piece of someone else's farm?`
    ),
    lesson: (_d) => React.createElement('p', { className: 'text-[14px] text-[var(--color-text-muted)]' }, 'Content coming soon — see docs/notebooklm/09-module-13-compound-growth.md Act 2'),
    lab: (_d) => React.createElement('p', { className: 'text-[14px] text-[var(--color-text-muted)]' }, 'Interactive lab coming soon'),
    quiz: [],
  },

  {
    slug: 'M15', title: 'Risk & Diversification', pillar: 5, level: 4, icon: PieChart, actMinutes: { hook: 2, lesson: 7, lab: 10, quiz: 4 }, // 23 min
    triggerHint: 'Have 3 active goals including one long-term goal',
    description: 'Don\'t put all your seeds in one basket — the maths of spreading risk.',
    hook: (d) => React.createElement('p', { className: 'text-[14px] leading-relaxed' },
      `${d.activeGoalsCount} active goals — you're thinking like a strategist. Now let's examine what happens when one of those soils turns bad.`
    ),
    lesson: (_d) => React.createElement('p', { className: 'text-[14px] text-[var(--color-text-muted)]' }, 'Content coming soon — see docs/notebooklm/09-module-15-risk-and-diversification.md Act 2'),
    lab: (_d) => React.createElement('p', { className: 'text-[14px] text-[var(--color-text-muted)]' }, 'Interactive lab coming soon'),
    quiz: [],
  },
]
