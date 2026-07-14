import { describe, it, expect } from 'vitest';
import { buildZohoSearchUrl, parseZohoSearchResponse, buildZohoCreateTicketBody } from './zoho.js';

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
