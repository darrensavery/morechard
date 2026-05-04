// app/src/lib/sharedExpensePresets.ts

export type ExpenseCategory =
  | 'education' | 'health' | 'clothing' | 'travel' | 'activities'
  | 'childcare' | 'food'   | 'tech'     | 'gifts'  | 'other';

export type ExpenseRegion = 'UK' | 'US' | 'PL';
export type ExpenseLocale = 'en' | 'en-US' | 'pl';

export interface ExpensePreset {
  id: string;
  name: string;
  category: ExpenseCategory;
  is_top_8: boolean;
  regions?: ExpenseRegion[];
  locale_overrides?: Partial<Record<ExpenseLocale, string>>;
  search_aliases?: string[];
  legally_distinguishable?: boolean;
}

export const PRESETS: ExpensePreset[] = [];

export function getPresetsForRegion(region: ExpenseRegion): ExpensePreset[] {
  return PRESETS.filter(p => !p.regions || p.regions.includes(region));
}

export function localiseName(preset: ExpensePreset, locale: ExpenseLocale): string {
  return preset.locale_overrides?.[locale] ?? preset.name;
}

export function findPreset(id: string): ExpensePreset | undefined {
  return PRESETS.find(p => p.id === id);
}

export function fuzzyMatchPreset(preset: ExpensePreset, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  if (preset.name.toLowerCase().includes(q)) return true;
  if (preset.search_aliases?.some(a => a.toLowerCase().includes(q))) return true;
  return false;
}
