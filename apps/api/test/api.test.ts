import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

/**
 * API contract tests.
 *
 * These run against a real SQLite database in a temp directory, so they
 * exercise the same code path as production rather than a mocked one.
 */

let app: FastifyInstance;
let tempDir: string;
let deviceToken: string;
let childId: string;

beforeAll(async () => {
  tempDir = mkdtempSync(join(tmpdir(), 'sparkle-test-'));
  process.env.SPARKLE_DB_PATH = join(tempDir, 'test.db');
  process.env.SPARKLE_DATA_DIR = tempDir;

  const { buildApp } = await import('../src/app.js');
  app = await buildApp({ logger: false, docs: false });
  await app.ready();

  const create = await app.inject({
    method: 'POST',
    url: '/api/v1/profiles',
    payload: {
      nickname: 'Tester',
      avatarId: 'fox',
      ageBand: '3-4',
      caregiverPin: '4321',
    },
  });
  expect(create.statusCode).toBe(201);
  const body = create.json();
  deviceToken = body.deviceToken;
  childId = body.profile.id;
});

afterAll(async () => {
  await app?.close();
  const { closeDb } = await import('../src/db/index.js');
  closeDb();
  rmSync(tempDir, { recursive: true, force: true });
});

describe('health', () => {
  it('reports the service as available and offline-capable', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok', offline: true });
  });
});

describe('profile creation', () => {
  it('rejects an invalid caregiver PIN', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/profiles',
      payload: { avatarId: 'fox', ageBand: '3-4', caregiverPin: '12' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('invalid_request');
  });

  it('never returns a real name or email in the profile payload', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/profiles/me',
      headers: { 'x-device-token': deviceToken },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.nickname).toBe('Tester');
    expect(body.email).toBeUndefined();
    expect(body).not.toHaveProperty('password');
  });

  it('rejects an unknown device token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/profiles/me',
      headers: { 'x-device-token': 'not-a-real-token' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('requires a device token for protected routes', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/map' });
    expect(res.statusCode).toBe(401);
  });
});

describe('curriculum', () => {
  it('exposes every level with units', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/curriculum/levels' });
    expect(res.statusCode).toBe(200);
    const { levels } = res.json();
    expect(levels.length).toBeGreaterThanOrEqual(6);
    expect(levels[0].units.length).toBeGreaterThan(0);
  });

  it('serves a lesson with activities and skills', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/curriculum/lessons/l1-u1-s1',
    });
    expect(res.statusCode).toBe(200);
    const { lesson } = res.json();
    expect(lesson.activities.length).toBeGreaterThan(0);
    expect(lesson.activities[0]).toHaveProperty('skills');
  });

  it('404s for an unknown lesson', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/curriculum/lessons/nope',
    });
    expect(res.statusCode).toBe(404);
  });

  it('marks only the first lesson as available on a fresh profile', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/map',
      headers: { 'x-device-token': deviceToken },
    });
    expect(res.statusCode).toBe(200);
    const { nodes } = res.json();
    const available = nodes.filter((n: { status: string }) => n.status === 'available');
    expect(available.length).toBe(1);
    expect(available[0].id).toBe('l1-u1-s1');
    expect(nodes.filter((n: { status: string }) => n.status === 'locked').length).toBeGreaterThan(0);
  });
});

describe('sessions and scoring', () => {
  it('scores a session, awards stars and unlocks the next lesson', async () => {
    const start = await app.inject({
      method: 'POST',
      url: '/api/v1/sessions',
      headers: { 'x-device-token': deviceToken },
      payload: { lessonId: 'l1-u1-s1' },
    });
    expect(start.statusCode).toBe(201);
    const { sessionId, lesson } = start.json();

    for (const activity of lesson.activities) {
      const answer =
        activity.kind === 'choose'
          ? activity.options.find((o: { correct: boolean }) => o.correct)?.id
          : activity.kind === 'speak'
            ? 'said'
            : activity.expected;

      const ev = await app.inject({
        method: 'POST',
        url: `/api/v1/sessions/${sessionId}/events`,
        headers: { 'x-device-token': deviceToken },
        payload: {
          activityId: activity.id,
          response: answer,
          elapsedMs: 2500,
          hintsUsed: 0,
        },
      });
      expect(ev.statusCode).toBe(200);
      expect(ev.json().correct).toBe(true);
    }

    const done = await app.inject({
      method: 'POST',
      url: `/api/v1/sessions/${sessionId}/complete`,
      headers: { 'x-device-token': deviceToken },
    });
    expect(done.statusCode).toBe(200);
    const result = done.json();
    expect(result.completed).toBe(true);
    expect(result.starsEarned).toBeGreaterThan(0);
    expect(result.starsEarned).toBeLessThanOrEqual(result.starsPossible);
    expect(result.nextLessonId).toBe('l1-u1-s2');
    expect(result.newBadges.map((b: { badgeId: string }) => b.badgeId)).toContain('first-step');
  });

  it('records an incorrect answer as score 0', async () => {
    const start = await app.inject({
      method: 'POST',
      url: '/api/v1/sessions',
      headers: { 'x-device-token': deviceToken },
      payload: { lessonId: 'l1-u3-s1' },
    });
    const { sessionId, lesson } = start.json();
    const chooseActivity = lesson.activities.find(
      (a: { kind: string }) => a.kind === 'choose',
    );
    expect(chooseActivity).toBeDefined();

    const ev = await app.inject({
      method: 'POST',
      url: `/api/v1/sessions/${sessionId}/events`,
      headers: { 'x-device-token': deviceToken },
      payload: {
        activityId: chooseActivity.id,
        response: 'definitely-wrong',
        elapsedMs: 1000,
        hintsUsed: 0,
      },
    });
    expect(ev.statusCode).toBe(200);
    expect(ev.json().score).toBe(0);
    expect(ev.json().correct).toBe(false);
  });

  it('404s for an unknown session', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/sessions/sess_missing/complete',
      headers: { 'x-device-token': deviceToken },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('caregiver controls', () => {
  it('refuses parent endpoints without the PIN', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/parent/settings',
      headers: { 'x-device-token': deviceToken },
    });
    expect(res.statusCode).toBe(400);
  });

  it('refuses parent endpoints with a wrong PIN', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/parent/settings',
      headers: { 'x-device-token': deviceToken, 'x-caregiver-pin': '9999' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('returns settings and updates them with the correct PIN', async () => {
    const ok = await app.inject({
      method: 'GET',
      url: '/api/v1/parent/settings',
      headers: { 'x-device-token': deviceToken, 'x-caregiver-pin': '4321' },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().settings.allowOutboundNetwork).toBe(false);

    const updated = await app.inject({
      method: 'PUT',
      url: '/api/v1/parent/settings',
      headers: { 'x-device-token': deviceToken, 'x-caregiver-pin': '4321' },
      payload: { dailyLimitMinutes: 30, audioEnabled: false },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().settings.dailyLimitMinutes).toBe(30);
    expect(updated.json().settings.audioEnabled).toBe(false);
  });

  it('changes the caregiver PIN and invalidates the old one', async () => {
    const change = await app.inject({
      method: 'PUT',
      url: '/api/v1/parent/pin',
      headers: { 'x-device-token': deviceToken, 'x-caregiver-pin': '4321' },
      payload: { newPin: '1357' },
    });
    expect(change.statusCode).toBe(200);

    const old = await app.inject({
      method: 'GET',
      url: '/api/v1/parent/settings',
      headers: { 'x-device-token': deviceToken, 'x-caregiver-pin': '4321' },
    });
    expect(old.statusCode).toBe(403);

    const updated = await app.inject({
      method: 'GET',
      url: '/api/v1/parent/settings',
      headers: { 'x-device-token': deviceToken, 'x-caregiver-pin': '1357' },
    });
    expect(updated.statusCode).toBe(200);

    // Restore the original PIN for the remaining tests.
    await app.inject({
      method: 'PUT',
      url: '/api/v1/parent/pin',
      headers: { 'x-device-token': deviceToken, 'x-caregiver-pin': '1357' },
      payload: { newPin: '4321' },
    });
  });

  it('produces an aggregate teacher report', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/parent/report?days=30',
      headers: { 'x-device-token': deviceToken, 'x-caregiver-pin': '4321' },
    });
    expect(res.statusCode).toBe(200);
    const { report } = res.json();
    expect(report.childId).toBe(childId);
    expect(report.sessionsCompleted).toBeGreaterThanOrEqual(1);
    expect(report.skillMastery).toBeTypeOf('object');
  });
});

describe('data portability', () => {
  it('exports the child profile as JSON', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/parent/export',
      headers: { 'x-device-token': deviceToken, 'x-caregiver-pin': '4321' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('application/json');
    expect(res.json().profile.id).toBe(childId);
  });
});

describe('media delivery', () => {
  it('resolves an extension-less logical path to a real file', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/media/audio/hello',
      headers: { accept: 'audio/wav,audio/*' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('audio/wav');
    expect(Number(res.headers['content-length'])).toBeGreaterThan(0);
  });

  it('serves images with the right content type', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/media/img/wave',
      headers: { accept: 'image/svg+xml,image/*' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('image/svg+xml');
  });

  it('404s for an unknown asset', async () => {
    const res = await app.inject({ method: 'GET', url: '/media/audio/does-not-exist' });
    expect(res.statusCode).toBe(404);
  });

  it('blocks path traversal attempts', async () => {
    const res = await app.inject({ method: 'GET', url: '/media/../../package.json' });
    expect([400, 404]).toContain(res.statusCode);
    expect(res.body).not.toContain('devDependencies');
  });

  it('rewrites lesson media references to concrete extensions', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/curriculum/lessons/l1-u1-s1',
    });
    const { lesson } = res.json();
    const stimulus = lesson.activities.find((a: { stimulus?: { src: string } }) => a.stimulus);
    expect(stimulus.stimulus.src).toMatch(/\.wav$/);
  });
});
