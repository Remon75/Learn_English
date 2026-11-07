import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  CURRICULUM,
  allLessons,
  getLesson,
  nextLessonId,
} from '@sparkle/shared';
import { getDb } from '../db/index.js';
import { requireChild } from '../lib/auth.js';
import { generateDeviceToken, hashPin, newId } from '../lib/ids.js';
import {
  computeLessonStatuses,
  loadChildProgress,
  listChildren,
} from '../lib/progress.js';
import { resolveLesson } from '../lib/lesson.js';

const createChildSchema = z.object({
  nickname: z.string().trim().min(1).max(24).optional(),
  avatarId: z.string().trim().min(1).max(32).default('fox'),
  ageBand: z.enum(['3-4', '5-6', '7-8']).default('3-4'),
  caregiverPin: z.string().regex(/^\d{4}$/, 'PIN must be exactly 4 digits'),
});

/**
 * Profile routes.
 *
 * A profile is created on the device, with no sign-up and no email. The
 * response contains the device token exactly once - the client stores it in
 * browser storage and sends it on every subsequent request.
 */
export async function profileRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/v1/profiles', async (request, reply) => {
    const parsed = createChildSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'invalid_request',
        message: 'Could not create the profile.',
        details: parsed.error.issues,
      });
    }

    const { nickname, avatarId, ageBand, caregiverPin } = parsed.data;
    const db = getDb();

    const id = newId('child_');
    const deviceToken = generateDeviceToken();
    const deviceTokenSalt = newId('salt_');
    const createdAt = new Date().toISOString();
    const firstLevel = CURRICULUM.levels[0]?.id ?? 'level-1';

    const tx = db.transaction(() => {
      db.prepare(
        `INSERT INTO children
         (id, nickname, avatar_id, age_band, created_at, current_level_id, device_token_hash, device_token_salt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        id,
        nickname ?? null,
        avatarId,
        ageBand,
        createdAt,
        firstLevel,
        hashPin(deviceToken, deviceTokenSalt),
        deviceTokenSalt,
      );

      const pinSalt = newId('salt_');
      db.prepare(
        `INSERT INTO caregiver_pin (child_id, pin_hash, pin_salt, updated_at)
         VALUES (?, ?, ?, ?)`,
      ).run(id, hashPin(caregiverPin, pinSalt), pinSalt, createdAt);
    });
    tx();

    return reply.code(201).send({
      profile: {
        id,
        nickname: nickname ?? null,
        avatarId,
        ageBand,
        createdAt,
        currentLevelId: firstLevel,
      },
      deviceToken,
      message: 'Profile created. Store the device token on this device.',
    });
  });

  /** Returns the profile bound to the presented device token. */
  app.get('/api/v1/profiles/me', { preHandler: requireChild }, async (request, reply) => {
    const child = request.child!;
    return reply.send({
      id: child.id,
      nickname: child.nickname,
      avatarId: child.avatar_id,
      ageBand: child.age_band,
      createdAt: child.created_at,
      currentLevelId: child.current_level_id,
    });
  });

  /** Lists local profiles. Used by the caregiver switcher. */
  app.get('/api/v1/profiles', async (_request, reply) => {
    const children = listChildren().map((c) => ({
      id: c.id,
      nickname: c.nickname,
      avatarId: c.avatar_id,
      ageBand: c.age_band,
      createdAt: c.created_at,
      currentLevelId: c.current_level_id,
    }));
    return reply.send({ profiles: children });
  });
}

/**
 * Curriculum routes.
 *
 * The curriculum ships with the app as versioned data, so a child can keep
 * learning with the server offline. These endpoints expose it read-only.
 */
export async function curriculumRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/v1/curriculum/levels', async (_request, reply) => {
    const levels = CURRICULUM.levels.map((level) => ({
      id: level.id,
      title: level.title,
      description: level.description,
      ageBand: level.ageBand,
      color: level.color,
      units: level.units.map((u) => ({
        id: u.id,
        title: u.title,
        theme: u.theme,
        icon: u.icon,
        lessonCount: u.lessons.length,
      })),
    }));
    return reply.send({ levels });
  });

  app.get('/api/v1/curriculum/lessons', async (_request, reply) => {
    const lessons = allLessons().map(({ level, unit, lesson }) => ({
      id: lesson.id,
      title: lesson.title,
      objective: lesson.objective,
      levelId: level.id,
      levelTitle: level.title,
      unitId: unit.id,
      unitTitle: unit.title,
      activityCount: lesson.activities.length,
      starsPossible: lesson.activities.reduce((sum, a) => sum + a.stars, 0),
    }));
    return reply.send({ lessons });
  });

  app.get<{ Params: { lessonId: string } }>(
    '/api/v1/curriculum/lessons/:lessonId',
    async (request, reply) => {
      const lesson = getLesson(request.params.lessonId);
      if (!lesson) {
        return reply
          .code(404)
          .send({ error: 'lesson_not_found', message: 'No lesson with that id.' });
      }
      return reply.send({ lesson: resolveLesson(lesson) });
    },
  );

  /** The child's map: every lesson plus its lock state and stars. */
  app.get('/api/v1/map', { preHandler: requireChild }, async (request, reply) => {
    const child = request.child!;
    const progress = loadChildProgress(child.id);
    const statuses = computeLessonStatuses(progress.lessons);

    const nodes = allLessons().map(({ level, unit, lesson }) => {
      const status = statuses[lesson.id] ?? 'locked';
      const record = progress.lessons[lesson.id];
      return {
        id: lesson.id,
        title: lesson.title,
        objective: lesson.objective,
        levelId: level.id,
        levelTitle: level.title,
        levelColor: level.color,
        unitId: unit.id,
        unitTitle: unit.title,
        icon: unit.icon,
        status,
        starsEarned: record?.starsEarned ?? 0,
        starsPossible: lesson.activities.reduce((sum, a) => sum + a.stars, 0),
        attempts: record?.attempts ?? 0,
      };
    });

    return reply.send({
      childId: child.id,
      totalStars: progress.totalStars,
      nodes,
    });
  });

  app.get<{ Params: { lessonId: string } }>(
    '/api/v1/lessons/:lessonId/next',
    async (request, reply) => {
      const next = nextLessonId(request.params.lessonId);
      return reply.send({ nextLessonId: next ?? null });
    },
  );
}
