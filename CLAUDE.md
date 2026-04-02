# MoneySteps PWA — Claude Code Context

## Project Overview
MoneySteps is a family pocket money PWA.
Parents manage chores, goals, approvals, and payments.
Children track earnings, savings goals, and progress.

---

## Source of Truth (IMPORTANT)
All authoritative product, brand, and technical knowledge for this project
has been distilled from NotebookLM and is stored locally in:

/docs/notebooklm/

These files are the source of truth.
Claude must consult them automatically when relevant and must not invent
requirements, tone, strategy, or architecture already covered there.

Start with:
/docs/notebooklm/00-index.md

---

## Routing Rule (How Claude Should Decide What to Read)
Before answering or making changes:

1. Check /docs/notebooklm/00-index.md
2. Consult the relevant file(s) based on the task:
   - Coding, data models, APIs, storage, auth, hosting → developer-bible.md
   - UI copy, wording, tone, UX text → ai-personality.md, brand-book.md
   - Roadmap, monetisation, positioning → business-strategy.md
   - Market comparison, differentiation → competitor-analysis.md

If the knowledge base does not specify something:
- Say “Not specified in the Knowledge Base”, OR
- Ask a clarifying question instead of guessing.

---

## Strategic Tech Direction (IMPORTANT)

### Current Direction
MoneySteps is evolving away from Firebase toward a **Cloudflare‑native stack**
to take advantage of:

- Cloudflare Pages + Functions
- Cloudflare D1 (SQL database)
- Cloudflare environment bindings
- Simpler mental model, lower long‑term cost, tighter platform integration

### Migration Rules
- Cloudflare D1 (SQL) is the **target data layer**
- Firebase should NOT be introduced in new code
- If legacy Firebase patterns exist:
  - Treat them as transitional
  - Do not expand or deepen Firebase usage
  - Prefer migration or abstraction over extension

If a storage or data-model decision is required:
- Default to Cloudflare D1 + SQL
- Ask before proposing Firebase-based solutions

---

## Working Expectations for Claude
Claude Code is responsible for:
- reasoning
- implementation
- refactoring
- execution within the defined constraints

Claude Code is NOT responsible for:
- re-interpreting original source documents
- re-deriving product decisions already captured
- inventing assumptions when knowledge is missing

When answering non-trivial questions, Claude may briefly note
which /docs/notebooklm files were consulted.

---

## Key Project Files
- `pocket-money-v3/pwa-v3/index.html` — single-file app (~344KB)
- `test-app.js` — Playwright test suite (repo root)
- `pocket-money-v3/pwa-v3/start-server.bat` — local dev server (localhost:3000)

## Common Commands

### Daily save routine
git add .
git commit -m "describe what changed"
git push

### Start local server
npm run dev

### Deploy to Cloudflare
wrangler deploy