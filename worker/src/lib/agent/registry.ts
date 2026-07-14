/**
 * Default-deny tool registry. A tool with no registered tier cannot be
 * invoked at all. In Phase 0, only invokeReadTool exists — there is no
 * invokeAutoTool or invokeGatedTool anywhere in this codebase yet. That's
 * deliberate: those dispatchers, and the execution endpoints that call
 * them, are Phase 1/Phase-frictionless-gate work, not Phase 0.
 */
import { Env } from '../../types.js';

export type ToolTier = 'read' | 'auto' | 'gated';

export interface ToolDefinition<TPayload = unknown, TResult = unknown> {
  name: string;
  tier: ToolTier;
  description: string;
  handler: (env: Env, payload: TPayload) => Promise<TResult>;
}

export class ToolNotRegisteredError extends Error {
  constructor(name: string) {
    super(`Tool "${name}" is not registered — default-deny: unregistered tools cannot be invoked`);
    this.name = 'ToolNotRegisteredError';
  }
}

export class ToolTierNotEnabledError extends Error {
  constructor(name: string, tier: ToolTier) {
    super(`Tool "${name}" is tier "${tier}" — only 'read' tools may be invoked in this phase`);
    this.name = 'ToolTierNotEnabledError';
  }
}

let registry = new Map<string, ToolDefinition>();

export function registerTool(def: ToolDefinition): void {
  if (registry.has(def.name)) {
    throw new Error(`Tool "${def.name}" is already registered`);
  }
  registry.set(def.name, def);
}

export function getTool(name: string): ToolDefinition | undefined {
  return registry.get(name);
}

export async function invokeReadTool<TPayload, TResult>(
  name: string,
  env: Env,
  payload: TPayload,
): Promise<TResult> {
  const def = registry.get(name);
  if (!def) throw new ToolNotRegisteredError(name);
  if (def.tier !== 'read') throw new ToolTierNotEnabledError(name, def.tier);
  return def.handler(env, payload) as Promise<TResult>;
}

/** Test-only: clears the registry between test cases. Never call in app code. */
export function resetRegistryForTests(): void {
  registry = new Map<string, ToolDefinition>();
}
