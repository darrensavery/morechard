import { Env } from '../types.js'

export class EmailNotConfiguredError extends Error {
  constructor() { super('Email provider not configured') }
}

const FROM_ADDRESS = 'Morechard <noreply@mail.morechard.com>'

export class EmailService {
  constructor(private env: Env) {}

  // ── Transactional sends ────────────────────────────────────────────────────

  async sendTransactional(opts: {
    to:      string
    subject: string
    html:    string
    text:    string
  }): Promise<void> {
    if (this.env.ENVIRONMENT === 'development') {
      console.log('[EmailService] transactional stub', opts)
      return
    }
    if (!this.env.RESEND_API_KEY) throw new EmailNotConfiguredError()

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.env.RESEND_API_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from:    FROM_ADDRESS,
        to:      [opts.to],
        subject: opts.subject,
        html:    opts.html,
        text:    opts.text,
      }),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`Resend error ${res.status}: ${body}`)
    }
  }

}

// ── Email builders ─────────────────────────────────────────────────────────────

export function buildVerifyEmailHtml(verifyUrl: string, displayName: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f0;font-family:system-ui,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f0;padding:40px 16px">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
        <tr>
          <td style="background:#0f6b4f;padding:24px 32px">
            <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff">🌱 Morechard</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px">
            <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#1a1a1a">Confirm your new email address</p>
            <p style="margin:0 0 24px;font-size:14px;color:#666;line-height:1.6">
              Hi ${displayName}, click the button below to confirm this address. The link expires in 24 hours.
              If you didn't request this change, you can ignore this email — your current address remains active.
            </p>
            <a href="${verifyUrl}"
               style="display:inline-block;background:#0f6b4f;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:14px 28px;border-radius:10px">
              Confirm email address
            </a>
            <p style="margin:24px 0 0;font-size:12px;color:#999;line-height:1.5">
              Or copy this link into your browser:<br>
              <span style="color:#0f6b4f;word-break:break-all">${verifyUrl}</span>
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px 24px;border-top:1px solid #f0f0f0">
            <p style="margin:0;font-size:11px;color:#aaa">
              Morechard — family finance tracker. All plans are one-time purchases.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export function buildVerifyEmailText(verifyUrl: string, displayName: string): string {
  return `Hi ${displayName},

Confirm your new Morechard email address by visiting:

${verifyUrl}

This link expires in 24 hours. If you didn't request this change, ignore this email — your current address stays active.

— Morechard`
}
