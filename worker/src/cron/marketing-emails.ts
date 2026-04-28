import { Env } from '../types.js'
import { EmailService, TEMPLATES, TemplateId } from '../lib/email.js'

interface CohortRow {
  user_id:      string
  family_id:    string
  email:        string
  has_ai_mentor: number
}

export async function runMarketingEmails(env: Env): Promise<void> {
  const emailService = new EmailService(env)

  await sendCohort(env, emailService, 12, TEMPLATES.TRIAL_EXPIRING_SOON)
  await sendCohort(env, emailService, 15, TEMPLATES.TRIAL_EXPIRED)
  await sendCohort(env, emailService, 21, TEMPLATES.RE_ENGAGEMENT_W1)
  await sendCohort(env, emailService, 42, TEMPLATES.RE_ENGAGEMENT_W4)
  await sendWeek12Cohort(env, emailService)
}

async function sendCohort(
  env: Env,
  emailService: EmailService,
  offsetDays: number,
  templateId: TemplateId,
): Promise<void> {
  const rows = await env.DB
    .prepare(`
      SELECT u.id AS user_id, f.id AS family_id, u.email, f.has_ai_mentor
      FROM families f
      INNER JOIN users u ON u.family_id = f.id AND u.granted_by IS NULL
      INNER JOIN (
        SELECT user_id, consented
        FROM marketing_consents
        WHERE (user_id, consented_at) IN (
          SELECT user_id, MAX(consented_at) FROM marketing_consents GROUP BY user_id
        )
      ) mc ON mc.user_id = u.id AND mc.consented = 1
      LEFT JOIN email_sends es ON es.family_id = f.id AND es.template_id = ?
      WHERE f.has_lifetime_license = 0
        AND f.deleted_at IS NULL
        AND f.trial_start_date IS NOT NULL
        AND date(f.trial_start_date, '+' || ? || ' days') = date('now')
        AND es.id IS NULL
    `)
    .bind(templateId, offsetDays)
    .all<CohortRow>()

  for (const row of rows.results) {
    if (!row.email) continue
    await emailService.sendEmail(row.email, templateId, row.user_id, row.family_id, {})
  }
}

async function sendWeek12Cohort(env: Env, emailService: EmailService): Promise<void> {
  const rows = await env.DB
    .prepare(`
      SELECT u.id AS user_id, f.id AS family_id, u.email, f.has_ai_mentor
      FROM families f
      INNER JOIN users u ON u.family_id = f.id AND u.granted_by IS NULL
      INNER JOIN (
        SELECT user_id, consented
        FROM marketing_consents
        WHERE (user_id, consented_at) IN (
          SELECT user_id, MAX(consented_at) FROM marketing_consents GROUP BY user_id
        )
      ) mc ON mc.user_id = u.id AND mc.consented = 1
      LEFT JOIN email_sends es_base ON es_base.family_id = f.id AND es_base.template_id = ?
      LEFT JOIN email_sends es_ai   ON es_ai.family_id   = f.id AND es_ai.template_id   = ?
      WHERE f.has_lifetime_license = 0
        AND f.deleted_at IS NULL
        AND f.trial_start_date IS NOT NULL
        AND date(f.trial_start_date, '+98 days') = date('now')
        AND es_base.id IS NULL
        AND es_ai.id   IS NULL
    `)
    .bind(TEMPLATES.RE_ENGAGEMENT_W12, TEMPLATES.RE_ENGAGEMENT_W12_AI)
    .all<CohortRow>()

  for (const row of rows.results) {
    if (!row.email) continue
    const templateId = row.has_ai_mentor === 0
      ? TEMPLATES.RE_ENGAGEMENT_W12_AI
      : TEMPLATES.RE_ENGAGEMENT_W12
    await emailService.sendEmail(row.email, templateId, row.user_id, row.family_id, {})
  }
}
