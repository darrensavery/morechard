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
  // GET /auth/verify is handled client-side by the SPA (React Router).
  // Let Pages serve index.html so the app can read the token from the URL.
  const url = new URL(ctx.request.url);
  if (ctx.request.method === 'GET' && url.pathname === '/auth/verify') {
    return ctx.next();
  }
  return ctx.env.API.fetch(ctx.request);
};
