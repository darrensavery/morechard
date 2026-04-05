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
  return ctx.env.API.fetch(ctx.request);
};
