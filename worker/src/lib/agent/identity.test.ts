import { describe, it, expect } from 'vitest';
import { normalizeEmailCandidate } from './identity.js';

describe('normalizeEmailCandidate', () => {
  it('lowercases the email', () => {
    expect(normalizeEmailCandidate('User@Example.com')).toBe('user@example.com');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeEmailCandidate('  user@example.com  ')).toBe('user@example.com');
  });

  it('trims and lowercases together', () => {
    expect(normalizeEmailCandidate('  User@EXAMPLE.com ')).toBe('user@example.com');
  });

  it('does not fuzzy-correct a typo\'d domain', () => {
    // A near-miss must stay a near-miss — resolveFamilyIdentity's exact-match
    // query is what fails it closed, not this normalizer "helpfully" fixing it.
    expect(normalizeEmailCandidate('user@examples.com')).toBe('user@examples.com');
  });
});
