/**
 * Minimal fetch-based Anthropic Messages API client — no SDK dependency,
 * matching the existing OpenAI-via-fetch pattern in insights.ts. Forces
 * structured output via tool_choice so callers get validated JSON, never
 * free text to parse.
 */
import { Env } from '../../types.js';

export const CLAUDE_TRIAGE_MODEL = 'claude-haiku-4-5-20251001';
export const CLAUDE_DIAGNOSIS_MODEL = 'claude-opus-4-8';

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ClaudeToolCallRequest {
  model: string;
  system: string;
  messages: ClaudeMessage[];
  tools: Array<{ name: string; description: string; input_schema: object }>;
  tool_choice: { type: 'tool'; name: string };
  max_tokens: number;
}

export function buildClaudeRequestBody(req: ClaudeToolCallRequest): string {
  return JSON.stringify({
    model: req.model,
    system: req.system,
    messages: req.messages,
    tools: req.tools,
    tool_choice: req.tool_choice,
    max_tokens: req.max_tokens,
  });
}

export async function callClaudeForStructuredOutput<T>(
  env: Env,
  req: ClaudeToolCallRequest,
): Promise<T> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: buildClaudeRequestBody(req),
  });

  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`Claude API error (${res.status}): ${msg}`);
  }

  const data = await res.json() as { content: Array<{ type: string; input?: unknown }> };
  const toolUse = data.content.find(block => block.type === 'tool_use');
  if (!toolUse || toolUse.input === undefined) {
    throw new Error('Claude did not return the expected structured tool call');
  }
  return toolUse.input as T;
}
