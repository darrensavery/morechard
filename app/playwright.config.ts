/**
 * Playwright config for the JWT-cookie-migration web verification suite.
 *
 * There is no existing Playwright suite in this repo (checked: no `app/e2e/`
 * directory, no `playwright.config.ts` anywhere, no committed spec files —
 * the root `package.json` lists `playwright` as a devDependency but nothing
 * had wired it up yet). This is a from-scratch minimal config, not a mirror
 * of a prior pattern.
 *
 * Note: this repo has the `playwright` package (browser automation + test
 * runner bundled together) but not the separate `@playwright/test` package.
 * `playwright` ships an equivalent `playwright/test` entry point, which is
 * what this config and the specs under `app/e2e/` import from.
 *
 * Requires BOTH dev servers running per the root CLAUDE.md:
 *   npm run dev        (from repo root — worker on :8787 against the
 *                        REMOTE morechard-dev D1, app/Vite on :5173)
 * `webServer` below does NOT attempt to start the worker — CLAUDE.md is
 * explicit that `--local` D1 is dead in this project, so there's no way to
 * spin up a self-contained worker for CI/ephemeral runs. A human (or CI job
 * with Cloudflare credentials) must have `npm run dev` running from the repo
 * root before invoking `npx playwright test`.
 */
import { defineConfig, devices } from 'playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Deliberately no `webServer` entry: the app dev server (Vite) proxies
  // /api and /auth to the worker at :8787, which itself must already be
  // running against the remote morechard-dev D1 (`npm run dev` from repo
  // root, per CLAUDE.md). Playwright can't safely bootstrap that here.
});
