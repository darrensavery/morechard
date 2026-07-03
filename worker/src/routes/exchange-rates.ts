/**
 * GET /api/exchange-rates
 *
 * Public endpoint — returns all locale multipliers from D1.
 * These are PPP-adjusted price multipliers (not live forex) used to scale
 * UK GBP median chore rates into local currency equivalents for US and PL.
 *
 * Cached in KV for 1 hour. Admin can bust the cache via PUT /api/admin/exchange-rates/:locale.
 */

import { Env } from '../types.js';
import { json } from '../lib/response.js';

export interface LocaleMultiplier {
  locale:     string;
  currency:   string;
  multiplier: number;
  label:      string;
  updated_at: number;
}

export const EXCHANGE_RATES_CACHE_KEY = 'locale-multipliers';
export const EXCHANGE_RATES_TTL       = 3600; // 1 hour

export async function loadMultipliers(env: Env): Promise<Map<string, LocaleMultiplier>> {
  const cached = await env.CACHE.get(EXCHANGE_RATES_CACHE_KEY);
  if (cached) {
    const rows = JSON.parse(cached) as LocaleMultiplier[];
    return new Map(rows.map(r => [r.locale, r]));
  }

  const rows = await env.DB
    .prepare('SELECT locale, currency, multiplier, label, updated_at FROM locale_multipliers ORDER BY locale ASC')
    .all<LocaleMultiplier>();

  const result = rows.results ?? [];
  await env.CACHE.put(EXCHANGE_RATES_CACHE_KEY, JSON.stringify(result), { expirationTtl: EXCHANGE_RATES_TTL });
  return new Map(result.map(r => [r.locale, r]));
}

export async function bustExchangeRatesCache(env: Env): Promise<void> {
  await Promise.all([
    env.CACHE.delete(EXCHANGE_RATES_CACHE_KEY),
    env.CACHE.delete('market-rates:en-GB'),
    env.CACHE.delete('market-rates:en-US'),
    env.CACHE.delete('market-rates:pl'),
  ].map(p => p.catch(() => {})));
}

export async function handleGetExchangeRates(_request: Request, env: Env): Promise<Response> {
  const multipliers = await loadMultipliers(env);
  return json({ rates: Array.from(multipliers.values()) });
}
