/**
 * Cloudflare Pages Function — proxy /auth/* → morechard-api worker
 *
 * On the "main" branch, forwarded to the bound Worker service. The binding
 * "API" must be configured in the Cloudflare Pages dashboard under
 * Settings → Functions → Service bindings, pointing to the "morechard-api"
 * worker. On any other branch, forwarded to that branch's own live Worker
 * preview version instead — see functions/_lib/workerProxy.ts.
 */

import { proxyToWorker } from '../_lib/workerProxy';

interface Env {
  API: Fetcher;
  CF_PAGES_BRANCH?: string;
}

export const onRequest: PagesFunction<Env> = async (ctx) => {
  // These are frontend SPA routes — let Pages serve index.html.
  const url = new URL(ctx.request.url);
  const frontendRoutes = ['/auth/verify', '/auth/login', '/auth/callback'];
  if (ctx.request.method === 'GET' && frontendRoutes.includes(url.pathname)) {
    return ctx.next();
  }
  return proxyToWorker(ctx.request, ctx.env);
};
