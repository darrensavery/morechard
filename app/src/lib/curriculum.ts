/**
 * Shared Learning Lab curriculum — single source of truth.
 * 20 modules across 6 pillars. Matches 08-learning-lab.md exactly.
 * Import in LabSection (parent Insights view) and LabTab (child view).
 */

export const PILLAR_ICONS: Record<string, string> = {
  LABOR_VALUE:           'M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48 2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48 2.83-2.83',
  SPENDING_CHOICES:      'M3 3h18M3 9h18M3 15h18M3 21h18',
  SAVING_GROWTH:         'M12 2a10 10 0 1 1 0 20A10 10 0 0 1 12 2zm0 5v5l3 3',
  BORROWING_DEBT:        'M9 14s-2-2-4-2-4 2-4 2M20 14s-2-2-4-2-4 2-4 2M3 8h18M5 3h14l1 5H4z',
  INVESTING_FUTURE:      'M3 3v18h18M7 16l4-4 4 4 4-4',
  SOCIETY_WELLBEING:     'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z',
}

export const PILLAR_LABELS: Record<string, string> = {
  LABOR_VALUE:       'Earning & Value',
  SPENDING_CHOICES:  'Spending & Choices',
  SAVING_GROWTH:     'Saving & Growth',
  BORROWING_DEBT:    'Borrowing & Debt',
  INVESTING_FUTURE:  'Investing & Future',
  SOCIETY_WELLBEING: 'Society & Wellbeing',
}

export interface CurriculumModule {
  slug:      string;
  label:     string;
  pillar:    string;
  level:     1 | 2 | 3 | 4;
  objective: string;
  outcomes:  string[];
}

export const CURRICULUM: CurriculumModule[] = [
  // ── Pillar 1: Earning & Value ────────────────────────────────────────────────
  {
    slug:      'effort-vs-reward',
    label:     'Effort',
    pillar:    'LABOR_VALUE',
    level:     1,
    objective: 'Understand why different work earns different rewards.',
    outcomes:  [
      'Rank their own chores by effort and compare to reward amount',
      'Explain why higher-value tasks earn more',
      'Identify one higher-effort chore they could take on',
    ],
  },
  {
    slug:      'taxes-net-pay',
    label:     'Taxes',
    pillar:    'LABOR_VALUE',
    level:     2,
    objective: 'Understand that a portion of every pay goes back to the community.',
    outcomes:  [
      'Explain what a tax is and who pays it',
      'Understand the difference between gross and net pay',
      'Name two things taxes are used to fund',
    ],
  },
  {
    slug:      'entrepreneurship',
    label:     'Enterprise',
    pillar:    'LABOR_VALUE',
    level:     3,
    objective: 'Discover how to scale effort beyond hourly tasks.',
    outcomes:  [
      'Explain what it means to earn without trading only time for money',
      'Identify a skill or idea that could be turned into a small service',
      'Understand the difference between employee and self-employed income',
    ],
  },
  {
    slug:      'gig-trap-vs-salary',
    label:     'Gig vs Salary',
    pillar:    'LABOR_VALUE',
    level:     3,
    objective: 'Weigh the trade-off between flexible income and secure income.',
    outcomes:  [
      'Describe the gig economy and how it works',
      'List two advantages and two risks of gig work',
      'Decide which income model suits a goal they have',
    ],
  },
  // ── Pillar 2: Spending & Choices ─────────────────────────────────────────────
  {
    slug:      'needs-vs-wants',
    label:     'Needs & Wants',
    pillar:    'SPENDING_CHOICES',
    level:     1,
    objective: 'Tell the difference between things we need and things we want.',
    outcomes:  [
      'Sort a list of items into Needs and Wants',
      'Explain why Needs come first in any budget',
      'Spot one Want they have been treating as a Need',
    ],
  },
  {
    slug:      'scams-digital-safety',
    label:     'Scams',
    pillar:    'SPENDING_CHOICES',
    level:     2,
    objective: 'Protect yourself from digital scams and "too good to be true" offers.',
    outcomes:  [
      'Identify three warning signs of a common scam',
      'Explain why they should never share a PIN or password',
      'Know what to do if they think they have been scammed',
    ],
  },
  {
    slug:      'advertising-influence',
    label:     'Adverts',
    pillar:    'SPENDING_CHOICES',
    level:     3,
    objective: 'Recognise how advertising and design influence spending decisions.',
    outcomes:  [
      'Name two techniques advertisers use to create desire',
      'Spot a "dark pattern" in an app or website',
      'Apply a 24-hour pause rule before impulse purchases',
    ],
  },
  // ── Pillar 3: Saving & Growth ────────────────────────────────────────────────
  {
    slug:      'patience-tree',
    label:     'Patience',
    pillar:    'SAVING_GROWTH',
    level:     1,
    objective: 'Understand why waiting for something can make it more valuable.',
    outcomes:  [
      'Explain the difference between an impulse purchase and a planned one',
      'Identify a goal they are willing to wait for',
      'Connect saving behaviour to their Savings Grove progress',
    ],
  },
  {
    slug:      'banking-101',
    label:     'Banking',
    pillar:    'SAVING_GROWTH',
    level:     2,
    objective: 'Learn how banks work and what a bank account is for.',
    outcomes:  [
      'Name the difference between a current account and a savings account',
      'Understand what interest rate means on both sides',
      'Know why keeping money in a bank is safer than keeping it at home',
    ],
  },
  {
    slug:      'opportunity-cost',
    label:     'Trade-offs',
    pillar:    'SAVING_GROWTH',
    level:     3,
    objective: 'Recognise that every choice means giving up something else.',
    outcomes:  [
      'Define opportunity cost in plain language',
      'Give a real example from their own spending decisions',
      'Apply the trade-off question before making a purchase',
    ],
  },
  {
    slug:      'the-snowball',
    label:     'Snowball',
    pillar:    'SAVING_GROWTH',
    level:     2,
    objective: 'Discover how money grows when it is left to work over time.',
    outcomes:  [
      'Describe compound interest in their own words',
      'Calculate a simple snowball scenario using their own savings',
      'Understand why starting early matters more than starting big',
    ],
  },
  // ── Pillar 4: Borrowing & Debt ───────────────────────────────────────────────
  {
    slug:      'the-interest-trap',
    label:     'Interest Trap',
    pillar:    'BORROWING_DEBT',
    level:     2,
    objective: 'Learn why borrowing money costs more than it appears.',
    outcomes:  [
      'Explain how interest turns a small debt into a large one',
      'Describe the difference between good debt and bad debt',
      'Identify warning signs of a debt trap',
    ],
  },
  {
    slug:      'credit-scores-trust',
    label:     'Credit Score',
    pillar:    'BORROWING_DEBT',
    level:     3,
    objective: 'Understand how reliability is measured as a number.',
    outcomes:  [
      'Explain what a credit score is and why it matters',
      'List three things that improve a credit score',
      'Describe what happens when someone misses a repayment',
    ],
  },
  {
    slug:      'good-vs-bad-debt',
    label:     'Good Debt',
    pillar:    'BORROWING_DEBT',
    level:     3,
    objective: 'Distinguish between debt that builds assets and debt that drains value.',
    outcomes:  [
      'Give an example of good debt and explain why it can work',
      'Give an example of bad debt and explain the cost',
      'Apply the asset vs. consumable test to a borrowing decision',
    ],
  },
  // ── Pillar 5: Investing & Future ─────────────────────────────────────────────
  {
    slug:      'compound-growth',
    label:     'Compound Growth',
    pillar:    'INVESTING_FUTURE',
    level:     4,
    objective: 'See how consistent small gains compound into large long-term wealth.',
    outcomes:  [
      'Calculate a basic compound growth scenario',
      'Explain why time in the market beats timing the market',
      'Connect their current saving habit to a future wealth outcome',
    ],
  },
  {
    slug:      'inflation',
    label:     'Inflation',
    pillar:    'INVESTING_FUTURE',
    level:     2,
    objective: 'Understand why money loses value if it just sits still.',
    outcomes:  [
      'Define inflation in plain language',
      'Calculate the real value of £100 after 10 years at 3% inflation',
      'Name one way to protect money from inflation',
    ],
  },
  {
    slug:      'risk-and-diversification',
    label:     'Risk',
    pillar:    'INVESTING_FUTURE',
    level:     4,
    objective: 'Learn why spreading investments reduces the chance of total loss.',
    outcomes:  [
      'Explain the phrase "don\'t put all your eggs in one basket"',
      'Describe how diversification reduces risk',
      'Identify a situation where taking more risk could make sense',
    ],
  },
  // ── Pillar 6: Society & Wellbeing ────────────────────────────────────────────
  {
    slug:      'giving-and-charity',
    label:     'Giving',
    pillar:    'SOCIETY_WELLBEING',
    level:     1,
    objective: 'Explore how sharing wealth strengthens communities.',
    outcomes:  [
      'Name a cause they care about and explain why',
      'Understand the concept of charitable giving and philanthropy',
      'Decide on a percentage of future earnings they would set aside for giving',
    ],
  },
  {
    slug:      'digital-vs-physical-currency',
    label:     'Digital Money',
    pillar:    'SOCIETY_WELLBEING',
    level:     2,
    objective: 'Understand the difference between real money and in-game currencies.',
    outcomes:  [
      'Explain how V-Bucks and Robux differ from real money',
      'Describe how a digital transaction works',
      'Spot the risks of spending in "walled garden" platforms',
    ],
  },
  {
    slug:      'money-and-mental-health',
    label:     'Money & Mind',
    pillar:    'SOCIETY_WELLBEING',
    level:     3,
    objective: 'Connect financial decisions to emotional wellbeing.',
    outcomes:  [
      'Identify what buyer\'s remorse feels like and why it happens',
      'List two ways financial stress affects everyday life',
      'Practise a one-day wait rule before a discretionary purchase',
    ],
  },
  {
    slug:      'social-comparison',
    label:     'Comparison',
    pillar:    'SOCIETY_WELLBEING',
    level:     3,
    objective: 'Recognise when social pressure drives spending decisions.',
    outcomes:  [
      'Define social comparison and give a real-world example',
      'Identify a purchase driven by peer pressure rather than genuine desire',
      'Apply the "my goals, not their goals" test to a spending choice',
    ],
  },
]

/** Slug-to-label map for quick lookups in the worker. */
export const SLUG_TO_LABEL: Record<string, string> = Object.fromEntries(
  CURRICULUM.map(m => [m.slug, m.label])
)
