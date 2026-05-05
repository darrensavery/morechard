/**
 * Shared Learning Lab curriculum — single source of truth.
 * Import this in LabSection (parent Insights view) and LabTab (child view).
 * Add new modules here; the UI and module count badge update automatically.
 */

export const PILLAR_ICONS: Record<string, string> = {
  LABOR_VALUE:           'M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48 2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48 2.83-2.83',
  DELAYED_GRATIFICATION: 'M12 2a10 10 0 1 1 0 20A10 10 0 0 1 12 2zm0 5v5l3 3',
  OPPORTUNITY_COST:      'M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18',
  CAPITAL_MANAGEMENT:    'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17.93V18h-2v1.93C7.06 19.44 4.56 16.94 4.07 14H6v-2H4.07C4.56 9.06 7.06 6.56 10 6.07V8h2V6.07c2.94.49 5.44 2.99 5.93 5.93H16v2h1.93c-.49 2.94-2.99 5.44-5.93 5.93z',
  SOCIAL_RESPONSIBILITY: 'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z',
}

export interface CurriculumModule {
  slug:      string;
  label:     string;
  pillar:    string;
  objective: string;
  outcomes:  string[];
}

export const CURRICULUM: CurriculumModule[] = [
  {
    slug:      'patience-tree',
    label:     'Patience',
    pillar:    'DELAYED_GRATIFICATION',
    objective: 'Understand why waiting for something can make it more valuable.',
    outcomes:  [
      'Explain the difference between an impulse purchase and a planned one',
      'Identify a goal they are willing to wait for',
      'Connect saving behaviour to their Savings Grove progress',
    ],
  },
  {
    slug:      'compound-interest',
    label:     'Snowball',
    pillar:    'CAPITAL_MANAGEMENT',
    objective: 'Discover how money grows when it is left to work over time.',
    outcomes:  [
      'Describe compound interest in their own words',
      'Calculate a simple snowball scenario using their own savings',
      'Understand why starting early matters more than starting big',
    ],
  },
  {
    slug:      'banking-101',
    label:     'Banking',
    pillar:    'CAPITAL_MANAGEMENT',
    objective: 'Learn how banks work and what a bank account is for.',
    outcomes:  [
      'Name the difference between a current account and a savings account',
      'Understand what interest rate means on both sides (saving vs. borrowing)',
      'Know why keeping money in a bank is safer than keeping it at home',
    ],
  },
  {
    slug:      'effort-vs-reward',
    label:     'Effort',
    pillar:    'LABOR_VALUE',
    objective: 'Connect the effort put into a task with the reward received.',
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
    objective: 'Understand that a portion of every pay goes back to the community.',
    outcomes:  [
      'Explain what a tax is and who pays it',
      'Understand the difference between gross and net pay',
      'Name two things taxes are used to fund',
    ],
  },
  {
    slug:      'opportunity-cost',
    label:     'Trade-offs',
    pillar:    'OPPORTUNITY_COST',
    objective: 'Recognise that every choice means giving up something else.',
    outcomes:  [
      'Define opportunity cost in plain language',
      'Give a real example from their own spending decisions',
      'Apply the trade-off question before making a purchase',
    ],
  },
  {
    slug:      'the-interest-trap',
    label:     'Debt',
    pillar:    'CAPITAL_MANAGEMENT',
    objective: 'Learn why borrowing money costs more than it appears.',
    outcomes:  [
      'Explain how interest turns a small debt into a large one',
      'Describe the difference between good debt and bad debt',
      'Identify warning signs of a debt trap',
    ],
  },
  {
    slug:      'giving-and-charity',
    label:     'Giving',
    pillar:    'SOCIAL_RESPONSIBILITY',
    objective: 'Explore how sharing wealth strengthens communities.',
    outcomes:  [
      'Name a cause they care about and explain why',
      'Understand the concept of charitable giving and philanthropy',
      'Decide on a percentage of future earnings they would set aside for giving',
    ],
  },
]

/** Slug-to-label map for quick lookups (e.g. in the worker). */
export const SLUG_TO_LABEL: Record<string, string> = Object.fromEntries(
  CURRICULUM.map(m => [m.slug, m.label])
)
