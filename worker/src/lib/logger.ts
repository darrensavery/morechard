/**
 * Structured logger for Cloudflare Workers.
 *
 * Outputs JSON to console so Cloudflare Workers Logs / Logpush can parse and
 * filter entries by level, label, or any context field. Avoids plain-string
 * console calls scattered through route handlers.
 *
 * Usage:
 *   import { logger } from '../lib/logger.js'
 *   logger.info('handleSpendingCreate', 'spending logged', { child_id, amount })
 *   logger.warn('handleChildLogin', 'bad PIN attempt', { child_id, attempt: 3 })
 *   logger.error('handleLedgerPost', 'chain integrity failure', { family_id })
 */

export type LogContext = Record<string, unknown>;

type Level = 'INFO' | 'WARN' | 'ERROR';

function emit(level: Level, label: string, message: string, ctx?: LogContext): void {
  const entry: Record<string, unknown> = {
    level,
    label,
    message,
    ts: new Date().toISOString(),
    ...ctx,
  };
  const line = JSON.stringify(entry);
  if (level === 'ERROR') {
    console.error(line);
  } else if (level === 'WARN') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  info:  (label: string, message: string, ctx?: LogContext) => emit('INFO',  label, message, ctx),
  warn:  (label: string, message: string, ctx?: LogContext) => emit('WARN',  label, message, ctx),
  error: (label: string, message: string, ctx?: LogContext) => emit('ERROR', label, message, ctx),
};
