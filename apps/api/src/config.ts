import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Configuration.
 *
 * Everything is read from the environment so the same build runs on a
 * laptop, a home server, or a school Raspberry Pi. The defaults are
 * development-friendly and require no configuration at all.
 */

function envString(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.length > 0 ? value : fallback;
}

function envNumber(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

export const PORT = envNumber('PORT', 8080);
export const HOST = envString('HOST', '0.0.0.0');

/**
 * Where the SQLite database lives.
 *
 * `here` is `apps/api/src` in development and `apps/api/dist` in a build,
 * so one level up is `apps/api` in both cases and the default data
 * directory is `apps/api/data`.
 */
export const DATA_DIR = envString(
  'SPARKLE_DATA_DIR',
  resolve(here, '../data'),
);

export const DB_PATH = envString(
  'SPARKLE_DB_PATH',
  resolve(DATA_DIR, 'sparkle.db'),
);

/**
 * Where lesson media lives.
 *
 * In development this points at the web app's public folder so both
 * processes share one asset tree. In production it points at the volume
 * mounted into the container.
 */
export const MEDIA_ROOT = envString(
  'SPARKLE_MEDIA_ROOT',
  resolve(here, '../../web/public/media'),
);

/** Comma-separated list of allowed CORS origins. Empty means "reflect origin". */
export const CORS_ORIGINS = envString('SPARKLE_CORS_ORIGINS', '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

/** Maximum requests per minute per client. */
export const RATE_LIMIT_MAX = envNumber('SPARKLE_RATE_LIMIT_MAX', 600);
