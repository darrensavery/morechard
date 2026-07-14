import { describe, it, expect } from 'vitest';
import { buildReviewItemEmail } from './reviewNotify.js';

describe('buildReviewItemEmail', () => {
  it('includes source, category, confidence, and queue bucket label for a recommended_approve item', () => {
    const { subject, text, html } = buildReviewItemEmail({
      incidentId: 'inc_1',
      source: 'zoho_desk',
      category: '06-billing-payments-stripe',
      confidence: 0.95,
      queueBucket: 'recommended_approve',
      diagnosis: 'Parent reports a duplicate charge; Stripe shows one successful payment.',
    });

    expect(subject).toContain('Recommended: Approve');
    expect(subject).toContain('zoho_desk');
    expect(text).toContain('95%');
    expect(text).toContain('06-billing-payments-stripe');
    expect(text).toContain('Recommended: Approve');
    expect(text).toContain('Parent reports a duplicate charge');
    expect(html).toContain('95%');
    expect(html).toContain('Recommended: Approve');
  });

  it('labels a needs_review item correctly', () => {
    const { subject, text } = buildReviewItemEmail({
      incidentId: 'inc_2',
      source: 'sentry',
      category: 'novel',
      confidence: 0.4,
      queueBucket: 'needs_review',
      diagnosis: 'Unclear error, no matching playbook section.',
    });

    expect(subject).toContain('Needs Review');
    expect(text).toContain('40%');
    expect(text).toContain('Needs Review');
  });

  it('escapes HTML-significant characters from the diagnosis text in the html body', () => {
    const { html } = buildReviewItemEmail({
      incidentId: 'inc_3',
      source: 'in_app',
      category: 'novel',
      confidence: 0.5,
      queueBucket: 'needs_review',
      diagnosis: 'Contains <script>alert(1)</script> & "quotes"',
    });

    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&amp;');
  });

  it('includes a link to /admin', () => {
    const { text, html } = buildReviewItemEmail({
      incidentId: 'inc_4',
      source: 'stripe',
      category: 'novel',
      confidence: 0.7,
      queueBucket: 'needs_review',
      diagnosis: 'x',
    });

    expect(text).toContain('https://api.morechard.com/admin');
    expect(html).toContain('https://api.morechard.com/admin');
  });
});
