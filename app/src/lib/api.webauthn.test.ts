import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: vi.fn(() => false) } }));
vi.mock('capacitor-secure-storage-plugin', () => ({ SecureStoragePlugin: { get: vi.fn(), set: vi.fn(), remove: vi.fn() } }));

const originalFetch = globalThis.fetch;

beforeEach(() => {
  globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })) as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

import {
  webauthnRegisterOptions, webauthnRegisterVerify, webauthnLoginOptions, webauthnLoginVerify,
} from './api';

describe('webauthn api.ts wrappers', () => {
  it('webauthnRegisterOptions POSTs to /auth/webauthn/register/options', async () => {
    await webauthnRegisterOptions('native');
    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toContain('/auth/webauthn/register/options');
    expect(JSON.parse(call[1].body)).toEqual({ platform: 'native' });
  });

  it('webauthnRegisterVerify POSTs the given payload to /auth/webauthn/register/verify', async () => {
    await webauthnRegisterVerify({ platform: 'native', publicKey: 'abc' });
    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toContain('/auth/webauthn/register/verify');
  });

  it('webauthnLoginOptions POSTs user_id/role/platform to /auth/webauthn/login/options', async () => {
    await webauthnLoginOptions('user_1', 'parent', 'web');
    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toContain('/auth/webauthn/login/options');
    expect(JSON.parse(call[1].body)).toEqual({ user_id: 'user_1', role: 'parent', platform: 'web' });
  });

  it('webauthnLoginVerify POSTs the given payload to /auth/webauthn/login/verify', async () => {
    await webauthnLoginVerify({ platform: 'native', user_id: 'user_1', role: 'parent', public_key: 'pk', signature: 'sig' });
    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toContain('/auth/webauthn/login/verify');
  });
});
