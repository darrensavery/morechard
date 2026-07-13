# Autonomous Support Agent Playbook

This directory contains the support playbook used by the autonomous support agent (Phase 0 and beyond).

The playbook documents diagnostic procedures, decision trees, and operator actions across all support domains.

Files are concatenated and synced to Cloudflare KV by the `worker/scripts/sync-playbook.mjs` script.

## Usage

Run manually after editing playbook files:
```bash
cd worker
npm run sync:playbook          # dev environment
npm run sync:playbook:prod     # production (requires explicit approval)
```

## Playbook Domains

Playbook files follow a numbered structure:
- `00-` through `10-`: Specific support domains (billing, auth, technical, etc.)

Each domain file contains:
- Problem statement (conditions that trigger this domain)
- Diagnostic tools and queries
- Decision tree for action categorization
- Operator actions (Phase 1+) or recommendations (Phase 0)

## Verification

To verify the playbook has been synced to KV:
```bash
npx wrangler kv key get --binding=CACHE "agent:playbook:hash"
```

This should return a 64-character SHA256 hex string.
