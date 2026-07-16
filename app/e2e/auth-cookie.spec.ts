/**
 * Playwright web verification for the JWT-cookie migration:
 *   1. Web login issues an HttpOnly `mc_token` cookie (the real credential)
 *      + a non-HttpOnly `mc_session` marker cookie, and the app can then
 *      make authenticated same-origin requests using those cookies.
 *   2. A mutating request that omits the `X-Morechard-Client` CSRF header
 *      is rejected with 403, even though the auth cookie is still attached
 *      (simulates a forged cross-site request — see
 *      worker/src/lib/middleware.ts `requireCsrfHeader` and
 *      worker/src/index.ts line ~641 where it's enforced ahead of every
 *      cookie-authenticated write route).
 *
 * Login mechanism: there is no seeded magic-link test account and no email
 * delivery available in this environment, so this suite drives the demo
 * account routes (`worker/src/routes/demo.ts`) instead — specifically
 * `POST /auth/demo/register`, which is public (no auth required) and, on
 * success, sets both cookies via `setAuthCookie` / `setSessionMarkerCookie`
 * exactly like the real login path does. This is a real, cookie-issuing
 * login flow, not a stub — it exercises the same cookie-setting code the
 * production login routes use.
 *
 * Each test logs in independently (fresh browser context per test = fresh
 * cookie jar), using a unique email so the upsert in handleDemoRegister
 * doesn't collide across runs.
 */
import { test, expect } from 'playwright/test';

async function demoLogin(page: import('playwright/test').Page, emailSuffix: string) {
  const status = await page.evaluate(async (email) => {
    const res = await fetch('/auth/demo/register', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Playwright Test', email, marketing_consent: false }),
    });
    return res.status;
  }, `playwright-e2e-${emailSuffix}-${Date.now()}@example.com`);
  expect(status).toBe(200);
}

test('web login sets an HttpOnly cookie and subsequent authenticated requests succeed', async ({ page, context }) => {
  await page.goto('/');
  await demoLogin(page, 'cookie-check');

  const cookies = await context.cookies();

  const authCookie = cookies.find((c) => c.name === 'mc_token');
  expect(authCookie).toBeDefined();
  expect(authCookie?.httpOnly).toBe(true);

  const marker = cookies.find((c) => c.name === 'mc_session');
  expect(marker).toBeDefined();
  expect(marker?.httpOnly).toBe(false);

  // A same-origin fetch from the page (cookies attached automatically +
  // the app's api.ts wiring adds X-Morechard-Client on real app requests;
  // here we add it explicitly since we're bypassing api.ts) should succeed.
  const status = await page.evaluate(async () => {
    const res = await fetch('/api/family', {
      credentials: 'include',
      headers: { 'X-Morechard-Client': '1' },
    });
    return res.status;
  });
  expect(status).toBe(200);
});

test('a cross-site-style POST without the CSRF header is rejected', async ({ page }) => {
  await page.goto('/');
  await demoLogin(page, 'csrf-check');

  const status = await page.evaluate(async () => {
    // Deliberately omit X-Morechard-Client to simulate a forged cross-site
    // request that still carries the (HttpOnly, browser-auto-attached)
    // auth cookie but was not made through the app's own fetch wrapper.
    const res = await fetch('/api/goals', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'test' }),
    });
    return res.status;
  });
  expect(status).toBe(403);
});
