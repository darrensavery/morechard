import { describe, it, expect } from 'vitest';
import { extractPlaybookSection } from './processIncident.js';

const SAMPLE_BUNDLE = [
  '# 01 Accounts',
  'Body text for accounts.',
  '',
  '# 06 Billing',
  'Body text for billing.',
].join('\n');

describe('extractPlaybookSection', () => {
  it('returns the matching top-level section by slug prefix', () => {
    const section = extractPlaybookSection(SAMPLE_BUNDLE, '06-billing-payments-stripe');
    expect(section).toContain('# 06 Billing');
    expect(section).toContain('Body text for billing.');
    expect(section).not.toContain('Body text for accounts.');
  });

  it('returns a "no matching section" marker for an unknown/novel category', () => {
    const section = extractPlaybookSection(SAMPLE_BUNDLE, 'novel');
    expect(section).toBe('(no matching playbook section — novel incident)');
  });
});
