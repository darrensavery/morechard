import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logger } from './logger.js';

describe('logger', () => {
  const consoleSpy = {
    log:   vi.spyOn(console, 'log').mockImplementation(() => {}),
    warn:  vi.spyOn(console, 'warn').mockImplementation(() => {}),
    error: vi.spyOn(console, 'error').mockImplementation(() => {}),
  };

  beforeEach(() => {
    consoleSpy.log.mockClear();
    consoleSpy.warn.mockClear();
    consoleSpy.error.mockClear();
  });

  // ── Routing to the correct console method ─────────────────────────────────

  it('routes INFO to console.log', () => {
    logger.info('testLabel', 'hello');
    expect(consoleSpy.log).toHaveBeenCalledOnce();
    expect(consoleSpy.warn).not.toHaveBeenCalled();
    expect(consoleSpy.error).not.toHaveBeenCalled();
  });

  it('routes WARN to console.warn', () => {
    logger.warn('testLabel', 'careful');
    expect(consoleSpy.warn).toHaveBeenCalledOnce();
    expect(consoleSpy.log).not.toHaveBeenCalled();
    expect(consoleSpy.error).not.toHaveBeenCalled();
  });

  it('routes ERROR to console.error', () => {
    logger.error('testLabel', 'boom');
    expect(consoleSpy.error).toHaveBeenCalledOnce();
    expect(consoleSpy.log).not.toHaveBeenCalled();
    expect(consoleSpy.warn).not.toHaveBeenCalled();
  });

  // ── Required fields in every output ──────────────────────────────────────

  function parsedOutput(spy: typeof consoleSpy.log): Record<string, unknown> {
    return JSON.parse(spy.mock.calls[0][0] as string);
  }

  it('includes level, label, message, and ts in INFO output', () => {
    logger.info('myRoute', 'user logged in');
    const entry = parsedOutput(consoleSpy.log);
    expect(entry.level).toBe('INFO');
    expect(entry.label).toBe('myRoute');
    expect(entry.message).toBe('user logged in');
    expect(typeof entry.ts).toBe('string');
  });

  it('includes level in WARN output', () => {
    logger.warn('myRoute', 'suspicious');
    const entry = parsedOutput(consoleSpy.warn);
    expect(entry.level).toBe('WARN');
  });

  it('includes level in ERROR output', () => {
    logger.error('myRoute', 'failed');
    const entry = parsedOutput(consoleSpy.error);
    expect(entry.level).toBe('ERROR');
  });

  it('ts is a valid ISO 8601 timestamp', () => {
    logger.info('route', 'msg');
    const entry = parsedOutput(consoleSpy.log);
    expect(() => new Date(entry.ts as string)).not.toThrow();
    expect(isNaN(new Date(entry.ts as string).getTime())).toBe(false);
  });

  // ── Context fields are spread into the output ────────────────────────────

  it('spreads context fields into the entry', () => {
    logger.info('handleSpending', 'logged', { child_id: 'c1', amount: 150 });
    const entry = parsedOutput(consoleSpy.log);
    expect(entry.child_id).toBe('c1');
    expect(entry.amount).toBe(150);
  });

  it('works without context (optional param)', () => {
    expect(() => logger.info('route', 'no ctx')).not.toThrow();
    const entry = parsedOutput(consoleSpy.log);
    expect(entry.message).toBe('no ctx');
  });

  // ── Output is valid JSON ──────────────────────────────────────────────────

  it('output is always valid JSON (INFO)', () => {
    logger.info('r', 'test', { nested: { a: 1 } });
    expect(() => JSON.parse(consoleSpy.log.mock.calls[0][0] as string)).not.toThrow();
  });

  it('output is always valid JSON (ERROR)', () => {
    logger.error('r', 'fail', { code: 500 });
    expect(() => JSON.parse(consoleSpy.error.mock.calls[0][0] as string)).not.toThrow();
  });
});
