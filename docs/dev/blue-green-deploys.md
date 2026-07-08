# Blue/Green Deploys — Plain-English Guide

This explains how Morechard's "test before it goes live" deploy setup works,
using a simple analogy, followed by exact step-by-step instructions.

---

## The analogy

Imagine the app is a toy shop, and the Worker (the API/backend) is the
shopkeeper.

**The old way**, whenever a new shopkeeper (updated code) was ready to start
working, we fired the old one and handed the keys straight to the new one —
while customers were still walking in. If the new shopkeeper turned out to be
bad at the job, customers noticed before we could stop it.

**The new way** works like this:

1. **A "trainee" shopkeeper is hired first, but never put at the counter.**
   Every time new code is saved (pushed to a branch on GitHub), a robot
   (GitHub Actions) automatically gives that trainee their own private
   back-room to practise in — using the *real* shop's *real* shelves and
   *real* till (the actual production database). Customers can't see the
   trainee or be served by them yet.

2. **You can go talk to the trainee directly**, through their own private
   door (a preview URL), and check they're doing everything right, using
   real data, without any customer at risk.

3. **Only when you merge into `main`** (the "this is the final version"
   button) does the robot do the big swap: it walks the trainee to the front
   counter and says "you're the shopkeeper now" — instantly, for every
   customer. The old shopkeeper is sent home. If something goes wrong, the
   swap can always be reversed.

**Why this is safe:** the trainee and the real shopkeeper share the *same*
till and the *same* shelves the whole time. They're never working from two
different copies of the shop's stock — that would mean whichever one sold
something last, the other wouldn't know about it, and things would get lost
or double-counted. Google does the same thing with their "blue/green"
deploys: they swap the *staff*, never the *cash register*.

The **frontend app** (the shop's signage/website) works the same way, but
Cloudflare Pages handles it automatically — every branch gets its own live
preview website, no extra setup needed on your part.

---

## Step 1 — Publish to the preview environment

1. Create a new branch and make your changes as normal:
   ```bash
   git checkout -b my-change
   # ... edit files ...
   git add .
   git commit -m "describe the change"
   ```
2. Push the branch to GitHub:
   ```bash
   git push -u origin my-change
   ```
3. That's it — pushing the branch is what triggers everything below
   automatically. You don't need to run any deploy commands by hand.

What happens automatically after the push:
- If your change touched anything under `worker/**`, GitHub Actions uploads
  a live **Worker preview** (visible in the repo's **Actions** tab → the
  "Worker — Version Upload & Deploy" run → the **preview** job).
- Cloudflare Pages always builds a matching **app preview** for the branch
  (as long as your change touched `app/*` or `functions/*` — see
  "Build watch paths" note below).
- The app preview automatically talks to your branch's own Worker preview
  for `/api/*` and `/auth/*` calls if one exists, or falls back to the real
  production API if it doesn't (e.g. for a frontend-only change).

---

## Step 2 — Find the preview URL

The **app preview URL** is what you'll normally want — visiting it in a
browser gives you the full app, talking to the right backend automatically.

Get it by running, from the repo root:
```bash
npx wrangler pages deployment list --project-name morechard-app
```
Find the row for your branch (most recent at the top) and copy the URL from
the **Deployment** column — it looks like:
```
https://<hash>.moneysteps.pages.dev
```

You can also find it in the Cloudflare dashboard:
**Workers & Pages → morechard-app → Deployments** tab.

> **Important:** this URL is tied to that *specific* build. Every new push
> to the branch creates a *new* URL — old ones eventually stop working. Always
> grab the latest one from the command above rather than reusing an old link.

If you specifically need to hit the **Worker preview** directly (rare — only
needed for testing the API in isolation), its URL is printed in the GitHub
Actions run's summary/log, in the form:
```
https://pr-<branch-name>-morechard-api.darren-savery.workers.dev
```

---

## Step 3 — Merge into the live environment

Once you're happy with what you tested on the preview:

1. Open a pull request from your branch into `main` (or just merge/push
   directly to `main` if you're working solo without a PR).
2. As soon as the merge lands on `main`:
   - GitHub Actions uploads a new Worker version and **immediately promotes
     it to 100% of live traffic** — this is the "swap at the counter" moment.
   - Cloudflare Pages builds and deploys a new **production** deployment,
     served at `app.morechard.com`.
3. Watch it happen (optional): repo → **Actions** tab → the latest run on
   `main` → the **deploy** job.

There's no separate manual "promote" step required for a normal merge — it's
fully automatic. The manual commands below are only for cases where you want
to do it by hand instead (e.g. re-running a deploy without a new commit):
```bash
cd worker
npm run deploy:preview   # upload a version, does NOT go live
npm run deploy:promote   # shift 100% of live traffic to that version
```

---

## Two dashboard settings this all depends on

If previews ever stop working, check these first
(**Cloudflare dashboard → Workers & Pages → morechard-app → Settings**):

1. **Build → Build watch paths** must include both `app/*` and `functions/*`.
   If a change only touches one of these and the other isn't listed,
   Cloudflare Pages silently skips the build entirely.
2. **Bindings** must have the `API` service binding (→ `morechard-api`)
   added for **both** the `Production` and `Preview` environments (use the
   "Choose Environment" dropdown at the top of that page to check each one).
   Without the `Preview` one, a branch preview with no matching Worker
   version will crash instead of correctly falling back to production.
