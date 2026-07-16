import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: vi.fn(() => false) } }));

vi.mock('@simplewebauthn/browser', () => ({
  startRegistration: vi.fn(async () => ({ id: 'cred_abc', rawId: 'cred_abc', response: {}, type: 'public-key' })),
  startAuthentication: vi.fn(async () => ({ id: 'cred_abc', rawId: 'cred_abc', response: {}, type: 'public-key' })),
}));

vi.mock('./webauthnNative', () => ({
  isNativeBiometricsAvailable: vi.fn(async () => true),
  registerNativeKey: vi.fn(async () => ({ ok: true, publicKey: 'native-pubkey' })),
  signNativeChallenge: vi.fn(async () => ({ ok: true, publicKey: 'native-pubkey', signature: 'native-sig' })),
  clearNativeKey: vi.fn(async () => undefined),
}));

const apiMocks = vi.hoisted(() => ({
  webauthnRegisterOptions: vi.fn(),
  webauthnRegisterVerify: vi.fn(async () => ({ ok: true })),
  webauthnLoginOptions: vi.fn(),
  webauthnLoginVerify: vi.fn(async () => ({ token: 'jwt.token.here', expires_in: 3600 })),
  setToken: vi.fn(async () => undefined),
  getUserId: vi.fn(() => 'user_1'),
  getRole: vi.fn(() => 'parent' as const),
}));
vi.mock('./api', () => apiMocks);

vi.mock('./authState', () => ({ primeAuthState: vi.fn(async () => undefined) }));

import { Capacitor } from '@capacitor/core';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import * as nativeModule from './webauthnNative';
import { primeAuthState } from './authState';
import {
  isBiometricsAvailable, registerBiometrics, challengeBiometrics,
  hasBiometricCredential, clearBiometricCredential,
} from './biometrics';

beforeEach(() => {
  vi.clearAllMocks();
  (Capacitor.isNativePlatform as ReturnType<typeof vi.fn>).mockReturnValue(false);
  localStorage.clear();
  apiMocks.getUserId.mockReturnValue('user_1');
  apiMocks.getRole.mockReturnValue('parent');
  // isBiometricsAvailable() on web checks this — mocked here (not just in the
  // dedicated describe block below) so every web-path test, not only the
  // ones that test isBiometricsAvailable() directly, sees platform support.
  Object.defineProperty(window, 'PublicKeyCredential', {
    value: { isUserVerifyingPlatformAuthenticatorAvailable: vi.fn(async () => true) },
    configurable: true,
  });
});

describe('registerBiometrics — web platform', () => {
  it('runs the real WebAuthn ceremony and marks the device registered on success', async () => {
    apiMocks.webauthnRegisterOptions.mockResolvedValue({ platform: 'web', options: { challenge: 'x' } });
    const result = await registerBiometrics('user_1', 'Ada');
    expect(result.ok).toBe(true);
    expect(startRegistration).toHaveBeenCalledOnce();
    expect(apiMocks.webauthnRegisterVerify).toHaveBeenCalledWith({ platform: 'web', response: expect.any(Object) });
    expect(hasBiometricCredential()).toBe(true);
  });

  it('does not mark the device registered if the ceremony is cancelled', async () => {
    apiMocks.webauthnRegisterOptions.mockResolvedValue({ platform: 'web', options: { challenge: 'x' } });
    (startRegistration as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('NotAllowedError'));
    const result = await registerBiometrics('user_1', 'Ada');
    expect(result.ok).toBe(false);
    expect(hasBiometricCredential()).toBe(false);
  });
});

describe('registerBiometrics — native platform', () => {
  beforeEach(() => (Capacitor.isNativePlatform as ReturnType<typeof vi.fn>).mockReturnValue(true));

  it('runs the native ceremony and marks the device registered on success', async () => {
    apiMocks.webauthnRegisterOptions.mockResolvedValue({ platform: 'native', challenge: 'chal' });
    const result = await registerBiometrics('user_1', 'Ada');
    expect(result.ok).toBe(true);
    expect(nativeModule.registerNativeKey).toHaveBeenCalledWith('user_1');
    expect(apiMocks.webauthnRegisterVerify).toHaveBeenCalledWith({ platform: 'native', publicKey: 'native-pubkey' });
    expect(hasBiometricCredential()).toBe(true);
  });

  it('does not mark the device registered if the native key step fails', async () => {
    apiMocks.webauthnRegisterOptions.mockResolvedValue({ platform: 'native', challenge: 'chal' });
    (nativeModule.registerNativeKey as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, reason: 'denied' });
    const result = await registerBiometrics('user_1', 'Ada');
    expect(result.ok).toBe(false);
    expect(hasBiometricCredential()).toBe(false);
  });
});

describe('challengeBiometrics', () => {
  it('returns unavailable immediately if this device was never registered', async () => {
    const result = await challengeBiometrics();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('unavailable');
    expect(apiMocks.webauthnLoginOptions).not.toHaveBeenCalled();
  });

  it('on web: runs the assertion, verifies, sets the token, and re-primes authState', async () => {
    localStorage.setItem('mc_biometric_registered', '1');
    apiMocks.webauthnLoginOptions.mockResolvedValue({ platform: 'web', options: { challenge: 'x' } });

    const result = await challengeBiometrics();
    expect(result.ok).toBe(true);
    expect(startAuthentication).toHaveBeenCalledOnce();
    expect(apiMocks.setToken).toHaveBeenCalledWith('jwt.token.here');
    expect(primeAuthState).toHaveBeenCalledOnce();
  });

  it('on native: signs via webauthnNative and treats a missing local key as unavailable (re-registration path)', async () => {
    (Capacitor.isNativePlatform as ReturnType<typeof vi.fn>).mockReturnValue(true);
    localStorage.setItem('mc_biometric_registered', '1');
    apiMocks.webauthnLoginOptions.mockResolvedValue({ platform: 'native', challenge: 'chal' });
    (nativeModule.signNativeChallenge as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, reason: 'unavailable' });

    const result = await challengeBiometrics();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('unavailable');
  });
});

describe('hasBiometricCredential / clearBiometricCredential', () => {
  it('reflects and clears the local registration flag synchronously', () => {
    expect(hasBiometricCredential()).toBe(false);
    localStorage.setItem('mc_biometric_registered', '1');
    expect(hasBiometricCredential()).toBe(true);
    clearBiometricCredential();
    expect(hasBiometricCredential()).toBe(false);
  });
});

describe('isBiometricsAvailable', () => {
  it('delegates to the platform authenticator check on web', async () => {
    Object.defineProperty(window, 'PublicKeyCredential', {
      value: { isUserVerifyingPlatformAuthenticatorAvailable: vi.fn(async () => true) },
      configurable: true,
    });
    expect(await isBiometricsAvailable()).toBe(true);
  });

  it('delegates to isNativeBiometricsAvailable on native', async () => {
    (Capacitor.isNativePlatform as ReturnType<typeof vi.fn>).mockReturnValue(true);
    expect(await isBiometricsAvailable()).toBe(true);
    expect(nativeModule.isNativeBiometricsAvailable).toHaveBeenCalledOnce();
  });
});
