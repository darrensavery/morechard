import { Env } from '../types.js'

export const TEMPLATES = {
  TRIAL_EXPIRING_SOON:  'trial_expiring_soon',
  TRIAL_EXPIRED:        'trial_expired',
  RE_ENGAGEMENT_W1:     're_engagement_w1',
  RE_ENGAGEMENT_W4:     're_engagement_w4',
  RE_ENGAGEMENT_W12:    're_engagement_w12',
  RE_ENGAGEMENT_W12_AI: 're_engagement_w12_ai',
  FEATURE_ANNOUNCE:     'feature_announce',
} as const

export type TemplateId = typeof TEMPLATES[keyof typeof TEMPLATES]

export class EmailNotConfiguredError extends Error {
  constructor() { super('Email provider not configured') }
}

export class EmailService {
  constructor(private env: Env) {}

  async sendEmail(
    to: string,
    templateId: TemplateId,
    userId: string,
    familyId: string,
    data: Record<string, unknown> = {},
  ): Promise<void> {
    const sendId = await this.logSend(userId, familyId, templateId)
    try {
      await this.dispatchEmail(to, templateId, data)
      await this.updateSendStatus(sendId, 'sent')
    } catch (err) {
      console.error('[EmailService] send failed', { templateId, err })
      await this.updateSendStatus(sendId, 'failed')
    }
  }

  private async dispatchEmail(
    to: string,
    templateId: TemplateId,
    data: Record<string, unknown>,
  ): Promise<void> {
    if (this.env.ENVIRONMENT === 'development') {
      console.log('[EmailService] stub send', { to, templateId, data })
      return
    }
    throw new EmailNotConfiguredError()
  }

  private async logSend(userId: string, familyId: string, templateId: string): Promise<number> {
    const result = await this.env.DB
      .prepare(`INSERT INTO email_sends (user_id, family_id, template_id, status)
                VALUES (?, ?, ?, 'pending')`)
      .bind(userId, familyId, templateId)
      .run()
    return result.meta.last_row_id as number
  }

  private async updateSendStatus(
    id: number,
    status: 'sent' | 'failed',
    providerMessageId?: string,
  ): Promise<void> {
    await this.env.DB
      .prepare(`UPDATE email_sends
                SET status = ?, provider_message_id = ?, sent_at = CASE WHEN ? = 'sent' THEN unixepoch() ELSE NULL END
                WHERE id = ?`)
      .bind(status, providerMessageId ?? null, status, id)
      .run()
  }
}
