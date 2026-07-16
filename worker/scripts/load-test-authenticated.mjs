#!/usr/bin/env node
// Authenticated-route load test — demo (Thomson) account only.
//
// Covers the "real authenticated traffic" gap flagged in
// docs/security/audits/2026-07-15-production-security-audit.md (Open item #2):
// the baseline load-test.mjs only hits the public /api/health endpoint.
//
// Deliberately excludes /api/chat — see the same audit doc, Open item #10
// (2026-07-16). The demo family has only 2 children and /api/chat is
// rate-limited to 20 messages/hour PER CHILD, so a real load run would
// either 429 almost immediately (not measuring real capacity) or lock the
// shared demo account's chat out for real visitors for up to an hour
// afterward. Chat capacity should be assessed separately, without hammering
// live shared demo infrastructure.
//
// Usage:
//   node scripts/load-test-authenticated.mjs <preview-base-url>
//   node scripts/load-test-authenticated.mjs https://api.morechard.com  # refused, see below

import autocannon from 'autocannon';

const baseUrl = process.argv[2];
if (!baseUrl) {
  console.error('Usage: node scripts/load-test-authenticated.mjs <base-url>');
  console.error('Example: node scripts/load-test-authenticated.mjs https://pr-my-branch.morechard-api.workers.dev');
  process.exit(1);
}

if (baseUrl.includes('api.morechard.com')) {
  console.error(
    'Refusing to run against the production hostname directly from this script.\n' +
    'Load-test a Worker Versions preview URL instead (see `deploy:preview` / worker-deploy.yml),\n' +
    'which runs against the real production D1 but not live user traffic.',
  );
  process.exit(1);
}

const FAMILY_ID = 'demo-family-thomson';
const CHILD_ID  = 'demo-child-ellie';

// 1. Get a demo JWT once and reuse it for the whole run — re-requesting per
// connection would spam demo_registrations upserts for no benefit (same
// email just bumps last_active_at, but there's no reason to call it 100x).
console.log('Requesting demo (Thomson) session token...');
const registerRes = await fetch(`${baseUrl}/auth/demo/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Capacity Load Test', email: 'loadtest-capacity@internal.morechard.com' }),
});
if (!registerRes.ok) {
  console.error(`Failed to get demo token: ${registerRes.status} ${await registerRes.text()}`);
  process.exit(1);
}
const { token } = await registerRes.json();
const authHeaders = { Authorization: `Bearer ${token}` };
console.log('  → got token\n');

// 2. Prime the weekly insights cache with a single call BEFORE the measured
// run. Insights briefings are AI-generated at most once per child per week
// and cached in D1 after that — this keeps the actual OpenAI call to a
// single request instead of one per connection/iteration.
console.log('Priming insights cache (1 request, may hit OpenAI)...');
const primeRes = await fetch(`${baseUrl}/api/insights?family_id=${FAMILY_ID}&child_id=${CHILD_ID}`, { headers: authHeaders });
console.log(`  → ${primeRes.status}\n`);

function summarize(label, r) {
  console.log(`\n=== ${label} ===`);
  console.log(`  requests: ${r.requests.total} total, ${r.requests.average.toFixed(1)}/sec avg`);
  console.log(`  status:   2xx=${r['2xx']} 3xx=${r['3xx']} 4xx=${r['4xx']} 5xx=${r['5xx']} errors=${r.errors} timeouts=${r.timeouts}`);
  console.log(`  latency:  avg=${r.latency.average}ms p50=${r.latency.p50}ms p90=${r.latency.p90}ms p99=${r.latency.p99}ms max=${r.latency.max}ms`);
  console.log(`  throughput: ${(r.throughput.average / 1024).toFixed(1)} KB/sec avg`);
}

// 3. Moderate load against the now-cached insights path.
const insightsResult = await autocannon({
  url: `${baseUrl}/api/insights?family_id=${FAMILY_ID}&child_id=${CHILD_ID}`,
  headers: authHeaders,
  connections: 10,
  duration: 30,
});
summarize('GET /api/insights (D1-cached path)', insightsResult);

// 4. Moderate load against PDF export (basic tier — no subscription gate,
// unlike behavioral/forensic which are tier-gated behind Shield AI).
const pdfResult = await autocannon({
  url: `${baseUrl}/api/export/pdf?family_id=${FAMILY_ID}&tier=basic`,
  headers: authHeaders,
  connections: 10,
  duration: 30,
});
summarize('GET /api/export/pdf (basic tier)', pdfResult);

console.log(
  '\nNOTE: /api/chat intentionally excluded from this run — see ' +
  'docs/security/audits/2026-07-15-production-security-audit.md, Open item #10.',
);
