// app/src/lib/spendCategories.ts
// Shared spend-category taxonomy. Keep the ids in sync with the SPEND_CATEGORIES
// whitelist in worker/src/routes/finance.ts so persisted categories validate.
export interface SpendCategory {
  id:      string
  heading: string
}

export const SPEND_CATEGORIES: SpendCategory[] = [
  { id: 'food',          heading: 'Food & Treats'       },
  { id: 'games',         heading: 'Games & Apps'        },
  { id: 'entertainment', heading: 'Entertainment'       },
  { id: 'clothes',       heading: 'Clothes & Style'     },
  { id: 'stationery',    heading: 'Stationery & School' },
  { id: 'toys',          heading: 'Toys & Hobbies'      },
  { id: 'tech',          heading: 'Tech & Gadgets'      },
  { id: 'books',         heading: 'Books & Reading'     },
  { id: 'gifts',         heading: 'Gifts'               },
  { id: 'other',         heading: 'Other'               },
]

const HEADING_BY_ID = new Map(SPEND_CATEGORIES.map(c => [c.id, c.heading]))

/** Human label for a stored category id; falls back to 'Other' for null/unknown. */
export function spendCategoryHeading(id: string | null | undefined): string {
  return (id && HEADING_BY_ID.get(id)) || 'Other'
}
