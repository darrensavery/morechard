import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('@sentry/cloudflare', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

import { runTrialSummaryEmail, formatSummaryAmount } from './trialSummaryEmail.js';
import type { Env } from '../types.js';

describe('formatSummaryAmount', () => {
  it('formats GBP with a £ symbol', () => {
    expect(formatSummaryAmount(4499, 'GBP')).toBe('£44.99');
  });
  it('formats USD with a $ symbol', () => {
    expect(formatSummaryAmount(4499, 'USD')).toBe('$44.99');
  });
  it('formats PLN with a zł symbol', () => {
    expect(formatSummaryAmount(4499, 'PLN')).toBe('zł44.99');
  });
});

interface FamilyFixture {
  id:               string;
  name:             string;
  currency:         string;
  lead_email:       string | null;
  lead_name:        string | null;
  completedChores:  number;
  totalEarnedPence: number;
  childCount:       number;
}

interface DbCall { sql: string; args: unknown[] }

function makeMockDb(families: FamilyFixture[]) {
  const calls: DbCall[] = [];
  const byId = new Map(families.map(f => [f.id, f]));

  const db = {
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            async all<T>() {
              if (sql.includes('FROM families f')) {
                return { results: families.map(f => ({
                  id: f.id, name: f.name, currency: f.currency,
                  lead_email: f.lead_email, lead_name: f.lead_name,
                })) as unknown as T[] };
              }
              return { results: [] as unknown as T[] };
            },
            async first<T>(): Promise<T | null> {
              const familyId = args[0] as string;
              const fixture = byId.get(familyId);
              if (sql.includes("FROM completions")) {
                return { cnt: fixture?.completedChores ?? 0 } as T;
              }
              if (sql.includes('FROM ledger')) {
                return { total: fixture?.totalEarnedPence ?? 0 } as T;
              }
              if (sql.includes("FROM family_roles WHERE family_id")) {
                return { cnt: fixture?.childCount ?? 0 } as T;
              }
              return null as T;
            },
            async run() {
              calls.push({ sql, args });
              return { success: true, meta: { changes: 1 } };
            },
          };
        },
      };
    },
  } as unknown as D1Database;

  return { db, calls };
}

function makeEnv(db: D1Database): Env {
  return {
    DB: db,
    APP_URL: 'https://app.morechard.com',
    ENVIRONMENT: 'development', // EmailService logs instead of calling Resend
  } as unknown as Env;
}

describe('runTrialSummaryEmail', () => {
  afterEach(() => vi.restoreAllMocks());

  it('sends the summary and marks trial_summary_sent_at for an active family', async () => {
    const family: FamilyFixture = {
      id: 'fam1', name: 'Test Family', currency: 'GBP',
      lead_email: 'lead@example.com', lead_name: 'Sam',
      completedChores: 5, totalEarnedPence: 1200, childCount: 2,
    };
    const { db, calls } = makeMockDb([family]);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await runTrialSummaryEmail(makeEnv(db));

    expect(logSpy).toHaveBeenCalledWith(
      '[EmailService] transactional stub',
      expect.objectContaining({ to: 'lead@example.com' }),
    );

    const updateCall = calls.find(c => c.sql.includes('UPDATE families SET trial_summary_sent_at'));
    expect(updateCall).toBeDefined();
    expect(updateCall!.args[1]).toBe('fam1');
  });

  it('does not send or mark when completed chores are below the meaningful-activity threshold', async () => {
    const family: FamilyFixture = {
      id: 'fam2', name: 'Quiet Family', currency: 'GBP',
      lead_email: 'quiet@example.com', lead_name: 'Alex',
      completedChores: 2, totalEarnedPence: 500, childCount: 1,
    };
    const { db, calls } = makeMockDb([family]);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await runTrialSummaryEmail(makeEnv(db));

    expect(logSpy).not.toHaveBeenCalled();
    expect(calls.find(c => c.sql.includes('UPDATE families'))).toBeUndefined();
  });

  it('skips a family with no lead-parent email on record', async () => {
    const family: FamilyFixture = {
      id: 'fam3', name: 'No Email Family', currency: 'GBP',
      lead_email: null, lead_name: 'Jo',
      completedChores: 10, totalEarnedPence: 2000, childCount: 1,
    };
    const { db, calls } = makeMockDb([family]);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await runTrialSummaryEmail(makeEnv(db));

    expect(logSpy).not.toHaveBeenCalled();
    expect(calls.find(c => c.sql.includes('UPDATE families'))).toBeUndefined();
  });

  it('continues processing remaining families when one fails', async () => {
    const good: FamilyFixture = {
      id: 'fam-good', name: 'Good Family', currency: 'GBP',
      lead_email: 'good@example.com', lead_name: 'Robin',
      completedChores: 4, totalEarnedPence: 800, childCount: 1,
    };
    const bad: FamilyFixture = {
      id: 'fam-bad', name: 'Bad Family', currency: 'GBP',
      lead_email: 'bad@example.com', lead_name: 'Charlie',
      completedChores: 4, totalEarnedPence: 800, childCount: 1,
    };
    const { db, calls } = makeMockDb([bad, good]);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Force the first family's stats lookup to throw, simulating a transient D1 error.
    const originalPrepare = db.prepare.bind(db);
    let choreQueryCount = 0;
    vi.spyOn(db, 'prepare').mockImplementation((sql: string) => {
      if (sql.includes('FROM completions')) {
        choreQueryCount++;
        if (choreQueryCount === 1) {
          return {
            bind: () => ({ first: async () => { throw new Error('transient D1 error'); } }),
          } as unknown as ReturnType<D1Database['prepare']>;
        }
      }
      return originalPrepare(sql);
    });

    await runTrialSummaryEmail(makeEnv(db));

    expect(errSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(
      '[EmailService] transactional stub',
      expect.objectContaining({ to: 'good@example.com' }),
    );
    expect(calls.find(c => c.sql.includes('UPDATE families') && c.args[1] === 'fam-good')).toBeDefined();
    expect(calls.find(c => c.sql.includes('UPDATE families') && c.args[1] === 'fam-bad')).toBeUndefined();
  });
});
