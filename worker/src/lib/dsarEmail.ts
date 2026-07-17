// worker/src/lib/dsarEmail.ts
//
// Resend-backed email senders for the DSAR portal. Mirrors the inline
// pattern used by sendMagicLinkEmail in worker/src/routes/auth.ts.

import type { Env } from '../types.js';

async function sendEmail(to: string, subject: string, html: string, env: Env): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: 'Morechard <noreply@mail.morechard.com>', to, subject, html }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend error ${res.status}: ${body}`);
  }
}

export async function sendDsarVerificationEmail(
  to: string,
  link: string,
  requestType: 'access' | 'erasure',
  env: Env,
): Promise<void> {
  const action = requestType === 'erasure' ? 'delete your data' : 'export your data';
  await sendEmail(
    to,
    'Confirm your Morechard data request',
    `<p>Click the link below to confirm your request to ${action}. This link expires in 1 hour.</p><p><a href="${link}">${link}</a></p><p>If you didn't request this, you can safely ignore this email — no action will be taken.</p>`,
    env,
  );
}

export async function sendDsarClarificationEmail(to: string, env: Env): Promise<void> {
  await sendEmail(
    to,
    'We need more detail on your Morechard data request',
    `<p>We couldn't match the child's name you provided to exactly one child on the account. Please submit a new request using the child's exact in-app display name, or contact <a href="mailto:support@morechard.com">support@morechard.com</a> for help.</p>`,
    env,
  );
}

export async function sendDsarAccessLinkEmail(to: string, downloadUrl: string, env: Env): Promise<void> {
  await sendEmail(
    to,
    'Your Morechard data export is ready',
    `<p>Your data export is ready to download.</p><p><a href="${downloadUrl}">${downloadUrl}</a></p><p>This link expires in 1 hour for your security. If it expires before you use it, submit a new request.</p>`,
    env,
  );
}
