# Cyber Essentials Readiness Checklist — Morechard

Working checklist to close the gaps between Morechard's actual setup and the NCSC/IASME Cyber Essentials requirements. Tick items off as you resolve them (`- [ ]` → `- [x]`).

**Legend:** 🔴 Blocking (likely automatic fail if unresolved) · 🟠 Needs input (only you know the answer) · 🟢 Confirm (probably fine — verify and check off)

---

## 🔴 Priority — fix before applying

- [ ] 🔴 **Resolve the Windows 10 end-of-support gap.** This dev environment reports Windows 10 (10.0.19045). Support ended 14 Oct 2025 — CE checks this directly (A6.1). Upgrade to Windows 11, or enrol in Microsoft's Extended Security Update programme.
- [ ] 🔴 **Enable MFA on Cloudflare** (Pages, Workers, D1 access)
- [ ] 🔴 **Enable MFA on GitHub** (repo + Actions access)
- [ ] 🔴 **Enable MFA on Stripe** (live payment keys — both standard and admin users)
- [ ] 🔴 **Enable MFA on the OpenAI platform account** (used for gpt-4o-mini AI Mentor briefings)
- [ ] 🔴 **Enable MFA on Sentry** (error tracking)
- [ ] 🔴 **Enable MFA on PostHog** (session replays — enable before it goes live)
- [ ] 🟠 **Enable MFA on your email/domain provider** — not captured in project memory; confirm which provider you use (Google Workspace, Cloudflare Email Routing, etc.)

---

## A1–A2 — Scope & organisation details

- [ ] 🟠 Confirm the legal entity name for the certificate (A1.1 — must match a real legal entity, max 150 characters)
- [ ] 🟠 Confirm organisation type (A1.2 — likely Sole Trader (SOL) based on solo-dev signals; confirm)
- [ ] 🟠 Confirm employee/contractor count (A1.3 — include yourself plus anyone with access to organisational data)
- [ ] 🟢 Decide whole-organisation vs partial scope (A2.1 — Whole Organisation is simplest for a solo/small setup, no sub-set segregation needed)
- [ ] 🟠 List every in-scope device: make + OS + version (A2.6 — every laptop/desktop used to develop or administer Morechard)
- [ ] 🟢 Confirm the full cloud services list (A2.9 — Cloudflare, GitHub, Stripe, OpenAI, Sentry, PostHog, plus email/domain provider; none can be excluded from scope)

## A4 — Firewalls

- [ ] 🟠 Confirm router/firewall admin password isn't default (your home/office router)
- [ ] 🟢 Confirm software firewall is enabled on dev machine(s) (Windows Defender Firewall, turned on)
- [ ] 🟠 Audit Worker admin/debug routes for unauthenticated access (check `api.morechard.com` for any route reachable without auth)
- [ ] 🟢 Confirm no unnecessary inbound firewall rules remain

## A5 — Secure configuration

- [ ] 🟠 Audit for stale/unused accounts across Cloudflare, GitHub, Stripe, OpenAI, Sentry, PostHog
- [ ] 🟠 Confirm device lock is enabled on dev devices (PIN, biometric, or password before access)
- [ ] 🟢 Confirm auto-run is disabled on dev devices (default on modern Windows — verify)
- [ ] 🟢 Confirm no default passwords remain anywhere

## A6 — Security update management

- [ ] 🟠 List browser(s) + version in use on the dev device
- [ ] 🟠 Document malware protection software + version (see Malware Protection below)
- [ ] 🟢 Confirm automatic updates are enabled where possible (OS and applications on dev devices)

## A7 — User access control (highest-risk section — feeds the blocking MFA checks above)

- [ ] 🟠 Confirm no shared logins across contractors/co-founders
- [ ] 🟠 Document the account approval/removal process (even solo: "I approve and remove my own accounts" is valid, but must be written down)
- [ ] 🟠 Separate admin activity from day-to-day browsing/email on dev device
- [ ] 🟠 Confirm password policy across all accounts (12+ characters, or 8+ with MFA/deny-list enforced)

## A8 — Malware protection

- [ ] 🟢 Confirm anti-malware is active on the dev device (Windows Defender is explicitly acceptable)
- [ ] 🟢 Confirm mobile devices used for admin access are restricted to signed apps (app-store/code-signing restriction should cover this by default on iOS/Android)

## Open decisions (not gaps — decisions to make)

- [ ] 🟢 Cyber Essentials vs Cyber Essentials Plus — Plus adds independent testing (vulnerability scans, phishing/malware test files, live MFA checks); standard CE is the natural starting point for a solo/small setup
- [ ] 🟢 Insurance opt-in (A3.1/A3.2) — only relevant if UK/Crown-dependency domiciled with turnover under £20m

---
*Sources: NCSC/IASME Cyber Essentials Question Set v16.3 (May 2026), Cyber Essentials: Requirements for IT Infrastructure v3.3, Cyber Essentials Plus Test Specification v3.2 — cross-referenced against Morechard's `CLAUDE.md` and project memory.*
