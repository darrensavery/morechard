import { describe, it, expect } from 'vitest';
import { buildClaudeRequestBody, CLAUDE_TRIAGE_MODEL, CLAUDE_DIAGNOSIS_MODEL } from './claudeClient.js';

describe('buildClaudeRequestBody', () => {
  it('serialises model, system, messages, tools, tool_choice, max_tokens', () => {
    const body = buildClaudeRequestBody({
      model: CLAUDE_TRIAGE_MODEL,
      system: 'You are a triage assistant.',
      messages: [{ role: 'user', content: 'incident text' }],
      tools: [{ name: 'submit_triage', description: 'x', input_schema: { type: 'object' } }],
      tool_choice: { type: 'tool', name: 'submit_triage' },
      max_tokens: 512,
    });
    const parsed = JSON.parse(body);
    expect(parsed.model).toBe('claude-haiku-4-5-20251001');
    expect(parsed.system).toBe('You are a triage assistant.');
    expect(parsed.messages).toEqual([{ role: 'user', content: 'incident text' }]);
    expect(parsed.tool_choice).toEqual({ type: 'tool', name: 'submit_triage' });
    expect(parsed.max_tokens).toBe(512);
  });

  it('uses the correct diagnosis model constant', () => {
    expect(CLAUDE_DIAGNOSIS_MODEL).toBe('claude-opus-4-8');
  });

  it('never emits a 3.x-era model name', () => {
    expect(CLAUDE_TRIAGE_MODEL).not.toMatch(/claude-3/);
    expect(CLAUDE_DIAGNOSIS_MODEL).not.toMatch(/claude-3/);
  });
});
