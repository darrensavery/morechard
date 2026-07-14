import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildZohoSearchUrl, parseZohoSearchResponse, buildZohoCreateTicketBody, searchZohoTicketsModifiedBetween, getZohoTicketContactEmail, postZohoTicketReply } from './zoho.js';

const fakeEnv = {
  ZOHO_API_DOMAIN: 'https://desk.zoho.com',
  ZOHO_DEPARTMENT_ID: '1892000000006907',
} as never;

describe('buildZohoSearchUrl', () => {
  it('builds a search URL with the modifiedTimeRange, sortBy, from, and limit params', () => {
    const url = buildZohoSearchUrl(fakeEnv, '2026-07-14T00:00:00.000Z', '2026-07-14T00:05:00.000Z', 0, 100);
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe('https://desk.zoho.com/api/v1/tickets/search');
    expect(parsed.searchParams.get('modifiedTimeRange')).toBe('2026-07-14T00:00:00.000Z,2026-07-14T00:05:00.000Z');
    expect(parsed.searchParams.get('sortBy')).toBe('modifiedTime');
    expect(parsed.searchParams.get('from')).toBe('0');
    expect(parsed.searchParams.get('limit')).toBe('100');
  });
});

describe('parseZohoSearchResponse', () => {
  it('extracts id, subject, description, and contact email from each ticket', () => {
    const body = {
      data: [
        {
          id: '31138000011969204',
          subject: 'Cannot log in',
          description: '<div>Locked out since yesterday</div>',
          contact: { email: 'parent@example.com' },
        },
      ],
    };
    const result = parseZohoSearchResponse(body);
    expect(result).toEqual([
      { id: '31138000011969204', subject: 'Cannot log in', description: '<div>Locked out since yesterday</div>', contactEmail: 'parent@example.com' },
    ]);
  });

  it('returns an empty array when data is missing', () => {
    expect(parseZohoSearchResponse({})).toEqual([]);
  });

  it('sets contactEmail to null when the contact object is absent', () => {
    const body = { data: [{ id: '1', subject: 'x', description: 'y' }] };
    expect(parseZohoSearchResponse(body)).toEqual([
      { id: '1', subject: 'x', description: 'y', contactEmail: null },
    ]);
  });
});

describe('searchZohoTicketsModifiedBetween', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns an empty array (not a throw) when Zoho responds 204 No Content with an empty body', async () => {
    // Zoho's real behavior for a zero-match search — confirmed via live
    // reproduction against production: HTTP 204 with an empty body, NOT
    // 200 with {"data": []}. Calling res.json() on this response throws
    // "Unexpected end of JSON input", which silently crashed every poll
    // in production until this fix (the crash happened before the KV
    // cursor write, so it was invisible without a live API reproduction).
    const fetchMock = vi.fn()
      // 1st call: OAuth token refresh
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'fake-token', expires_in: 3600 }),
      })
      // 2nd call: ticket search, zero matches
      .mockResolvedValueOnce({
        ok: true,
        status: 204,
        text: async () => '',
      });
    vi.stubGlobal('fetch', fetchMock);

    const env = {
      CACHE: { get: async () => null, put: async () => undefined },
      ZOHO_ACCOUNTS_DOMAIN: 'https://accounts.zoho.eu',
      ZOHO_API_DOMAIN: 'https://desk.zoho.eu',
      ZOHO_CLIENT_ID: 'x', ZOHO_CLIENT_SECRET: 'x', ZOHO_REFRESH_TOKEN: 'x', ZOHO_ORG_ID: 'x',
    } as never;

    const result = await searchZohoTicketsModifiedBetween(env, '2026-07-14T00:00:00.000Z', '2026-07-14T00:05:00.000Z');
    expect(result).toEqual([]);
  });
});

describe('getZohoTicketContactEmail', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const baseEnv = {
    CACHE: { get: async () => 'fake-token', put: async () => undefined },
    ZOHO_ACCOUNTS_DOMAIN: 'https://accounts.zoho.eu',
    ZOHO_API_DOMAIN: 'https://desk.zoho.eu',
    ZOHO_ORG_ID: 'x',
  } as never;

  it('returns the top-level email field when present', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ email: 'parent@example.com' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const email = await getZohoTicketContactEmail(baseEnv, '31138000011969204');
    expect(email).toBe('parent@example.com');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://desk.zoho.eu/api/v1/tickets/31138000011969204',
      expect.objectContaining({ headers: expect.objectContaining({ orgId: 'x' }) }),
    );
  });

  it('falls back to the nested contact.email field', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ contact: { email: 'parent@example.com' } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    expect(await getZohoTicketContactEmail(baseEnv, '1')).toBe('parent@example.com');
  });

  it('returns null when no email is present anywhere', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);

    expect(await getZohoTicketContactEmail(baseEnv, '1')).toBeNull();
  });

  it('throws with the response body when the fetch fails', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: false, status: 404, text: async () => 'not found' });
    vi.stubGlobal('fetch', fetchMock);

    await expect(getZohoTicketContactEmail(baseEnv, '1')).rejects.toThrow('Zoho ticket fetch failed (404): not found');
  });
});

describe('postZohoTicketReply', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const baseEnv = {
    CACHE: { get: async () => 'fake-token', put: async () => undefined },
    ZOHO_ACCOUNTS_DOMAIN: 'https://accounts.zoho.eu',
    ZOHO_API_DOMAIN: 'https://desk.zoho.eu',
    ZOHO_ORG_ID: 'x',
    ZOHO_FROM_EMAIL: 'support@morechard.com',
  } as never;

  it('fetches the contact email then posts sendReply with the html content', async () => {
    const fetchMock = vi.fn()
      // ticket fetch (for contact email)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ email: 'parent@example.com' }) })
      // sendReply
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);

    const result = await postZohoTicketReply(baseEnv, '31138000011969204', '<p>Hi</p>');
    expect(result).toEqual({ ok: true });

    const sendReplyCall = fetchMock.mock.calls[1];
    expect(sendReplyCall[0]).toBe('https://desk.zoho.eu/api/v1/tickets/31138000011969204/sendReply');
    const body = JSON.parse(sendReplyCall[1].body);
    expect(body).toEqual({
      fromEmailAddress: 'support@morechard.com',
      to: 'parent@example.com',
      content: '<p>Hi</p>',
      contentType: 'html',
      channel: 'EMAIL',
    });
  });

  it('returns an error result (does not throw) when no contact email can be found', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);

    const result = await postZohoTicketReply(baseEnv, '1', '<p>Hi</p>');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/email address/);
  });

  it('returns an error result when the sendReply call fails', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ email: 'parent@example.com' }) })
      .mockResolvedValueOnce({ ok: false, status: 422, text: async () => 'invalid fromEmailAddress' });
    vi.stubGlobal('fetch', fetchMock);

    const result = await postZohoTicketReply(baseEnv, '1', '<p>Hi</p>');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('invalid fromEmailAddress');
  });
});

describe('buildZohoCreateTicketBody', () => {
  it('builds a create-ticket body using the department id from env and a contact email object', () => {
    const body = buildZohoCreateTicketBody(fakeEnv, {
      subject: 'Support request from app',
      description: 'Cannot see my goals',
      email: 'parent@example.com',
      lastName: 'Savery',
    });
    expect(body).toEqual({
      subject: 'Support request from app',
      description: 'Cannot see my goals',
      departmentId: '1892000000006907',
      status: 'Open',
      contact: { email: 'parent@example.com', lastName: 'Savery' },
    });
  });
});
