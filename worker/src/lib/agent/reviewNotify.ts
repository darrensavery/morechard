/**
 * Immediate operator email when a new agent_review_items row is created.
 * One email per item, sent as soon as it's written — not a scheduled
 * digest. Matches the EmailService.sendTransactional pattern already used
 * for magic links and the suggestion-promotion digest (worker/src/jobs/
 * suggestionPromotion.ts).
 */
import { Env } from '../../types.js';
import { EmailService } from '../email.js';

const ADMIN_EMAIL = 'darren.savery@gmail.com';
const ADMIN_URL = 'https://api.morechard.com/admin';

export interface ReviewItemEmailInput {
  incidentId: string;
  source: string;
  category: string;
  confidence: number;
  queueBucket: 'recommended_approve' | 'needs_review';
  diagnosis: string;
  /** One-tap approval link — present only when isOneTapEligible() was true. */
  approveUrl?: string | null;
}

function escapeHtml(s: string): string {
  return s.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string));
}

export function buildReviewItemEmail(
  item: ReviewItemEmailInput,
): { subject: string; text: string; html: string } {
  const confidencePct = Math.round(item.confidence * 100);
  const bucketLabel = item.queueBucket === 'recommended_approve' ? 'Recommended: Approve' : 'Needs Review';

  const subject = item.approveUrl
    ? `[Morechard] One-tap fix ready — ${item.source}`
    : `[Morechard] Support ticket to review — ${bucketLabel} (${item.source})`;

  const text = [
    item.approveUrl
      ? `A support ticket was diagnosed and a fix is ready — approve it with one tap, no need to open /admin.`
      : `A new support ticket has been diagnosed and is waiting for review.`,
    '',
    `Source:      ${item.source}`,
    `Category:    ${item.category}`,
    `Confidence:  ${confidencePct}%`,
    `Queue:       ${bucketLabel}`,
    '',
    `Diagnosis:`,
    item.diagnosis,
    '',
    item.approveUrl ? `Approve: ${item.approveUrl}` : '',
    `Review it: ${ADMIN_URL} (Agent Review tab)`,
  ].filter(Boolean).join('\n');

  const approveButton = item.approveUrl
    ? `<p><a href="${item.approveUrl}" style="display:inline-block;background:#0f6b4f;color:#ffffff;font-weight:700;text-decoration:none;padding:14px 28px;border-radius:10px">Approve →</a></p>`
    : '';

  const html = `<div style="font-family:system-ui,sans-serif;font-size:14px;color:#1a1a1a">
    <p style="font-size:16px;font-weight:700">🌱 ${item.approveUrl ? 'One-tap fix ready' : 'Support ticket to review'}</p>
    <p style="color:#555">
      <strong>${escapeHtml(bucketLabel)}</strong> — ${escapeHtml(item.source)} / ${escapeHtml(item.category)} / ${confidencePct}% confidence
    </p>
    <pre style="background:#f5f5f0;padding:16px;border-radius:8px;white-space:pre-wrap;font-size:12px">${escapeHtml(item.diagnosis)}</pre>
    ${approveButton}
    <p><a href="${ADMIN_URL}" style="color:#0f6b4f;font-weight:700">Review it in /admin →</a></p>
  </div>`;

  return { subject, text, html };
}

/**
 * Best-effort — a mail failure must never fail incident processing. The
 * review item is already written to the DB and visible in /admin
 * regardless of whether this email sends.
 */
export async function notifyNewReviewItem(env: Env, item: ReviewItemEmailInput): Promise<void> {
  try {
    const { subject, text, html } = buildReviewItemEmail(item);
    await new EmailService(env).sendTransactional({ to: ADMIN_EMAIL, subject, html, text });
  } catch (err) {
    console.error('[reviewNotify] failed to send review item email', err);
  }
}
