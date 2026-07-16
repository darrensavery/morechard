// app/src/lib/biometrics.ts
//
// Real, server-verified biometric login. On web this is a genuine WebAuthn
// ceremony (@simplewebauthn/browser); on native (Capacitor) it's an ECDSA
// key pair gated by a native biometric prompt (webauthnNative.ts). Either
// way, a successful check both unlocks the device AND (re)issues a real
// login session — see
// docs/superpowers/specs/2026-07-16-webauthn-verification-design.md.
//
// Exported function names/signatures are unchanged from the previous
// (unverified) version so every existing call site — Stage3SecureApp,
// JoinFamilyScreen, PinManagementSettings, useGatekeeper, LockScreen —
// needs zero changes.

import { Capacitor } from '@capacitor/core';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import {
  webauthnRegisterOptions, webauthnRegisterVerify, webauthnLoginOptions, webauthnLoginVerify,
  setToken, getUserId, getRole,
} from './api';
import {
  isNativeBiometricsAvailable, registerNativeKey, signNativeChallenge, clearNativeKey,
} from './webauthnNative';
import { primeAuthState } from './authState';

export type BiometricResult =
  | { ok: true; method: 'biometrics' }
  | { ok: false; reason: 'unavailable' | 'denied' | 'error'; message?: string }

const REGISTERED_FLAG_KEY = 'mc_biometric_registered';

/** True if this device/platform supports biometric authentication at all. */
export async function isBiometricsAvailable(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) return isNativeBiometricsAvailable();
  try {
    if (!window.PublicKeyCredential) return false;
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/**
 * Registers a real, server-verified biometric credential for this device.
 * Called once during "Secure your App" setup — always while the caller
 * already holds a valid session (registration is an authenticated
 * endpoint), so `userId`/role are derived server-side from that session,
 * not trusted from any client input.
 */
export async function registerBiometrics(userId: string, displayName: string): Promise<BiometricResult> {
  try {
    const available = await isBiometricsAvailable();
    if (!available) return { ok: false, reason: 'unavailable' };

    if (Capacitor.isNativePlatform()) {
      await webauthnRegisterOptions('native', displayName); // primes the server-side challenge
      const keyResult = await registerNativeKey(userId);
      if (!keyResult.ok) return { ok: false, reason: keyResult.reason, message: keyResult.message };

      await webauthnRegisterVerify({ platform: 'native', publicKey: keyResult.publicKey });
      localStorage.setItem(REGISTERED_FLAG_KEY, '1');
      return { ok: true, method: 'biometrics' };
    }

    const optionsResult = await webauthnRegisterOptions('web', displayName);
    if (optionsResult.platform !== 'web') return { ok: false, reason: 'error', message: 'unexpected platform in server response' };

    const response = await startRegistration({ optionsJSON: optionsResult.options as never });
    await webauthnRegisterVerify({ platform: 'web', response: response as unknown as Record<string, unknown> });
    localStorage.setItem(REGISTERED_FLAG_KEY, '1');
    return { ok: true, method: 'biometrics' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('NotAllowedError') || msg.toLowerCase().includes('cancel')) {
      return { ok: false, reason: 'denied' };
    }
    return { ok: false, reason: 'error', message: msg };
  }
}

/**
 * Issues a biometric challenge. On success this both proves "still you" AND
 * (re)issues a real session — a successful check here is sufficient to
 * re-authenticate even if the underlying cookie/token had fully expired.
 */
export async function challengeBiometrics(): Promise<BiometricResult> {
  if (!hasBiometricCredential()) return { ok: false, reason: 'unavailable' };

  const userId = getUserId();
  const role = getRole();
  if (!userId || !role) return { ok: false, reason: 'unavailable' };

  try {
    const available = await isBiometricsAvailable();
    if (!available) return { ok: false, reason: 'unavailable' };

    if (Capacitor.isNativePlatform()) {
      const optionsResult = await webauthnLoginOptions(userId, role, 'native');
      if (optionsResult.platform !== 'native') return { ok: false, reason: 'error' };

      const signResult = await signNativeChallenge(userId, optionsResult.challenge);
      if (!signResult.ok) return { ok: false, reason: signResult.reason, message: signResult.message };

      const verifyResult = await webauthnLoginVerify({
        platform: 'native', user_id: userId, role,
        public_key: signResult.publicKey, signature: signResult.signature,
      });
      await setToken(verifyResult.token);
      await primeAuthState();
      return { ok: true, method: 'biometrics' };
    }

    const optionsResult = await webauthnLoginOptions(userId, role, 'web');
    if (optionsResult.platform !== 'web') return { ok: false, reason: 'error' };

    const assertion = await startAuthentication({ optionsJSON: optionsResult.options as never });
    const verifyResult = await webauthnLoginVerify({
      platform: 'web', user_id: userId, role, response: assertion as unknown as Record<string, unknown>,
    });
    await setToken(verifyResult.token); // no-op on web — the cookie is already set by the response
    await primeAuthState();
    return { ok: true, method: 'biometrics' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('NotAllowedError') || msg.toLowerCase().includes('cancel')) {
      return { ok: false, reason: 'denied' };
    }
    return { ok: false, reason: 'error', message: msg };
  }
}

/**
 * Synchronous local check — "did registration succeed on this device."
 * The real credential (public key) lives server-side; this is just a fast,
 * synchronous UI-gating flag, not the source of truth. If the client-side
 * key/ceremony state is ever actually missing when challenged (IndexedDB
 * cleared, stale pre-upgrade localStorage-only state), `challengeBiometrics`
 * / `registerNativeKey`'s own checks report 'unavailable' at that point —
 * this flag only controls whether we *attempt* the flow at all.
 */
export function hasBiometricCredential(): boolean {
  return localStorage.getItem(REGISTERED_FLAG_KEY) === '1';
}

export function clearBiometricCredential(): void {
  localStorage.removeItem(REGISTERED_FLAG_KEY);
  const userId = getUserId();
  if (userId && Capacitor.isNativePlatform()) void clearNativeKey(userId);
}
