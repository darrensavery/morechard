/** Minimal URL-safe nanoid using Web Crypto — no npm dependency. */
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export function nanoid(size = 21): string {
  const bytes = crypto.getRandomValues(new Uint8Array(size));
  return Array.from(bytes)
    .map(b => ALPHABET[b % ALPHABET.length])
    .join('');
}
