import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';

const SCRYPT_KEYLEN = 64;

/** URL-safe random id, used for opaque child identifiers. */
export function newId(prefix = ''): string {
  return `${prefix}${randomUUID()}`;
}

/**
 * Generates a caregiver PIN.
 * A 4-digit PIN is child-gated and therefore not a security boundary on
 * its own - it only prevents a 3-year-old from wandering into settings.
 */
export function generatePin(): string {
  return String(randomBytes(2).readUInt16BE(0) % 10000).padStart(4, '0');
}

export function hashPin(pin: string, salt: string): string {
  return scryptSync(pin, salt, SCRYPT_KEYLEN).toString('hex');
}

export function verifyPin(pin: string, salt: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashPin(pin, salt), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

/**
 * Device token presented by the child client on every request.
 * It identifies "this tablet, this profile" without any account system.
 */
export function generateDeviceToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Derives a deterministic "day" key for streak calculation.
 * Uses local calendar days so that a streak matches the family's clock.
 */
export function localDayKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function daysBetween(a: string, b: string): number {
  const parse = (key: string) => {
    const [y, m, d] = key.split('-').map(Number);
    return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  };
  return Math.round((parse(b) - parse(a)) / 86_400_000);
}
