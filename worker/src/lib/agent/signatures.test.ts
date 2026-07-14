import { describe, it, expect } from 'vitest';
import {
  verifyStripeSupportAgentSignature,
  verifySentrySignature,
} from './signatures.js';

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

describe('verifyStripeSupportAgentSignature', () => {
  it('accepts a correctly signed, fresh payload', async () => {
    const secret = 'whsec_test';
    const rawBody = '{"type":"charge.failed"}';
    const timestamp = Math.floor(Date.now() / 1000);
    const v1 = await hmacHex(secret, `${timestamp}.${rawBody}`);
    const header = `t=${timestamp},v1=${v1}`;
    expect(await verifyStripeSupportAgentSignature(rawBody, header, secret)).toBe(true);
  });

  it('rejects a tampered body', async () => {
    const secret = 'whsec_test';
    const timestamp = Math.floor(Date.now() / 1000);
    const v1 = await hmacHex(secret, `${timestamp}.{"type":"charge.failed"}`);
    const header = `t=${timestamp},v1=${v1}`;
    expect(await verifyStripeSupportAgentSignature('{"type":"charge.succeeded"}', header, secret)).toBe(false);
  });

  it('rejects a stale timestamp (>5 minutes old)', async () => {
    const secret = 'whsec_test';
    const rawBody = '{"type":"charge.failed"}';
    const staleTimestamp = Math.floor(Date.now() / 1000) - 400;
    const v1 = await hmacHex(secret, `${staleTimestamp}.${rawBody}`);
    const header = `t=${staleTimestamp},v1=${v1}`;
    expect(await verifyStripeSupportAgentSignature(rawBody, header, secret)).toBe(false);
  });

  it('rejects a malformed signature header', async () => {
    expect(await verifyStripeSupportAgentSignature('{}', 'garbage', 'secret')).toBe(false);
  });
});

describe('verifySentrySignature', () => {
  it('accepts a correctly signed payload', async () => {
    const secret = 'sentry_test_secret';
    const rawBody = '{"action":"triggered","data":{"issue":{"id":"123"}}}';
    const sig = await hmacHex(secret, rawBody);
    expect(await verifySentrySignature(rawBody, sig, secret)).toBe(true);
  });

  it('rejects a tampered payload', async () => {
    const secret = 'sentry_test_secret';
    const sig = await hmacHex(secret, '{"action":"triggered"}');
    expect(await verifySentrySignature('{"action":"resolved"}', sig, secret)).toBe(false);
  });
});
