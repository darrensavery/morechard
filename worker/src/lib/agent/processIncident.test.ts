import { describe, it, expect } from 'vitest';
import { extractPlaybookSection, isOneTapEligible } from './processIncident.js';

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

const ELIGIBLE_INPUT = {
  recommendedTool: 'resend_magic_link',
  queueBucket: 'recommended_approve' as const,
  resolvedEmail: 'parent@example.com',
  harassmentSignalTripped: false,
};

describe('isOneTapEligible', () => {
  it('is eligible when all four conditions hold', () => {
    expect(isOneTapEligible(ELIGIBLE_INPUT)).toBe(true);
  });

  it('is not eligible for any tool other than resend_magic_link', () => {
    expect(isOneTapEligible({ ...ELIGIBLE_INPUT, recommendedTool: 'issue_refund' })).toBe(false);
  });

  it('is not eligible outside the recommended_approve queue bucket', () => {
    expect(isOneTapEligible({ ...ELIGIBLE_INPUT, queueBucket: 'needs_review' })).toBe(false);
  });

  it('is not eligible without a resolved identity', () => {
    expect(isOneTapEligible({ ...ELIGIBLE_INPUT, resolvedEmail: null })).toBe(false);
  });

  it('is not eligible when the harassment signal is tripped', () => {
    expect(isOneTapEligible({ ...ELIGIBLE_INPUT, harassmentSignalTripped: true })).toBe(false);
  });
});
