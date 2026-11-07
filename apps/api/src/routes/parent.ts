import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ParentSettings } from '@sparkle/shared';
import { getDb } from '../db/index.js';
import { loadSettings, requireCaregiverPin, requireChild } from '../lib/auth.js';import { hashPin, newId } from '../lib/ids.js';
import { buildTeacherReport, loadChildProgress } from '../lib/progress.js';

const settingsSchema = z.object({
  dailyLimitMinutes: z.number().int().min(0).max(180).optional(),
  bedtimeLock: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
  bedtimeWake: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
  sharingRequiresApproval: z.boolean().optional(),
  microphoneEnabled: z.boolean().optional(),
  offlineDownloadsEnabled: z.boolean().optional(),
  audioEnabled: z.boolean().optional(),
  caregiverLocale: z.string().min(2).max(12).optional(),
  allowOutboundNetwork: z.boolean().optional(),
});

/**
 * Caregiver routes.
 *
 * Every route here is gated behind the caregiver PIN. The reporting data is
 * aggregate and exportable as JSON on the caregiver's own machine.
 */
export async function parentRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/api/v1/parent/settings',
    { preHandler: [requireChild, requireCaregiverPin] },
    async (request, reply) => {
      const child = request.child!;
      const row = loadSettings(child.id);
      return reply.send({
        settings: toSettings(row),
      });
    },
  );

  app.put(
    '/api/v1/parent/settings',
    { preHandler: [requireChild, requireCaregiverPin] },
    async (request, reply) => {
      const parsed = settingsSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: 'invalid_request',
          message: 'The settings payload is invalid.',
          details: parsed.error.issues,
        });
      }

      const child = request.child!;
      const db = getDb();
      const current = loadSettings(child.id);
      const next = parsed.data;

      db.prepare(
        `UPDATE settings SET
           daily_limit_minutes = ?,
           bedtime_lock = ?,
           bedtime_wake = ?,
           sharing_requires_approval = ?,
           microphone_enabled = ?,
           offline_downloads_enabled = ?,
           audio_enabled = ?,
           caregiver_locale = ?,
           allow_outbound_network = ?
         WHERE child_id = ?`,
      ).run(
        next.dailyLimitMinutes ?? current.daily_limit_minutes,
        next.bedtimeLock === undefined ? current.bedtime_lock : next.bedtimeLock,
        next.bedtimeWake === undefined ? current.bedtime_wake : next.bedtimeWake,
        boolToInt(next.sharingRequiresApproval ?? current.sharing_requires_approval === 1),
        boolToInt(next.microphoneEnabled ?? current.microphone_enabled === 1),
        boolToInt(next.offlineDownloadsEnabled ?? current.offline_downloads_enabled === 1),
        boolToInt(next.audioEnabled ?? current.audio_enabled === 1),
        next.caregiverLocale ?? current.caregiver_locale,
        boolToInt(next.allowOutboundNetwork ?? current.allow_outbound_network === 1),
        child.id,
      );

      return reply.send({ settings: toSettings(loadSettings(child.id)) });
    },
  );

  /** Changes the caregiver PIN. Requires the current PIN. */
  app.put(
    '/api/v1/parent/pin',
    { preHandler: [requireChild, requireCaregiverPin] },
    async (request, reply) => {
      const parsed = z
        .object({
          newPin: z.string().regex(/^\d{4}$/),
        })
        .safeParse(request.body);

      if (!parsed.success) {
        return reply.code(400).send({
          error: 'invalid_request',
          message: 'The new PIN must be 4 digits.',
          details: parsed.error.issues,
        });
      }

      const child = request.child!;
      const db = getDb();
      const salt = newId('salt_');
      db.prepare(
        `UPDATE caregiver_pin SET pin_hash = ?, pin_salt = ?, updated_at = ? WHERE child_id = ?`,
      ).run(hashPin(parsed.data.newPin, salt), salt, new Date().toISOString(), child.id);

      return reply.send({ updated: true });
    },
  );

  /** Aggregate report for a caregiver-defined window. */
  app.get(
    '/api/v1/parent/report',
    { preHandler: [requireChild, requireCaregiverPin] },
    async (request, reply) => {
      const child = request.child!;
      const query = request.query as { days?: string };
      const days = Math.min(Math.max(Number(query.days ?? 7) || 7, 1), 365);
      const end = new Date();
      const start = new Date(end.getTime() - days * 86_400_000);

      const report = buildTeacherReport(
        child.id,
        start.toISOString(),
        end.toISOString(),
      );
      return reply.send({ report });
    },
  );

  /** Full progress snapshot, used by the child rewards screen. */
  app.get(
    '/api/v1/parent/progress',
    { preHandler: [requireChild, requireCaregiverPin] },
    async (request, reply) => {
      const child = request.child!;
      return reply.send({ progress: loadChildProgress(child.id) });
    },
  );

  /**
   * Deletes the child's local data.
   *
   * This is the GDPR-K erasure path: it removes the profile and every row
   * that references it, and it leaves nothing in any analytics system
   * because no such system exists.
   */
  app.delete(
    '/api/v1/parent/profile',
    { preHandler: [requireChild, requireCaregiverPin] },
    async (request, reply) => {
      const child = request.child!;
      const db = getDb();
      db.prepare('DELETE FROM children WHERE id = ?').run(child.id);
      return reply.send({ deleted: true, childId: child.id });
    },
  );

  /** Exports the child's data as a JSON file the caregiver owns. */
  app.get(
    '/api/v1/parent/export',
    { preHandler: [requireChild, requireCaregiverPin] },
    async (request, reply) => {
      const child = request.child!;
      const progress = loadChildProgress(child.id);
      const db = getDb();
      const sessions = db
        .prepare('SELECT * FROM sessions WHERE child_id = ? ORDER BY started_at ASC')
        .all(child.id);

      return reply
        .header('content-type', 'application/json')
        .header(
          'content-disposition',
          `attachment; filename="sparkle-${child.id.slice(-8)}-export.json"`,
        )
        .send({
          exportedAt: new Date().toISOString(),
          profile: {
            id: child.id,
            nickname: child.nickname,
            avatarId: child.avatar_id,
            ageBand: child.age_band,
            createdAt: child.created_at,
          },
          progress,
          sessions,
        });
    },
  );
}

function toSettings(row: ReturnType<typeof loadSettings>): ParentSettings {
  return {
    childId: row.child_id,
    dailyLimitMinutes: row.daily_limit_minutes,
    bedtimeLock: row.bedtime_lock ?? undefined,
    bedtimeWake: row.bedtime_wake ?? undefined,
    sharingRequiresApproval: row.sharing_requires_approval === 1,
    microphoneEnabled: row.microphone_enabled === 1,
    offlineDownloadsEnabled: row.offline_downloads_enabled === 1,
    audioEnabled: row.audio_enabled === 1,
    caregiverLocale: row.caregiver_locale,
    allowOutboundNetwork: row.allow_outbound_network === 1,
  };
}

function boolToInt(value: boolean): number {
  return value ? 1 : 0;
}
