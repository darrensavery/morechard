/**
 * Cloudflare Pages Function — proxy /auth/* → morechard-api worker
 *
 * All auth routes (/auth/login, /auth/create-family, etc.) are forwarded
 * to the bound Worker service. The binding "API" must be configured in
 * the Cloudflare Pages dashboard under Settings → Functions → Service bindings,
 * pointing to the "morechard-api" worker.
 */

interface Env {
  API: Fetcher;
}

export const onRequest: PagesFunction<Env> = async (ctx) => {
  // These are frontend SPA routes — let Pages serve index.html.
  const url = new URL(ctx.request.url);
  const frontendRoutes = ['/auth/verify', '/auth/login', '/auth/callback'];
  if (ctx.request.method === 'GET' && frontendRoutes.includes(url.pathname)) {
    return ctx.next();
  }
  return ctx.env.API.fetch(ctx.request);
};
