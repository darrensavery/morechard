/**
 * Lightweight PostHog event capture for Cloudflare Workers (edge-compatible).
 *
 * Uses the PostHog HTTP API directly — no Node.js SDK required.
 * Fires-and-forgets: never awaited on the critical path.
 *
 * Usage:
 *   captureAiGeneration(env, {
 *     distinctId: family_id,
 *     traceId: crypto.randomUUID(),
 *     model: '@cf/meta/llama-3-8b-instruct',
 *     provider: 'cloudflare-workers-ai',
 *     spanName: 'mentor_briefing',
 *     input: messages,
 *     latencySeconds: 1.23,
 *   });
 */

import type { Env } from '../types.js';

export interface AiGenerationProps {
  distinctId: string;
  traceId: string;
  spanName: string;
  model: string;
  provider: string;
  input: Array<{ role: string; content: string }>;
  outputText?: string;
  latencySeconds?: number;
  isError?: boolean;
  errorMessage?: string;
}

/**
 * Capture a $ai_generation event to PostHog.
 * Fire-and-forget — do NOT await this in latency-sensitive paths.
 */
export function captureAiGeneration(env: Env, props: AiGenerationProps): void {
  if (!env.POSTHOG_API_KEY || !env.POSTHOG_HOST) return;

  const body = {
    api_key: env.POSTHOG_API_KEY,
    event: '$ai_generation',
    properties: {
      distinct_id: props.distinctId,
      $ai_trace_id: props.traceId,
      $ai_span_name: props.spanName,
      $ai_model: props.model,
      $ai_provider: props.provider,
      $ai_input: props.input,
      ...(props.outputText !== undefined && {
        $ai_output_choices: [{ role: 'assistant', content: props.outputText }],
      }),
      ...(props.latencySeconds !== undefined && { $ai_latency: props.latencySeconds }),
      ...(props.isError !== undefined && { $ai_is_error: props.isError }),
      ...(props.errorMessage !== undefined && { $ai_error: props.errorMessage }),
    },
  };

  // Fire-and-forget — intentionally not awaited.
  fetch(`${env.POSTHOG_HOST}/i/v0/e/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(() => {
    // Silently ignore PostHog failures — never block the main response.
  });
}
