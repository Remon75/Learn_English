import { describe, expect, it } from 'vitest';
import { CURRICULUM, allLessons, getLesson, nextLessonId } from '@sparkle/shared';
import { gradeResponse, starsForActivity } from '@sparkle/shared';

/**
 * Web-layer contract tests.
 *
 * These guard the assumptions the browser code makes about the shared
 * curriculum: that every activity kind the UI renders actually exists in
 * the data, and that the grading rules the UI depends on behave as the UI
 * expects.
 */

const RENDERED_KINDS = ['listen', 'speak', 'trace', 'match', 'choose', 'order', 'story'];

describe('curriculum coverage', () => {
  it('covers every activity kind the UI renders', () => {
    const kinds = new Set<string>();
    for (const { lesson } of allLessons()) {
      for (const activity of lesson.activities) kinds.add(activity.kind);
    }
    for (const kind of RENDERED_KINDS) {
      expect(kinds.has(kind), `no activity uses the "${kind}" renderer`).toBe(true);
    }
  });

  it('covers the full foundational curriculum', () => {
    const skills = new Set<string>();
    for (const { lesson } of allLessons()) {
      for (const activity of lesson.activities) {
        for (const skill of activity.skills) skills.add(skill);
      }
    }
    // Phonics, vocabulary, alphabet, grammar, listening and speaking.
    for (const skill of [
      'phonics',
      'vocabulary',
      'alphabet',
      'grammar',
      'listening',
      'speaking',
    ]) {
      expect(skills.has(skill), `the curriculum never practises "${skill}"`).toBe(true);
    }
  });

  it('has a lesson for every age band in the levels', () => {
    for (const level of CURRICULUM.levels) {
      const lessonCount = level.units.reduce((sum, unit) => sum + unit.lessons.length, 0);
      expect(lessonCount, level.id).toBeGreaterThan(0);
    }
  });

  it('keeps every activity short enough for a pre-reader', () => {
    for (const { lesson } of allLessons()) {
      for (const activity of lesson.activities) {
        expect(activity.seconds, activity.id).toBeLessThanOrEqual(60);
      }
    }
  });

  it('keeps prompts short enough to read aloud in one breath', () => {
    for (const { lesson } of allLessons()) {
      for (const activity of lesson.activities) {
        const words = activity.prompt.split(/\s+/).length;
        expect(words, `${activity.id}: "${activity.prompt}"`).toBeLessThanOrEqual(8);
      }
    }
  });
});

describe('activity payloads the UI depends on', () => {
  it('gives every choose activity options with media or a label', () => {
    for (const { lesson } of allLessons()) {
      for (const activity of lesson.activities) {
        if (activity.kind !== 'choose') continue;
        for (const option of activity.options ?? []) {
          expect(option.label.length, activity.id).toBeGreaterThan(0);
        }
      }
    }
  });

  it('gives every match activity pairs with two sides', () => {
    for (const { lesson } of allLessons()) {
      for (const activity of lesson.activities) {
        if (activity.kind !== 'match') continue;
        expect(activity.pairs?.length, activity.id).toBeGreaterThan(0);
        for (const pair of activity.pairs ?? []) {
          expect(pair.left.src, activity.id).toMatch(/^\/media\//);
          expect(pair.right.src, activity.id).toMatch(/^\/media\//);
        }
      }
    }
  });

  it('gives every speak activity a target phrase', () => {
    for (const { lesson } of allLessons()) {
      for (const activity of lesson.activities) {
        if (activity.kind !== 'speak') continue;
        expect(activity.speakTarget?.length, activity.id).toBeGreaterThan(0);
      }
    }
  });

  it('gives every trace activity an expected letter', () => {
    for (const { lesson } of allLessons()) {
      for (const activity of lesson.activities) {
        if (activity.kind !== 'trace') continue;
        expect(activity.expected?.length, activity.id).toBeGreaterThan(0);
      }
    }
  });
});

describe('the UI can grade the answers it collects', () => {
  it('grades a choice answer the way ChooseActivity sends it', () => {
    const lesson = getLesson('l1-u1-s1')!;
    const choose = lesson.activities.find((a) => a.kind === 'choose')!;
    const correct = choose.options!.find((o) => o.correct)!;
    const wrong = choose.options!.find((o) => !o.correct)!;

    expect(gradeResponse(choose, correct.id)).toBe(1);
    expect(gradeResponse(choose, wrong.id)).toBe(0);
  });

  it('grades a match answer the way MatchActivity sends it', () => {
    const lesson = getLesson('l1-u2-s1')!;
    const match = lesson.activities.find((a) => a.kind === 'match')!;
    const pairs = match.pairs!;

    const correct = pairs.map((p) => `${p.id}=${p.right.src}`).join(',');
    expect(gradeResponse(match, correct)).toBe(1);

    const wrong = pairs.map((p) => `${p.id}=${p.left.src}`).join(',');
    expect(gradeResponse(match, wrong)).toBe(0);
  });

  it('grades an order answer the way OrderActivity sends it', () => {
    const lesson = getLesson('l5-u3-s1')!;
    const order = lesson.activities.find((a) => a.kind === 'order')!;
    expect(gradeResponse(order, order.solution!.join('|'))).toBe(1);
  });

  it('grades a self-rated speaking answer the way SpeakActivity sends it', () => {
    const lesson = getLesson('l1-u1-s1')!;
    const speak = lesson.activities.find((a) => a.kind === 'speak')!;
    expect(gradeResponse(speak, 'said')).toBe(1);
    expect(gradeResponse(speak, '')).toBe(0);
  });

  it('awards stars in the range the reward screen renders', () => {
    const lesson = getLesson('l1-u1-s1')!;
    const activity = lesson.activities[0]!;
    for (const hintsUsed of [0, 1, 2]) {
      const stars = starsForActivity(activity, {
        activityId: activity.id,
        lessonId: lesson.id,
        score: 1,
        elapsedMs: 1000,
        hintsUsed,
        completedAt: new Date().toISOString(),
      });
      expect(stars).toBeGreaterThanOrEqual(0);
      expect(stars).toBeLessThanOrEqual(activity.stars);
    }
  });
});

describe('lesson navigation', () => {
  it('links every lesson to a next lesson except the last', () => {
    const flat = allLessons();
    for (let i = 0; i < flat.length - 1; i += 1) {
      expect(nextLessonId(flat[i]!.lesson.id)).toBe(flat[i + 1]!.lesson.id);
    }
    expect(nextLessonId(flat[flat.length - 1]!.lesson.id)).toBeUndefined();
  });
});
