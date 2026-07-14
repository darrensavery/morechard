import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerTool, getTool, invokeReadTool, invokeAutoTool, resetRegistryForTests,
  ToolNotRegisteredError, ToolTierNotEnabledError,
} from './registry.js';

describe('tool registry', () => {
  beforeEach(() => resetRegistryForTests());

  it('registers and retrieves a tool by name', () => {
    registerTool({ name: 'foo', tier: 'read', description: 'test', handler: async () => 'ok' });
    expect(getTool('foo')?.tier).toBe('read');
  });

  it('throws when registering the same tool name twice', () => {
    registerTool({ name: 'foo', tier: 'read', description: 'test', handler: async () => 'ok' });
    expect(() =>
      registerTool({ name: 'foo', tier: 'read', description: 'dup', handler: async () => 'ok' }),
    ).toThrow(/already registered/);
  });

  it('getTool returns undefined for an unknown name', () => {
    expect(getTool('does-not-exist')).toBeUndefined();
  });

  it('invokeReadTool executes a registered read-tier tool', async () => {
    registerTool({ name: 'foo', tier: 'read', description: 'test', handler: async (_env, payload) => ({ echoed: payload }) });
    const result = await invokeReadTool('foo', {} as never, { x: 1 });
    expect(result).toEqual({ echoed: { x: 1 } });
  });

  it('invokeReadTool throws ToolNotRegisteredError for an unknown tool (default-deny)', async () => {
    await expect(invokeReadTool('nope', {} as never, {})).rejects.toBeInstanceOf(ToolNotRegisteredError);
  });

  it('invokeReadTool throws ToolTierNotEnabledError for a registered AUTO tool', async () => {
    registerTool({ name: 'send_reply', tier: 'auto', description: 'test', handler: async () => 'sent' });
    await expect(invokeReadTool('send_reply', {} as never, {})).rejects.toBeInstanceOf(ToolTierNotEnabledError);
  });

  it('invokeReadTool throws ToolTierNotEnabledError for a registered GATED tool', async () => {
    registerTool({ name: 'grant_license', tier: 'gated', description: 'test', handler: async () => 'granted' });
    await expect(invokeReadTool('grant_license', {} as never, {})).rejects.toBeInstanceOf(ToolTierNotEnabledError);
  });

  it('invokeAutoTool executes a registered auto-tier tool', async () => {
    registerTool({ name: 'resend_magic_link', tier: 'auto', description: 'test', handler: async (_env, payload) => ({ echoed: payload }) });
    const result = await invokeAutoTool('resend_magic_link', {} as never, { email: 'a@b.com' });
    expect(result).toEqual({ echoed: { email: 'a@b.com' } });
  });

  it('invokeAutoTool throws ToolNotRegisteredError for an unknown tool (default-deny)', async () => {
    await expect(invokeAutoTool('nope', {} as never, {})).rejects.toBeInstanceOf(ToolNotRegisteredError);
  });

  it('invokeAutoTool throws ToolTierNotEnabledError for a registered READ tool', async () => {
    registerTool({ name: 'foo', tier: 'read', description: 'test', handler: async () => 'ok' });
    await expect(invokeAutoTool('foo', {} as never, {})).rejects.toBeInstanceOf(ToolTierNotEnabledError);
  });

  it('invokeAutoTool throws ToolTierNotEnabledError for a registered GATED tool', async () => {
    registerTool({ name: 'grant_license', tier: 'gated', description: 'test', handler: async () => 'granted' });
    await expect(invokeAutoTool('grant_license', {} as never, {})).rejects.toBeInstanceOf(ToolTierNotEnabledError);
  });
});
