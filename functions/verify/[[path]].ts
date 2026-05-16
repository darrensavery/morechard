/**
 * Cloudflare Pages Function — serve SPA for /verify/* paths
 *
 * The React app handles /verify/:hash client-side. This function lets
 * Pages serve index.html for any /verify/* request so the SPA router
 * can pick it up on direct load or refresh.
 */

export const onRequest: PagesFunction = async (ctx) => {
  return ctx.next();
};
