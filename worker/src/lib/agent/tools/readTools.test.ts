import { describe, it, expect, beforeEach } from 'vitest';
import { registerReadTools } from './readTools.js';
import { getTool, resetRegistryForTests } from '../registry.js';

describe('registerReadTools', () => {
  beforeEach(() => resetRegistryForTests());

  const expectedTools = [
    'get_family_license_state',
    'get_family_members',
    'get_payment_audit_log',
    'get_ledger_tail',
    'get_login_attempt_state',
    'get_active_sessions',
  ];

  it('registers all six Diagnostic Toolkit queries as tier "read"', () => {
    registerReadTools();
    for (const name of expectedTools) {
      const tool = getTool(name);
      expect(tool, `expected "${name}" to be registered`).toBeDefined();
      expect(tool?.tier).toBe('read');
    }
  });

  it('is idempotent-safe to call once per cold start (does not throw on a fresh registry)', () => {
    expect(() => registerReadTools()).not.toThrow();
  });
});
