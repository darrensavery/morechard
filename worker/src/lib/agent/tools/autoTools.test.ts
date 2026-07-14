import { describe, it, expect, beforeEach } from 'vitest';
import { isMagicLinkRateLimited, buildMagicLinkResendEmail } from './autoTools.js';
import { registerAutoTools } from './autoTools.js';
import { getTool, resetRegistryForTests } from '../registry.js';

describe('isMagicLinkRateLimited', () => {
  it('is not limited when there is no prior attempt', () => {
    expect(isMagicLinkRateLimited(null, 1000)).toBe(false);
  });

  it('is not limited when the window has expired', () => {
    // window is 600s; last attempt window_start was 700s before now
    expect(isMagicLinkRateLimited({ attempts: 3, window_start: 1000 }, 1700)).toBe(false);
  });

  it('is not limited when under the cap within the window', () => {
    expect(isMagicLinkRateLimited({ attempts: 2, window_start: 1000 }, 1100)).toBe(false);
  });

  it('is limited when at or over the cap within the window', () => {
    expect(isMagicLinkRateLimited({ attempts: 3, window_start: 1000 }, 1100)).toBe(true);
  });
});

describe('buildMagicLinkResendEmail', () => {
  it('includes the sign-in link and the recipient name', () => {
    const { subject, text, html } = buildMagicLinkResendEmail('Darren', 'https://app.morechard.com/auth/verify?token=abc');
    expect(subject).toContain('sign-in link');
    expect(text).toContain('https://app.morechard.com/auth/verify?token=abc');
    expect(html).toContain('https://app.morechard.com/auth/verify?token=abc');
    expect(html).toContain('Darren');
  });

  it('escapes HTML-significant characters in the name', () => {
    const { html } = buildMagicLinkResendEmail('<script>alert(1)</script>', 'https://x.test/y');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('registerAutoTools', () => {
  beforeEach(() => resetRegistryForTests());

  it('registers resend_magic_link as tier "auto"', () => {
    registerAutoTools();
    const tool = getTool('resend_magic_link');
    expect(tool).toBeDefined();
    expect(tool?.tier).toBe('auto');
  });

  it('is idempotent-safe to call once per cold start (does not throw on a fresh registry)', () => {
    expect(() => registerAutoTools()).not.toThrow();
  });
});
