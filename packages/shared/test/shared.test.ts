import { describe, expect, it } from 'vitest';
import {
  BADGES,
  CURRICULUM,
  LESSON_ORDER,
  allLessons,
  bestAttemptPerActivity,
  evaluateBadges,
  getLesson,
  gradeResponse,
  nextLessonId,
  scoreSession,
  starsForActivity,
  type SessionEvent,
} from '../src/index.js';

describe('curriculum integrity', () => {
  it('exposes at least six levels covering the full foundational curriculum', () => {
    expect(CURRICULUM.levels.length).toBeGreaterThanOrEqual(6);
  });

  it('has unique lesson ids', () => {
    const ids = allLessons().map((e) => e.lesson.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has unique activity ids within every lesson', () => {
    for (const { lesson } of allLessons()) {
      const ids = lesson.activities.map((a) => a.id);
      expect(new Set(ids).size, `duplicate activity id in ${lesson.id}`).toBe(ids.length);
    }
  });

  it('gives every activity a prompt, stars, seconds and skills', () => {
    for (const { lesson } of allLessons()) {
      for (const activity of lesson.activities) {
        expect(activity.prompt.length, activity.id).toBeGreaterThan(0);
        expect([1, 2, 3]).toContain(activity.stars);
        expect(activity.seconds).toBeGreaterThan(0);
        expect(activity.skills.length, activity.id).toBeGreaterThan(0);
      }
    }
  });

  it('only references media on the local origin', () => {
    const paths: string[] = [];
    for (const { lesson } of allLessons()) {
      for (const activity of lesson.activities) {
        if (activity.stimulus) paths.push(activity.stimulus.src);
        if (activity.instructionAudio) paths.push(activity.instructionAudio.src);
        for (const option of activity.options ?? []) {
          if (option.media) paths.push(option.media.src);
        }
        for (const p of activity.pairs ?? []) {
          paths.push(p.left.src, p.right.src);
        }
      }
    }
    for (const path of paths) {
      expect(path.startsWith('/media/'), `non-local media path: ${path}`).toBe(true);
    }
  });

  it('gives every choose activity at least one correct option', () => {
    for (const { lesson } of allLessons()) {
      for (const activity of lesson.activities) {
        if (activity.kind !== 'choose') continue;
        expect(activity.options?.length, activity.id).toBeGreaterThan(1);
        const correct = activity.options?.filter((o) => o.correct).length ?? 0;
        expect(correct, activity.id).toBeGreaterThan(0);
      }
    }
  });

  it('gives every listen activity pictures to choose from', () => {
    // A listen activity without options leaves the child with nothing to
    // tap and no way to reach the next activity.
    for (const { lesson } of allLessons()) {
      for (const activity of lesson.activities) {
        if (activity.kind !== 'listen') continue;
        expect(activity.options?.length, activity.id).toBeGreaterThan(1);
        const correct = activity.options?.filter((o) => o.correct).length ?? 0;
        expect(correct, activity.id).toBe(1);
        expect(activity.expected?.length, activity.id).toBeGreaterThan(0);
      }
    }
  });

  it('gives every option a picture or a readable label', () => {
    for (const { lesson } of allLessons()) {
      for (const activity of lesson.activities) {
        for (const option of activity.options ?? []) {
          expect(option.label.length, `${activity.id}/${option.id}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it('gives every order activity a matching solution', () => {
    for (const { lesson } of allLessons()) {
      for (const activity of lesson.activities) {
        if (activity.kind !== 'order') continue;
        expect(activity.solution?.length, activity.id).toBe(activity.orderTokens?.length);
      }
    }
  });

  it('chains lessons in order', () => {
    expect(nextLessonId(LESSON_ORDER[0]!)).toBe(LESSON_ORDER[1]);
    expect(nextLessonId(LESSON_ORDER[LESSON_ORDER.length - 1]!)).toBeUndefined();
  });
});

describe('grading', () => {
  const chooseActivity = {
    id: 'choose',
    kind: 'choose' as const,
    prompt: 'pick',
    options: [
      { id: 'a', label: 'A', correct: true },
      { id: 'b', label: 'B', correct: false },
    ],
    stars: 2 as const,
    seconds: 10,
    difficulty: 1 as const,
    skills: ['vocabulary'],
  };

  it('grades a correct choice', () => {
    expect(gradeResponse(chooseActivity, 'a')).toBe(1);
  });

  it('grades an incorrect choice', () => {
    expect(gradeResponse(chooseActivity, 'b')).toBe(0);
  });

  it('grades an empty response as wrong', () => {
    expect(gradeResponse(chooseActivity, undefined)).toBe(0);
    expect(gradeResponse(chooseActivity, '')).toBe(0);
  });

  it('grades an order activity only when the full sequence matches', () => {
    const orderActivity = {
      ...chooseActivity,
      id: 'order',
      kind: 'order' as const,
      orderTokens: ['a', 'b', 'c'],
      solution: ['a', 'b', 'c'],
    };
    expect(gradeResponse(orderActivity, 'a|b|c')).toBe(1);
    expect(gradeResponse(orderActivity, 'a|c|b')).toBe(0);
    expect(gradeResponse(orderActivity, 'a|b')).toBe(0);
  });

  it('grades a match activity only when every pair is correct', () => {
    const matchActivity = {
      ...chooseActivity,
      id: 'match',
      kind: 'match' as const,
      pairs: [
        {
          id: 'p1',
          left: { kind: 'image' as const, src: '/media/img/a.png' },
          right: { kind: 'audio' as const, src: '/media/audio/a.mp3' },
        },
      ],
    };
    expect(gradeResponse(matchActivity, 'p1=/media/audio/a.mp3')).toBe(1);
    expect(gradeResponse(matchActivity, 'p1=/media/audio/b.mp3')).toBe(0);
  });

  it('is case and whitespace insensitive for exact-match activities', () => {
    const listenActivity = {
      ...chooseActivity,
      id: 'listen',
      kind: 'listen' as const,
      expected: 'Hello',
    };
    expect(gradeResponse(listenActivity, ' hello ')).toBe(1);
  });

  it('grades a listen answer by the option the child tapped', () => {
    const listenActivity = {
      ...chooseActivity,
      id: 'listen',
      kind: 'listen' as const,
      expected: 'cat',
      options: [
        { id: 'cat', label: 'Cat', correct: true },
        { id: 'dog', label: 'Dog', correct: false },
      ],
    };
    expect(gradeResponse(listenActivity, 'cat')).toBe(1);
    expect(gradeResponse(listenActivity, 'dog')).toBe(0);
  });

  it('still grades a listen answer given as the spoken word', () => {
    const listenActivity = {
      ...chooseActivity,
      id: 'listen',
      kind: 'listen' as const,
      expected: 'cat',
      options: [
        { id: 'cat', label: 'Cat', correct: true },
        { id: 'dog', label: 'Dog', correct: false },
      ],
    };
    expect(gradeResponse(listenActivity, ' Cat ')).toBe(1);
    expect(gradeResponse(listenActivity, 'dog')).toBe(0);
  });

  it('accepts "I heard it" for a listen activity without options', () => {
    const listenActivity = {
      ...chooseActivity,
      id: 'listen',
      kind: 'listen' as const,
      expected: 'hello',
      options: [],
    };
    expect(gradeResponse(listenActivity, 'heard')).toBe(1);
  });
});

describe('stars', () => {
  const activity = {
    id: 'x',
    kind: 'choose' as const,
    prompt: 'p',
    options: [],
    stars: 3 as const,
    seconds: 10,
    difficulty: 1 as const,
    skills: ['vocabulary'],
  };
  const event = (hintsUsed: number, score = 1): SessionEvent => ({
    activityId: 'x',
    lessonId: 'l',
    score,
    elapsedMs: 1000,
    hintsUsed,
    completedAt: new Date().toISOString(),
  });

  it('awards full stars with no hints', () => {
    expect(starsForActivity(activity, event(0))).toBe(3);
  });

  it('reduces stars when hints are used', () => {
    expect(starsForActivity(activity, event(1))).toBe(2);
    expect(starsForActivity(activity, event(2))).toBe(1);
  });

  it('never awards stars for a failed attempt', () => {
    expect(starsForActivity(activity, event(0, 0))).toBe(0);
  });

  it('never drops a one-star activity to zero', () => {
    const oneStar = { ...activity, stars: 1 as const };
    expect(starsForActivity(oneStar, event(2))).toBe(1);
  });
});

describe('session scoring', () => {
  const lesson = getLesson('l1-u1-s1')!;

  const baseInput = {
    lesson,
    totalStarsBefore: 0,
    lessonsCompletedBefore: 0,
    perfectActivitiesBefore: 0,
    skillMasteryBefore: {},
    currentStreakDays: 0,
    speakingRecordingsBefore: 0,
    alreadyAwardedBadges: new Set<string>(),
    lessonCompleted: true,
  };

  it('awards the first-step badge on the first completed lesson', () => {
    const events: SessionEvent[] = lesson.activities.map((a) => ({
      activityId: a.id,
      lessonId: lesson.id,
      response: 'x',
      score: 1,
      elapsedMs: 1000,
      hintsUsed: 0,
      completedAt: new Date().toISOString(),
    }));
    const result = scoreSession({ ...baseInput, events });
    expect(result.newBadges.map((b) => b.badgeId)).toContain('first-step');
    expect(result.starsEarned).toBe(
      lesson.activities.reduce((sum, a) => sum + a.stars, 0),
    );
  });

  it('does not count an incomplete lesson towards completion badges', () => {
    const events: SessionEvent[] = [
      {
        activityId: lesson.activities[0]!.id,
        lessonId: lesson.id,
        score: 1,
        elapsedMs: 1000,
        hintsUsed: 0,
        completedAt: new Date().toISOString(),
      },
    ];
    const result = scoreSession({ ...baseInput, events, lessonCompleted: false });
    expect(result.newBadges.map((b) => b.badgeId)).not.toContain('first-step');
    expect(result.lessonsCompleted).toBe(0);
  });

  it('never awards the same badge twice', () => {
    const events: SessionEvent[] = lesson.activities.map((a) => ({
      activityId: a.id,
      lessonId: lesson.id,
      score: 1,
      elapsedMs: 1000,
      hintsUsed: 0,
      completedAt: new Date().toISOString(),
    }));
    const first = scoreSession({ ...baseInput, events });
    const awarded = new Set(first.newBadges.map((b) => b.badgeId));
    const second = scoreSession({
      ...baseInput,
      events,
      totalStarsBefore: first.totalStars,
      lessonsCompletedBefore: first.lessonsCompleted,
      alreadyAwardedBadges: awarded,
    });
    expect(second.newBadges.map((b) => b.badgeId)).not.toContain('first-step');
  });

  it('keeps skill mastery within 0..1', () => {
    const events: SessionEvent[] = lesson.activities.map((a) => ({
      activityId: a.id,
      lessonId: lesson.id,
      score: 1,
      elapsedMs: 1000,
      hintsUsed: 0,
      completedAt: new Date().toISOString(),
    }));
    const result = scoreSession({ ...baseInput, events });
    for (const value of Object.values(result.skillMastery)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it('collapses retries so repeated taps cannot inflate the star count', () => {
    const first = lesson.activities[0]!;
    const events: SessionEvent[] = [
      { activityId: first.id, lessonId: lesson.id, score: 0, elapsedMs: 500, hintsUsed: 0, completedAt: '1' },
      { activityId: first.id, lessonId: lesson.id, score: 0, elapsedMs: 500, hintsUsed: 0, completedAt: '2' },
      { activityId: first.id, lessonId: lesson.id, score: 1, elapsedMs: 500, hintsUsed: 0, completedAt: '3' },
      ...lesson.activities.slice(1).map((a) => ({
        activityId: a.id,
        lessonId: lesson.id,
        score: 1,
        elapsedMs: 500,
        hintsUsed: 0,
        completedAt: '4',
      })),
    ];

    const result = scoreSession({ ...baseInput, events });
    const expectedStars = lesson.activities.reduce((sum, a) => sum + a.stars, 0);
    expect(result.starsEarned).toBe(expectedStars);
    expect(result.starsPossible).toBe(expectedStars);
  });

  it('keeps the best attempt when a wrong answer is followed by a correct one', () => {
    const first = lesson.activities[0]!;
    const events: SessionEvent[] = [
      { activityId: first.id, lessonId: lesson.id, score: 0, elapsedMs: 500, hintsUsed: 0, completedAt: '1' },
      { activityId: first.id, lessonId: lesson.id, score: 1, elapsedMs: 500, hintsUsed: 0, completedAt: '2' },
    ];
    const result = scoreSession({ ...baseInput, events });
    expect(result.starsEarned).toBe(first.stars);
  });
});

describe('bestAttemptPerActivity', () => {
  it('returns one event per activity with the highest score', () => {
    const events: SessionEvent[] = [
      { activityId: 'a', lessonId: 'l', score: 0.2, elapsedMs: 1, hintsUsed: 0, completedAt: '1' },
      { activityId: 'a', lessonId: 'l', score: 0.9, elapsedMs: 1, hintsUsed: 0, completedAt: '2' },
      { activityId: 'b', lessonId: 'l', score: 0.5, elapsedMs: 1, hintsUsed: 0, completedAt: '3' },
    ];
    const best = bestAttemptPerActivity(events);
    expect(best).toHaveLength(2);
    expect(best.find((e) => e.activityId === 'a')?.score).toBe(0.9);
  });
});

describe('badges', () => {
  it('has no duplicate badge ids', () => {
    const ids = BADGES.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('only awards badges whose rule is satisfied', () => {
    const awarded = evaluateBadges(
      {
        lessonsCompleted: 1,
        totalStars: 0,
        perfectActivities: 0,
        skillMastery: {},
        currentStreakDays: 0,
        speakingRecordings: 0,
      },
      new Set(),
    );
    expect(awarded.map((b) => b.id)).toEqual(['first-step']);
  });

  it('respects the already-awarded set', () => {
    const awarded = evaluateBadges(
      {
        lessonsCompleted: 1,
        totalStars: 0,
        perfectActivities: 0,
        skillMastery: {},
        currentStreakDays: 0,
        speakingRecordings: 0,
      },
      new Set(['first-step']),
    );
    expect(awarded).toHaveLength(0);
  });
});
