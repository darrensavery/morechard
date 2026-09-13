# Morechard Support (docs.morechard.com)

Public self-service Knowledge Base, built with [Docusaurus](https://docusaurus.io/). Deployed as a Cloudflare Worker (static assets) — see `docs/notebooklm/06-developer-bible.md` and `CLAUDE.md` in the repo root for the wider Cloudflare-native stack.

## Content source of truth

Article content is authored once as JSON and pushed to **two** places:

1. **Zoho Desk** (internal, agent-only KB) via `worker/scripts/zoho-kb-import.mjs`
2. **This public site** via `convert-articles.mjs` in this folder, which reads the same JSON files and generates the MDX docs under `docs/`

Source files (in `worker/scripts/`):
- `kb-articles-full.json` — 31 parent-facing articles
- `kb-articles-child.json` + `kb-articles-child-2.json` — 19 child-facing articles

**To update content:** edit the JSON files, then re-run:

```bash
cd docs-site
node convert-articles.mjs
npm run build
```

The script wipes and regenerates every `.mdx` file under `docs/for-parents/` and `docs/for-kids/` — don't hand-edit those files directly, changes will be overwritten on the next sync.

## Local development

```bash
npm start        # dev server with hot reload
npm run build    # production build to build/
npm run serve    # preview the production build locally
```

## Deployment

Deployed as a standalone Cloudflare Worker (static assets), not through the classic Pages CI pipeline the way `app/` and `marketing/` are:

```bash
npm run build
npx wrangler deploy
```

(`wrangler.jsonc` pins the Worker name to `morechard-support` and the assets directory to `build/`, so a bare `wrangler deploy` targets the right project.)

Custom domain `support.morechard.com` is bound via the Cloudflare dashboard (Workers & Pages → morechard-support → Settings → Domains & Routes) — there's no CLI command for this in the current Wrangler version. Was previously CNAME'd to Freshdesk; retired as part of the Freshdesk → Zoho Desk migration.
