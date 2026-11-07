import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  bestAttemptPerActivity,
  getLesson,
  gradeResponse,
  nextLessonId,
  scoreSession,
  type SessionEvent,
} from '@sparkle/shared';
import { getDb } from '../db/index.js';
import { requireChild } from '../lib/auth.js';
import { newId } from '../lib/ids.js';
import {
  awardBadges,
  awardedBadgeIds,
  computeStreak,
  loadChildProgress,
  recordActivityStats,
  recordSkillMastery,
  upsertLessonProgress,
} from '../lib/progress.js';

import { resolveLesson } from '../lib/lesson.js';

const startSessionSchema = z.object({
  lessonId: z.string().min(1),
});

const eventSchema = z.object({
  activityId: z.string().min(1),
  response: z.string().optional(),
  /** When supplied by the client it overrides server-side grading. */
  score: z.number().min(0).max(1).optional(),
  elapsedMs: z.number().int().min(0).max(10 * 60 * 1000),
  hintsUsed: z.number().int().min(0).max(10).default(0),
});

/**
 * Session routes.
 *
 * A session is one attempt at one lesson. Events are recorded as the child
 * plays, then the session is finalised and scored server-side. The client
 * never computes stars or awards badges - it only reports what happened.
 */
export async function sessionRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/v1/sessions', { preHandler: requireChild }, async (request, reply) => {
    const parsed = startSessionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'invalid_request',
        message: 'A lessonId is required.',
        details: parsed.error.issues,
      });
    }

    const lesson = getLesson(parsed.data.lessonId);
    if (!lesson) {
      return reply.code(404).send({ error: 'lesson_not_found', message: 'No lesson with that id.' });
    }

    const child = request.child!;
    const db = getDb();
    const sessionId = newId('sess_');
    const startedAt = new Date().toISOString();

    db.prepare(
      `INSERT INTO sessions (id, child_id, lesson_id, started_at) VALUES (?, ?, ?, ?)`,
    ).run(sessionId, child.id, lesson.id, startedAt);

    return reply.code(201).send({
      sessionId,
      lesson: resolveLesson(lesson),
      startedAt,
    });
  });

  /**
   * Records one activity attempt.
   * Grading happens here so the server remains the source of truth.
   */
  app.post<{ Params: { sessionId: string } }>(
    '/api/v1/sessions/:sessionId/events',
    { preHandler: requireChild },
    async (request, reply) => {
      const parsed = eventSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: 'invalid_request',
          message: 'The activity event is invalid.',
          details: parsed.error.issues,
        });
      }

      const child = request.child!;
      const db = getDb();
      const session = db
        .prepare('SELECT * FROM sessions WHERE id = ? AND child_id = ?')
        .get(request.params.sessionId, child.id) as { id: string; lesson_id: string } | undefined;

      if (!session) {
        return reply.code(404).send({ error: 'session_not_found', message: 'Unknown session.' });
      }

      const lesson = getLesson(session.lesson_id);
      const activity = lesson?.activities.find((a) => a.id === parsed.data.activityId);
      if (!activity) {
        return reply.code(404).send({
          error: 'activity_not_found',
          message: 'That activity is not part of this lesson.',
        });
      }

      const score = parsed.data.score ?? gradeResponse(activity, parsed.data.response);
      const completedAt = new Date().toISOString();

      db.prepare(
        `INSERT INTO session_events
         (id, session_id, child_id, activity_id, lesson_id, response, score, elapsed_ms, hints_used, completed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        newId('evt_'),
        session.id,
        child.id,
        activity.id,
        session.lesson_id,
        parsed.data.response ?? null,
        score,
        parsed.data.elapsedMs,
        parsed.data.hintsUsed,
        completedAt,
      );

      recordActivityStats(child.id, activity.id, score);

      return reply.send({
        accepted: true,
        activityId: activity.id,
        score,
        correct: score >= 0.5,
      });
    },
  );

  /**
   * Finalises a session: computes stars, mastery, badges and unlocks.
   */
  app.post<{ Params: { sessionId: string } }>(
    '/api/v1/sessions/:sessionId/complete',
    { preHandler: requireChild },
    async (request, reply) => {
      const child = request.child!;
      const db = getDb();
      const session = db
        .prepare('SELECT * FROM sessions WHERE id = ? AND child_id = ?')
        .get(request.params.sessionId, child.id) as
        | { id: string; lesson_id: string; started_at: string }
        | undefined;

      if (!session) {
        return reply.code(404).send({ error: 'session_not_found', message: 'Unknown session.' });
      }

      const lesson = getLesson(session.lesson_id);
      if (!lesson) {
        return reply.code(404).send({ error: 'lesson_not_found', message: 'No lesson with that id.' });
      }

      const eventRows = db
        .prepare('SELECT * FROM session_events WHERE session_id = ?')
        .all(session.id) as Array<{
        activity_id: string;
        response: string | null;
        score: number;
        elapsed_ms: number;
        hints_used: number;
        completed_at: string;
      }>;

      const events: SessionEvent[] = eventRows.map((row) => ({
        activityId: row.activity_id,
        lessonId: session.lesson_id,
        ...(row.response ? { response: row.response } : {}),
        score: row.score,
        elapsedMs: row.elapsed_ms,
        hintsUsed: row.hints_used,
        completedAt: row.completed_at,
      }));

      // Retries collapse to the best attempt per activity, so a child who
      // taps a wrong answer a few times is neither penalised nor able to
      // inflate their star count.
      const attempts = bestAttemptPerActivity(events);
      const distinctActivities = new Set(attempts.map((e) => e.activityId)).size;

      const progress = loadChildProgress(child.id);
      const lessonsCompletedBefore = Object.values(progress.lessons).filter(
        (l) => l.status === 'completed',
      ).length;
      const perfectActivitiesBefore = db
        .prepare(
          'SELECT COUNT(*) AS c FROM activity_stats WHERE child_id = ? AND score >= 0.99',
        )
        .get(child.id) as { c: number };
      const streak = computeStreak(child.id);
      const completed = distinctActivities >= lesson.activities.length;

      const result = scoreSession({
        lesson,
        events: attempts,
        totalStarsBefore: progress.totalStars,
        lessonsCompletedBefore,
        perfectActivitiesBefore: perfectActivitiesBefore.c,
        skillMasteryBefore: progress.skillMastery,
        currentStreakDays: streak.current,
        speakingRecordingsBefore: progress.speakingRecordings,
        alreadyAwardedBadges: awardedBadgeIds(child.id),
        lessonCompleted: completed,
      });

      const endedAt = new Date().toISOString();

      db.prepare(
        `UPDATE sessions SET ended_at = ?, stars_earned = ?, stars_possible = ?, score = ?
         WHERE id = ?`,
      ).run(endedAt, result.starsEarned, result.starsPossible, result.score, session.id);

      upsertLessonProgress(
        child.id,
        lesson.id,
        result.starsEarned,
        result.starsPossible,
        result.score,
        completed,
      );
      recordSkillMastery(child.id, result.skillMastery);
      awardBadges(
        child.id,
        result.newBadges.map((b) => b.badgeId),
      );

      return reply.send({
        sessionId: session.id,
        starsEarned: result.starsEarned,
        starsPossible: result.starsPossible,
        score: result.score,
        newBadges: result.newBadges,
        nextLessonId: completed ? nextLessonId(lesson.id) : undefined,
        completed,
      });
    },
  );
}
