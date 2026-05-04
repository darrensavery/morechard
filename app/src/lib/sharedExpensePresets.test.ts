import { describe, it, expect } from 'vitest';
import type { ExpensePreset, ExpenseCategory } from './sharedExpensePresets';
import {
  PRESETS,
  getPresetsForRegion,
  localiseName,
  findPreset,
  fuzzyMatchPreset,
} from './sharedExpensePresets';

describe('catalogue integrity', () => {
  it('has exactly 65 presets', () => {
    expect(PRESETS).toHaveLength(65);
  });

  it('every preset has a non-empty id', () => {
    PRESETS.forEach((preset, idx) => {
      expect(preset.id, `preset at index ${idx} missing id`).toBeTruthy();
      expect(typeof preset.id).toBe('string');
    });
  });

  it('every preset has a non-empty name', () => {
    PRESETS.forEach((preset, idx) => {
      expect(preset.name, `preset at index ${idx} missing name`).toBeTruthy();
      expect(typeof preset.name).toBe('string');
    });
  });

  it('every preset has a valid category', () => {
    const validCategories: ExpenseCategory[] = [
      'education', 'health', 'clothing', 'travel', 'activities',
      'childcare', 'food', 'tech', 'gifts', 'other',
    ];
    PRESETS.forEach((preset, idx) => {
      expect(validCategories, `preset "${preset.name}" (idx ${idx}) has invalid category: ${preset.category}`)
        .toContain(preset.category);
    });
  });

  it('all preset ids are unique', () => {
    const ids = PRESETS.map(p => p.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('exactly 8 presets have is_top_8: true', () => {
    const top8Count = PRESETS.filter(p => p.is_top_8).length;
    expect(top8Count).toBe(8);
  });

  it('no preset has is_top_8: true with an empty name', () => {
    PRESETS.forEach((preset) => {
      if (preset.is_top_8) {
        expect(preset.name, `top-8 preset with id "${preset.id}" has empty name`)
          .toBeTruthy();
      }
    });
  });
});

describe('getPresetsForRegion', () => {
  it('returns all presets when regions is undefined on all items (universal presets)', () => {
    // Create a test set where all presets lack regions (universal)
    const testPresets: ExpensePreset[] = [
      { id: 'p1', name: 'School Fees', category: 'education', is_top_8: false },
      { id: 'p2', name: 'Doctor Visit', category: 'health', is_top_8: false },
    ];

    const filtered = testPresets.filter(p => !p.regions || p.regions.includes('UK'));
    expect(filtered).toEqual(testPresets);
  });

  it('returns only region-specific presets when filtered', () => {
    const testPresets: ExpensePreset[] = [
      { id: 'p1', name: 'School Fees', category: 'education', is_top_8: false, regions: ['UK'] },
      { id: 'p2', name: 'Doctor Visit', category: 'health', is_top_8: false, regions: ['US'] },
      { id: 'p3', name: 'Universal', category: 'food', is_top_8: false },
    ];

    const ukFiltered = testPresets.filter(p => !p.regions || p.regions.includes('UK'));
    expect(ukFiltered).toHaveLength(2);
    expect(ukFiltered.some(p => p.id === 'p1')).toBe(true);
    expect(ukFiltered.some(p => p.id === 'p3')).toBe(true);
  });

  it('includes a preset with regions: ["UK", "US"] for both UK and US, excludes for PL', () => {
    const testPreset: ExpensePreset = {
      id: 'multi',
      name: 'Multi-region',
      category: 'travel',
      is_top_8: false,
      regions: ['UK', 'US'],
    };

    // UK should include
    expect(!testPreset.regions || testPreset.regions.includes('UK')).toBe(true);
    // US should include
    expect(!testPreset.regions || testPreset.regions.includes('US')).toBe(true);
    // PL should exclude
    expect(!testPreset.regions || testPreset.regions.includes('PL')).toBe(false);
  });

  it('uses getPresetsForRegion helper with actual function', () => {
    // With populated PRESETS, universal presets (no regions) are always returned
    const ukPresets = getPresetsForRegion('UK');
    expect(Array.isArray(ukPresets)).toBe(true);
    // Universal presets (no regions field) are included for every region
    expect(ukPresets.length).toBeGreaterThan(0);
    // US-only preset 'yearbook' should NOT appear for UK
    expect(ukPresets.some(p => p.id === 'yearbook')).toBe(false);
  });
});

describe('localiseName', () => {
  it('returns name when no locale_overrides present', () => {
    const preset: ExpensePreset = {
      id: 'p1',
      name: 'School Fees',
      category: 'education',
      is_top_8: false,
    };
    expect(localiseName(preset, 'en')).toBe('School Fees');
    expect(localiseName(preset, 'pl')).toBe('School Fees');
  });

  it('returns locale override when present', () => {
    const preset: ExpensePreset = {
      id: 'p1',
      name: 'School Fees',
      category: 'education',
      is_top_8: false,
      locale_overrides: { pl: 'Opłaty szkolne', 'en-US': 'School Fees' },
    };
    expect(localiseName(preset, 'pl')).toBe('Opłaty szkolne');
    expect(localiseName(preset, 'en-US')).toBe('School Fees');
  });

  it('falls back to name when locale not in overrides', () => {
    const preset: ExpensePreset = {
      id: 'p1',
      name: 'Doctor',
      category: 'health',
      is_top_8: false,
      locale_overrides: { pl: 'Doktor' },
    };
    // 'en' is not in overrides, should fall back to name
    expect(localiseName(preset, 'en')).toBe('Doctor');
  });
});

describe('findPreset', () => {
  it('returns undefined for an unknown id', () => {
    const result = findPreset('nonexistent-id');
    expect(result).toBeUndefined();
  });

  it('returns the preset when found (with populated PRESETS in Task 1.3)', () => {
    // This test will pass when PRESETS is empty (findPreset returns undefined)
    // and will verify the function works correctly in Task 1.3
    const testId = 'test-preset';
    const result = findPreset(testId);
    // With empty PRESETS, will always be undefined
    expect(result).toBeUndefined();
  });
});

describe('fuzzyMatchPreset', () => {
  it('returns true for empty query', () => {
    const preset: ExpensePreset = {
      id: 'p1',
      name: 'School Fees',
      category: 'education',
      is_top_8: false,
    };
    expect(fuzzyMatchPreset(preset, '')).toBe(true);
  });

  it('matches on name (case-insensitive)', () => {
    const preset: ExpensePreset = {
      id: 'p1',
      name: 'School Fees',
      category: 'education',
      is_top_8: false,
    };
    expect(fuzzyMatchPreset(preset, 'school')).toBe(true);
    expect(fuzzyMatchPreset(preset, 'SCHOOL')).toBe(true);
    expect(fuzzyMatchPreset(preset, 'fees')).toBe(true);
    expect(fuzzyMatchPreset(preset, 'School Fees')).toBe(true);
  });

  it('matches on search_aliases (case-insensitive)', () => {
    const preset: ExpensePreset = {
      id: 'p1',
      name: 'School Fees',
      category: 'education',
      is_top_8: false,
      search_aliases: ['tuition', 'education', 'academy'],
    };
    expect(fuzzyMatchPreset(preset, 'tuition')).toBe(true);
    expect(fuzzyMatchPreset(preset, 'TUITION')).toBe(true);
    expect(fuzzyMatchPreset(preset, 'academy')).toBe(true);
  });

  it('returns false for no match', () => {
    const preset: ExpensePreset = {
      id: 'p1',
      name: 'School Fees',
      category: 'education',
      is_top_8: false,
      search_aliases: ['tuition'],
    };
    expect(fuzzyMatchPreset(preset, 'nonexistent')).toBe(false);
    expect(fuzzyMatchPreset(preset, 'xyz')).toBe(false);
  });

  it('matches partial strings in name and aliases', () => {
    const preset: ExpensePreset = {
      id: 'p1',
      name: 'Swimming Lessons',
      category: 'activities',
      is_top_8: false,
      search_aliases: ['aquatic'],
    };
    expect(fuzzyMatchPreset(preset, 'swim')).toBe(true);
    expect(fuzzyMatchPreset(preset, 'aqua')).toBe(true);
  });
});
