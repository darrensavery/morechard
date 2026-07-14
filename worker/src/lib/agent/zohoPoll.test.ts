import { describe, it, expect } from 'vitest';
import { computePollWindow } from './zohoPoll.js';

describe('computePollWindow', () => {
  it('starts the window 10 minutes before now when there is no prior cursor', () => {
    const { sinceIso, toIso } = computePollWindow(null, '2026-07-14T12:00:00.000Z');
    expect(sinceIso).toBe('2026-07-14T11:50:00.000Z');
    expect(toIso).toBe('2026-07-14T12:00:00.000Z');
  });

  it('starts the window 2 minutes before the prior cursor (overlap for clock skew / jitter)', () => {
    const { sinceIso, toIso } = computePollWindow('2026-07-14T11:55:00.000Z', '2026-07-14T12:00:00.000Z');
    expect(sinceIso).toBe('2026-07-14T11:53:00.000Z');
    expect(toIso).toBe('2026-07-14T12:00:00.000Z');
  });
});
