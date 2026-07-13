import { describe, it, expect } from 'vitest';
import { dedupeIncomingSentryEvent } from './supportAgentIngest.js';

describe('dedupeIncomingSentryEvent', () => {
  it('classifies as new when no open incident exists for this issue id', () => {
    expect(dedupeIncomingSentryEvent({ existingOpenIncidentId: null })).toBe('new');
  });

  it('classifies as duplicate when an open incident already exists for this issue id', () => {
    expect(dedupeIncomingSentryEvent({ existingOpenIncidentId: 'inc_abc' })).toBe('duplicate');
  });
});
