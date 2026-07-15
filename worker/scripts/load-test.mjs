#!/usr/bin/env node
// Baseline load test against public (unauthenticated) endpoints — see
// docs/dev/capacity-planning.md for context and how to extend this to
// authenticated routes.
//
// Usage:
//   node scripts/load-test.mjs                         # against a Worker preview URL
//   node scripts/load-test.mjs https://api.morechard.com  # NEVER point at production without asking first

import autocannon from 'autocannon';

const baseUrl = process.argv[2];
if (!baseUrl) {
  console.error('Usage: node scripts/load-test.mjs <base-url>');
  console.error('Example: node scripts/load-test.mjs https://pr-my-branch.morechard-api.workers.dev');
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

const result = await autocannon({
  url: `${baseUrl}/api/health`,
  connections: 10,
  duration: 20,
});

autocannon.printResult(result);
