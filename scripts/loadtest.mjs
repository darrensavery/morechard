/**
 * Morechard load test — runs against production edge
 *
 * Usage:  node scripts/loadtest.mjs
 *
 * Scenarios:
 *   A. Health endpoint     — baseline, no auth, no DB
 *   B. Market rates COLD   — authenticated, D1 hit (first request populates KV)
 *   C. Market rates WARM   — authenticated, KV hit (cache already hot)
 *
 * JWT is obtained via POST /auth/demo/register (public endpoint, Thomson demo family).
 * No test data is left behind — the demo_registrations upsert is idempotent.
 */

const BASE        = 'https://morechard-api.darren-savery.workers.dev';
const CONCURRENCY = 50;
const WAVES       = 10;  // total = CONCURRENCY * WAVES requests per scenario

// ── HTTP helper ───────────────────────────────────────────────────────────────

async function api(method, path, body, token) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json };
}

// ── JWT via demo register (public, no secret needed) ─────────────────────────

async function provisionDemoJwt() {
  const res = await api('POST', '/auth/demo/register', {
    name:              'Load Test',
    email:             `loadtest-${Date.now()}@perf.test`,
    marketing_consent: false,
  });
  if (res.status !== 200 && res.status !== 201) {
    throw new Error(`Demo register failed ${res.status}: ${JSON.stringify(res.body)}`);
  }
  return res.body.token;
}

// ── Load test core ────────────────────────────────────────────────────────────

async function wave(fn) {
  return Promise.all(Array.from({ length: CONCURRENCY }, fn));
}

function stats(latencies) {
  const sorted = [...latencies].sort((a, b) => a - b);
  const sum    = sorted.reduce((a, b) => a + b, 0);
  return {
    min: sorted[0],
    p50: sorted[Math.floor(sorted.length * 0.50)],
    p95: sorted[Math.floor(sorted.length * 0.95)],
    p99: sorted[Math.floor(sorted.length * 0.99)],
    max: sorted[sorted.length - 1],
    mean: Math.round(sum / sorted.length),
  };
}

async function runScenario(label, requestFn) {
  const latencies = [];
  let errors = 0;
  const start = Date.now();

  for (let w = 0; w < WAVES; w++) {
    const times = await wave(async () => {
      const t0 = Date.now();
      try {
        const res = await requestFn();
        if (!res.ok) errors++;
      } catch {
        errors++;
      }
      return Date.now() - t0;
    });
    latencies.push(...times);
  }

  const elapsed = (Date.now() - start) / 1000;
  const total   = CONCURRENCY * WAVES;
  const rps     = Math.round(total / elapsed);
  const s       = stats(latencies);

  console.log(`\n── ${label} ──`);
  console.log(`  Requests : ${total} (${CONCURRENCY} concurrent × ${WAVES} waves)`);
  console.log(`  Errors   : ${errors}`);
  console.log(`  RPS      : ${rps}`);
  console.log(`  Latency  : min=${s.min}ms  p50=${s.p50}ms  p95=${s.p95}ms  p99=${s.p99}ms  max=${s.max}ms`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  try {
    const h = await fetch(`${BASE}/api/health`);
    if (!h.ok) throw new Error(`Status ${h.status}`);
  } catch {
    console.error(`\n✗  Worker not reachable at ${BASE}\n`);
    process.exit(1);
  }

  console.log(`\nMorechard Load Test — Production Edge`);
  console.log(`Target      : ${BASE}`);
  console.log(`Concurrency : ${CONCURRENCY} simultaneous requests`);
  console.log(`Waves       : ${WAVES}  (${CONCURRENCY * WAVES} requests per scenario)`);

  process.stdout.write('\nProvisioning demo JWT... ');
  let jwt;
  try {
    jwt = await provisionDemoJwt();
    console.log('done.');
  } catch (e) {
    console.error(`\n✗  ${e.message}`);
    console.error('   Running health-only baseline.\n');
  }

  await runScenario('A — Health (no auth, no DB)', () =>
    fetch(`${BASE}/api/health`),
  );

  if (!jwt) {
    console.log('\nSkipping authenticated scenarios (no JWT available).');
    return;
  }

  await runScenario('B — Market rates COLD (first request populates KV)', () =>
    fetch(`${BASE}/api/market-rates?locale=en-GB`, {
      headers: { Authorization: `Bearer ${jwt}` },
    }),
  );

  await runScenario('C — Market rates WARM (served from KV cache)', () =>
    fetch(`${BASE}/api/market-rates?locale=en-GB`, {
      headers: { Authorization: `Bearer ${jwt}` },
    }),
  );

  console.log('\n');
}

main().catch(err => { console.error(err); process.exit(1); });
