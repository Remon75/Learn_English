import type {
  AwardedBadge,
  ChildProgress,
  LessonProgress,
  LessonStatus,
  TeacherReport,
} from '@sparkle/shared';
import { BADGES_BY_ID, CURRICULUM, LESSON_ORDER, allLessons } from '@sparkle/shared';
import {
  getDb,
  type ActivityStatRow,
  type BadgeRow,
  type ChildRow,
  type EventRow,
  type LessonProgressRow,
  type SessionRow,
  type SkillMasteryRow,
} from '../db/index.js';
import { daysBetween, localDayKey } from '../lib/ids.js';

/**
 * Progress repository.
 *
 * All reads are aggregate and child-scoped. There is no event stream that
 * records what a child looked at, how long they lingered, or what they
 * failed - only "which lesson, what score, how many stars".
 */

export function loadChildProgress(childId: string): ChildProgress {
  const db = getDb();

  const lessons = db
    .prepare('SELECT * FROM lesson_progress WHERE child_id = ?')
    .all(childId) as LessonProgressRow[];

  const badges = db
    .prepare('SELECT * FROM badges WHERE child_id = ? ORDER BY awarded_at ASC')
    .all(childId) as BadgeRow[];

  const skills = db
    .prepare('SELECT * FROM skill_mastery WHERE child_id = ?')
    .all(childId) as SkillMasteryRow[];

  const lessonMap: Record<string, LessonProgress> = {};
  let totalStars = 0;
  for (const row of lessons) {
    totalStars += row.stars_earned;
    lessonMap[row.lesson_id] = {
      lessonId: row.lesson_id,
      status: row.status as LessonStatus,
      starsEarned: row.stars_earned,
      starsPossible: row.stars_possible,
      attempts: row.attempts,
      bestScore: row.best_score,
      ...(row.last_attempt_at ? { lastAttemptAt: row.last_attempt_at } : {}),
    };
  }

  const skillMastery: Record<string, number> = {};
  for (const row of skills) skillMastery[row.skill] = row.mastery;

  const perfectActivities = db
    .prepare(
      'SELECT COUNT(*) AS c FROM activity_stats WHERE child_id = ? AND score >= 0.99',
    )
    .get(childId) as { c: number };

  const speakingRecordings = db
    .prepare('SELECT COUNT(*) AS c FROM activity_stats WHERE child_id = ? AND score >= 0.5')
    .get(childId) as { c: number };

  const streak = computeStreak(childId);
  const minutes = computeMinutes(childId);

  return {
    childId,
    totalStars,
    badges: badges.map((row) => {
      const badge = BADGES_BY_ID.get(row.badge_id);
      return {
        badgeId: row.badge_id,
        awardedAt: row.awarded_at,
        title: badge?.title ?? row.badge_id,
        description: badge?.description ?? '',
        icon: badge?.icon ?? 'star',
      } satisfies AwardedBadge;
    }),
    lessons: lessonMap,
    skillMastery,
    currentStreakDays: streak.current,
    longestStreakDays: streak.longest,
    speakingRecordings: speakingRecordings.c,
    totalMinutesLearned: minutes,
  };
}

/**
 * Computes the current and longest consecutive-day streak.
 *
 * A streak counts days with at least one completed activity. Missing a day
 * resets the counter but never removes stars or badges - the reward system
 * never punishes a child for being ill or on holiday.
 */
export function computeStreak(childId: string): { current: number; longest: number } {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT DISTINCT substr(completed_at, 1, 10) AS day
       FROM session_events
       WHERE child_id = ?
       ORDER BY day DESC`,
    )
    .all(childId) as Array<{ day: string }>;

  if (rows.length === 0) return { current: 0, longest: 0 };

  const days = rows.map((r) => r.day);
  let longest = 1;
  let run = 1;
  for (let i = 1; i < days.length; i += 1) {
    const gap = daysBetween(days[i + 1]!, days[i]!);
    if (gap === 1) {
      run += 1;
      longest = Math.max(longest, run);
    } else {
      run = 1;
    }
  }

  const today = localDayKey();
  const latest = days[0]!;
  const gapFromToday = daysBetween(latest, today);
  // The streak is still "current" if the last activity was yesterday.
  const current = gapFromToday <= 1 ? run : 0;

  return { current, longest: Math.max(longest, current) };
}

/** Total focused minutes, derived from session durations (never idle time). */
export function computeMinutes(childId: string): number {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(ended_ms), 0) AS ms FROM (
         SELECT (julianday(ended_at) - julianday(started_at)) * 86400000 AS ended_ms
         FROM sessions WHERE child_id = ? AND ended_at IS NOT NULL
       )`,
    )
    .get(childId) as { ms: number };
  return Math.round((row.ms / 60_000) * 10) / 10;
}

/**
 * Computes which lessons are unlocked.
 *
 * A lesson unlocks when the previous lesson in curriculum order has been
 * completed. Everything else stays visible but marked "locked" - a child
 * should be able to see the whole map, not just the next node.
 */
export function computeLessonStatuses(
  progress: Record<string, LessonProgress>,
): Record<string, LessonStatus> {
  const statuses: Record<string, LessonStatus> = {};
  let previousCompleted = true;

  for (const lessonId of LESSON_ORDER) {
    const record = progress[lessonId];
    if (record?.status === 'completed') {
      statuses[lessonId] = 'completed';
      previousCompleted = true;
      continue;
    }
    if (previousCompleted) {
      statuses[lessonId] = record?.status === 'in-progress' ? 'in-progress' : 'available';
      previousCompleted = false;
    } else {
      statuses[lessonId] = 'locked';
    }
  }

  return statuses;
}

export function upsertLessonProgress(
  childId: string,
  lessonId: string,
  starsEarned: number,
  starsPossible: number,
  score: number,
  completed: boolean,
): void {
  const db = getDb();
  const existing = db
    .prepare('SELECT * FROM lesson_progress WHERE child_id = ? AND lesson_id = ?')
    .get(childId, lessonId) as LessonProgressRow | undefined;

  const now = new Date().toISOString();
  const bestScore = Math.max(existing?.best_score ?? 0, score);
  const bestStars = Math.max(existing?.stars_earned ?? 0, starsEarned);
  const status: LessonStatus = completed ? 'completed' : 'in-progress';

  if (existing) {
    db.prepare(
      `UPDATE lesson_progress
       SET status = ?, stars_earned = ?, stars_possible = ?, attempts = attempts + 1,
           last_attempt_at = ?, best_score = ?
       WHERE child_id = ? AND lesson_id = ?`,
    ).run(status, bestStars, starsPossible, now, bestScore, childId, lessonId);
  } else {
    db.prepare(
      `INSERT INTO lesson_progress
       (child_id, lesson_id, status, stars_earned, stars_possible, attempts, last_attempt_at, best_score)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
    ).run(childId, lessonId, status, starsEarned, starsPossible, now, bestScore);
  }
}

export function recordSkillMastery(childId: string, skillMastery: Record<string, number>): void {
  const db = getDb();
  const stmt = db.prepare(
    `INSERT INTO skill_mastery (child_id, skill, mastery) VALUES (?, ?, ?)
     ON CONFLICT(child_id, skill) DO UPDATE SET mastery = excluded.mastery`,
  );
  const tx = db.transaction((entries: Array<[string, number]>) => {
    for (const [skill, mastery] of entries) stmt.run(childId, skill, mastery);
  });
  tx(Object.entries(skillMastery));
}

export function recordActivityStats(childId: string, activityId: string, score: number): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO activity_stats (child_id, activity_id, score) VALUES (?, ?, ?)
     ON CONFLICT(child_id, activity_id) DO UPDATE SET score = MAX(score, excluded.score)`,
  ).run(childId, activityId, score);
}

export function awardBadges(childId: string, badgeIds: string[]): void {
  if (badgeIds.length === 0) return;
  const db = getDb();
  const stmt = db.prepare(
    `INSERT INTO badges (child_id, badge_id, awarded_at) VALUES (?, ?, ?)
     ON CONFLICT(child_id, badge_id) DO NOTHING`,
  );
  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    for (const badgeId of badgeIds) stmt.run(childId, badgeId, now);
  });
  tx();
}

export function awardedBadgeIds(childId: string): Set<string> {
  const db = getDb();
  const rows = db.prepare('SELECT badge_id FROM badges WHERE child_id = ?').all(childId) as BadgeRow[];
  return new Set(rows.map((r) => r.badge_id));
}

/**
 * Builds a caregiver-facing report.
 *
 * The report is aggregate and coarse on purpose: it describes what a child
 * practised, not how they behaved. There is no session replay, no keystroke
 * trace, and no third-party analytics sink.
 */
export function buildTeacherReport(
  childId: string,
  periodStart: string,
  periodEnd: string,
): TeacherReport {
  const db = getDb();

  const sessions = db
    .prepare(
      `SELECT * FROM sessions
       WHERE child_id = ? AND ended_at IS NOT NULL AND ended_at >= ? AND ended_at <= ?
       ORDER BY ended_at DESC`,
    )
    .all(childId, periodStart, periodEnd) as SessionRow[];

  const lessonTitles = new Map<string, string>();
  for (const entry of allLessons()) lessonTitles.set(entry.lesson.id, entry.lesson.title);

  const skillRows = db
    .prepare('SELECT * FROM skill_mastery WHERE child_id = ?')
    .all(childId) as SkillMasteryRow[];

  const skillMastery: Record<string, number> = {};
  for (const row of skillRows) skillMastery[row.skill] = row.mastery;

  const skills = Object.entries(skillMastery).sort((a, b) => b[1] - a[1]);
  const strengths = skills.filter(([, v]) => v >= 0.7).map(([k]) => k);
  const focusAreas = skills.filter(([, v]) => v < 0.5).map(([k]) => k);

  const activityStats = db
    .prepare('SELECT * FROM activity_stats WHERE child_id = ?')
    .all(childId) as ActivityStatRow[];

  const lessonsCompleted = db
    .prepare(
      `SELECT COUNT(*) AS c FROM lesson_progress WHERE child_id = ? AND status = 'completed'`,
    )
    .get(childId) as { c: number };

  const totalMs = sessions.reduce(
    (sum, s) => sum + Math.max(0, Date.parse(s.ended_at ?? '') - Date.parse(s.started_at)),
    0,
  );

  const progress = loadChildProgress(childId);
  const possibleStars = CURRICULUM.levels.reduce(
    (sum, level) =>
      sum +
      level.units.reduce(
        (unitSum, u) =>
          unitSum +
          u.lessons.reduce(
            (lessonSum, l) => lessonSum + l.activities.reduce((aSum, a) => aSum + a.stars, 0),
            0,
          ),
        0,
      ),
    0,
  );

  return {
    childId,
    periodStart,
    periodEnd,
    minutesLearned: Math.round((totalMs / 60_000) * 10) / 10,
    sessionsCompleted: sessions.length,
    lessonsCompleted: lessonsCompleted.c,
    starsEarned: progress.totalStars,
    possibleStars,
    skillMastery,
    strengths,
    focusAreas,
    recentActivity: sessions.slice(0, 20).map((s) => ({
      lessonId: s.lesson_id,
      lessonTitle: lessonTitles.get(s.lesson_id) ?? s.lesson_id,
      completedAt: s.ended_at ?? s.started_at,
      score: s.score,
    })),
  };
}

export function getChildRow(childId: string): ChildRow | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM children WHERE id = ?').get(childId) as ChildRow | undefined;
}

export function listChildren(): ChildRow[] {
  const db = getDb();
  return db.prepare('SELECT * FROM children ORDER BY created_at ASC').all() as ChildRow[];
}

export function recentEvents(childId: string, limit = 50): EventRow[] {
  const db = getDb();
  return db
    .prepare(
      'SELECT * FROM session_events WHERE child_id = ? ORDER BY completed_at DESC LIMIT ?',
    )
    .all(childId, limit) as EventRow[];
}
