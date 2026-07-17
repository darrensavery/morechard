import { describe, it, expect } from 'vitest';
import { computePollWindow, isVendorArtifactTicket } from './zohoPoll.js';

describe('isVendorArtifactTicket', () => {
  it('flags tickets from the Zoho Desk vendor onboarding sender', () => {
    expect(isVendorArtifactTicket({
      id: '1', subject: 'Welcome to Zoho Desk', description: '', contactEmail: 'support@zohosupport.com',
    })).toBe(true);
  });

  it('is case-insensitive on the domain', () => {
    expect(isVendorArtifactTicket({
      id: '1', subject: 'Welcome', description: '', contactEmail: 'support@ZohoSupport.com',
    })).toBe(true);
  });

  it('does not flag real customer tickets', () => {
    expect(isVendorArtifactTicket({
      id: '2', subject: "Can't mark chore done", description: '', contactEmail: 'parent@example.com',
    })).toBe(false);
  });

  it('does not flag tickets with no contact email', () => {
    expect(isVendorArtifactTicket({
      id: '3', subject: 'No email', description: '', contactEmail: null,
    })).toBe(false);
  });
});

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
