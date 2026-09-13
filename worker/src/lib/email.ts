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

interface TrialSummaryStatsLike {
  completedChores: number
  childCount:      number
}

export function buildTrialSummaryEmailHtml(
  displayName: string, stats: TrialSummaryStatsLike, earnedDisplay: string, appUrl: string,
): string {
  const choreWord = stats.completedChores === 1 ? 'chore' : 'chores'
  const childWord  = stats.childCount === 1 ? 'child' : 'children'

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
            <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#1a1a1a">Your first 14 days with Morechard</p>
            <p style="margin:0 0 24px;font-size:14px;color:#666;line-height:1.6">
              Hi ${displayName}, your free trial has ended — here's what your family did with it:
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">
              <tr>
                <td style="padding:12px 16px;background:#f5f5f0;border-radius:10px 10px 0 0;border-bottom:1px solid #ffffff">
                  <span style="font-size:14px;color:#1a1a1a"><strong>${stats.completedChores}</strong> ${choreWord} completed</span>
                </td>
              </tr>
              <tr>
                <td style="padding:12px 16px;background:#f5f5f0;border-bottom:1px solid #ffffff">
                  <span style="font-size:14px;color:#1a1a1a"><strong>${earnedDisplay}</strong> earned</span>
                </td>
              </tr>
              <tr>
                <td style="padding:12px 16px;background:#f5f5f0;border-radius:0 0 10px 10px">
                  <span style="font-size:14px;color:#1a1a1a"><strong>${stats.childCount}</strong> ${childWord} tracked</span>
                </td>
              </tr>
            </table>
            <a href="${appUrl}"
               style="display:inline-block;background:#0f6b4f;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:14px 28px;border-radius:10px">
              See your full summary
            </a>
            <p style="margin:24px 0 0;font-size:12px;color:#999;line-height:1.5">
              Your complete usage report — the same one you can download any time from Settings → Data &amp; Exports — is waiting for you in the app.
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

export function buildTrialSummaryEmailText(
  displayName: string, stats: TrialSummaryStatsLike, earnedDisplay: string, appUrl: string,
): string {
  const choreWord = stats.completedChores === 1 ? 'chore' : 'chores'
  const childWord  = stats.childCount === 1 ? 'child' : 'children'

  return `Hi ${displayName},

Your free trial has ended — here's what your family did with it:

- ${stats.completedChores} ${choreWord} completed
- ${earnedDisplay} earned
- ${stats.childCount} ${childWord} tracked

See your full summary any time in the app: ${appUrl}
(The same report is always available from Settings → Data & Exports.)

— Morechard`
}

export function buildVerifyEmailText(verifyUrl: string, displayName: string): string {
  return `Hi ${displayName},

Confirm your new Morechard email address by visiting:

${verifyUrl}

This link expires in 24 hours. If you didn't request this change, ignore this email — your current address stays active.

— Morechard`
}
