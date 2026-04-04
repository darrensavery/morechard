/**
 * Biometrics — Face ID / Touch ID via the Web Authentication API.
 *
 * Uses platform authenticators (built into the device) to verify the user.
 * No keys are stored on a server — this is purely a local "are you still you?" check.
 *
 * Works in:  Safari/iOS (Face ID, Touch ID), Chrome/Android (fingerprint, face)
 * Falls back gracefully on desktop browsers that lack biometric hardware.
 */

export type BiometricResult =
  | { ok: true; method: 'biometrics' }
  | { ok: false; reason: 'unavailable' | 'denied' | 'error'; message?: string }

/** True if this device/browser supports platform authenticators (Face ID, Touch ID, etc.) */
export async function isBiometricsAvailable(): Promise<boolean> {
  try {
    if (!window.PublicKeyCredential) return false
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

/**
 * Register a biometric credential for this device.
 * Called once during "Secure your App" setup.
 * Stores the credential ID in localStorage for future challenges.
 */
export async function registerBiometrics(userId: string, displayName: string): Promise<BiometricResult> {
  try {
    const available = await isBiometricsAvailable()
    if (!available) return { ok: false, reason: 'unavailable' }

    const challenge = crypto.getRandomValues(new Uint8Array(32))
    const userIdBytes = new TextEncoder().encode(userId)

    const credential = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: 'Morechard', id: window.location.hostname },
        user: {
          id: userIdBytes,
          name: displayName,
          displayName,
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7  },  // ES256
          { type: 'public-key', alg: -257 }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',  // device built-in only
          userVerification: 'required',
          residentKey: 'preferred',
        },
        timeout: 60000,
      },
    }) as PublicKeyCredential | null

    if (!credential) return { ok: false, reason: 'denied' }

    // Store credential ID so we can issue a challenge on next unlock
    localStorage.setItem('mc_biometric_id', credential.id)
    return { ok: true, method: 'biometrics' }

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    // NotAllowedError = user dismissed / denied
    if (msg.includes('NotAllowedError') || msg.includes('not allowed')) {
      return { ok: false, reason: 'denied' }
    }
    return { ok: false, reason: 'error', message: msg }
  }
}

/**
 * Issue a biometric challenge to verify the current user.
 * Called on every app unlock attempt when biometrics are available.
 */
export async function challengeBiometrics(): Promise<BiometricResult> {
  try {
    const credId = localStorage.getItem('mc_biometric_id')
    if (!credId) return { ok: false, reason: 'unavailable' }

    const available = await isBiometricsAvailable()
    if (!available) return { ok: false, reason: 'unavailable' }

    const challenge = crypto.getRandomValues(new Uint8Array(32))

    // Decode stored credential ID from base64url
    const rawId = base64urlDecode(credId)

    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [{ type: 'public-key', id: rawId }],
        userVerification: 'required',
        timeout: 60000,
      },
    })

    if (!assertion) return { ok: false, reason: 'denied' }
    return { ok: true, method: 'biometrics' }

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('NotAllowedError') || msg.includes('not allowed')) {
      return { ok: false, reason: 'denied' }
    }
    return { ok: false, reason: 'error', message: msg }
  }
}

export function hasBiometricCredential(): boolean {
  return !!localStorage.getItem('mc_biometric_id')
}

export function clearBiometricCredential(): void {
  localStorage.removeItem('mc_biometric_id')
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function base64urlDecode(str: string): ArrayBuffer {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64)
  const buf = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i)
  return buf.buffer
}
