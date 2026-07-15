# Security Documentation Index (Morechard)

Central repository for every security audit, penetration test, and
compliance questionnaire response run against Morechard. The point of this
folder: when a school, partner, or auditor asks "have you assessed X",
answer from here first — don't re-run a full audit from scratch every time.

## Structure

```
docs/security/
  00-index.md              — this file
  audits/                  — one file per audit/pentest, named YYYY-MM-DD-<short-name>.md
  questionnaire-answers.md — reusable answers to common security-questionnaire questions
```

## Audit log

| Date | Audit | Scope | Result |
|------|-------|-------|--------|
| 2026-07-15 | [Production security audit](audits/2026-07-15-production-security-audit.md) | 13-domain review ahead of a potential school endorsement (auth, database, app security, hosting, deployment, scaling, recovery, monitoring, secrets, supply chain, compliance) | 8 gaps closed same-day; 5 items explicitly deferred (see doc) |

## Related documents (not moved here — cross-referenced)

- [`docs/governance/cyber-essentials-checklist.md`](../governance/cyber-essentials-checklist.md) — NCSC/IASME Cyber Essentials readiness checklist. Org/account-level items (MFA, device inventory, legal entity details) that only Darren can action — not code-fixable, tracked separately from the technical audits in this folder.
- [`docs/governance/lia/`](../governance/lia/) — Legitimate Interest Assessment (UK GDPR basis for the 7-year pseudonymised ledger retention).
- [`docs/governance/privacy/`](../governance/privacy/) — privacy/data-protection source documents.
- [`docs/dev/d1-backup-recovery-runbook.md`](../dev/d1-backup-recovery-runbook.md) — D1 Time Travel restore procedure, RPO/RTO. Written as a byproduct of the 2026-07-15 audit; lives in `docs/dev/` because it's an operational runbook, not an audit record — linked here for discoverability.

## When a new audit/questionnaire comes in

1. Check the table above first — many questions ("do you encrypt data at rest", "do you have a backup policy", "what's your incident process") already have a documented, dated answer.
2. If the audit is genuinely new in scope, run it and add a new file under `audits/` following the format of the 2026-07-15 one (scope, method, findings by severity, remediation status, what's deferred and why).
3. Update `questionnaire-answers.md` with any new Q&A pairs worth reusing — keep answers dated, since infrastructure changes over time and a stale answer is worse than none.
4. Add a row to the table above.

## What this folder deliberately does NOT claim

None of the documents in this folder constitute a formal certification (SOC 2, ISO 27001, Cyber Essentials Plus, etc.) unless explicitly labelled as an auditor's attestation. They are internal self-assessments and remediation logs — useful as evidence of due diligence and as a fast-answer source for questionnaires, but not a substitute for third-party certification if a partner requires one.
