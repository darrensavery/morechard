/**
 * Cloudflare Pages Function — proxy /api/* → morechard-api worker
 *
 * All API routes (/api/family, /api/chores, etc.) are forwarded
 * to the bound Worker service. The binding "API" must be configured in
 * the Cloudflare Pages dashboard under Settings → Functions → Service bindings,
 * pointing to the "morechard-api" worker.
 */

interface Env {
  API: Fetcher;
}

export const onRequest: PagesFunction<Env> = async (ctx) => {
  return ctx.env.API.fetch(ctx.request);
};
