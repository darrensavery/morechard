# 10 · Referrals & Promo Codes

Covers the referral programme (share link, attribution, cash commission) and promo/discount codes at checkout.

**Key facts:**
- Each family has an **8-character hex referral code** (`referral_code`, lazily created on first use), and a shareable URL. `GET /api/referrals/me` returns them; `GET /api/referrals/stats` returns click + conversion counts.
- **Referral is a cash-commission model.** A conversion is *recorded* (`referral_conversions`) when a referred family makes a qualifying purchase; the actual cash payout is settled **externally** (Rewardful or similar). The app does **not** grant free AI-time or in-app credit for referrals.
- Only **acquisition** SKUs earn a referral: `COMPLETE`, `COMPLETE_AI`, `SHIELD_AI` (and legacy `LIFETIME`). The **AI upgrade** (`AI_UPGRADE`) does **not** earn referral credit.
- Attribution is captured at signup: the referred family stores `referred_by_code`. **Unknown codes are silently ignored** at registration.

---

## Referral programme

### Symptom: "I referred someone but got no reward / it's not in my stats"
**Diagnose (walk the chain):**
1. **Was the code applied at signup?** Attribution only sticks if the friend entered/carried the referral code during registration (`referred_by_code`). If they signed up cold, there's no link — and this can't be retro-fixed cleanly.
2. **Did the friend actually purchase a qualifying SKU?** A conversion only records on a purchase of `COMPLETE` / `COMPLETE_AI` / `SHIELD_AI`. A friend still in trial, or who only bought the `AI_UPGRADE`, generates **no** referral.
3. **Payout is external.** Even a recorded conversion pays out via the external affiliate system (Rewardful), not in-app — so "nothing in the app" is expected; the reward is cash, settled separately.

```bash
# Did a conversion record for this referrer's code?
npx wrangler d1 execute morechard --remote --env production --command="
  SELECT * FROM referral_conversions WHERE referral_code = 'REFCODE' ORDER BY converted_at DESC;"

# What code (if any) is a referred family attributed to?
npx wrangler d1 execute morechard --remote --env production --command="
  SELECT id, referred_by_code FROM families WHERE id = 'REFERRED_FAMILY_ID';"
```

**Resolve:**
- Code never applied at signup → explain attribution must happen at registration; offer to escalate for a goodwill decision if the referrer has clear evidence (this is discretionary, operator-only).
- Purchased only a non-qualifying SKU (AI upgrade) or still in trial → explain the qualifying-purchase rule; the reward triggers when/if they buy a qualifying product.
- Conversion **is** recorded but no cash received → this is an **external payout** question (Rewardful timing/threshold), escalate to whoever manages the affiliate account (Darren).

### Symptom: "Where's my referral link?"
**Resolve:** Settings → refer/share (calls `GET /api/referrals/me`). The code is auto-created the first time they open it. Share the URL — attribution happens when the friend registers via it.

### Symptom: "My referral stats look wrong (clicks but no conversions)"
**Fact:** Clicks (`POST /api/referrals/click`, public) and conversions are counted separately. Clicks with no conversions just means people visited but didn't sign up + buy a qualifying product. Not a bug.

---

## Promo / discount codes

**Facts:** Stripe Checkout has promotion codes enabled (`allow_promotion_codes`). When a code is applied at checkout, the redemption is recorded post-payment (`promo_code_redemptions`, matched via the Stripe promotion code id). Promo codes are configured in Stripe + the `promo_codes` table.

### Symptom: "My promo code isn't accepted at checkout"
**Diagnose:** The code is validated by **Stripe** at the checkout page, not by our app. Common causes: expired code, usage limit reached, wrong region/currency, minimum-spend rules, or a typo.
**Resolve:** Have them re-check the exact code (case, spaces). If it's genuinely a valid active code that Stripe rejects, verify the promotion is live and applicable to that product/region in the **Stripe Dashboard** — escalate if the promo config looks wrong.

### Symptom: "I entered a code but wasn't charged the discounted amount"
**Diagnose:** Stripe's charged amount reflects the discount only if the code was applied **before** completing payment. Check the Stripe Dashboard for whether a promotion code was attached to the session, and `promo_code_redemptions` for whether we recorded it.
**Resolve:** If they paid full price because they forgot to apply the code, a discount can't be retro-applied to a completed charge — a goodwill partial refund is a discretionary operator decision. Escalate with the session id if warranted.

### Symptom: "The discount didn't get recorded / my code should have earned something"
**Fact:** Promo redemption recording keys on Stripe's promotion code id → our `promo_codes` row. If a code exists in Stripe but not in our `promo_codes` table, the payment still succeeds but the redemption isn't logged.
**Resolve:** The customer isn't harmed (they got the discount at checkout); the gap is internal analytics. Note the code and pass to product/ops to reconcile the `promo_codes` table.

---

## Escalation triggers for this domain
- Recorded conversion but the referrer hasn't been paid → external affiliate (Rewardful) question → Darren.
- Goodwill referral attribution for a code that wasn't applied at signup → operator (discretionary).
- A valid, live Stripe promo code that Stripe rejects at checkout → verify promo config in Stripe Dashboard, escalate if misconfigured.
- Full-price charge where a valid discount was intended → operator (discretionary partial refund).
