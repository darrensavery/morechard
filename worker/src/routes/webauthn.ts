//
// Real, server-verified WebAuthn (web) and native-ECDSA-keypair (Capacitor
// app) registration + login. See
// docs/superpowers/specs/2026-07-16-webauthn-verification-design.md for
// the full design.
//
// POST /auth/webauthn/register/options  (authenticated) — start registration
// POST /auth/webauthn/register/verify   (authenticated) — finish registration
// POST /auth/webauthn/login/options     (public)         — start login
// POST /auth/webauthn/login/verify      (public)         — finish login, issues a session

import {
  generateRegistrationOptions, verifyRegistrationResponse,
  generateAuthenticationOptions, verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  RegistrationResponseJSON, AuthenticationResponseJSON,
  VerifiedRegistrationResponse, VerifiedAuthenticationResponse,
} from '@simplewebauthn/server';
import * as Sentry from '@sentry/cloudflare';
import { z } from 'zod';
import { Env } from '../types.js';
import { json, error } from '../lib/response.js';
import { parseValidatedBody } from '../lib/validate.js';
import { resolveReturnOrigin } from '../lib/appUrl.js';
import { nanoid } from '../lib/nanoid.js';
import type { JwtPayload } from '../lib/jwt.js';
import {
  toBase64Url, fromBase64Url, deriveNativeCredentialId, verifyNativeSignature,
  storeChallenge, consumeChallenge,
} from '../lib/webauthn.js';
import { issueParentJwt, issueChildJwt } from './auth.js';

type AuthedRequest = Request & { auth: JwtPayload };

const platformSchema = z.enum(['web', 'native']);
const roleSchema = z.enum(['parent', 'child']);

const registerOptionsSchema = z.object({ platform: platformSchema, displayName: z.string().optional() });

// `response`'s exact shape is a deeply-nested WebAuthn structure
// (id/rawId/response.clientDataJSON/response.attestationObject/...) —
// @simplewebauthn/server's own verify call is the real validator for its
// contents; zod here only confirms we received a JSON object at all.
const registerVerifySchema = z.discriminatedUnion('platform', [
  z.object({ platform: z.literal('web'), response: z.record(z.string(), z.unknown()) }),
  z.object({ platform: z.literal('native'), publicKey: z.string().min(1) }),
]);

const loginOptionsSchema = z.object({
  user_id: z.string().min(1),
  role: roleSchema,
  platform: platformSchema,
});

const loginVerifySchema = z.discriminatedUnion('platform', [
  z.object({
    platform: z.literal('web'), user_id: z.string().min(1), role: roleSchema,
    response: z.record(z.string(), z.unknown()),
  }),
  z.object({
    platform: z.literal('native'), user_id: z.string().min(1), role: roleSchema,
    public_key: z.string().min(1), signature: z.string().min(1),
  }),
]);

function rpFrom(request: Request, env: Env): { origin: string; rpID: string } {
  const origin = resolveReturnOrigin(request, env);
  return { origin, rpID: new URL(origin).hostname };
}

// ── Registration ──────────────────────────────────────────────────────────

export async function handleWebauthnRegisterOptions(request: Request, env: Env): Promise<Response> {
  const auth = (request as AuthedRequest).auth;
  if (!auth) return error('Unauthorised', 401);

  const parsed = await parseValidatedBody(request, registerOptionsSchema);
  if (parsed instanceof Response) return parsed;

  if (parsed.platform === 'native') {
    const challenge = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
    await storeChallenge(env, auth.sub, challenge);
    return json({ platform: 'native', challenge });
  }

  const { rpID } = rpFrom(request, env);
  const existing = await env.DB
    .prepare('SELECT credential_id FROM webauthn_credentials WHERE user_id = ? AND type = ?')
    .bind(auth.sub, 'webauthn')
    .all<{ credential_id: string }>();

  const options = await generateRegistrationOptions({
    rpName: 'Morechard',
    rpID,
    userName: auth.sub,
    userID: new TextEncoder().encode(auth.sub) as Uint8Array<ArrayBuffer>,
    userDisplayName: parsed.displayName ?? auth.sub,
    attestationType: 'none',
    authenticatorSelection: {
      authenticatorAttachment: 'platform',
      userVerification: 'required',
      residentKey: 'preferred',
    },
    excludeCredentials: existing.results.map(r => ({ id: r.credential_id })),
  });

  await storeChallenge(env, auth.sub, options.challenge);
  return json({ platform: 'web', options });
}

export async function handleWebauthnRegisterVerify(request: Request, env: Env): Promise<Response> {
  const auth = (request as AuthedRequest).auth;
  if (!auth) return error('Unauthorised', 401);

  const parsed = await parseValidatedBody(request, registerVerifySchema);
  if (parsed instanceof Response) return parsed;

  const challenge = await consumeChallenge(env, auth.sub);
  if (!challenge) return error('Challenge expired or not found', 400);

  if (parsed.platform === 'native') {
    const credentialId = await deriveNativeCredentialId(parsed.publicKey);
    await env.DB
      .prepare(`INSERT INTO webauthn_credentials (id, user_id, role, credential_id, public_key, type, counter, created_at)
                VALUES (?,?,?,?,?,'native-ecdsa',0,?)`)
      .bind(nanoid(), auth.sub, auth.role, credentialId, parsed.publicKey, Math.floor(Date.now() / 1000))
      .run();
    return json({ ok: true });
  }

  const { origin, rpID } = rpFrom(request, env);
  let verification: VerifiedRegistrationResponse;
  try {
    verification = await verifyRegistrationResponse({
      response: parsed.response as unknown as RegistrationResponseJSON,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });
  } catch {
    return error('Registration verification failed', 400);
  }
  if (!verification.verified || !verification.registrationInfo) {
    return error('Registration verification failed', 400);
  }

  const { credential } = verification.registrationInfo;
  await env.DB
    .prepare(`INSERT INTO webauthn_credentials (id, user_id, role, credential_id, public_key, type, counter, created_at)
              VALUES (?,?,?,?,?,'webauthn',?,?)`)
    .bind(nanoid(), auth.sub, auth.role, credential.id, toBase64Url(credential.publicKey), credential.counter, Math.floor(Date.now() / 1000))
    .run();

  return json({ ok: true });
}
