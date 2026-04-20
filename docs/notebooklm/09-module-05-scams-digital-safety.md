# Module 5: Scams & Digital Safety
**Pillar 2 · Level 2 (Sapling) · Ages 10–12**

---

## LIVE APP INTEGRATION

**Datapoints consumed:**
- `goal_title_http_flag` — primary trigger condition (HTTP/link detected in goal title)
- `scam_flag_raised` — secondary trigger (parent flags suspicious item)
- `current_balance` — used in Lab numeracy (value at risk)
- `chore_rate_median` — used in Lab (labor equivalent of balance)
- `recent_goal_titles` — Hook personalisation if keyword trigger fires

**AI Mentor rendering rules:**
- Hook must reference the specific trigger: if `goal_title_http_flag = true`, name the flagged goal title. If `scam_flag_raised = true`, acknowledge the parent's flag without disclosing who raised it.
- Lab must use the child's actual `current_balance` as the "at risk" figure.
- Module must not claim all online offers are scams — teach pattern recognition, not blanket suspicion.
- Language must remain accessible for ages 10–12.

---

## ORCHARD PERSONA VERSION

### ACT 1 — HOOK

*Trigger delivered when `goal.title ILIKE '%http%' OR scam_flag_raised = true`*

> *"Something in this corner of the orchard smells like blight. Scams grow fast and look delicious — let's learn how to spot them before they spread."*

Something caught the system's attention. Maybe you wrote a link into a goal title, or something got flagged as unusual.

Here's the thing: the internet is full of things that look like opportunities but are designed to take your money — or your information, which is worth more than money. You're 10–12. You're old enough to be targeted. You're also old enough to learn how to protect yourself.

Let's look at how the most common scams actually work, so you recognise them on sight.

---

### ACT 2 — LESSON

**What a scam is — and what it isn't.**

A scam is a deliberate deception designed to get something from you — money, personal information, or access to accounts. The person behind it knows it's a lie. They built the lie on purpose.

This is different from a bad deal (a product that turns out to be poor quality) or a mistake (a company charging you the wrong amount). Scams are intentional.

---

**The three things scammers always need.**

Every scam — no matter how sophisticated — needs three things from you:

1. **Your attention** — you have to see the offer
2. **Your trust** — you have to believe it's real
3. **Your action** — you have to click, send, or share something

Scammers are experts at engineering all three. Understanding how they do it is the whole defence.

---

**The patterns to recognise.**

**Too good to be true.** If a deal promises something that seems implausibly generous — free money, a phone for £1, guaranteed returns — that is the pattern. Legitimate businesses don't give things away without a reason. The reason is the trap.

**Urgency.** "Offer expires in 10 minutes." "Act now or lose your place." Urgency removes your thinking time. Real opportunities do not dissolve in ten minutes. Urgency is a tool to stop you asking questions.

**Authority impersonation.** Scammers pretend to be trusted organisations: banks, the government, Amazon, Apple. They copy logos, email addresses, and website layouts. The goal is to borrow trust from institutions you already trust.

**Requests for personal information.** Any message asking you to confirm your password, card number, PIN, or personal details via a link or message is almost certainly a scam. Legitimate services never ask for your password. They don't need it — they already have your account.

**The prize you didn't enter for.** "Congratulations — you've been selected!" If you didn't enter a competition, you didn't win one. The selection was designed to make you feel lucky; the luck is the hook.

---

**Phishing — what it means.**

Phishing is the specific technique of sending messages that impersonate a trusted source to steal credentials or money. The name comes from "fishing" — the scammer casts a lure and waits for someone to bite.

Common forms:
- Fake bank emails asking you to "verify your account"
- Fake parcel delivery messages (you have a missed delivery — pay £1.50 to reschedule)
- Fake prize notifications
- Fake job offers asking for your bank details to "set up payment"

The tell: phishing messages create urgency, contain a link, and ask you to do something that involves your personal or financial information.

---

**What to do when you're not sure.**

1. **Don't click the link.** Go to the website directly by typing the address yourself.
2. **Don't reply.** Don't give information to confirm your details even to say "this is wrong."
3. **Tell a trusted adult.** A parent, carer, or teacher. Not because you did something wrong — but because two pairs of eyes are better than one on this.
4. **Check the sender.** Legitimate companies use their own domains. Amazon emails come from amazon.co.uk, not amazon-support-247.com.

---

### ACT 3 — LAB

**Numeracy check (required).**

Your current balance is **£{current_balance}**.

1. If a scammer drained your entire balance, how many chores at **£{chore_rate_median}** each would you need to complete to recover that money? ____________ chores
2. If a phishing message claimed you'd won a prize worth ten times your current balance, what would the supposed prize be worth? ____________ — does that number make the claim more or less believable?
3. If you received a message saying "Pay £2.99 to claim your £{current_balance × 5} prize" — how much would you lose if it were a scam? ____________ How many chores is that? ____________

---

**Spot the scam.**

Read each message. Write S (Scam) or L (Legitimate) and name the pattern you spotted:

1. *"Your bank account has been locked. Click here within 2 hours to unlock it or your account will be closed."* — ____  Pattern: ____________
2. *"Your Morechard balance has been updated. Log in at morechard.app to see your latest earnings."* — ____  Pattern: ____________
3. *"Congratulations! You have been randomly selected to receive a £500 gift card. Enter your details to claim."* — ____  Pattern: ____________
4. *"Your Amazon order has been delayed. No action needed — estimated delivery updated to Thursday."* — ____  Pattern: ____________
5. *"Urgent: Your Apple ID has been used in another country. Verify your payment details immediately."* — ____  Pattern: ____________

---

**Reflection.**

1. Have you ever received a message that felt wrong? What was it about it that felt off?
2. What would you do if you received a message saying your Morechard account needed verification? (Hint: What does the real Morechard never ask for?)
3. If a friend showed you a message saying they'd won £1,000 for free, what questions would you ask them?

**Bonus challenge:** Ask a parent you're with to show you one real scam message they've received (most adults have). Identify which pattern it used: urgency, authority impersonation, too good to be true, or prize you didn't enter for.

---

### ACT 4 — QUIZ

**Q1.** You receive an email that says "Your bank has noticed unusual activity. Click here to verify your account within 24 hours." What is the most important action to take?

- A) Click the link to check if it's real
- B) Reply to the email to ask if it's genuine
- C) Do not click — go to your bank's website directly by typing the address, and call their official number if concerned

*Correct: C. Clicking the link or replying gives the scammer what they need. Going direct to the official source is always the safe route.*

---

**Q2.** A message says "Congratulations — you've won a new phone! You didn't enter anything, but you've been randomly selected." Which pattern is this?

- A) Phishing
- B) The prize you didn't enter for — designed to make you feel lucky so you lower your guard
- C) Authority impersonation

*Correct: B. The prize-you-didn't-enter pattern exploits the feeling of luck to bypass critical thinking.*

---

**Q3.** What is the single most reliable sign that a message is NOT from a legitimate organisation?

- A) The message is very long
- B) The message asks you to confirm personal information, passwords, or payment details via a link
- C) The message was unexpected

*Correct: B. No legitimate service asks for your password or payment details via a link or message. They don't need it — they already have your account. This request is always the tell.*

---

### CLOSING LINE

> *"The orchard's blight spreads fastest in the dark. You can see it now — and that's the whole defence."*

---

## CLEAN PERSONA VERSION

### ACT 1 — HOOK

**MODULE:** M5 — Scams & Digital Safety
**TRIGGER:** `goal.title ILIKE '%http%' OR scam_flag_raised = true`
**HOOK:** *"Trigger condition met: external link detected in goal title or scam flag raised. Review digital threat model before proceeding."*

---

### ACT 2 — LESSON

**Scam definition.**

A scam is a deliberate deception with the intent to extract value (money, credentials, personal data) from a target. Distinguishing properties:
- Intentional — not a mistake or poor service
- Deceptive — false representation of identity, offer, or risk
- Extractive — designed to transfer value from target to scammer

---

**Attack vectors (common).**

| Vector | Mechanism | Target |
|---|---|---|
| Phishing | Impersonates trusted entity via email/message | Credentials, payment details |
| Smishing | Same mechanism via SMS | Click rate higher on mobile |
| Prize scam | False win notification | Personal data, processing fee |
| Urgency scam | Artificial time pressure on fake threat | Rushed action bypassing scepticism |
| Impersonation | Copies logos, domains, tone of trusted org | Trust transfer |

---

**Defence protocol.**

```
on_receipt_of_suspicious_message:
  1. do_not_click_link()
  2. do_not_reply()
  3. verify_via_official_channel(type_address_directly)
  4. report_to_trusted_adult()
  5. check_sender_domain(expected_domain vs actual_domain)
```

**Domain check rule:** sender domain must exactly match the official domain. Subdomains, hyphens, or additional words indicate spoofing (e.g. `amazon-support.com` ≠ `amazon.co.uk`).

---

**Credential hygiene rules.**

- Passwords: never share, never transmit via link, change on suspected compromise
- PINs: never enter on any site reached via a link in a message
- Personal data: name + DOB + address combination enables identity fraud — do not share all three simultaneously to unknown parties

---

### ACT 3 — LAB

**Numeracy check (required).**

Given `current_balance = {current_balance}`, `chore_rate_median = {chore_rate_median}`:

1. `chores_to_recover_full_loss = current_balance / chore_rate_median` = ____________
2. `claimed_prize = current_balance × 10` = ____________. Plausibility assessment: ____________
3. `scam_fee = 2.99`. `chores_to_recover_fee = 2.99 / chore_rate_median` = ____________. `expected_prize = current_balance × 5`. Net position if scam: `−2.99`.

---

**Message classification task.**

For each message, output:

```json
{
  "message": "string",
  "classification": "scam | legitimate",
  "pattern": "urgency | authority_impersonation | prize | phishing | too_good_to_true | none",
  "confidence": "high | medium | low"
}
```

Messages to classify (same five from Orchard Lab above).

---

### ACT 4 — QUIZ

**Q1.** Correct action on receipt of "unusual account activity" email with link:

- [ ] Click link to assess
- [ ] Reply to confirm details
- [x] Navigate directly to official site; call official number if concerned

**Q2.** "Prize you didn't enter" — mechanism:

- [ ] Phishing
- [x] Exploit of luck/surprise response to lower critical evaluation threshold
- [ ] Authority impersonation

**Q3.** Most reliable indicator of illegitimate message:

- [ ] Message is unexpected
- [x] Request for credentials or payment details via link — legitimate services never require this
- [ ] Message is long

---

### CLOSING LINE

*"Module complete. Threat recognition patterns loaded. Apply domain-check and credential-hygiene rules on all future unsolicited digital contacts."*

---

## TECHNICAL JSON EXPORT

```json
{
  "module_id": "M5",
  "title": "Scams & Digital Safety",
  "pillar": 2,
  "pillar_name": "Spending & Choices",
  "level": 2,
  "level_name": "Sapling",
  "age_range": "10-12",
  "launch_status": "Launch",
  "moat_type": "pedagogical_moat",
  "persona_versions": ["orchard", "clean"],
  "honest_framing_required": false,

  "trigger_logic": {
    "event_type": "GOAL_WRITE",
    "condition": "goal.title ILIKE '%http%' OR scam_flag_raised = true",
    "evaluation_timing": "on_goal_write",
    "null_safety": "If goal title is null, ILIKE returns false; condition falls through to scam_flag_raised check.",
    "idempotency_guard": "INSERT OR IGNORE INTO unlocked_modules (child_id, module_id, triggered_at) VALUES (:child_id, 'M5', CURRENT_TIMESTAMP)",
    "level_gate_check": "child.age_tier >= 'SAPLING'",
    "subscription_gate": "ai_subscription_status IN ('ACTIVE')"
  },

  "live_app_integration": {
    "datapoints_required": [
      "current_balance",
      "chore_rate_median"
    ],
    "datapoints_optional": [
      "goal_title_http_flag",
      "scam_flag_raised",
      "recent_goal_titles"
    ],
    "fallback_behaviour": "If current_balance is null, Lab uses £20 as example. If chore_rate_median is null, use regional fallback rate."
  },

  "mentor_hook": {
    "locale_en_gb": "Something in this corner of the orchard smells like blight. Scams grow fast and look delicious — let's learn how to spot them before they spread.",
    "locale_pl": null,
    "locale_en_us": null
  },

  "closing_line": {
    "locale_en_gb": "The orchard's blight spreads fastest in the dark. You can see it now — and that's the whole defence.",
    "locale_pl": null,
    "locale_en_us": null
  },

  "structure": {
    "act_1": "Hook — references trigger condition (flagged goal or parent flag). Does not reveal who flagged.",
    "act_2": "Lesson — scam definition, three requirements (attention, trust, action), four patterns (too good to be true, urgency, impersonation, prize), phishing explained, defence protocol.",
    "act_3": "Lab — required numeracy using current_balance as at-risk figure. Five-message classification exercise.",
    "act_4": "Quiz — 3 questions on correct action, pattern identification, and credential-request tell."
  },

  "quiz": {
    "pass_threshold": 2,
    "questions": [
      {
        "id": "M5_Q1",
        "stem": "Correct action on bank security email with link.",
        "correct_option": "C",
        "concept_tested": "defence_protocol"
      },
      {
        "id": "M5_Q2",
        "stem": "Prize-you-didn't-enter pattern — mechanism.",
        "correct_option": "B",
        "concept_tested": "prize_scam_pattern"
      },
      {
        "id": "M5_Q3",
        "stem": "Most reliable illegitimate message indicator.",
        "correct_option": "B",
        "concept_tested": "credential_request_tell"
      }
    ]
  },

  "concepts_introduced": [
    "scam_definition",
    "phishing",
    "urgency_manipulation",
    "authority_impersonation",
    "prize_scam",
    "domain_check",
    "credential_hygiene",
    "defence_protocol"
  ],

  "prerequisites": ["M4"],

  "unlocks": ["M6", "M17"],

  "d1_logging": {
    "table": "unlocked_modules",
    "columns": ["child_id", "module_id", "triggered_at"],
    "duplicate_guard": "INSERT OR IGNORE"
  }
}
```

---

## PEDAGOGICAL NOTES
*(For module authors)*

- **Moat Type: Pedagogical Moat.** No mainstream kids' finance app teaches phishing defence or domain checking. Online safety is treated as a separate subject from financial literacy; Morechard integrates both because the harm vector is direct and financial.
- **Trigger rationale:** An HTTP link in a goal title is an unusual and specific signal — most 10–12 year olds don't type URLs into goal names unless something prompted them to. A scam flag raised by a parent is a direct behaviour signal. Both warrant immediate module delivery.
- **Non-alarmist framing:** The lesson must not say "never trust anything online." The goal is pattern recognition and a clear decision protocol — not blanket suspicion that would make the child unable to function digitally.
- **Labor equivalent in Lab:** Calculating how many chores their balance represents makes the abstract loss of "all your money" concrete and personal. This is the key Morechard data advantage over static curriculum.
- **Household neutrality:** Bonus challenge uses "a parent you're with" — most adults have received phishing messages and can share an example.
- **Scam_flag_raised privacy:** If the trigger was a parent scam flag, the Hook acknowledges something unusual was noticed without specifying who noticed it. Avoid framing the parent as having reported the child.
