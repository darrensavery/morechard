/**
 * Routes a proxied /api or /auth request to the right Worker.
 *
 * - Production (branch "main"): forwarded via the "API" service binding,
 *   configured in the Cloudflare Pages dashboard → Settings → Functions.
 * - Any other branch: forwarded directly to that branch's own Worker
 *   preview version, uploaded automatically by
 *   .github/workflows/worker-deploy.yml (Cloudflare Worker Versions).
 *   The preview alias hostname must be derived the same way the workflow
 *   derives it (`pr-<branch, alphanumeric only, 28 chars>-morechard-api...`)
 *   — keep the two in sync if either changes.
 *
 * CF_PAGES_BRANCH is injected automatically by Cloudflare Pages at runtime.
 */

interface Env {
  API: Fetcher;
  CF_PAGES_BRANCH?: string;
}

function previewWorkerHost(branch: string): string {
  const safe = branch.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 28);
  return `pr-${safe}-morechard-api.darren-savery.workers.dev`;
}

export async function proxyToWorker(request: Request, env: Env): Promise<Response> {
  const branch = env.CF_PAGES_BRANCH;

  if (branch && branch !== 'main') {
    const url = new URL(request.url);
    url.protocol = 'https:';
    url.hostname = previewWorkerHost(branch);
    url.port = '';

    try {
      // Clone before reading — request bodies can only be consumed once, and
      // we may still need the original, untouched body for the env.API
      // fallback below if this preview doesn't exist.
      const res = await fetch(new Request(url.toString(), request.clone()));
      // No Worker preview exists for this branch yet (e.g. a frontend-only
      // branch that never touched worker/**) — Cloudflare's edge serves a
      // plain 404 HTML error page for the nonexistent workers.dev host,
      // rather than failing the fetch. Our real API never returns HTML on
      // a 404 (only JSON, or occasionally a 200 HTML PDF-export fallback),
      // so that combination is a reliable "no such preview" signal.
      const isMissingPreview = res.status === 404 &&
        (res.headers.get('content-type') ?? '').includes('text/html');
      if (!isMissingPreview) return res;
    } catch {
      // DNS/network failure reaching the preview host — fall back below.
    }
  }

  return env.API.fetch(request);
}
