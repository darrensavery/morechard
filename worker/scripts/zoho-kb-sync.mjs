/**
 * Re-syncs existing Zoho Desk KB articles to match the local JSON source of
 * truth (matched by exact title). Unlike zoho-kb-import.mjs (which only
 * creates new articles), this PATCHes the `answer` field of articles that
 * already exist, so a copy-wide fix (e.g. punctuation style) doesn't require
 * deleting and recreating everything.
 *
 * Usage:
 *   ZOHO_CLIENT_ID=... ZOHO_CLIENT_SECRET=... ZOHO_REFRESH_TOKEN=... ZOHO_ORG_ID=... \
 *     node scripts/zoho-kb-sync.mjs
 */
import { readFileSync } from 'node:fs';

const ACCOUNTS_DOMAIN = process.env.ZOHO_ACCOUNTS_DOMAIN || 'https://accounts.zoho.eu';
const API_DOMAIN = process.env.ZOHO_API_DOMAIN || 'https://desk.zoho.eu';
const CATEGORY_ID = process.env.ZOHO_KB_CATEGORY_ID || '265905000000375153';

for (const key of ['ZOHO_CLIENT_ID', 'ZOHO_CLIENT_SECRET', 'ZOHO_REFRESH_TOKEN', 'ZOHO_ORG_ID']) {
  if (!process.env[key]) {
    console.error(`Missing required env var: ${key}`);
    process.exit(1);
  }
}

const sourceFiles = [
  'kb-articles.example.json',
  'kb-articles-full.json',
  'kb-articles-child.json',
  'kb-articles-child-2.json',
  'kb-articles-troubleshooting.json',
  'kb-articles-trust-compliance.json',
  'kb-articles-billing-extra.json',
];

// Normalize away dash-style differences (em/en dash vs hyphen) so a title
// that changed ONLY in punctuation still matches its existing Zoho article.
function normalizeTitle(title) {
  return title.replace(/[‒-―‐‑-]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}

const byTitle = new Map();
for (const file of sourceFiles) {
  const articles = JSON.parse(readFileSync(new URL(file, import.meta.url), 'utf-8'));
  for (const a of articles) byTitle.set(normalizeTitle(a.title), { title: a.title, content: a.content });
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

async function listAllArticles(accessToken) {
  const all = [];
  let from = 1; // Zoho's `from` is 1-indexed; 0 is rejected with UNPROCESSABLE_ENTITY
  const limit = 50;
  for (;;) {
    const url = `${API_DOMAIN}/api/v1/articles?categoryId=${CATEGORY_ID}&from=${from}&limit=${limit}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
        orgId: process.env.ZOHO_ORG_ID,
      },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`List failed: ${res.status} ${JSON.stringify(data)}`);
    const page = data.data || [];
    all.push(...page);
    if (page.length < limit) break;
    from += limit;
  }
  return all;
}

async function main() {
  const accessToken = await getAccessToken();
  const existing = await listAllArticles(accessToken);
  console.log(`Found ${existing.length} existing articles in Zoho; ${byTitle.size} local source articles loaded.`);

  let updated = 0, unchanged = 0, unmatched = 0, failed = 0;
  for (const article of existing) {
    const local = byTitle.get(normalizeTitle(article.title));
    if (local === undefined) {
      unmatched++;
      console.log(`  ? no local match for "${article.title}" (id ${article.id})`);
      continue;
    }
    const titleChanged = article.title !== local.title;
    const contentChanged = article.answer !== local.content;
    if (!titleChanged && !contentChanged) {
      unchanged++;
      continue;
    }
    const body = {};
    if (titleChanged) body.title = local.title;
    if (contentChanged) body.answer = local.content;
    const res = await fetch(`${API_DOMAIN}/api/v1/articles/${article.id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
        orgId: process.env.ZOHO_ORG_ID,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      updated++;
      console.log(`  ✓ updated "${local.title}"${titleChanged ? ' (title + content)' : ''}`);
    } else {
      failed++;
      console.error(`  ✗ failed "${article.title}" -> ${res.status} ${await res.text()}`);
    }
  }

  console.log(`\nDone: ${updated} updated, ${unchanged} already up to date, ${unmatched} not found in local source, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
