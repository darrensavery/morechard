/**
 * Bulk-creates Zoho Desk Knowledge Base articles from a local JSON file.
 * One-off admin tool for the Freshdesk -> Zoho Desk KB migration
 * (docs/superpowers/plans/2026-07-14-freshdesk-to-zoho-desk-migration.md).
 *
 * Requires ZOHO_CLIENT_ID / ZOHO_CLIENT_SECRET / ZOHO_REFRESH_TOKEN / ZOHO_ORG_ID
 * as environment variables — the refresh token must include the Desk.articles.ALL
 * scope (the original support-agent token only had tickets/search/basic/contacts,
 * see worker/src/lib/agent/zoho.ts for the ticket-only pattern this script mirrors).
 *
 * Schema verified against Zoho's own OpenAPI spec:
 *   https://github.com/zoho/zohodesk-oas/blob/master/v1.0/Article.json
 * POST /api/v1/articles requires: answer, categoryId, status, title.
 *
 * Usage:
 *   ZOHO_CLIENT_ID=... ZOHO_CLIENT_SECRET=... ZOHO_REFRESH_TOKEN=... ZOHO_ORG_ID=... \
 *     node scripts/zoho-kb-import.mjs scripts/kb-articles.example.json
 *
 * Defaults to Draft status — nothing goes live until reviewed and published
 * manually in Zoho Desk. Pass --publish to create articles as Published instead.
 *
 * Defaults to permission: AGENTS (internal/private KB). The Zoho Desk Free
 * plan (confirmed 2026-09-13, org 20116764340) rejects permission: ALL /
 * REGISTEREDUSERS with 403 LICENSE_ACCESS_LIMITED ("Public Articles" is a
 * Standard-plan-and-up feature) — AGENTS-only articles work fine. Override
 * per-article with a "permission" field in the input JSON once the plan is
 * upgraded.
 */
import { readFileSync } from 'node:fs';

const ACCOUNTS_DOMAIN = process.env.ZOHO_ACCOUNTS_DOMAIN || 'https://accounts.zoho.eu';
const API_DOMAIN = process.env.ZOHO_API_DOMAIN || 'https://desk.zoho.eu';
const DEPARTMENT_ID = process.env.ZOHO_DEPARTMENT_ID || '265905000000007061';
const CATEGORY_ID = process.env.ZOHO_KB_CATEGORY_ID || '265905000000375153';

const publish = process.argv.includes('--publish');
const inputPath = process.argv.find((a, i) => i >= 2 && !a.startsWith('--'));

if (!inputPath) {
  console.error('Usage: node scripts/zoho-kb-import.mjs <path-to-articles.json> [--publish]');
  process.exit(1);
}

for (const key of ['ZOHO_CLIENT_ID', 'ZOHO_CLIENT_SECRET', 'ZOHO_REFRESH_TOKEN', 'ZOHO_ORG_ID']) {
  if (!process.env[key]) {
    console.error(`Missing required env var: ${key}`);
    process.exit(1);
  }
}

async function getAccessToken() {
  const res = await fetch(`${ACCOUNTS_DOMAIN}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.ZOHO_CLIENT_ID,
      client_secret: process.env.ZOHO_CLIENT_SECRET,
      refresh_token: process.env.ZOHO_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(`Token refresh failed: ${res.status} ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

async function createArticle(accessToken, article) {
  const body = {
    title: article.title,
    answer: article.content, // HTML body — field is literally called "answer" in Zoho's API
    categoryId: article.categoryId || CATEGORY_ID,
    departmentId: article.departmentId || DEPARTMENT_ID,
    status: publish ? 'Published' : 'Draft',
    permission: article.permission || 'AGENTS', // AGENTS = internal-only; ALL requires a paid Zoho Desk plan (see header note)
    ...(article.tags ? { tags: article.tags } : {}),
  };

  const res = await fetch(`${API_DOMAIN}/api/v1/articles`, {
    method: 'POST',
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
      orgId: process.env.ZOHO_ORG_ID,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

async function main() {
  const articles = JSON.parse(readFileSync(inputPath, 'utf-8'));
  if (!Array.isArray(articles)) {
    throw new Error('Input file must be a JSON array of { title, content, tags? } objects');
  }

  console.log(`Loaded ${articles.length} article(s) from ${inputPath}`);
  console.log(`Target: ${API_DOMAIN} · department ${DEPARTMENT_ID} · category ${CATEGORY_ID} · status ${publish ? 'Published' : 'Draft'}`);

  const accessToken = await getAccessToken();

  let created = 0;
  let failed = 0;
  for (const article of articles) {
    const { ok, status, data } = await createArticle(accessToken, article);
    if (ok) {
      created += 1;
      console.log(`  ✓ "${article.title}" -> id ${data.id}`);
    } else {
      failed += 1;
      console.error(`  ✗ "${article.title}" -> ${status} ${JSON.stringify(data)}`);
    }
  }

  console.log(`\nDone: ${created} created, ${failed} failed.`);
  if (!publish) {
    console.log('All articles created as Draft — review and publish them manually in Zoho Desk Help Center.');
  }
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
