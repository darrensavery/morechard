# Shared Expense Presets + Receipt Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the free-text shared-expense logging UI with a Rate-Guide-style preset picker (65 items, 10 categories), add receipt upload with client-side compression, and embed receipts as Exhibits in the Shield-Plan court PDF.

**Architecture:** Static client-side preset catalogue (no D1 table), schema migration adds 9 columns (5 expense fields + 1 hash version + 3 void-tracking), new dedicated `RECEIPTS` R2 bucket, hash chain v2 derivation alongside v1 dispatch, two new worker route modules (`sharedExpenseReceipt.ts`, `sharedExpenseVoid.ts`), `pdf-lib` merge in the export route.

**Tech Stack:** TypeScript, React, Cloudflare Workers, D1, R2, Vitest, `pdf-lib`. Runtime is Cloudflare Pages (frontend) + Cloudflare Workers (API).

**Spec:** [`docs/superpowers/specs/2026-05-04-shared-expense-presets-design.md`](../specs/2026-05-04-shared-expense-presets-design.md)

---

## File Structure

### New files
- `app/src/lib/sharedExpensePresets.ts` — 65-entry preset catalogue + `getPresetsForRegion()` + `localiseName()` + `findPreset()`
- `app/src/lib/imageCompression.ts` — `compressImage()` Canvas-based util with EXIF preservation
- `app/src/components/dashboard/ReceiptPicker.tsx` — Take-photo / Upload-from-device sub-component for the expense sheet
- `app/src/components/dashboard/VoidExpenseSheet.tsx` — Void-and-Re-log confirmation modal
- `worker/src/routes/sharedExpenseReceipt.ts` — POST/GET/DELETE receipt handlers
- `worker/src/routes/sharedExpenseVoid.ts` — POST void handler with optional replacement
- `worker/src/lib/pdfReceiptEmbed.ts` — `embedReceiptsInPdf()` for the Exhibits section
- `worker/migrations/0050_shared_expense_extensions.sql` — schema additions
- `app/src/lib/__tests__/sharedExpensePresets.test.ts`
- `app/src/lib/__tests__/imageCompression.test.ts`
- `worker/src/lib/__tests__/sharedExpenseHash.test.ts` (extends existing tests if any)

### Modified files
- `app/src/components/dashboard/AddExpenseSheet.tsx` — full UI rebuild
- `app/src/components/dashboard/PoolTab.tsx` — Voided badges, Void action entry point
- `app/src/lib/api.ts` — add `uploadReceipt()`, `getReceiptUrl()`, `deleteReceipt()`, `voidExpense()`
- `worker/src/routes/sharedExpenses.ts` — accept new payload fields; new category enum
- `worker/src/lib/sharedExpenseHash.ts` — `computeSharedExpenseHashV2()`, `verifySharedExpenseHash()` dispatcher
- `worker/src/routes/export.ts` — append Exhibits section to PDF
- `worker/src/types.ts` — add `RECEIPTS: R2Bucket` to `Env`
- `worker/src/index.ts` — register new routes
- `worker/wrangler.toml` — declare `RECEIPTS` R2 binding
- `worker/package.json` — add `pdf-lib` dependency

### Untouched but referenced
- `app/src/components/dashboard/CreateChoreSheet.tsx` — pattern source
- `app/src/hooks/useMarketRates.ts` — `fuzzyMatch` (note: signature is `fuzzyMatch(rate: MarketRate, query: string)` — we'll add a generic `fuzzyMatchPreset` that wraps the same idea for `ExpensePreset`)
- `worker/src/routes/proof.ts` — pattern source for upload/get/EXIF handling

---

## Phase 1 — Preset catalogue (frontend, isolated, low risk)

### Task 1.1: Create the preset type definitions and a minimal catalogue stub

**Files:**
- Create: `app/src/lib/sharedExpensePresets.ts`

- [ ] **Step 1: Create the file with type defs and an empty array**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add app/src/lib/sharedExpensePresets.ts
git commit -m "feat(expenses): add ExpensePreset types and helpers stub"
```

---

### Task 1.2: Write tests for the helper functions before populating the catalogue

**Files:**
- Create: `app/src/lib/__tests__/sharedExpensePresets.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
// app/src/lib/__tests__/sharedExpensePresets.test.ts
import { describe, it, expect } from 'vitest';
import {
  PRESETS,
  getPresetsForRegion,
  localiseName,
  findPreset,
  fuzzyMatchPreset,
  ExpensePreset,
} from '../sharedExpensePresets';

describe('sharedExpensePresets catalogue', () => {
  it('has exactly 65 presets', () => {
    expect(PRESETS).toHaveLength(65);
  });

  it('has exactly 8 top_8 presets', () => {
    expect(PRESETS.filter(p => p.is_top_8)).toHaveLength(8);
  });

  it('has unique ids', () => {
    const ids = PRESETS.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every preset has a non-empty name and a valid category', () => {
    const valid: ExpensePreset['category'][] = [
      'education','health','clothing','travel','activities',
      'childcare','food','tech','gifts','other',
    ];
    for (const p of PRESETS) {
      expect(p.name.trim()).not.toBe('');
      expect(valid).toContain(p.category);
    }
  });

  it('getPresetsForRegion("US") excludes UK-only presets', () => {
    const us = getPresetsForRegion('US');
    expect(us.some(p => p.regions?.includes('UK') && !p.regions.includes('US'))).toBe(false);
  });

  it('getPresetsForRegion("UK") includes universal presets', () => {
    const uk = getPresetsForRegion('UK');
    const universal = PRESETS.filter(p => !p.regions);
    for (const p of universal) {
      expect(uk).toContainEqual(p);
    }
  });

  it('localiseName falls back to name when no override exists', () => {
    const p: ExpensePreset = { id: 't', name: 'Test', category: 'other', is_top_8: false };
    expect(localiseName(p, 'pl')).toBe('Test');
  });

  it('localiseName returns override when present', () => {
    const p: ExpensePreset = {
      id: 't', name: 'Test', category: 'other', is_top_8: false,
      locale_overrides: { pl: 'Próba' },
    };
    expect(localiseName(p, 'pl')).toBe('Próba');
  });

  it('findPreset returns undefined for unknown id', () => {
    expect(findPreset('nonexistent-xyz')).toBeUndefined();
  });

  it('fuzzyMatchPreset matches by name (case-insensitive)', () => {
    const p: ExpensePreset = { id: 't', name: 'School Trip', category: 'education', is_top_8: true };
    expect(fuzzyMatchPreset(p, 'school')).toBe(true);
    expect(fuzzyMatchPreset(p, 'TRIP')).toBe(true);
    expect(fuzzyMatchPreset(p, 'lunch')).toBe(false);
  });

  it('fuzzyMatchPreset matches by alias', () => {
    const p: ExpensePreset = {
      id: 't', name: 'Doctor / dentist visit', category: 'health', is_top_8: true,
      search_aliases: ['medical', 'GP', 'check-up'],
    };
    expect(fuzzyMatchPreset(p, 'GP')).toBe(true);
    expect(fuzzyMatchPreset(p, 'medical')).toBe(true);
  });

  it('fuzzyMatchPreset returns true for empty query', () => {
    const p: ExpensePreset = { id: 't', name: 'X', category: 'other', is_top_8: false };
    expect(fuzzyMatchPreset(p, '')).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests — expect catalogue-length test to fail**

Run: `cd app && npm test -- sharedExpensePresets`
Expected: FAIL — `expected length 0 to be 65`. Other tests pass.

- [ ] **Step 3: Commit the failing tests**

```bash
git add app/src/lib/__tests__/sharedExpensePresets.test.ts
git commit -m "test(expenses): add tests for preset catalogue helpers"
```

---

### Task 1.3: Populate the 65-preset catalogue

**Files:**
- Modify: `app/src/lib/sharedExpensePresets.ts` — replace `PRESETS = []` with the full array

- [ ] **Step 1: Replace the `PRESETS` array with the full catalogue**

Open `app/src/lib/sharedExpensePresets.ts` and replace the empty `PRESETS = []` line with:

```typescript
export const PRESETS: ExpensePreset[] = [
  // ── Education (8) ─────────────────────────────────────────────
  { id: 'school-trip', name: 'School trip', category: 'education', is_top_8: true,
    locale_overrides: { 'en-US': 'Field trip', pl: 'Wycieczka szkolna' },
    search_aliases: ['trip', 'field trip', 'excursion', 'wycieczka', 'PGL', 'residential'] },
  { id: 'school-supplies', name: 'School supplies & stationery', category: 'education', is_top_8: false,
    locale_overrides: { pl: 'Przybory szkolne' },
    search_aliases: ['stationery', 'supplies', 'pens', 'pencils', 'wyprawka'] },
  { id: 'textbooks', name: 'Textbooks', category: 'education', is_top_8: false,
    locale_overrides: { pl: 'Podręczniki' },
    search_aliases: ['books', 'textbook'] },
  { id: 'tutoring', name: 'Tutoring / extra lessons', category: 'education', is_top_8: false,
    locale_overrides: { pl: 'Korepetycje' },
    search_aliases: ['tutor', 'extra lessons', 'private lessons', 'korepetycje'] },
  { id: 'exam-fees', name: 'Exam fees', category: 'education', is_top_8: false,
    locale_overrides: { 'en-US': 'Exam / AP test fees', pl: 'Opłaty egzaminacyjne' },
    search_aliases: ['exam', 'GCSE', 'A-Level', 'SAT', 'ACT', 'AP test', 'matura'] },
  { id: 'music-lessons', name: 'Music lessons', category: 'education', is_top_8: false,
    locale_overrides: { pl: 'Lekcje muzyki' },
    search_aliases: ['piano', 'guitar', 'violin', 'music tutor'] },
  { id: 'yearbook', name: 'Yearbook', category: 'education', is_top_8: false,
    regions: ['US'],
    search_aliases: ['yearbook'] },
  { id: 'school-photos', name: 'School photos', category: 'education', is_top_8: false,
    locale_overrides: { pl: 'Zdjęcia szkolne' },
    search_aliases: ['photos', 'class photo', 'portraits'] },

  // ── Health (8) ────────────────────────────────────────────────
  { id: 'doctor-dentist', name: 'Doctor / dentist visit', category: 'health', is_top_8: true,
    locale_overrides: { 'en-US': 'Doctor / dentist appointment', pl: 'Wizyta u lekarza / dentysty' },
    search_aliases: ['medical', 'GP', 'doctor', 'dentist', 'check-up', 'appointment'] },
  { id: 'orthodontist', name: 'Orthodontist / braces', category: 'health', is_top_8: false,
    locale_overrides: { pl: 'Ortodonta / aparat' },
    search_aliases: ['braces', 'orthodontist', 'aligners', 'Invisalign'] },
  { id: 'optician', name: 'Optician / glasses / contact lenses', category: 'health', is_top_8: false,
    locale_overrides: { 'en-US': 'Eye doctor / glasses / contacts', pl: 'Optyk / okulary' },
    search_aliases: ['glasses', 'contacts', 'eye test', 'eye doctor', 'optometrist'] },
  { id: 'prescription', name: 'Prescription medicine', category: 'health', is_top_8: false,
    locale_overrides: { pl: 'Leki na receptę' },
    search_aliases: ['medicine', 'prescription', 'pharmacy', 'leki'] },
  { id: 'therapy', name: 'Therapy / counselling', category: 'health', is_top_8: false,
    legally_distinguishable: true,
    locale_overrides: { 'en-US': 'Therapy / counseling', pl: 'Terapia / poradnictwo' },
    search_aliases: ['mental health', 'counselling', 'CBT', 'therapy', 'psychologist', 'psychiatrist'] },
  { id: 'vaccinations', name: 'Vaccinations', category: 'health', is_top_8: false,
    locale_overrides: { pl: 'Szczepienia' },
    search_aliases: ['vaccine', 'immunisation', 'jab', 'shot'] },
  { id: 'medical-equipment', name: 'Medical equipment / orthotics', category: 'health', is_top_8: false,
    legally_distinguishable: true,
    locale_overrides: { pl: 'Sprzęt medyczny' },
    search_aliases: ['orthotics', 'crutches', 'wheelchair', 'hearing aid', 'inhaler'] },
  { id: 'physio', name: 'Physiotherapy', category: 'health', is_top_8: false,
    locale_overrides: { 'en-US': 'Physical therapy', pl: 'Fizjoterapia' },
    search_aliases: ['physio', 'physical therapy', 'rehab'] },

  // ── Clothing (6) ──────────────────────────────────────────────
  { id: 'school-uniform', name: 'School uniform', category: 'clothing', is_top_8: true,
    locale_overrides: { pl: 'Mundurek szkolny' },
    search_aliases: ['uniform', 'shirt', 'trousers', 'skirt', 'tie', 'blazer', 'PE kit'] },
  { id: 'shoes', name: 'Shoes', category: 'clothing', is_top_8: true,
    locale_overrides: { pl: 'Buty' },
    search_aliases: ['uniform', 'trainers', 'school shoes', 'football boots', 'pumps', 'sneakers'] },
  { id: 'coat', name: 'Coat / outerwear', category: 'clothing', is_top_8: false,
    locale_overrides: { pl: 'Kurtka / okrycie wierzchnie' },
    search_aliases: ['coat', 'jacket', 'raincoat', 'winter coat'] },
  { id: 'sportswear', name: 'Sportswear / kit', category: 'clothing', is_top_8: false,
    locale_overrides: { pl: 'Strój sportowy' },
    search_aliases: ['kit', 'football kit', 'rugby kit', 'PE', 'tracksuit', 'leotard'] },
  { id: 'everyday-clothes', name: 'Everyday clothes', category: 'clothing', is_top_8: false,
    locale_overrides: { pl: 'Ubrania codzienne' },
    search_aliases: ['clothes', 'jeans', 'tshirt', 'tops'] },
  { id: 'special-occasion-outfit', name: 'Special-occasion outfit', category: 'clothing', is_top_8: false,
    locale_overrides: { pl: 'Strój na specjalną okazję' },
    search_aliases: ['suit', 'dress', 'formal', 'wedding', 'communion outfit'] },

  // ── Travel (5) ────────────────────────────────────────────────
  { id: 'family-holiday-share', name: 'Family holiday share', category: 'travel', is_top_8: false,
    locale_overrides: { 'en-US': 'Family vacation share', pl: 'Udział w wakacjach rodzinnych' },
    search_aliases: ['holiday', 'vacation', 'trip'] },
  { id: 'visiting-other-parent', name: 'Visiting other parent (transport)', category: 'travel', is_top_8: false,
    locale_overrides: { pl: 'Podróż do drugiego rodzica' },
    search_aliases: ['contact', 'handover', 'transport', 'travel costs'] },
  { id: 'school-residential', name: 'School residential / overnight trip', category: 'travel', is_top_8: false,
    locale_overrides: { pl: 'Wyjazd szkolny z noclegiem' },
    search_aliases: ['residential', 'overnight', 'PGL', 'camp'] },
  { id: 'transport-pass', name: 'Public transport pass', category: 'travel', is_top_8: false,
    locale_overrides: { 'en-US': 'Transit pass', pl: 'Bilet komunikacji miejskiej' },
    search_aliases: ['bus pass', 'train pass', 'oyster', 'monthly pass'] },
  { id: 'passport-visa', name: 'Passport / visa fees', category: 'travel', is_top_8: false,
    locale_overrides: { pl: 'Paszport / wiza' },
    search_aliases: ['passport', 'visa', 'travel docs'] },

  // ── Activities (9) ────────────────────────────────────────────
  { id: 'sports-club-fees', name: 'Sports club / team fees', category: 'activities', is_top_8: true,
    locale_overrides: { pl: 'Składki klubu sportowego' },
    search_aliases: ['football', 'rugby', 'cricket', 'swim squad', 'team', 'subs'] },
  { id: 'school-clubs', name: 'School clubs / extra-curricular', category: 'activities', is_top_8: false,
    locale_overrides: { pl: 'Kółka zainteresowań' },
    search_aliases: ['chess', 'drama', 'coding club', 'choir', 'debate', 'after-school club'] },
  { id: 'sports-equipment', name: 'Sports equipment & kit', category: 'activities', is_top_8: false,
    locale_overrides: { pl: 'Sprzęt sportowy' },
    search_aliases: ['equipment', 'racket', 'bat', 'helmet', 'shin pads'] },
  { id: 'instrument-lessons', name: 'Music / instrument lessons', category: 'activities', is_top_8: false,
    locale_overrides: { pl: 'Nauka gry na instrumencie' },
    search_aliases: ['piano lessons', 'guitar lessons', 'violin lessons'] },
  { id: 'drama-dance', name: 'Drama / dance classes', category: 'activities', is_top_8: false,
    locale_overrides: { pl: 'Zajęcia teatralne / taneczne' },
    search_aliases: ['ballet', 'tap', 'jazz', 'street dance', 'stage school'] },
  { id: 'scouts-brownies', name: 'Scouts / Brownies / cadets', category: 'activities', is_top_8: false,
    locale_overrides: { 'en-US': 'Scouting / cadets', pl: 'Harcerze / harcerstwo' },
    search_aliases: ['scouts', 'brownies', 'cubs', 'guides', 'cadets', 'harcerze'] },
  { id: 'summer-camp', name: 'Summer camp / holiday club', category: 'activities', is_top_8: false,
    locale_overrides: { pl: 'Obóz letni / kolonie' },
    search_aliases: ['camp', 'holiday club', 'colonia', 'half-term club'] },
  { id: 'swimming-lessons', name: 'Swimming lessons', category: 'activities', is_top_8: false,
    locale_overrides: { pl: 'Lekcje pływania' },
    search_aliases: ['swimming', 'pool', 'swim'] },
  { id: 'martial-arts', name: 'Martial arts', category: 'activities', is_top_8: false,
    locale_overrides: { pl: 'Sztuki walki' },
    search_aliases: ['karate', 'judo', 'taekwondo', 'BJJ', 'kickboxing'] },

  // ── Childcare (5) ─────────────────────────────────────────────
  { id: 'childcare-wraparound', name: 'Childcare / wraparound', category: 'childcare', is_top_8: true,
    locale_overrides: { 'en-US': 'Childcare / before-after school', pl: 'Świetlica / opieka' },
    search_aliases: ['after-school', 'before-school', 'breakfast club', 'wraparound', 'świetlica'] },
  { id: 'childminder-nursery', name: 'Childminder / nursery', category: 'childcare', is_top_8: false,
    locale_overrides: { 'en-US': 'Daycare / preschool', pl: 'Żłobek / przedszkole' },
    search_aliases: ['nursery', 'daycare', 'childminder', 'preschool', 'żłobek'] },
  { id: 'babysitter', name: 'Babysitter', category: 'childcare', is_top_8: false,
    locale_overrides: { pl: 'Opiekunka' },
    search_aliases: ['sitter', 'nanny'] },
  { id: 'nanny-share', name: 'Nanny share', category: 'childcare', is_top_8: false,
    search_aliases: ['nanny', 'shared nanny'] },
  { id: 'holiday-childcare', name: 'Holiday childcare', category: 'childcare', is_top_8: false,
    locale_overrides: { 'en-US': 'School-break childcare', pl: 'Opieka w wakacje' },
    search_aliases: ['half-term care', 'holiday club', 'school break'] },

  // ── Food (3) ──────────────────────────────────────────────────
  { id: 'lunch-money', name: 'Lunch money / lunch account', category: 'food', is_top_8: true,
    locale_overrides: { 'en-US': 'Lunch account', pl: 'Obiady szkolne' },
    search_aliases: ['dinner money', 'lunch', 'ParentPay', 'school meals', 'cafeteria'] },
  { id: 'special-diet', name: 'Special diet groceries', category: 'food', is_top_8: false,
    legally_distinguishable: true,
    locale_overrides: { pl: 'Specjalna dieta' },
    search_aliases: ['gluten-free', 'dairy-free', 'allergy', 'coeliac', 'formula', 'prescribed diet'] },
  { id: 'event-catering', name: 'Birthday / event catering', category: 'food', is_top_8: false,
    locale_overrides: { pl: 'Catering urodzinowy' },
    search_aliases: ['catering', 'party food', 'cake'] },

  // ── Tech & Devices (5) ────────────────────────────────────────
  { id: 'laptop-tablet', name: 'School laptop / tablet', category: 'tech', is_top_8: false,
    locale_overrides: { pl: 'Laptop / tablet do szkoły' },
    search_aliases: ['laptop', 'tablet', 'iPad', 'Chromebook', 'computer'] },
  { id: 'phone-device', name: 'Phone (device)', category: 'tech', is_top_8: false,
    locale_overrides: { pl: 'Telefon' },
    search_aliases: ['phone', 'iPhone', 'mobile', 'smartphone', 'handset'] },
  { id: 'phone-bill', name: 'Phone bill / data plan', category: 'tech', is_top_8: false,
    locale_overrides: { pl: 'Abonament telefoniczny' },
    search_aliases: ['phone bill', 'data plan', 'SIM', 'contract'] },
  { id: 'headphones', name: 'Headphones / accessories', category: 'tech', is_top_8: false,
    locale_overrides: { pl: 'Słuchawki / akcesoria' },
    search_aliases: ['headphones', 'earbuds', 'AirPods', 'case', 'charger'] },
  { id: 'app-subscription', name: 'Software / app subscriptions (educational)', category: 'tech', is_top_8: false,
    locale_overrides: { pl: 'Subskrypcje aplikacji' },
    search_aliases: ['app', 'subscription', 'Duolingo', 'Mathletics', 'Times Tables Rock Stars'] },

  // ── Gifts & Celebrations (6) ──────────────────────────────────
  { id: 'birthday-gift', name: 'Birthday gift (for child)', category: 'gifts', is_top_8: true,
    locale_overrides: { pl: 'Prezent urodzinowy (dla dziecka)' },
    search_aliases: ['birthday', 'present', 'gift'] },
  { id: 'christmas-gift', name: 'Christmas / holiday gift', category: 'gifts', is_top_8: false,
    locale_overrides: { 'en-US': 'Holiday / Christmas gift', pl: 'Prezent świąteczny' },
    search_aliases: ['Christmas', 'Hanukkah', 'holiday gift', 'Mikołaj'] },
  { id: 'birthday-party', name: 'Birthday party costs', category: 'gifts', is_top_8: false,
    locale_overrides: { pl: 'Koszty przyjęcia urodzinowego' },
    search_aliases: ['party', 'venue', 'entertainer'] },
  { id: 'gift-from-child', name: 'Other family gift (from child)', category: 'gifts', is_top_8: false,
    locale_overrides: { pl: 'Prezent od dziecka dla rodziny' },
    search_aliases: ['mothers day', 'fathers day', 'grandparents'] },
  { id: 'religious-milestone', name: 'Religious milestone', category: 'gifts', is_top_8: false,
    locale_overrides: { pl: 'Komunia / bierzmowanie' },
    search_aliases: ['communion', 'confirmation', 'bar mitzvah', 'bat mitzvah', 'baptism'] },
  { id: 'prom-graduation', name: 'School prom / graduation', category: 'gifts', is_top_8: false,
    locale_overrides: { pl: 'Bal / studniówka' },
    search_aliases: ['prom', 'graduation', 'studniówka', 'leavers'] },

  // ── Other (6) ─────────────────────────────────────────────────
  { id: 'pocket-money-topup', name: 'Pocket money top-up', category: 'other', is_top_8: false,
    locale_overrides: { 'en-US': 'Allowance top-up', pl: 'Doładowanie kieszonkowego' },
    search_aliases: ['allowance', 'pocket money', 'top up'] },
  { id: 'pet-costs', name: 'Pet costs (child\'s pet)', category: 'other', is_top_8: false,
    locale_overrides: { pl: 'Koszty zwierzaka' },
    search_aliases: ['pet', 'vet', 'food', 'grooming'] },
  { id: 'hobby-supplies', name: 'Hobby supplies', category: 'other', is_top_8: false,
    locale_overrides: { pl: 'Akcesoria hobbystyczne' },
    search_aliases: ['art', 'craft', 'lego', 'hobby'] },
  { id: 'hairdresser', name: 'Hairdresser / barber', category: 'other', is_top_8: false,
    locale_overrides: { pl: 'Fryzjer' },
    search_aliases: ['haircut', 'hairdresser', 'barber', 'salon'] },
  { id: 'membership', name: 'Subscription / membership', category: 'other', is_top_8: false,
    locale_overrides: { pl: 'Subskrypcja / członkostwo' },
    search_aliases: ['membership', 'gym', 'club', 'magazine'] },
  { id: 'custom', name: 'Custom expense', category: 'other', is_top_8: false,
    legally_distinguishable: true,
    locale_overrides: { pl: 'Inny wydatek' },
    search_aliases: ['custom', 'other'] },
];
```

- [ ] **Step 2: Run tests — all should pass now**

Run: `cd app && npm test -- sharedExpensePresets`
Expected: PASS (all 11 tests)

- [ ] **Step 3: Commit**

```bash
git add app/src/lib/sharedExpensePresets.ts
git commit -m "feat(expenses): populate 65-preset catalogue with locale + alias data"
```

---

## Phase 2 — Image compression util (frontend, isolated, low risk)

### Task 2.1: Write failing tests for `compressImage`

**Files:**
- Create: `app/src/lib/__tests__/imageCompression.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
// app/src/lib/__tests__/imageCompression.test.ts
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { compressImage } from '../imageCompression';

// Build a synthetic File of N bytes with the given MIME type.
function fakeFile(bytes: number, type: string, name = 'f'): File {
  const buf = new Uint8Array(bytes);
  // Sprinkle non-zero values so it's not all-zero (some image decoders bail on that).
  for (let i = 0; i < bytes; i++) buf[i] = (i * 31) & 0xff;
  return new File([buf], name, { type });
}

describe('compressImage', () => {
  beforeAll(() => {
    // jsdom doesn't implement createImageBitmap or HTMLCanvasElement.toBlob.
    // Mock them so the util's branches are exercised without a real image pipeline.
    // @ts-expect-error — patching a global for tests
    global.createImageBitmap = vi.fn(async () => ({
      width: 4000, height: 3000, close: () => {},
    }));
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      drawImage: vi.fn(),
    })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback) {
      cb(new Blob([new Uint8Array(50_000)], { type: 'image/jpeg' }));
    } as typeof HTMLCanvasElement.prototype.toBlob;
  });

  it('passes PDFs through unchanged', async () => {
    const input = fakeFile(2_000_000, 'application/pdf', 'receipt.pdf');
    const out = await compressImage(input);
    expect(out).toBe(input);
  });

  it('passes small images through unchanged', async () => {
    const input = fakeFile(400_000, 'image/jpeg', 'small.jpg');
    const out = await compressImage(input);
    expect(out).toBe(input);
  });

  it('compresses large JPEGs to a smaller JPEG', async () => {
    const input = fakeFile(8_000_000, 'image/jpeg', 'big.jpg');
    const out = await compressImage(input);
    expect(out).not.toBe(input);
    expect(out.type).toBe('image/jpeg');
    expect(out.size).toBeLessThan(input.size);
  });

  it('throws when the compressed result is still over 10MB', async () => {
    const huge = fakeFile(20_000_000, 'image/jpeg', 'huge.jpg');
    HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback) {
      // Force the mock to return something still >10MB
      cb(new Blob([new Uint8Array(15_000_000)], { type: 'image/jpeg' }));
    } as typeof HTMLCanvasElement.prototype.toBlob;
    await expect(compressImage(huge)).rejects.toThrow(/too large/i);
  });

  it('falls back to original when HEIC decode throws', async () => {
    const heic = fakeFile(2_500_000, 'image/heic', 'photo.heic');
    // @ts-expect-error — patching mock
    global.createImageBitmap = vi.fn(async () => { throw new Error('cannot decode HEIC'); });
    const out = await compressImage(heic);
    expect(out).toBe(heic);
  });
});
```

- [ ] **Step 2: Run — confirm fail (file does not exist)**

Run: `cd app && npm test -- imageCompression`
Expected: FAIL — module not found.

- [ ] **Step 3: Commit failing test**

```bash
git add app/src/lib/__tests__/imageCompression.test.ts
git commit -m "test(expenses): add tests for compressImage util"
```

---

### Task 2.2: Implement `compressImage`

**Files:**
- Create: `app/src/lib/imageCompression.ts`

- [ ] **Step 1: Implement the util**

```typescript
// app/src/lib/imageCompression.ts

const MAX_DIM = 1600;
const QUALITY = 0.82;
const SMALL_THRESHOLD = 500_000;       // 500 KB
const HARD_CAP = 10 * 1024 * 1024;     // 10 MB

/**
 * Compresses an image File for upload.
 * - PDFs and small images pass through unchanged.
 * - Large JPEG/PNG/WebP are resized to MAX_DIM longest edge and re-encoded JPEG@0.82.
 * - HEIC: attempts createImageBitmap; on failure, returns original (still subject to HARD_CAP).
 * - Throws if the final size exceeds 10MB.
 */
export async function compressImage(file: File): Promise<File> {
  if (file.type === 'application/pdf') return file;
  if (file.size <= SMALL_THRESHOLD) return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    // HEIC on Chrome/Android often fails. Pass through but enforce the hard cap.
    if (file.size > HARD_CAP) {
      throw new Error('Image too large after compression — try a smaller photo.');
    }
    return file;
  }

  const { width, height } = bitmap;
  const longest = Math.max(width, height);
  const scale = longest > MAX_DIM ? MAX_DIM / longest : 1;
  const targetW = Math.round(width  * scale);
  const targetH = Math.round(height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close?.();
    throw new Error('Image too large after compression — try a smaller photo.');
  }
  ctx.drawImage(bitmap, 0, 0, targetW, targetH);
  bitmap.close?.();

  const blob = await new Promise<Blob | null>(resolve => {
    canvas.toBlob(b => resolve(b), 'image/jpeg', QUALITY);
  });
  if (!blob) {
    throw new Error('Image too large after compression — try a smaller photo.');
  }

  if (blob.size > HARD_CAP) {
    throw new Error('Image too large after compression — try a smaller photo.');
  }

  // EXIF preservation for source JPEGs only — splice the original APP1 segment
  // back into the new JPEG so the worker's confidence scoring still works.
  let outBlob: Blob = blob;
  if (file.type === 'image/jpeg') {
    try {
      const merged = await spliceExif(file, blob);
      if (merged) outBlob = merged;
    } catch {
      // Non-fatal — proceed with the canvas output (no EXIF).
    }
  }

  const newName = file.name.replace(/\.[^.]+$/, '') + '.jpg';
  return new File([outBlob], newName, { type: 'image/jpeg' });
}

/**
 * Extracts the APP1 segment (Exif marker) from `originalJpeg` and re-injects it
 * into `newJpeg` immediately after the SOI. Returns null if either is malformed.
 */
async function spliceExif(originalJpeg: File, newJpeg: Blob): Promise<Blob | null> {
  const origBuf = new Uint8Array(await originalJpeg.arrayBuffer());
  const newBuf  = new Uint8Array(await newJpeg.arrayBuffer());

  // SOI check (FF D8)
  if (origBuf.length < 4 || origBuf[0] !== 0xFF || origBuf[1] !== 0xD8) return null;
  if (newBuf.length  < 4 || newBuf[0]  !== 0xFF || newBuf[1]  !== 0xD8) return null;

  // Find the APP1 segment in the original
  let i = 2;
  while (i + 4 < origBuf.length) {
    if (origBuf[i] !== 0xFF) break;
    const marker = origBuf[i + 1];
    const segLen = (origBuf[i + 2] << 8) | origBuf[i + 3];
    if (marker === 0xE1 && segLen >= 8) {
      // Confirm 'Exif\0\0' prefix
      const ePrefix = String.fromCharCode(origBuf[i+4], origBuf[i+5], origBuf[i+6], origBuf[i+7]);
      if (ePrefix === 'Exif') {
        const app1 = origBuf.slice(i, i + 2 + segLen);
        const out = new Uint8Array(2 + app1.length + (newBuf.length - 2));
        out[0] = 0xFF; out[1] = 0xD8;
        out.set(app1, 2);
        out.set(newBuf.slice(2), 2 + app1.length);
        return new Blob([out], { type: 'image/jpeg' });
      }
    }
    if (marker === 0xDA) break; // SOS — pixel data starts; no APP1 found
    i += 2 + segLen;
  }
  return null;
}
```

- [ ] **Step 2: Run tests — all should pass**

Run: `cd app && npm test -- imageCompression`
Expected: PASS (5 tests).

- [ ] **Step 3: Commit**

```bash
git add app/src/lib/imageCompression.ts
git commit -m "feat(expenses): add compressImage util with EXIF preservation"
```

---

## Phase 3 — Database migration + worker schema/types groundwork

### Task 3.1: Add `RECEIPTS` R2 binding to types and wrangler

**Files:**
- Modify: `worker/src/types.ts`
- Modify: `worker/wrangler.toml`

- [ ] **Step 1: Add `RECEIPTS` to the `Env` interface**

In [worker/src/types.ts:1-19](worker/src/types.ts#L1-L19), modify the `Env` interface — replace:

```typescript
export interface Env {
  DB: D1Database;
  EVIDENCE: R2Bucket;
```

with:

```typescript
export interface Env {
  DB: D1Database;
  EVIDENCE: R2Bucket;
  RECEIPTS: R2Bucket;
```

- [ ] **Step 2: Add binding to wrangler.toml**

Open `worker/wrangler.toml` and locate the existing `EVIDENCE` R2 binding. Add a parallel block immediately below:

```toml
[[r2_buckets]]
binding = "RECEIPTS"
bucket_name = "morechard-receipts"
preview_bucket_name = "morechard-receipts-preview"
```

- [ ] **Step 3: Create the buckets via wrangler CLI**

Run:
```bash
cd worker && npx wrangler r2 bucket create morechard-receipts
npx wrangler r2 bucket create morechard-receipts-preview
```

Expected: two `Created bucket` confirmations. If the buckets already exist (re-running), the CLI will say so; that's fine.

- [ ] **Step 4: Type-check**

Run: `cd worker && npx tsc --noEmit`
Expected: clean output, no errors.

- [ ] **Step 5: Commit**

```bash
git add worker/src/types.ts worker/wrangler.toml
git commit -m "feat(expenses): add RECEIPTS R2 bucket binding"
```

---

### Task 3.2: Write the schema migration

**Files:**
- Create: `worker/migrations/0050_shared_expense_extensions.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- worker/migrations/0050_shared_expense_extensions.sql
-- Adds preset/receipt support and void-and-re-log to shared_expenses.
-- Existing rows remain hash_version = 1 (legacy hash input).
-- New rows use hash_version = 2 (extended hash input).

ALTER TABLE shared_expenses ADD COLUMN expense_date TEXT;
ALTER TABLE shared_expenses ADD COLUMN note TEXT;
ALTER TABLE shared_expenses ADD COLUMN receipt_r2_key TEXT;
ALTER TABLE shared_expenses ADD COLUMN receipt_hash TEXT;
ALTER TABLE shared_expenses ADD COLUMN receipt_uploaded_at INTEGER;
ALTER TABLE shared_expenses ADD COLUMN hash_version INTEGER NOT NULL DEFAULT 1;

-- Void-and-re-log support
ALTER TABLE shared_expenses ADD COLUMN voided_at INTEGER;
ALTER TABLE shared_expenses ADD COLUMN voided_by TEXT;
ALTER TABLE shared_expenses ADD COLUMN voids_id INTEGER;

-- Index to speed up court-PDF "find replacement" lookups
CREATE INDEX IF NOT EXISTS idx_shared_expenses_voids_id ON shared_expenses(voids_id);

-- NOTE: We do not rebuild the table to update the category CHECK constraint.
-- Validation is enforced in the API handler (worker/src/routes/sharedExpenses.ts)
-- against the canonical 10-category list. D1 CHECK rebuilds require a full
-- table copy on a hot table, so we keep DB-side permissive and enforce in code.
```

- [ ] **Step 2: Apply migration locally**

Run: `cd worker && npx wrangler d1 migrations apply DB --local`
Expected: `0050_shared_expense_extensions.sql` reported as applied.

- [ ] **Step 3: Verify columns exist**

Run: `cd worker && npx wrangler d1 execute DB --local --command="PRAGMA table_info(shared_expenses)"`
Expected output includes rows for `expense_date`, `note`, `receipt_r2_key`, `receipt_hash`, `receipt_uploaded_at`, `hash_version`, `voided_at`, `voided_by`, `voids_id`.

- [ ] **Step 4: Commit**

```bash
git add worker/migrations/0050_shared_expense_extensions.sql
git commit -m "feat(expenses): migration 0050 — preset/receipt/void columns"
```

---

## Phase 4 — Hash chain v2 derivation

### Task 4.1: Write tests for the hash dispatcher

**Files:**
- Create: `worker/src/lib/__tests__/sharedExpenseHash.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
// worker/src/lib/__tests__/sharedExpenseHash.test.ts
import { describe, it, expect } from 'vitest';
import {
  computeSharedExpenseHash,
  computeSharedExpenseHashV2,
  GENESIS_HASH,
} from '../sharedExpenseHash';

describe('sharedExpenseHash', () => {
  const base = {
    id: 42,
    familyId: 'fam_xyz',
    loggedBy: 'user_abc',
    totalAmount: 5000,
    currency: 'GBP',
    splitBp: 5000,
    previousHash: GENESIS_HASH,
  };

  it('v1 hash is deterministic', async () => {
    const a = await computeSharedExpenseHash(
      base.id, base.familyId, base.loggedBy, base.totalAmount,
      base.currency, base.splitBp, base.previousHash,
    );
    const b = await computeSharedExpenseHash(
      base.id, base.familyId, base.loggedBy, base.totalAmount,
      base.currency, base.splitBp, base.previousHash,
    );
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('v2 hash is deterministic', async () => {
    const args = {
      ...base,
      expenseDate: '2026-05-04',
      note: 'After-school chess club, 6 sessions',
      receiptHash: 'abc123',
      voidedAt: null as number | null,
      voidsId: null as number | null,
    };
    const a = await computeSharedExpenseHashV2(args);
    const b = await computeSharedExpenseHashV2(args);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('v2 hash differs from v1 for the same financial inputs', async () => {
    const v1 = await computeSharedExpenseHash(
      base.id, base.familyId, base.loggedBy, base.totalAmount,
      base.currency, base.splitBp, base.previousHash,
    );
    const v2 = await computeSharedExpenseHashV2({
      ...base,
      expenseDate: null,
      note: null,
      receiptHash: null,
      voidedAt: null,
      voidsId: null,
    });
    expect(v1).not.toBe(v2);
  });

  it('v2 hash changes when receipt_hash changes', async () => {
    const a = await computeSharedExpenseHashV2({
      ...base, expenseDate: '2026-05-04', note: 'x',
      receiptHash: 'aaa', voidedAt: null, voidsId: null,
    });
    const b = await computeSharedExpenseHashV2({
      ...base, expenseDate: '2026-05-04', note: 'x',
      receiptHash: 'bbb', voidedAt: null, voidsId: null,
    });
    expect(a).not.toBe(b);
  });

  it('v2 hash changes when note changes', async () => {
    const a = await computeSharedExpenseHashV2({
      ...base, expenseDate: '2026-05-04', note: 'first',
      receiptHash: null, voidedAt: null, voidsId: null,
    });
    const b = await computeSharedExpenseHashV2({
      ...base, expenseDate: '2026-05-04', note: 'second',
      receiptHash: null, voidedAt: null, voidsId: null,
    });
    expect(a).not.toBe(b);
  });
});
```

- [ ] **Step 2: Run — confirm fail (V2 not implemented)**

Run: `cd worker && npm test -- sharedExpenseHash`
Expected: FAIL — `computeSharedExpenseHashV2 is not a function`.

- [ ] **Step 3: Commit failing tests**

```bash
git add worker/src/lib/__tests__/sharedExpenseHash.test.ts
git commit -m "test(expenses): add tests for v2 hash derivation"
```

---

### Task 4.2: Implement `computeSharedExpenseHashV2`

**Files:**
- Modify: `worker/src/lib/sharedExpenseHash.ts`

- [ ] **Step 1: Append the v2 function and a dispatcher**

Open `worker/src/lib/sharedExpenseHash.ts` and append (do not modify the existing exports — they stay for v1 verification):

```typescript
// ─── V2 derivation ─────────────────────────────────────────────
// Adds: expense_date, note, receipt_hash, voided_at, voids_id, hash_version=2
// Null fields are serialised as the literal string 'null' so empty != absent.

export interface SharedExpenseHashV2Input {
  id: number;
  familyId: string;
  loggedBy: string;
  totalAmount: number;
  currency: string;
  splitBp: number;
  expenseDate: string | null;
  note: string | null;
  receiptHash: string | null;
  voidedAt: number | null;
  voidsId: number | null;
  previousHash: string;
}

export async function computeSharedExpenseHashV2(input: SharedExpenseHashV2Input): Promise<string> {
  const fields: (string | number)[] = [
    'v2',                      // version tag (defends against downgrade attacks)
    input.id,
    input.familyId,
    input.loggedBy,
    input.totalAmount,
    input.currency,
    input.splitBp,
    input.expenseDate ?? 'null',
    input.note        ?? 'null',
    input.receiptHash ?? 'null',
    input.voidedAt    ?? 'null',
    input.voidsId     ?? 'null',
    input.previousHash,
  ];
  return sha256(fields.join('|'));
}

/**
 * Verifies the record_hash for a row using its stored hash_version.
 * v1 rows use the legacy financial-only derivation; v2 rows use the extended one.
 * Returns true on match.
 */
export async function verifySharedExpenseHash(row: {
  id: number;
  family_id: string;
  logged_by: string;
  total_amount: number;
  currency: string;
  split_bp: number;
  expense_date: string | null;
  note: string | null;
  receipt_hash: string | null;
  voided_at: number | null;
  voids_id: number | null;
  previous_hash: string;
  record_hash: string;
  hash_version: number;
}): Promise<boolean> {
  const expected = row.hash_version >= 2
    ? await computeSharedExpenseHashV2({
        id: row.id,
        familyId: row.family_id,
        loggedBy: row.logged_by,
        totalAmount: row.total_amount,
        currency: row.currency,
        splitBp: row.split_bp,
        expenseDate: row.expense_date,
        note: row.note,
        receiptHash: row.receipt_hash,
        voidedAt: row.voided_at,
        voidsId: row.voids_id,
        previousHash: row.previous_hash,
      })
    : await computeSharedExpenseHash(
        row.id, row.family_id, row.logged_by, row.total_amount,
        row.currency, row.split_bp, row.previous_hash,
      );
  return expected === row.record_hash;
}
```

- [ ] **Step 2: Run tests — all should pass**

Run: `cd worker && npm test -- sharedExpenseHash`
Expected: PASS (5 tests).

- [ ] **Step 3: Type-check**

Run: `cd worker && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add worker/src/lib/sharedExpenseHash.ts worker/src/lib/__tests__/sharedExpenseHash.test.ts
git commit -m "feat(expenses): add v2 hash derivation and version-aware verifier"
```

---

## Phase 5 — Worker route updates: create-expense accepts new fields

### Task 5.1: Extend the POST /api/shared-expenses payload validation

**Files:**
- Modify: `worker/src/routes/sharedExpenses.ts`

- [ ] **Step 1: Update `VALID_CATEGORIES` and accept `expense_date` + `note`**

In [worker/src/routes/sharedExpenses.ts:14-27](worker/src/routes/sharedExpenses.ts#L14-L27), modify `handleCreateSharedExpense`. Replace the existing body destructure and validation block with:

```typescript
  const body = await req.json<{
    description: string;
    category: string;
    total_amount: number;
    split_bp?: number;
    attachment_key?: string;
    expense_date?: string | null;  // 'YYYY-MM-DD' or null
    note?: string | null;
  }>();

  if (!body.description?.trim()) return jsonErr('description required', 400);
  if (!body.category) return jsonErr('category required', 400);
  if (!Number.isInteger(body.total_amount) || body.total_amount <= 0) {
    return jsonErr('total_amount must be a positive integer (pence)', 400);
  }

  const VALID_CATEGORIES = [
    'education', 'health', 'clothing', 'travel', 'activities',
    'childcare', 'food', 'tech', 'gifts', 'other',
  ];
  if (!VALID_CATEGORIES.includes(body.category)) return jsonErr('invalid category', 400);

  // expense_date — allow null/undefined, otherwise require 'YYYY-MM-DD'
  let expenseDate: string | null = null;
  if (body.expense_date !== undefined && body.expense_date !== null) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.expense_date)) {
      return jsonErr('expense_date must be YYYY-MM-DD', 400);
    }
    expenseDate = body.expense_date;
  }

  // note — allow null/undefined; cap length to keep PDF rendering predictable
  let note: string | null = null;
  if (body.note !== undefined && body.note !== null) {
    const trimmed = body.note.trim();
    if (trimmed.length > 1000) return jsonErr('note must be ≤ 1000 characters', 400);
    note = trimmed.length ? trimmed : null;
  }
```

- [ ] **Step 2: Update the INSERT statement and the auto-commit hash call**

Still in `handleCreateSharedExpense`, find the INSERT block and the autoCommit hash branch. Replace:

```typescript
  const insertStmt = env.DB
    .prepare(
      `INSERT INTO shared_expenses
         (family_id, logged_by, description, category, total_amount, currency,
          split_bp, verification_status, attachment_key, previous_hash, record_hash, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      req.auth.family_id,
      req.auth.sub,
      body.description.trim(),
      body.category,
      body.total_amount,
      family.currency,
      splitBp,
      insertStatus,
      body.attachment_key ?? null,
      previousHash,
      recordHash,
      ip(req),
    );

  const result = await insertStmt.run();
  const newId = result.meta.last_row_id as number;

  if (autoCommit) {
    recordHash = await computeSharedExpenseHash(
      newId,
      req.auth.family_id,
      req.auth.sub,
      body.total_amount,
      family.currency,
      splitBp,
      previousHash,
    );
    // Atomic batch: write the hash immediately so concurrent reads never see PENDING for committed rows
    await env.DB.batch([
      env.DB.prepare('UPDATE shared_expenses SET record_hash = ? WHERE id = ?').bind(recordHash, newId),
    ]);
  }
```

with:

```typescript
  const insertStmt = env.DB
    .prepare(
      `INSERT INTO shared_expenses
         (family_id, logged_by, description, category, total_amount, currency,
          split_bp, verification_status, attachment_key, previous_hash, record_hash, ip_address,
          expense_date, note, hash_version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 2)`,
    )
    .bind(
      req.auth.family_id,
      req.auth.sub,
      body.description.trim(),
      body.category,
      body.total_amount,
      family.currency,
      splitBp,
      insertStatus,
      body.attachment_key ?? null,
      previousHash,
      recordHash,
      ip(req),
      expenseDate,
      note,
    );

  const result = await insertStmt.run();
  const newId = result.meta.last_row_id as number;

  if (autoCommit) {
    recordHash = await computeSharedExpenseHashV2({
      id: newId,
      familyId: req.auth.family_id,
      loggedBy: req.auth.sub,
      totalAmount: body.total_amount,
      currency: family.currency,
      splitBp,
      expenseDate,
      note,
      receiptHash: null,         // no receipt yet at create time
      voidedAt: null,
      voidsId: null,
      previousHash,
    });
    await env.DB.batch([
      env.DB.prepare('UPDATE shared_expenses SET record_hash = ? WHERE id = ?').bind(recordHash, newId),
    ]);
  }
```

- [ ] **Step 3: Add the V2 import at the top of the file**

In [worker/src/routes/sharedExpenses.ts:2](worker/src/routes/sharedExpenses.ts#L2), replace:

```typescript
import { computeSharedExpenseHash, getLastCommittedHash, GENESIS_HASH } from '../lib/sharedExpenseHash.js';
```

with:

```typescript
import {
  computeSharedExpenseHash, computeSharedExpenseHashV2,
  getLastCommittedHash, GENESIS_HASH,
} from '../lib/sharedExpenseHash.js';
```

- [ ] **Step 4: Update `handleApproveSharedExpense` to use v2**

Still in the same file, find `handleApproveSharedExpense` (around line 153). After fetching `expense`, also SELECT and use `expense_date`, `note`, `receipt_hash`, `voided_at`, `voids_id`. Replace the SELECT and the hash call:

Find:
```typescript
  const expense = await env.DB
    .prepare('SELECT * FROM shared_expenses WHERE id = ? AND family_id = ?')
    .bind(expenseId, req.auth.family_id)
    .first<{
      id: number; logged_by: string; total_amount: number; currency: string;
      split_bp: number; verification_status: string;
    }>();
```

Replace with:
```typescript
  const expense = await env.DB
    .prepare('SELECT * FROM shared_expenses WHERE id = ? AND family_id = ?')
    .bind(expenseId, req.auth.family_id)
    .first<{
      id: number; logged_by: string; total_amount: number; currency: string;
      split_bp: number; verification_status: string;
      expense_date: string | null; note: string | null;
      receipt_hash: string | null; voided_at: number | null; voids_id: number | null;
      hash_version: number;
    }>();
```

Then find:
```typescript
  const previousHash = await getLastCommittedHash(env.DB, req.auth.family_id);
  const recordHash = await computeSharedExpenseHash(
    expense.id,
    req.auth.family_id,
    expense.logged_by,
    expense.total_amount,
    expense.currency,
    expense.split_bp,
    previousHash,
  );
```

Replace with:
```typescript
  const previousHash = await getLastCommittedHash(env.DB, req.auth.family_id);
  // Approval always finalises under v2 — even if the row was created before the migration,
  // the hash_version column defaults to 1 only on legacy rows. New rows are stamped 2 on insert.
  const recordHash = await computeSharedExpenseHashV2({
    id: expense.id,
    familyId: req.auth.family_id,
    loggedBy: expense.logged_by,
    totalAmount: expense.total_amount,
    currency: expense.currency,
    splitBp: expense.split_bp,
    expenseDate: expense.expense_date,
    note: expense.note,
    receiptHash: expense.receipt_hash,
    voidedAt: expense.voided_at,
    voidsId: expense.voids_id,
    previousHash,
  });
```

And update the UPDATE statement to set `hash_version = 2`:
```typescript
  await env.DB
    .prepare(
      `UPDATE shared_expenses
       SET verification_status = 'committed_manual',
           authorised_by = ?,
           previous_hash = ?,
           record_hash = ?,
           hash_version = 2
       WHERE id = ?`,
    )
    .bind(req.auth.sub, previousHash, recordHash, expense.id)
    .run();
```

- [ ] **Step 5: Type-check**

Run: `cd worker && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add worker/src/routes/sharedExpenses.ts
git commit -m "feat(expenses): accept expense_date + note; use v2 hash derivation"
```

---

## Phase 6 — Receipt upload route

### Task 6.1: Create the receipt route module skeleton

**Files:**
- Create: `worker/src/routes/sharedExpenseReceipt.ts`

- [ ] **Step 1: Create the file**

```typescript
// worker/src/routes/sharedExpenseReceipt.ts
//
// POST   /api/shared-expenses/:id/receipt   Upload bytes → R2 → update row → re-derive hash
// GET    /api/shared-expenses/:id/receipt   Returns presigned URL (1h)
// DELETE /api/shared-expenses/:id/receipt   Allowed only within 48h of upload (any plan)

import { Env } from '../types.js';
import { json as jsonOk, error as jsonErr } from '../lib/response.js';
import { sha256 } from '../lib/hash.js';
import { computeSharedExpenseHashV2 } from '../lib/sharedExpenseHash.js';
import { JwtPayload } from '../lib/jwt.js';

type AuthedRequest = Request & { auth: JwtPayload };

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];
const MAX_BYTES = 10 * 1024 * 1024;
const DELETE_WINDOW_MS = 48 * 60 * 60 * 1000;  // 48 hours

interface ExpenseRow {
  id: number;
  family_id: string;
  logged_by: string;
  total_amount: number;
  currency: string;
  split_bp: number;
  verification_status: string;
  expense_date: string | null;
  note: string | null;
  receipt_r2_key: string | null;
  receipt_hash: string | null;
  receipt_uploaded_at: number | null;
  voided_at: number | null;
  voids_id: number | null;
  previous_hash: string;
  record_hash: string;
  hash_version: number;
}

async function fetchExpense(env: Env, id: string, familyId: string): Promise<ExpenseRow | null> {
  return env.DB
    .prepare('SELECT * FROM shared_expenses WHERE id = ? AND family_id = ?')
    .bind(id, familyId)
    .first<ExpenseRow>();
}
```

- [ ] **Step 2: Add the upload handler**

Append to the same file:

```typescript
// ─────────────────────────────────────────────────────────────────────────────
// POST /api/shared-expenses/:id/receipt
// ─────────────────────────────────────────────────────────────────────────────
export async function handleReceiptUpload(
  req: AuthedRequest,
  env: Env,
  expenseId: string,
): Promise<Response> {
  if (!req.auth) return jsonErr('Unauthorized', 401);

  const contentType = req.headers.get('content-type') ?? '';
  const mime = contentType.split(';')[0].trim().toLowerCase();
  if (!ALLOWED_TYPES.includes(mime)) {
    return jsonErr(`Unsupported file type. Allowed: ${ALLOWED_TYPES.join(', ')}`, 415);
  }

  const expense = await fetchExpense(env, expenseId, req.auth.family_id);
  if (!expense) return jsonErr('expense not found', 404);
  if (expense.voided_at) return jsonErr('cannot attach receipt to a voided expense', 409);

  // Size check
  const cl = parseInt(req.headers.get('content-length') ?? '0', 10);
  if (cl > MAX_BYTES) return jsonErr('File too large (max 10 MB)', 413);
  const bytes = await req.arrayBuffer();
  if (bytes.byteLength > MAX_BYTES) return jsonErr('File too large (max 10 MB)', 413);
  if (bytes.byteLength === 0) return jsonErr('Empty file', 400);

  const uploadedAtMs = Date.now();
  const receiptHash = await sha256BytesHex(bytes);

  const ext = mime === 'image/png'      ? 'png'
            : mime === 'image/webp'     ? 'webp'
            : mime === 'image/heic'     ? 'heic'
            : mime === 'application/pdf' ? 'pdf'
            : 'jpg';
  const r2Key = `${expense.family_id}/${expense.id}/${uploadedAtMs}.${ext}`;

  // Replace existing receipt if any
  if (expense.receipt_r2_key) {
    try { await env.RECEIPTS.delete(expense.receipt_r2_key); } catch { /* non-fatal */ }
  }

  await env.RECEIPTS.put(r2Key, bytes, {
    httpMetadata: { contentType: mime },
    customMetadata: {
      family_id:   expense.family_id,
      expense_id:  String(expense.id),
      uploaded_by: req.auth.sub,
      receipt_hash: receiptHash,
    },
  });

  // Re-derive the row's hash with the new receipt_hash if the row is committed.
  // Pending rows still carry record_hash = 'PENDING' until approval.
  let newRecordHash = expense.record_hash;
  if (
    expense.verification_status === 'committed_auto' ||
    expense.verification_status === 'committed_manual'
  ) {
    newRecordHash = await computeSharedExpenseHashV2({
      id: expense.id,
      familyId: expense.family_id,
      loggedBy: expense.logged_by,
      totalAmount: expense.total_amount,
      currency: expense.currency,
      splitBp: expense.split_bp,
      expenseDate: expense.expense_date,
      note: expense.note,
      receiptHash,
      voidedAt: expense.voided_at,
      voidsId: expense.voids_id,
      previousHash: expense.previous_hash,
    });
  }

  await env.DB
    .prepare(
      `UPDATE shared_expenses
       SET receipt_r2_key = ?, receipt_hash = ?, receipt_uploaded_at = ?,
           record_hash = ?, hash_version = 2
       WHERE id = ?`,
    )
    .bind(r2Key, receiptHash, uploadedAtMs, newRecordHash, expense.id)
    .run();

  return jsonOk({ ok: true, receipt_key: r2Key, receipt_hash: receiptHash }, 201);
}

async function sha256BytesHex(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
```

- [ ] **Step 3: Add the GET (presigned URL) handler**

Append:

```typescript
// ─────────────────────────────────────────────────────────────────────────────
// GET /api/shared-expenses/:id/receipt — returns presigned URL (1h)
// ─────────────────────────────────────────────────────────────────────────────
export async function handleReceiptGet(
  req: AuthedRequest,
  env: Env,
  expenseId: string,
): Promise<Response> {
  if (!req.auth) return jsonErr('Unauthorized', 401);

  const expense = await fetchExpense(env, expenseId, req.auth.family_id);
  if (!expense) return jsonErr('expense not found', 404);
  if (!expense.receipt_r2_key) return jsonOk({ receipt_url: null });

  const obj = await env.RECEIPTS.head(expense.receipt_r2_key);
  if (!obj) {
    return jsonOk({ receipt_url: null, message: 'Receipt object missing in R2', missing: true });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const signedUrl = await (env.RECEIPTS as unknown as any).createSignedUrl(
    expense.receipt_r2_key,
    { expiresIn: 3600 },
  );

  return jsonOk({ receipt_url: signedUrl, expires_in: 3600 });
}
```

- [ ] **Step 4: Add the DELETE handler with 48h gate**

Append:

```typescript
// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/shared-expenses/:id/receipt — allowed within 48h of upload
// After 48h: 409 with payload pointing at the void route.
// ─────────────────────────────────────────────────────────────────────────────
export async function handleReceiptDelete(
  req: AuthedRequest,
  env: Env,
  expenseId: string,
): Promise<Response> {
  if (!req.auth) return jsonErr('Unauthorized', 401);

  const expense = await fetchExpense(env, expenseId, req.auth.family_id);
  if (!expense) return jsonErr('expense not found', 404);
  if (!expense.receipt_r2_key) return jsonErr('no receipt to delete', 404);

  if (expense.receipt_uploaded_at == null) {
    return jsonErr('receipt timestamp missing — please contact support', 500);
  }

  const ageMs = Date.now() - expense.receipt_uploaded_at;
  if (ageMs > DELETE_WINDOW_MS) {
    return new Response(
      JSON.stringify({
        error: 'Receipt is older than 48 hours and cannot be deleted directly.',
        next_action: 'void_and_relog',
        void_endpoint: `/api/shared-expenses/${expense.id}/void`,
      }),
      { status: 409, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Remove from R2 (non-fatal on missing) and re-derive hash
  try { await env.RECEIPTS.delete(expense.receipt_r2_key); } catch { /* non-fatal */ }

  let newRecordHash = expense.record_hash;
  if (
    expense.verification_status === 'committed_auto' ||
    expense.verification_status === 'committed_manual'
  ) {
    newRecordHash = await computeSharedExpenseHashV2({
      id: expense.id,
      familyId: expense.family_id,
      loggedBy: expense.logged_by,
      totalAmount: expense.total_amount,
      currency: expense.currency,
      splitBp: expense.split_bp,
      expenseDate: expense.expense_date,
      note: expense.note,
      receiptHash: null,
      voidedAt: expense.voided_at,
      voidsId: expense.voids_id,
      previousHash: expense.previous_hash,
    });
  }

  await env.DB
    .prepare(
      `UPDATE shared_expenses
       SET receipt_r2_key = NULL, receipt_hash = NULL, receipt_uploaded_at = NULL,
           record_hash = ?, hash_version = 2
       WHERE id = ?`,
    )
    .bind(newRecordHash, expense.id)
    .run();

  return jsonOk({ deleted: true });
}
```

- [ ] **Step 5: Type-check**

Run: `cd worker && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add worker/src/routes/sharedExpenseReceipt.ts
git commit -m "feat(expenses): receipt upload/get/delete routes (48h delete window)"
```

---

### Task 6.2: Wire the receipt routes into the index router

**Files:**
- Modify: `worker/src/index.ts`

- [ ] **Step 1: Add import**

In [worker/src/index.ts:75-76](worker/src/index.ts#L75-L76), after the existing `proof` import, add:

```typescript
import { handleProofUpload, handleProofGet } from './routes/proof.js';
import {
  handleReceiptUpload,
  handleReceiptGet,
  handleReceiptDelete,
} from './routes/sharedExpenseReceipt.js';
```

- [ ] **Step 2: Add route registrations in the parent-only block**

Find the existing shared-expense route block in [worker/src/index.ts:524-534](worker/src/index.ts#L524-L534). Immediately after the `sharedExpRejectMatch` block, insert:

```typescript
  const sharedExpReceiptMatch = path.match(/^\/api\/shared-expenses\/(\d+)\/receipt$/);
  if (sharedExpReceiptMatch && method === 'POST')
    return withAuth(request, auth, env, (req, e) => handleReceiptUpload(req as AuthedRequest, e, sharedExpReceiptMatch[1]));
  if (sharedExpReceiptMatch && method === 'GET')
    return withAuth(request, auth, env, (req, e) => handleReceiptGet(req as AuthedRequest, e, sharedExpReceiptMatch[1]));
  if (sharedExpReceiptMatch && method === 'DELETE')
    return withAuth(request, auth, env, (req, e) => handleReceiptDelete(req as AuthedRequest, e, sharedExpReceiptMatch[1]));
```

(`AuthedRequest` is the same type the existing `withAuth` injection produces — import it locally from `./routes/auth.js` if not already in scope, or use `Request & { auth: JwtPayload }`.)

- [ ] **Step 3: Type-check**

Run: `cd worker && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add worker/src/index.ts
git commit -m "feat(expenses): wire receipt routes into index"
```

---

## Phase 7 — Void-and-Re-log route

### Task 7.1: Create the void route module

**Files:**
- Create: `worker/src/routes/sharedExpenseVoid.ts`

- [ ] **Step 1: Create the file**

```typescript
// worker/src/routes/sharedExpenseVoid.ts
//
// POST /api/shared-expenses/:id/void
// Body: { reason: string, replacement?: { description, category, total_amount, split_bp?, expense_date?, note? } }
//
// Voids the expense; if `replacement` is provided, creates a new row that
// references the voided one via voids_id. Both rows remain in the chain.

import { Env } from '../types.js';
import { json as jsonOk, error as jsonErr, clientIp as ip } from '../lib/response.js';
import {
  computeSharedExpenseHashV2, getLastCommittedHash,
} from '../lib/sharedExpenseHash.js';
import { JwtPayload } from '../lib/jwt.js';

type AuthedRequest = Request & { auth: JwtPayload };

const VALID_CATEGORIES = [
  'education', 'health', 'clothing', 'travel', 'activities',
  'childcare', 'food', 'tech', 'gifts', 'other',
];

interface ReplacementBody {
  description: string;
  category: string;
  total_amount: number;
  split_bp?: number;
  expense_date?: string | null;
  note?: string | null;
}

interface VoidRequestBody {
  reason: string;
  replacement?: ReplacementBody;
}

export async function handleVoidSharedExpense(
  req: AuthedRequest,
  env: Env,
  expenseId: string,
): Promise<Response> {
  if (!req.auth) return jsonErr('Unauthorized', 401);

  const body = await req.json<VoidRequestBody>().catch(() => null);
  if (!body || !body.reason?.trim()) return jsonErr('reason is required', 400);
  if (body.reason.trim().length > 1000) return jsonErr('reason must be ≤ 1000 characters', 400);

  const expense = await env.DB
    .prepare('SELECT * FROM shared_expenses WHERE id = ? AND family_id = ?')
    .bind(expenseId, req.auth.family_id)
    .first<{
      id: number; logged_by: string; total_amount: number; currency: string;
      split_bp: number; verification_status: string;
      expense_date: string | null; note: string | null;
      receipt_hash: string | null; voided_at: number | null;
      voids_id: number | null; previous_hash: string;
    }>();

  if (!expense) return jsonErr('expense not found', 404);
  if (expense.voided_at) return jsonErr('expense is already voided', 409);

  const nowMs = Date.now();

  // ─── Mark the original row as voided. Re-hash to capture voided_at + voided_by signal. ───
  // Note: the original row's previous_hash and chain position do not change; we only update
  // its content fields and record_hash. This keeps the chain intact; the void is part of the seal.
  const newOriginalHash = await computeSharedExpenseHashV2({
    id: expense.id,
    familyId: req.auth.family_id,
    loggedBy: expense.logged_by,
    totalAmount: expense.total_amount,
    currency: expense.currency,
    splitBp: expense.split_bp,
    expenseDate: expense.expense_date,
    note: expense.note,
    receiptHash: expense.receipt_hash,
    voidedAt: nowMs,
    voidsId: expense.voids_id,
    previousHash: expense.previous_hash,
  });

  await env.DB
    .prepare(
      `UPDATE shared_expenses
       SET voided_at = ?, voided_by = ?, record_hash = ?, hash_version = 2
       WHERE id = ?`,
    )
    .bind(nowMs, req.auth.sub, newOriginalHash, expense.id)
    .run();

  // ─── If a replacement is provided, validate and create the new row. ───
  let replacementId: number | null = null;
  if (body.replacement) {
    const r = body.replacement;
    if (!r.description?.trim()) return jsonErr('replacement.description required', 400);
    if (!VALID_CATEGORIES.includes(r.category)) return jsonErr('invalid replacement.category', 400);
    if (!Number.isInteger(r.total_amount) || r.total_amount <= 0) {
      return jsonErr('replacement.total_amount must be a positive integer (pence)', 400);
    }
    const splitBp = r.split_bp ?? expense.split_bp;
    if (!Number.isInteger(splitBp) || splitBp < 0 || splitBp > 10000) {
      return jsonErr('replacement.split_bp must be 0–10000', 400);
    }

    let expenseDate: string | null = null;
    if (r.expense_date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(r.expense_date)) {
        return jsonErr('replacement.expense_date must be YYYY-MM-DD', 400);
      }
      expenseDate = r.expense_date;
    }
    let note: string | null = null;
    if (r.note) {
      const t = r.note.trim();
      if (t.length > 1000) return jsonErr('replacement.note must be ≤ 1000 characters', 400);
      note = t.length ? t : null;
    }

    const previousHash = await getLastCommittedHash(env.DB, req.auth.family_id);
    // Insert the replacement; record_hash is filled below in a follow-up UPDATE
    const insertResult = await env.DB
      .prepare(
        `INSERT INTO shared_expenses
           (family_id, logged_by, description, category, total_amount, currency,
            split_bp, verification_status, previous_hash, record_hash, ip_address,
            expense_date, note, hash_version, voids_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'committed_auto', ?, 'PENDING', ?, ?, ?, 2, ?)`,
      )
      .bind(
        req.auth.family_id, req.auth.sub, r.description.trim(), r.category,
        r.total_amount, expense.currency, splitBp, previousHash, ip(req),
        expenseDate, note, expense.id,
      )
      .run();
    replacementId = insertResult.meta.last_row_id as number;

    const replacementHash = await computeSharedExpenseHashV2({
      id: replacementId,
      familyId: req.auth.family_id,
      loggedBy: req.auth.sub,
      totalAmount: r.total_amount,
      currency: expense.currency,
      splitBp,
      expenseDate,
      note,
      receiptHash: null,
      voidedAt: null,
      voidsId: expense.id,
      previousHash,
    });
    await env.DB
      .prepare('UPDATE shared_expenses SET record_hash = ? WHERE id = ?')
      .bind(replacementHash, replacementId)
      .run();
  }

  return jsonOk({
    voided_id: expense.id,
    replacement_id: replacementId,
    voided_at: nowMs,
  });
}
```

- [ ] **Step 2: Type-check**

Run: `cd worker && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add worker/src/routes/sharedExpenseVoid.ts
git commit -m "feat(expenses): void-and-relog route"
```

---

### Task 7.2: Wire the void route into index

**Files:**
- Modify: `worker/src/index.ts`

- [ ] **Step 1: Add import**

After the receipt import (added in Task 6.2), add:

```typescript
import { handleVoidSharedExpense } from './routes/sharedExpenseVoid.js';
```

- [ ] **Step 2: Register the route**

In the parent-only block, immediately after the receipt route registrations from Task 6.2, add:

```typescript
  const sharedExpVoidMatch = path.match(/^\/api\/shared-expenses\/(\d+)\/void$/);
  if (sharedExpVoidMatch && method === 'POST')
    return withAuth(request, auth, env, (req, e) => handleVoidSharedExpense(req as AuthedRequest, e, sharedExpVoidMatch[1]));
```

- [ ] **Step 3: Type-check**

Run: `cd worker && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add worker/src/index.ts
git commit -m "feat(expenses): wire void route into index"
```

---

## Phase 8 — Court PDF Exhibit section

### Task 8.1: Add `pdf-lib` dependency

**Files:**
- Modify: `worker/package.json`

- [ ] **Step 1: Install pdf-lib**

Run: `cd worker && npm install pdf-lib`
Expected: `+ pdf-lib@1.x.x` (or similar). `package.json` and lockfile updated.

- [ ] **Step 2: Verify it's in dependencies**

Run: `cd worker && grep pdf-lib package.json`
Expected: `"pdf-lib": "^1.x.x"` in `dependencies`.

- [ ] **Step 3: Commit**

```bash
git add worker/package.json worker/package-lock.json
git commit -m "chore(worker): add pdf-lib dependency for PDF receipt embedding"
```

---

### Task 8.2: Create the receipt-embed util

**Files:**
- Create: `worker/src/lib/pdfReceiptEmbed.ts`

- [ ] **Step 1: Create the util**

```typescript
// worker/src/lib/pdfReceiptEmbed.ts
//
// Embeds a list of receipts (image or PDF, fetched from R2) as an Exhibits section
// at the end of an existing PDF. Returns the merged PDF as a Uint8Array.

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { Env } from '../types.js';

export interface ExhibitEntry {
  expense_id: number;
  expense_name: string;            // canonical preset name or description
  expense_date: string | null;     // 'YYYY-MM-DD'
  receipt_r2_key: string;
  receipt_uploaded_at: number;     // unix ms
  voided: boolean;
}

/**
 * Appends an Exhibits section to `basePdfBytes` containing every receipt referenced
 * in `entries`. Image receipts are embedded one per page; PDF receipts are merged
 * page-for-page. Each exhibit gets a caption page with the cross-reference.
 */
export async function embedReceiptsInPdf(
  basePdfBytes: Uint8Array,
  entries: ExhibitEntry[],
  env: Env,
): Promise<Uint8Array> {
  const merged = await PDFDocument.load(basePdfBytes);
  if (entries.length === 0) return await merged.save();

  const font = await merged.embedFont(StandardFonts.Helvetica);
  const fontBold = await merged.embedFont(StandardFonts.HelveticaBold);

  // Section divider
  const divider = merged.addPage();
  const dW = divider.getWidth(); const dH = divider.getHeight();
  divider.drawText('Exhibits', { x: 50, y: dH - 100, size: 36, font: fontBold });
  divider.drawText('Receipts referenced in the financial summary above.', {
    x: 50, y: dH - 140, size: 12, font, color: rgb(0.3, 0.3, 0.3),
  });
  divider.drawText(`Total exhibits: ${entries.length}`, {
    x: 50, y: dH - 160, size: 12, font, color: rgb(0.3, 0.3, 0.3),
  });
  // Suppress unused-var lint without changing the API
  void dW;

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const label = String.fromCharCode(65 + (i % 26)) + (i >= 26 ? Math.floor(i / 26) + 1 : '');
    await appendExhibit(merged, e, label, font, fontBold, env);
  }

  return await merged.save();
}

async function appendExhibit(
  merged: PDFDocument,
  e: ExhibitEntry,
  label: string,
  font: import('pdf-lib').PDFFont,
  fontBold: import('pdf-lib').PDFFont,
  env: Env,
): Promise<void> {
  const obj = await env.RECEIPTS.get(e.receipt_r2_key);
  if (!obj) return; // R2 miss — skip silently

  const bytes = new Uint8Array(await obj.arrayBuffer());
  const mime = obj.httpMetadata?.contentType ?? 'application/octet-stream';

  // Caption header page
  const cap = merged.addPage();
  const cW = cap.getWidth(); const cH = cap.getHeight();
  cap.drawText(`Exhibit ${label}${e.voided ? ' (Voided)' : ''}`, {
    x: 50, y: cH - 80, size: 24, font: fontBold,
  });
  cap.drawText(e.expense_name, { x: 50, y: cH - 110, size: 14, font });
  if (e.expense_date) {
    cap.drawText(`Expense date: ${e.expense_date}`, {
      x: 50, y: cH - 130, size: 11, font, color: rgb(0.3, 0.3, 0.3),
    });
  }
  cap.drawText(`Uploaded: ${new Date(e.receipt_uploaded_at).toISOString()}`, {
    x: 50, y: cH - 145, size: 11, font, color: rgb(0.3, 0.3, 0.3),
  });
  void cW;

  if (mime === 'application/pdf') {
    const src = await PDFDocument.load(bytes);
    const pages = await merged.copyPages(src, src.getPageIndices());
    for (const p of pages) merged.addPage(p);
  } else if (mime === 'image/jpeg' || mime === 'image/png') {
    const img = mime === 'image/png'
      ? await merged.embedPng(bytes)
      : await merged.embedJpg(bytes);
    const page = merged.addPage();
    const pw = page.getWidth(); const ph = page.getHeight();
    const scale = Math.min((pw - 100) / img.width, (ph - 100) / img.height, 1);
    const w = img.width  * scale;
    const h = img.height * scale;
    page.drawImage(img, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
  } else {
    // WebP / HEIC are not directly embeddable by pdf-lib. Show a placeholder.
    const page = merged.addPage();
    const pH = page.getHeight();
    page.drawText('Receipt format not embeddable (download via app to view).', {
      x: 50, y: pH - 100, size: 12, font, color: rgb(0.5, 0.1, 0.1),
    });
  }
}
```

- [ ] **Step 2: Type-check**

Run: `cd worker && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add worker/src/lib/pdfReceiptEmbed.ts
git commit -m "feat(expenses): pdf-lib util to embed receipts as Exhibits"
```

---

### Task 8.3: Wire the embed util into the export route

**Files:**
- Modify: `worker/src/routes/export.ts`

- [ ] **Step 1: Read the current export.ts to find the PDF return point**

Run: `cd worker && grep -n "handleExportPdf\|return new Response\|application/pdf" src/routes/export.ts | head -30`

You're looking for the function `handleExportPdf` and the line where the final PDF bytes are returned. The exact line will vary — read enough context to identify where the existing PDF buffer lives just before the `return`.

- [ ] **Step 2: Inject the receipt-embed step**

After the existing PDF generation produces `pdfBytes` (a `Uint8Array` or similar) and before the `return new Response(pdfBytes, { ... })`, add:

```typescript
  // ─── Append Exhibits section if there are receipts ───
  const exhibitRows = await env.DB
    .prepare(
      `SELECT id, description, expense_date, receipt_r2_key, receipt_uploaded_at, voided_at
       FROM shared_expenses
       WHERE family_id = ?
         AND deleted_at IS NULL
         AND receipt_r2_key IS NOT NULL
       ORDER BY COALESCE(expense_date, '0000-00-00') ASC, id ASC`,
    )
    .bind(familyId)
    .all<{
      id: number; description: string;
      expense_date: string | null;
      receipt_r2_key: string;
      receipt_uploaded_at: number;
      voided_at: number | null;
    }>();

  if (exhibitRows.results.length > 0) {
    const { embedReceiptsInPdf } = await import('../lib/pdfReceiptEmbed.js');
    pdfBytes = await embedReceiptsInPdf(
      pdfBytes,
      exhibitRows.results.map(r => ({
        expense_id:           r.id,
        expense_name:         r.description,
        expense_date:         r.expense_date,
        receipt_r2_key:       r.receipt_r2_key,
        receipt_uploaded_at:  r.receipt_uploaded_at,
        voided:               r.voided_at != null,
      })),
      env,
    );
  }
```

> **Note:** the variable holding the PDF bytes in `handleExportPdf` may be named differently (e.g. `buffer`, `pdfBuf`). Use whatever the local name is. The variable holding the family ID is whatever the existing handler uses (often `familyId` from the query string, sometimes `auth.family_id`). Match the existing style; do not introduce new globals.

- [ ] **Step 3: Type-check**

Run: `cd worker && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add worker/src/routes/export.ts
git commit -m "feat(expenses): embed receipts as Exhibits in court-PDF export"
```

---

## Phase 9 — Frontend API client + UI

### Task 9.1: Add API client methods for the new endpoints

**Files:**
- Modify: `app/src/lib/api.ts`

- [ ] **Step 1: Open the file and locate the existing shared-expense API helpers**

Run: `cd app && grep -n "shared-expenses\|sharedExpense" src/lib/api.ts`

Find the section where existing shared-expense helpers live (e.g. `createSharedExpense`, `listSharedExpenses`).

- [ ] **Step 2: Append new helpers**

Append:

```typescript
// ─── Receipts ────────────────────────────────────────────────────────────────
export async function uploadReceipt(expenseId: number, file: File): Promise<{ receipt_key: string; receipt_hash: string }> {
  const res = await fetch(apiUrl(`/api/shared-expenses/${expenseId}/receipt`), {
    method: 'POST',
    headers: {
      ...authHeaders(),
      'Content-Type': file.type,
    },
    body: file,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(data.error ?? `Upload failed (${res.status})`);
  }
  return res.json();
}

export async function getReceiptUrl(expenseId: number): Promise<{ receipt_url: string | null }> {
  const res = await fetch(apiUrl(`/api/shared-expenses/${expenseId}/receipt`), {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Receipt fetch failed (${res.status})`);
  return res.json();
}

export async function deleteReceipt(expenseId: number): Promise<{ deleted: boolean }> {
  const res = await fetch(apiUrl(`/api/shared-expenses/${expenseId}/receipt`), {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (res.status === 409) {
    const data = await res.json() as { error: string; next_action?: string };
    throw new Error(data.error);
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(data.error ?? `Delete failed (${res.status})`);
  }
  return res.json();
}

// ─── Void-and-Re-log ─────────────────────────────────────────────────────────
export interface VoidReplacement {
  description: string;
  category: string;
  total_amount: number;
  split_bp?: number;
  expense_date?: string | null;
  note?: string | null;
}

export async function voidExpense(
  expenseId: number,
  reason: string,
  replacement?: VoidReplacement,
): Promise<{ voided_id: number; replacement_id: number | null; voided_at: number }> {
  const res = await fetch(apiUrl(`/api/shared-expenses/${expenseId}/void`), {
    method: 'POST',
    headers: authHeaders('application/json'),
    body: JSON.stringify({ reason, replacement }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(data.error ?? `Void failed (${res.status})`);
  }
  return res.json();
}
```

- [ ] **Step 3: Type-check**

Run: `cd app && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add app/src/lib/api.ts
git commit -m "feat(expenses): API client helpers for receipt + void"
```

---

### Task 9.2: Build the `ReceiptPicker` component

**Files:**
- Create: `app/src/components/dashboard/ReceiptPicker.tsx`

- [ ] **Step 1: Create the component**

```tsx
// app/src/components/dashboard/ReceiptPicker.tsx
import { useRef, useState } from 'react';
import { compressImage } from '../../lib/imageCompression';

type Props = {
  file: File | null;
  onChange: (f: File | null) => void;
  disabled?: boolean;
};

export function ReceiptPicker({ file, onChange, disabled }: Props) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handle(picked: File | null) {
    setError(null);
    if (!picked) { onChange(null); return; }
    setBusy(true);
    try {
      const compressed = await compressImage(picked);
      onChange(compressed);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not process image';
      // Helpful HEIC hint
      if (picked.type === 'image/heic' || /heic/i.test(picked.name)) {
        setError('iPhone HEIC photos can\'t always be processed in the browser. Tap "Take photo" instead, or open the photo on your iPhone, tap Share → Save as JPEG.');
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest mb-2">
        Receipt (optional)
      </p>

      {!file ? (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            disabled={disabled || busy}
            className="rounded-2xl border-2 border-[var(--color-border)] bg-[var(--color-surface-alt)] py-3 px-2 text-[12px] font-semibold text-[var(--color-text-muted)] hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)] transition-all disabled:opacity-50"
          >
            📷 Take photo
          </button>
          <button
            type="button"
            onClick={() => galleryRef.current?.click()}
            disabled={disabled || busy}
            className="rounded-2xl border-2 border-[var(--color-border)] bg-[var(--color-surface-alt)] py-3 px-2 text-[12px] font-semibold text-[var(--color-text-muted)] hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)] transition-all disabled:opacity-50"
          >
            📁 Upload from device
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-[var(--brand-primary)] bg-[color-mix(in_srgb,var(--brand-primary)_10%,transparent)] p-3 flex items-center gap-3">
          {file.type.startsWith('image/') ? (
            <img
              src={URL.createObjectURL(file)}
              alt="Receipt preview"
              className="w-14 h-14 rounded-lg object-cover"
            />
          ) : (
            <div className="w-14 h-14 rounded-lg bg-[var(--color-surface)] flex items-center justify-center text-[10px] font-bold text-[var(--brand-primary)]">
              PDF
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-[var(--color-text)] truncate">{file.name}</p>
            <p className="text-[10px] text-[var(--color-text-muted)]">
              {(file.size / 1024).toFixed(0)} KB
            </p>
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            disabled={disabled || busy}
            className="text-[11px] font-semibold text-[var(--brand-primary)] underline"
          >
            Replace
          </button>
        </div>
      )}

      <p className="mt-2 text-[10px] text-[var(--color-text-muted)] italic">
        Receipts strengthen court-ready records on the Shield Plan.
      </p>

      {error && (
        <p className="mt-2 text-[11px] text-red-600">{error}</p>
      )}

      <input
        ref={cameraRef}
        type="file"
        accept="image/jpeg,image/png"
        capture="environment"
        className="hidden"
        onChange={e => handle(e.target.files?.[0] ?? null)}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={e => handle(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `cd app && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/dashboard/ReceiptPicker.tsx
git commit -m "feat(expenses): ReceiptPicker component (Take photo / Upload, with compression)"
```

---

### Task 9.3: Rebuild `AddExpenseSheet`

**Files:**
- Modify: `app/src/components/dashboard/AddExpenseSheet.tsx`

This task replaces the existing component. Read the existing file first ([app/src/components/dashboard/AddExpenseSheet.tsx](app/src/components/dashboard/AddExpenseSheet.tsx)) to understand its props contract, then replace its body.

- [ ] **Step 1: Replace the file contents**

```tsx
// app/src/components/dashboard/AddExpenseSheet.tsx
import { useEffect, useRef, useState } from 'react';
import { apiUrl, authHeaders, uploadReceipt } from '../../lib/api';
import { useAndroidBack } from '../../hooks/useAndroidBack';
import {
  PRESETS,
  getPresetsForRegion,
  fuzzyMatchPreset,
  findPreset,
  ExpensePreset,
  ExpenseCategory,
  ExpenseRegion,
  ExpenseLocale,
} from '../../lib/sharedExpensePresets';
import { ReceiptPicker } from './ReceiptPicker';

type Props = {
  defaultSplitBp: number;
  currency: string;
  parentingMode: 'single' | 'co-parenting';
  region: ExpenseRegion;
  locale: ExpenseLocale;
  onClose: () => void;
  onSaved: () => void;
};

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  education: '📚 Education',
  health: '🏥 Health',
  clothing: '👕 Clothing',
  travel: '✈️ Travel',
  activities: '⚽ Activities',
  childcare: '🧒 Childcare',
  food: '🍎 Food',
  tech: '📱 Tech',
  gifts: '🎁 Gifts',
  other: '📋 Other',
};

export function AddExpenseSheet({
  defaultSplitBp, currency, parentingMode, region, locale, onClose, onSaved,
}: Props) {
  const isCoParenting = parentingMode === 'co-parenting';
  const [selectedPreset, setSelectedPreset] = useState<ExpensePreset | null>(null);
  const [titleInput, setTitleInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [overrideCategory, setOverrideCategory] = useState<ExpenseCategory | null>(null);
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);
  const [amountStr, setAmountStr] = useState('');
  const [expenseDate, setExpenseDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [splitBp, setSplitBp] = useState(isCoParenting ? defaultSplitBp : 10000);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  useAndroidBack(true, onClose);

  // Auto-expand + focus the note when a legally_distinguishable preset is picked.
  useEffect(() => {
    if (selectedPreset?.legally_distinguishable) {
      setShowNote(true);
      setTimeout(() => noteRef.current?.focus(), 100);
    }
  }, [selectedPreset]);

  const regionPresets = getPresetsForRegion(region);
  const top8 = regionPresets.filter(p => p.is_top_8).slice(0, 8);
  const matches = regionPresets.filter(p => fuzzyMatchPreset(p, titleInput));

  const symbol = currency === 'GBP' ? '£' : currency === 'USD' ? '$' : 'zł';
  const totalPence = Math.round(parseFloat(amountStr || '0') * 100);
  const loggedByAmount = Math.round((totalPence * splitBp) / 10000);
  const otherAmount = totalPence - loggedByAmount;

  const effectiveCategory: ExpenseCategory =
    overrideCategory ?? selectedPreset?.category ?? 'other';

  function selectPreset(p: ExpensePreset) {
    setSelectedPreset(p);
    setTitleInput(p.name);
    setOverrideCategory(null);
    setShowSuggestions(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const description = (selectedPreset?.name ?? titleInput).trim();
    if (!description) { setError('Please pick or type an expense.'); return; }
    if (totalPence <= 0) { setError('Please enter a valid amount.'); return; }

    setSaving(true);
    try {
      const res = await fetch(apiUrl('/api/shared-expenses'), {
        method: 'POST',
        headers: authHeaders('application/json'),
        body: JSON.stringify({
          description,
          category: effectiveCategory,
          total_amount: totalPence,
          split_bp: splitBp,
          expense_date: expenseDate,
          note: note.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? 'Failed to save');
      }
      const created = await res.json() as { id: number };
      if (receiptFile) {
        try {
          await uploadReceipt(created.id, receiptFile);
        } catch (uploadErr) {
          // Non-blocking — show a banner via the parent and proceed
          console.error('Receipt upload failed:', uploadErr);
          setError('Expense saved, but receipt upload failed. You can retry from the expense detail.');
        }
      }
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
      <div className="w-full max-w-[560px] bg-[var(--color-surface)] rounded-t-2xl p-6 pb-10 flex flex-col gap-4 max-h-[92svh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Log shared expense</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-[var(--color-text-muted)] text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Quick Pick tile grid */}
        <div>
          <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest mb-2">
            Quick Pick
          </p>
          <div className="grid grid-cols-4 gap-2">
            {top8.map(p => {
              const active = selectedPreset?.id === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => selectPreset(p)}
                  className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl border-2 py-2.5 px-1 text-center transition-all
                    ${active
                      ? 'border-[var(--brand-primary)] bg-[color-mix(in_srgb,var(--brand-primary)_10%,transparent)] text-[var(--brand-primary)]'
                      : 'border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[var(--color-text-muted)] hover:border-[var(--brand-primary)]'}`}
                >
                  <span className="text-lg">{CATEGORY_LABELS[p.category].split(' ')[0]}</span>
                  <span className="text-[9px] font-semibold leading-tight text-center">
                    {p.name.split(' / ')[0]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Search input */}
        <div className="relative">
          <input
            type="text"
            value={titleInput}
            placeholder="Or type an expense name…"
            onChange={e => {
              setTitleInput(e.target.value);
              setShowSuggestions(e.target.value.length > 0);
              setSelectedPreset(null);
            }}
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
          />
          {showSuggestions && titleInput.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-10 mt-1 max-h-48 overflow-y-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg divide-y divide-[var(--color-border)]">
              {matches.length > 0 ? matches.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => selectPreset(p)}
                  className="w-full flex items-center px-3 py-2.5 text-left hover:bg-[var(--color-surface-alt)]"
                >
                  <span className="text-[13px]">{p.name}</span>
                </button>
              )) : (
                <p className="px-3 py-2.5 text-[12px] text-[var(--color-text-muted)]">
                  Custom expense — we&apos;ll log it under &quot;Other&quot;.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Filed under chip */}
        <div className="h-7 flex items-center">
          <button
            type="button"
            onClick={() => setShowCategoryMenu(s => !s)}
            className="text-[11px] px-2.5 py-1 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[var(--color-text-muted)]"
          >
            Filed under: {CATEGORY_LABELS[effectiveCategory]} ✎
          </button>
          {showCategoryMenu && (
            <div className="ml-2 flex flex-wrap gap-1">
              {(Object.keys(CATEGORY_LABELS) as ExpenseCategory[]).map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => { setOverrideCategory(cat); setShowCategoryMenu(false); }}
                  className="text-[10px] px-2 py-0.5 rounded-full border border-[var(--color-border)] hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
                >
                  {CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest block mb-1.5">
                Amount ({symbol})
              </label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                value={amountStr}
                onChange={e => setAmountStr(e.target.value)}
                placeholder="0.00"
                className="w-full border border-[var(--color-border)] rounded-xl px-4 py-3 text-sm bg-[var(--color-surface-raised)] tabular-nums"
                required
              />
            </div>
            <div className="flex-1">
              <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest block mb-1.5">
                Date
              </label>
              <input
                type="date"
                value={expenseDate}
                onChange={e => setExpenseDate(e.target.value)}
                className="w-full border border-[var(--color-border)] rounded-xl px-4 py-3 text-sm bg-[var(--color-surface-raised)]"
                max={new Date().toISOString().slice(0, 10)}
              />
            </div>
          </div>

          {isCoParenting && (
            <div>
              <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
                Your share — {(splitBp / 100).toFixed(0)}%
              </label>
              <input
                type="range"
                min={0} max={10000} step={100}
                value={splitBp}
                onChange={e => setSplitBp(Number(e.target.value))}
                className="w-full mt-2"
              />
              {totalPence > 0 && (
                <div className="flex justify-between text-xs text-[var(--color-text-muted)] mt-1 tabular-nums">
                  <span>You: {symbol}{(loggedByAmount / 100).toFixed(2)}</span>
                  <span>Other parent: {symbol}{(otherAmount / 100).toFixed(2)}</span>
                </div>
              )}
            </div>
          )}

          <ReceiptPicker file={receiptFile} onChange={setReceiptFile} disabled={saving} />

          <div>
            <button
              type="button"
              onClick={() => setShowNote(s => !s)}
              className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--color-text-muted)] hover:text-[var(--brand-primary)]"
            >
              <span className={`inline-block transition-transform ${showNote ? 'rotate-90' : ''}`}>▶</span>
              {showNote ? 'Hide' : 'Add'} note
            </button>
            {showNote && (
              <textarea
                ref={noteRef}
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder={
                  selectedPreset?.legally_distinguishable
                    ? 'e.g. Prescribed gluten-free diet — supplier: Schar'
                    : 'Optional context — invoice number, supplier, etc.'
                }
                rows={3}
                maxLength={1000}
                className="mt-2 w-full border border-[var(--color-border)] rounded-xl px-3 py-2.5 text-[13px] bg-[var(--color-surface)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
              />
            )}
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-[var(--brand-primary)] text-white font-semibold py-3 rounded-xl disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Log expense'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Locate the existing call site for `AddExpenseSheet` and add `region`/`locale` props**

Run: `cd app && grep -rn "AddExpenseSheet" src --include="*.tsx" --include="*.ts"`

For each call site (likely in `PoolTab.tsx` or `ParentDashboard.tsx`), add the missing props. The family record carries region (`families.region`) and locale (`families.locale` or derived from currency). If the parent component doesn't already have these in scope, fetch them from the family API hook used elsewhere in the same file.

If region is unavailable, default to `'UK'` for v1 and add a note in the dashboard component:

```tsx
<AddExpenseSheet
  defaultSplitBp={family?.shared_expense_split_bp ?? 5000}
  currency={family?.currency ?? 'GBP'}
  parentingMode={family?.parenting_mode ?? 'single'}
  region={(family?.region as 'UK' | 'US' | 'PL' | undefined) ?? 'UK'}
  locale={(family?.locale as 'en' | 'en-US' | 'pl' | undefined) ?? 'en'}
  onClose={...}
  onSaved={...}
/>
```

- [ ] **Step 3: Type-check**

Run: `cd app && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Run the dev server and smoke-test**

Run: `cd app && npm run dev`

Open the parent dashboard, tap the **+** button → Log Shared Expense. Verify:
- The 8 Quick Pick tiles render
- Typing "school" filters the suggestions
- Selecting "Therapy / counselling" auto-expands the note section and focuses it
- Picking a "Take photo" / "Upload from device" file shows the preview
- Submitting with no receipt creates the expense (check Network tab for `POST /api/shared-expenses` 201)
- Submitting with a receipt fires `POST /api/shared-expenses/:id/receipt` 201

If any of these fail, fix before commit.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/dashboard/AddExpenseSheet.tsx app/src/components/dashboard/PoolTab.tsx
git commit -m "feat(expenses): rebuild AddExpenseSheet with preset picker, date, receipt, note"
```

(Include any other call-site files modified in step 2.)

---

### Task 9.4: Build the `VoidExpenseSheet` component

**Files:**
- Create: `app/src/components/dashboard/VoidExpenseSheet.tsx`

- [ ] **Step 1: Create the component**

```tsx
// app/src/components/dashboard/VoidExpenseSheet.tsx
import { useState } from 'react';
import { voidExpense, VoidReplacement } from '../../lib/api';
import { useAndroidBack } from '../../hooks/useAndroidBack';

type ExpenseToVoid = {
  id: number;
  description: string;
  category: string;
  total_amount: number;
  split_bp: number;
  expense_date: string | null;
  note: string | null;
};

type Props = {
  expense: ExpenseToVoid;
  currency: string;
  onClose: () => void;
  onVoided: () => void;
};

export function VoidExpenseSheet({ expense, currency, onClose, onVoided }: Props) {
  const [reason, setReason] = useState('');
  const [withReplacement, setWithReplacement] = useState(false);
  const [r, setR] = useState<VoidReplacement>({
    description: expense.description,
    category: expense.category,
    total_amount: expense.total_amount,
    split_bp: expense.split_bp,
    expense_date: expense.expense_date,
    note: expense.note,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const symbol = currency === 'GBP' ? '£' : currency === 'USD' ? '$' : 'zł';

  useAndroidBack(true, onClose);

  async function handleSubmit() {
    setError(null);
    if (!reason.trim()) { setError('Please give a reason.'); return; }
    setSaving(true);
    try {
      await voidExpense(expense.id, reason.trim(), withReplacement ? r : undefined);
      onVoided();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not void expense');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
      <div className="w-full max-w-[560px] bg-[var(--color-surface)] rounded-t-2xl p-6 pb-10 flex flex-col gap-4 max-h-[92svh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Void expense</h2>
          <button onClick={onClose} aria-label="Close" className="text-[var(--color-text-muted)] text-2xl leading-none">×</button>
        </div>

        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-alt)] p-3">
          <p className="text-[12px] font-semibold">{expense.description}</p>
          <p className="text-[11px] text-[var(--color-text-muted)] tabular-nums">
            {symbol}{(expense.total_amount / 100).toFixed(2)} · {expense.expense_date ?? '(no date)'}
          </p>
        </div>

        <div>
          <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide block mb-1">
            Reason for voiding
          </label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="e.g. uploaded the wrong receipt, amount entered incorrectly"
            rows={3}
            maxLength={1000}
            className="w-full border border-[var(--color-border)] rounded-xl px-3 py-2.5 text-[13px] resize-none"
          />
        </div>

        <label className="flex items-center gap-2 text-[12px]">
          <input
            type="checkbox"
            checked={withReplacement}
            onChange={e => setWithReplacement(e.target.checked)}
          />
          Re-log with corrected details
        </label>

        {withReplacement && (
          <div className="flex flex-col gap-3 pl-5 border-l-2 border-[var(--color-border)]">
            <input
              type="text"
              value={r.description}
              onChange={e => setR({ ...r, description: e.target.value })}
              placeholder="Description"
              className="border border-[var(--color-border)] rounded-xl px-3 py-2 text-[13px]"
            />
            <div className="flex gap-2">
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={(r.total_amount / 100).toFixed(2)}
                onChange={e => setR({ ...r, total_amount: Math.round(parseFloat(e.target.value || '0') * 100) })}
                placeholder="Amount"
                className="flex-1 border border-[var(--color-border)] rounded-xl px-3 py-2 text-[13px] tabular-nums"
              />
              <input
                type="date"
                value={r.expense_date ?? ''}
                onChange={e => setR({ ...r, expense_date: e.target.value || null })}
                className="flex-1 border border-[var(--color-border)] rounded-xl px-3 py-2 text-[13px]"
              />
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={saving}
          className="w-full bg-red-600 text-white font-semibold py-3 rounded-xl disabled:opacity-50"
        >
          {saving ? 'Voiding…' : 'Void expense'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `cd app && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/dashboard/VoidExpenseSheet.tsx
git commit -m "feat(expenses): VoidExpenseSheet with optional re-log replacement"
```

---

### Task 9.5: Add Void button + Voided badge to PoolTab

**Files:**
- Modify: `app/src/components/dashboard/PoolTab.tsx`

- [ ] **Step 1: Read PoolTab to find the per-row render**

Run: `cd app && grep -n "shared_expense\|expenses.map\|description" src/components/dashboard/PoolTab.tsx | head -30`

Identify the JSX block that renders each expense row. Each row has at least `description`, `total_amount`, and (after this work) `voided_at`, `voids_id`.

- [ ] **Step 2: Add the badge and Void button**

In the per-row render block, add a "Voided" badge when `expense.voided_at != null`:

```tsx
{expense.voided_at && (
  <span className="ml-2 text-[10px] font-bold text-red-600 uppercase tracking-wider line-through">
    Voided
  </span>
)}
```

Also extend the row to render `expense.description` with a `line-through` style when voided:

```tsx
<p className={`text-[13px] font-semibold ${expense.voided_at ? 'line-through text-[var(--color-text-muted)]' : ''}`}>
  {expense.description}
</p>
```

Add a "Void" action button next to the existing per-row controls (only when `!expense.voided_at`):

```tsx
{!expense.voided_at && (
  <button
    type="button"
    onClick={() => setVoidTarget(expense)}
    className="text-[10px] font-semibold text-red-600 hover:underline"
  >
    Void
  </button>
)}
```

- [ ] **Step 3: Add a `voidTarget` state and render `VoidExpenseSheet`**

At the top of `PoolTab`, add:

```tsx
import { VoidExpenseSheet } from './VoidExpenseSheet';

// in the component body:
const [voidTarget, setVoidTarget] = useState<typeof expenses[number] | null>(null);
```

At the bottom of the JSX (next to where `<AddExpenseSheet>` is conditionally rendered):

```tsx
{voidTarget && (
  <VoidExpenseSheet
    expense={voidTarget}
    currency={currency}
    onClose={() => setVoidTarget(null)}
    onVoided={() => { setVoidTarget(null); refresh(); }}
  />
)}
```

`refresh` here is whatever the existing PoolTab uses to re-fetch expenses (often a `refetch` from a hook — match existing usage).

- [ ] **Step 4: Type-check**

Run: `cd app && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Smoke-test**

Run dev server, log a tiny expense, then void it. Confirm:
- Reason is required (empty submit shows error)
- Voided expense shows the "Voided" badge and strike-through
- "Re-log with corrected details" creates a new row that appears in the list
- Both rows are visible

- [ ] **Step 6: Commit**

```bash
git add app/src/components/dashboard/PoolTab.tsx
git commit -m "feat(expenses): Void button + Voided badge + Re-log integration in PoolTab"
```

---

## Phase 10 — End-to-end verification

### Task 10.1: Run the full test suite

- [ ] **Step 1: Run app tests**

Run: `cd app && npm test`
Expected: all green. New tests for presets and compression should pass alongside the existing suite.

- [ ] **Step 2: Run worker tests**

Run: `cd worker && npm test`
Expected: all green. Hash chain tests should pass.

- [ ] **Step 3: Type-check both packages**

Run: `cd app && npx tsc --noEmit && cd ../worker && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Build for production**

Run: `cd app && npm run build`
Expected: build succeeds. Check the bundle size — `pdf-lib` is worker-side only, but watch for accidental client imports.

- [ ] **Step 5: If anything fails, fix and commit; otherwise proceed.**

---

### Task 10.2: Manual end-to-end test on a real device

- [ ] **Step 1: Deploy to a Cloudflare Pages preview branch**

Create a branch (`feat/shared-expense-presets`), push it, and let Cloudflare Pages auto-deploy. The preview URL is in the GitHub PR check.

- [ ] **Step 2: Test matrix on a real phone**

On an iPhone (Safari):
- [ ] HEIC photo via "Take photo" — should save (may pass through uncompressed)
- [ ] PDF receipt via "Upload from device" — should attach and embed in court PDF
- [ ] Compress + upload a screenshot

On Android Chrome:
- [ ] JPEG photo via "Take photo" — should compress
- [ ] WebP photo via "Upload from device" — should compress
- [ ] PDF receipt — should attach

For all:
- [ ] Confirm the new "Filed under" chip is correct
- [ ] Confirm legally-distinguishable presets auto-focus the note
- [ ] Trigger a 48h+ delete attempt (manually backdate `receipt_uploaded_at` in D1 for one row) — confirm 409 with `next_action: 'void_and_relog'`

- [ ] **Step 3: Court PDF spot check**

Log 3 expenses with receipts (one PDF, two images), then call `GET /api/export/pdf?family_id=…`. Confirm:
- Financial summary is unchanged
- Exhibit section appears at the end
- Each exhibit has a caption page + the actual receipt
- Voided expenses appear in the summary with strike-through
- PDF receipt is rendered as actual pages, not a placeholder

- [ ] **Step 4: Open a PR**

Push final commits. Title: `feat(expenses): preset library + receipt upload + court-PDF exhibits`.

In the PR description, link the spec and the plan, and call out the four user-visible changes:
1. Tap-and-go preset picker (65 items)
2. Date and Note fields
3. Receipt upload with compression
4. Void-and-Re-log workflow

---

## Self-Review Notes

**Spec coverage check:** Every section of the spec maps to at least one task —
- §5 catalogue → Task 1.1, 1.2, 1.3
- §5.1 search aliases → embedded in Task 1.3 catalogue
- §6.1 static catalogue file → Task 1.1
- §6.2 schema → Task 3.2
- §6.3 hash v2 → Task 4.1, 4.2
- §6.4 worker routes (receipt upload + void) → Task 6.1, 6.2, 7.1, 7.2
- §6.5 client compression → Task 2.1, 2.2
- §6.6 UI → Task 9.2, 9.3
- §6.7 court-PDF exhibits → Task 8.1, 8.2, 8.3
- §6.8 submit flow → Task 9.3 (`handleSubmit`)
- 48h delete window → Task 6.1 step 4
- Voided badge in PoolTab → Task 9.5
- HEIC fallback message → Task 9.2 in `ReceiptPicker`
- Legally-distinguishable autofocus → Task 9.3 useEffect

**Type consistency check:** `computeSharedExpenseHashV2` signature consistent across Tasks 4.2, 5.1, 6.1, 7.1. `ExpensePreset.id` is a string everywhere. `voidExpense` API client returns `{ voided_id, replacement_id, voided_at }` matching the worker handler in Task 7.1.

**Out-of-scope items not in this plan:** retrofitting `compressImage` to chore proofs (separate follow-up), worker memory budget for very large exports (decide during implementation if it bites), PDF export memory profiling.
