import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { getDb, type ChildRow, type SettingsRow } from '../db/index.js';
import { hashPin, verifyPin } from '../lib/ids.js';

/**
 * Authentication model - deliberately local-first.
 *
 * There is no email address, no OAuth provider, no third-party identity
 * service and no telemetry. Two secrets exist and both stay on the device:
 *
 *  1. `device token` - a 256-bit random secret held by the child client and
 *     stored in its browser storage. It proves "this is the tablet that owns
 *     this profile" and is presented as `X-Device-Token`.
 *  2. `caregiver PIN` - a 4-digit local PIN protecting adult-only screens.
 *     It is a household gate that stops a 3-year-old from changing
 *     settings, not a defence against a determined adult.
 *
 * The caregiver PIN is stored as a salted scrypt hash. Nothing about a
 * child leaves the machine, so there is no personal data to leak.
 */

export const pinSchema = z.object({
  pin: z.string().regex(/^\d{4}$/, 'PIN must be exactly 4 digits'),
});

/**
 * Extracts the caregiver PIN from either the `X-Caregiver-Pin` header or a
 * `pin` field in the JSON body.
 *
 * The header is preferred because GET and DELETE requests cannot carry a
 * body, and every caregiver endpoint should work with one uniform mechanism.
 */
export function extractPin(request: FastifyRequest): string | undefined {
  const header = request.headers['x-caregiver-pin'];
  if (typeof header === 'string' && header.length > 0) return header;

  const body = request.body as { pin?: unknown } | undefined;
  if (body && typeof body.pin === 'string') return body.pin;

  return undefined;
}

/** Resolves the child profile from the device token. */
export async function requireChild(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const token = request.headers['x-device-token'];
  if (typeof token !== 'string' || token.length === 0) {
    await reply.code(401).send({
      error: 'unauthorized',
      message: 'Missing device token. Send the X-Device-Token header.',
    });
    return;
  }

  const db = getDb();
  const rows = db.prepare('SELECT * FROM children').all() as ChildRow[];
  const match = rows.find((row) =>
    verifyPin(token, row.device_token_salt, row.device_token_hash),
  );

  if (!match) {
    await reply.code(401).send({
      error: 'unauthorized',
      message: 'The device token is not valid for any profile.',
    });
    return;
  }

  request.child = match;
}

/**
 * Verifies the caregiver PIN for the child on the request.
 * Required by every parent-only endpoint (settings, reports, exports).
 */
export async function requireCaregiverPin(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const raw = extractPin(request);
  const parsed = pinSchema.safeParse({ pin: raw });
  if (!parsed.success) {
    await reply.code(400).send({
      error: 'invalid_pin_format',
      message: 'A 4-digit caregiver PIN is required (X-Caregiver-Pin header).',
    });
    return;
  }

  const child = request.child;
  if (!child) {
    await reply.code(401).send({ error: 'unauthorized', message: 'Child context missing.' });
    return;
  }

  const db = getDb();
  const row = db
    .prepare('SELECT * FROM caregiver_pin WHERE child_id = ?')
    .get(child.id) as { pin_hash: string; pin_salt: string } | undefined;

  if (!row || !verifyPin(parsed.data.pin, row.pin_salt, row.pin_hash)) {
    await reply.code(403).send({ error: 'invalid_pin', message: 'That PIN is not correct.' });
    return;
  }
}

/** Returns the stored parent settings, creating defaults on first read. */
export function loadSettings(childId: string): SettingsRow {
  const db = getDb();
  const existing = db
    .prepare('SELECT * FROM settings WHERE child_id = ?')
    .get(childId) as SettingsRow | undefined;
  if (existing) return existing;

  db.prepare('INSERT INTO settings (child_id) VALUES (?) ON CONFLICT(child_id) DO NOTHING').run(
    childId,
  );
  return db.prepare('SELECT * FROM settings WHERE child_id = ?').get(childId) as SettingsRow;
}

/** Applies the shared auth decorators to an instance. */
export async function registerAuth(app: FastifyInstance): Promise<void> {
  app.decorateRequest('child', null);
}

declare module 'fastify' {
  interface FastifyRequest {
    child: ChildRow | null;
  }
}

export { hashPin };
