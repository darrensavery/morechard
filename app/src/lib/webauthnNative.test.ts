// app/src/lib/webauthnNative.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@aparajita/capacitor-biometric-auth', () => ({
  BiometricAuth: {
    checkBiometry: vi.fn(async () => ({ isAvailable: true })),
    authenticate: vi.fn(async () => undefined),
  },
  BiometryError: class BiometryError extends Error {
    code: string;
    constructor(message: string, code: string) { super(message); this.code = code; }
  },
  BiometryErrorType: {
    userCancel: 'userCancel',
    biometryNotAvailable: 'biometryNotAvailable',
    authenticationFailed: 'authenticationFailed',
  },
}));

import { BiometricAuth, BiometryError, BiometryErrorType } from '@aparajita/capacitor-biometric-auth';
import {
  isNativeBiometricsAvailable, registerNativeKey, signNativeChallenge, clearNativeKey,
} from './webauthnNative';

function deleteVaultDb(): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase('morechard-webauthn-vault');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}

beforeEach(async () => {
  vi.clearAllMocks();
  (BiometricAuth.checkBiometry as ReturnType<typeof vi.fn>).mockResolvedValue({ isAvailable: true });
  (BiometricAuth.authenticate as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  await deleteVaultDb();
});

function toBase64Url(input: ArrayBuffer): string {
  const bytes = new Uint8Array(input);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

describe('isNativeBiometricsAvailable', () => {
  it('reflects checkBiometry().isAvailable', async () => {
    expect(await isNativeBiometricsAvailable()).toBe(true);
    (BiometricAuth.checkBiometry as ReturnType<typeof vi.fn>).mockResolvedValue({ isAvailable: false });
    expect(await isNativeBiometricsAvailable()).toBe(false);
  });

  it('returns false if checkBiometry throws', async () => {
    (BiometricAuth.checkBiometry as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('no plugin'));
    expect(await isNativeBiometricsAvailable()).toBe(false);
  });
});

describe('registerNativeKey', () => {
  it('generates and persists a key pair, returning a usable base64url public key', async () => {
    const result = await registerNativeKey('user_1');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.publicKey).not.toMatch(/[+/=]/);
      expect(BiometricAuth.authenticate).toHaveBeenCalledOnce();
    }
  });

  it('does not generate a key if the biometric prompt is denied', async () => {
    (BiometricAuth.authenticate as ReturnType<typeof vi.fn>).mockRejectedValue(
      new BiometryError('cancelled', BiometryErrorType.userCancel),
    );
    const result = await registerNativeKey('user_1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('denied');
  });

  it('reports unavailable when the device has no biometry', async () => {
    (BiometricAuth.checkBiometry as ReturnType<typeof vi.fn>).mockResolvedValue({ isAvailable: false });
    const result = await registerNativeKey('user_1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('unavailable');
  });
});

describe('signNativeChallenge — real key round trip', () => {
  it('signs a challenge with the previously registered key, verifiable against the exported public key', async () => {
    const reg = await registerNativeKey('user_1');
    expect(reg.ok).toBe(true);
    if (!reg.ok) return;

    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const challengeB64Url = toBase64Url(challenge.buffer as ArrayBuffer);

    const result = await signNativeChallenge('user_1', challengeB64Url);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.publicKey).toBe(reg.publicKey);

    // Independently verify the signature to prove the private key really
    // signed this exact challenge (catches export-format mismatches).
    const spkiBytes = Uint8Array.from(atob(result.publicKey.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    const publicKey = await crypto.subtle.importKey('spki', spkiBytes, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    const sigBytes = Uint8Array.from(atob(result.signature.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, publicKey, sigBytes, challenge);
    expect(valid).toBe(true);
  });

  it('reports unavailable when no key has been registered on this device', async () => {
    const result = await signNativeChallenge('never_registered_user', 'AAAA');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('unavailable');
  });
});

describe('clearNativeKey', () => {
  it('removes the stored key so signing afterward reports unavailable', async () => {
    await registerNativeKey('user_1');
    await clearNativeKey('user_1');
    const result = await signNativeChallenge('user_1', 'AAAA');
    expect(result.ok).toBe(false);
  });
});
