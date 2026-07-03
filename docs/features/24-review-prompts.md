---
feature: 24-review-prompts
title: App Review Prompts
---

### Purpose

Encourages satisfied parents to leave an App Store or Play Store review at the right moment — after meaningful engagement — while routing negative sentiment to a private feedback channel instead of a public review. This protects the app's public rating and gives the solo developer actionable feedback from unhappy users.

### Methodology

**Eligibility evaluation** (`worker/src/lib/reviewPrompt.ts`)

The `evaluateEligibility` function gates whether a prompt is shown, checking in order:
- Global kill switch (`KILL_SWITCH = false` to enable)
- User has opted out (triggered after `MAX_PROMPTS = 3` dismissals)
- Per-user cooldown (`suppress_until` timestamp, 90 days after dismissal, 30 days after "maybe later")
- Per-family cooldown (30 days since any family member was prompted)
- Milestone gating: first prompt at 10 approved completions; repeat prompts require 15 additional approvals since last prompt

**API endpoints** (`worker/src/routes/reviewPrompt.ts`)

- `POST /api/review-prompt/outcome` — records the result of showing the prompt (`prompted`, `dismissed`, `maybe_later`). Upserts a `review_prompt_state` row, advances `prompt_count`, sets `suppress_until`, and marks `opted_out` once the dismissal cap is reached. Parents only.
- `POST /api/review-prompt/feedback` — saves a private message (≤500 chars, HTML-stripped) from a parent who rated the experience negatively. Stores platform (`android`/`ios`/`web`) and app version. Parents only.

**Background job — feedback digest**

`handleFeedbackDigest` is called from the Worker's scheduled CRON handler. It queries all `review_feedback` rows where `emailed_at IS NULL`, composes a plain-text digest, sends it via MailChannels, then stamps every delivered row with the current timestamp to prevent re-sending.

### Dependencies

- **External packages**: None beyond standard Worker globals (`crypto.randomUUID`)
- **Internal modules**: `../lib/reviewPrompt.ts` (constants + `evaluateEligibility`), `../lib/response.ts` (`json`, `error`, `parseBody`), `../lib/jwt.ts` (`JwtPayload`), `../types.ts` (`Env`, `ReviewPromptState`)
- **APIs / services**: Cloudflare D1 (tables: `review_prompt_state`, `review_feedback`, `completions`); MailChannels transactional email API (`https://api.mailchannels.net/tx/v1/send`) for the digest; Cloudflare Workers scheduled CRON trigger for the digest job
