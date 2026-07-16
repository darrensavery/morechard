// app/src/lib/webauthnNative.ts
//
// Native (Capacitor) equivalent of a WebAuthn credential: a non-extractable
// ECDSA P-256 key pair generated with Web Crypto, persisted directly in
// IndexedDB (CryptoKey objects support structured clone — the exact same
// technique already shipped for the encrypted bank vault in
// localBankDetails.ts), and gated behind a native biometric prompt
// (Face ID / Touch ID / fingerprint) before every use.
//
// This is deliberately NOT true Secure-Enclave/Android-Keystore-backed
// signing — that would require custom native Swift/Kotlin plugin code,
// untestable on real hardware in this environment. The private key is
// WebView-sandboxed app data, matching the security bar this app already
// accepts elsewhere (Keychain-stored JWT, encrypted IndexedDB bank vault).
// See docs/superpowers/specs/2026-07-16-webauthn-verification-design.md.

import { BiometricAuth, BiometryError, BiometryErrorType } from '@aparajita/capacitor-biometric-auth';

const DB_NAME = 'morechard-webauthn-vault';
const DB_VERSION = 1;
const KEY_STORE = 'keys';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(KEY_STORE)) db.createObjectStore(KEY_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGet<T>(db: IDBDatabase, key: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(KEY_STORE, 'readonly').objectStore(KEY_STORE).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

function idbPut(db: IDBDatabase, value: unknown, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(KEY_STORE, 'readwrite').objectStore(KEY_STORE).put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function idbDelete(db: IDBDatabase, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(KEY_STORE, 'readwrite').objectStore(KEY_STORE).delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function toBase64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(input: string): Uint8Array {
  const padded = input + '='.repeat((4 - (input.length % 4)) % 4);
  const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function classifyBiometryError(err: unknown): 'unavailable' | 'denied' | 'error' {
  if (err instanceof BiometryError) {
    switch (err.code) {
      case BiometryErrorType.userCancel:
      case BiometryErrorType.appCancel:
      case BiometryErrorType.systemCancel:
      case BiometryErrorType.userFallback:
      case BiometryErrorType.authenticationFailed:
      case BiometryErrorType.biometryLockout:
        return 'denied';
      case BiometryErrorType.biometryNotAvailable:
      case BiometryErrorType.biometryNotEnrolled:
      case BiometryErrorType.passcodeNotSet:
      case BiometryErrorType.noDeviceCredential:
      case BiometryErrorType.invalidContext:
      case BiometryErrorType.notInteractive:
        return 'unavailable';
      default:
        return 'error';
    }
  }
  return 'error';
}

export async function isNativeBiometricsAvailable(): Promise<boolean> {
  try {
    const result = await BiometricAuth.checkBiometry();
    return result.isAvailable;
  } catch {
    return false;
  }
}

export type NativeKeyResult =
  | { ok: true; publicKey: string }
  | { ok: false; reason: 'unavailable' | 'denied' | 'error'; message?: string };

/**
 * Registers a new native biometric credential for `userId`: prompts for
 * biometrics FIRST, and only generates + persists a key pair if that
 * prompt succeeds. Never generates a key on a denied/cancelled prompt.
 */
export async function registerNativeKey(userId: string): Promise<NativeKeyResult> {
  try {
    const available = await isNativeBiometricsAvailable();
    if (!available) return { ok: false, reason: 'unavailable' };

    await BiometricAuth.authenticate({ reason: 'Set up biometric sign-in' });
    // Only reached if authenticate() resolved without throwing.

    const keyPair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']) as CryptoKeyPair;
    const db = await openDb();
    try {
      await idbPut(db, keyPair, userId);
    } finally {
      db.close();
    }

    const spki = await crypto.subtle.exportKey('spki', keyPair.publicKey) as ArrayBuffer;
    return { ok: true, publicKey: toBase64Url(spki) };
  } catch (err) {
    const reason = classifyBiometryError(err);
    return { ok: false, reason, message: err instanceof Error ? err.message : String(err) };
  }
}

export type NativeSignResult =
  | { ok: true; publicKey: string; signature: string }
  | { ok: false; reason: 'unavailable' | 'denied' | 'error'; message?: string };

/**
 * Signs `challengeB64Url` with `userId`'s stored private key. Every call
 * re-triggers the biometric prompt — never cached, never skipped. If the
 * key is missing (IndexedDB cleared, or never registered), reports
 * 'unavailable' — callers should treat this identically to "never
 * registered" and fall back to password/PIN.
 */
export async function signNativeChallenge(userId: string, challengeB64Url: string): Promise<NativeSignResult> {
  try {
    const db = await openDb();
    let keyPair: CryptoKeyPair | undefined;
    try {
      keyPair = await idbGet<CryptoKeyPair>(db, userId);
    } finally {
      db.close();
    }
    if (!keyPair) return { ok: false, reason: 'unavailable' };

    const available = await isNativeBiometricsAvailable();
    if (!available) return { ok: false, reason: 'unavailable' };

    await BiometricAuth.authenticate({ reason: 'Sign in' });
    // Only reached if authenticate() resolved without throwing.

    const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, keyPair.privateKey, fromBase64Url(challengeB64Url) as BufferSource) as ArrayBuffer;
    const spki = await crypto.subtle.exportKey('spki', keyPair.publicKey) as ArrayBuffer;
    return { ok: true, publicKey: toBase64Url(spki), signature: toBase64Url(signature) };
  } catch (err) {
    const reason = classifyBiometryError(err);
    return { ok: false, reason, message: err instanceof Error ? err.message : String(err) };
  }
}

export async function clearNativeKey(userId: string): Promise<void> {
  const db = await openDb();
  try {
    await idbDelete(db, userId);
  } finally {
    db.close();
  }
}
