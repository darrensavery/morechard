import { describe, it, expect } from 'vitest';
import { buildDiagnosisPrompt } from './diagnose.js';

describe('buildDiagnosisPrompt', () => {
  it('includes the matched playbook section, resolved identity, and READ tool results', () => {
    const prompt = buildDiagnosisPrompt({
      playbookSection: '## 06 Billing\nStripe is authoritative for the actual charge.',
      resolvedFamilyId: 'fam_123',
      readToolResults: { get_payment_audit_log: [{ id: 1, payment_type: 'COMPLETE' }] },
      incidentText: 'I paid but the app is still locked',
    });
    expect(prompt).toContain('## 06 Billing');
    expect(prompt).toContain('fam_123');
    expect(prompt).toContain('get_payment_audit_log');
    expect(prompt).toContain('---BEGIN INCIDENT---');
    expect(prompt).toContain('---END INCIDENT---');
  });

  it('states unresolved identity explicitly rather than omitting it silently', () => {
    const prompt = buildDiagnosisPrompt({
      playbookSection: '## 01 Accounts',
      resolvedFamilyId: null,
      readToolResults: {},
      incidentText: 'user@typo.con says they cannot log in',
    });
    expect(prompt).toContain('identity could not be confirmed');
  });
});
