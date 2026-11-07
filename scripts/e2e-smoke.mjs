#!/usr/bin/env node
/**
 * End-to-end smoke test against a running API.
 *
 * Walks the whole child journey the way the browser does: create a profile,
 * read the map, run a lesson, record every activity, complete the session,
 * then unlock the caregiver area and export the data.
 *
 * Usage: node scripts/e2e-smoke.mjs [baseUrl]
 */
const BASE = process.argv[2] ?? 'http://localhost:8080';

let passed = 0;
let failed = 0;

function check(label, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${label}${detail ? ` -> ${detail}` : ''}`);
  }
}

async function call(method, path, { body, token, pin } = {}) {
  const headers = { accept: 'application/json' };
  if (body) headers['content-type'] = 'application/json';
  if (token) headers['x-device-token'] = token;
  if (pin) headers['x-caregiver-pin'] = pin;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const text = await res.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }
  return { status: res.status, body: payload, headers: res.headers };
}

console.log(`Sparkle English end-to-end smoke test against ${BASE}\n`);

/* 1. Health */
console.log('health');
const health = await call('GET', '/health');
check('service is healthy', health.status === 200, `status ${health.status}`);
check('reports offline capability', health.body?.offline === true);

/* 2. Create a profile */
console.log('\nprofile');
const created = await call('POST', '/api/v1/profiles', {
  body: { nickname: 'E2E', avatarId: 'panda', ageBand: '5-6', caregiverPin: '2468' },
});
check('profile created', created.status === 201, `status ${created.status}`);
const token = created.body?.deviceToken;
check('device token issued', typeof token === 'string' && token.length > 20);
check('no email field returned', created.body?.profile?.email === undefined);
check('no password field returned', created.body?.profile?.password === undefined);

/* 3. Protected route rejects a bad token */
console.log('\nauthentication');
const badToken = await call('GET', '/api/v1/profiles/me', { token: 'wrong-token' });
check('bad device token rejected', badToken.status === 401, `status ${badToken.status}`);

const noToken = await call('GET', '/api/v1/map');
check('missing device token rejected', noToken.status === 401, `status ${noToken.status}`);

const me = await call('GET', '/api/v1/profiles/me', { token });
check('profile readable with token', me.status === 200, `status ${me.status}`);
check('nickname round-trips', me.body?.nickname === 'E2E');

/* 4. Curriculum */
console.log('\ncurriculum');
const levels = await call('GET', '/api/v1/curriculum/levels');
check('levels served', (levels.body?.levels?.length ?? 0) >= 6);

const lesson = await call('GET', '/api/v1/curriculum/lessons/l1-u1-s1');
check('lesson served', lesson.status === 200, `status ${lesson.status}`);
check('lesson has activities', (lesson.body?.lesson?.activities?.length ?? 0) > 0);
const stimulus = lesson.body?.lesson?.activities?.find((a) => a.stimulus)?.stimulus;
check('media reference has a real extension', /\.(wav|mp3|ogg|opus)$/.test(stimulus?.src ?? ''), stimulus?.src);

const media = await call('GET', stimulus?.src ?? '/media/audio/hello');
check('media file is served', media.status === 200, `status ${media.status}`);
check(
  'media has an audio content type',
  (media.headers.get('content-type') ?? '').startsWith('audio/'),
  media.headers.get('content-type') ?? 'none',
);

const missing = await call('GET', '/api/v1/curriculum/lessons/does-not-exist');
check('unknown lesson 404s', missing.status === 404, `status ${missing.status}`);

/* 5. Map lock state */
console.log('\nmap');
const map = await call('GET', '/api/v1/map', { token });
check('map served', map.status === 200, `status ${map.status}`);
const available = map.body?.nodes?.filter((n) => n.status === 'available') ?? [];
const locked = map.body?.nodes?.filter((n) => n.status === 'locked') ?? [];
check('exactly one lesson available at the start', available.length === 1, `${available.length}`);
check('the rest of the curriculum is visible but locked', locked.length > 0, `${locked.length}`);

/* 6. Run a full lesson */
console.log('\nsession');
const started = await call('POST', '/api/v1/sessions', {
  token,
  body: { lessonId: 'l1-u1-s1' },
});
check('session started', started.status === 201, `status ${started.status}`);
const sessionId = started.body?.sessionId;
const activities = started.body?.lesson?.activities ?? [];

let allCorrect = true;
for (const activity of activities) {
  const answer =
    activity.kind === 'choose'
      ? activity.options?.find((o) => o.correct)?.id
      : activity.kind === 'speak'
        ? 'said'
        : activity.kind === 'order'
          ? activity.solution?.join('|')
          : activity.kind === 'match'
            ? activity.pairs
                ?.map((p) => `${p.id}=${p.right.src}`)
                .join(',')
            : activity.expected;

  const event = await call('POST', `/api/v1/sessions/${sessionId}/events`, {
    token,
    body: { activityId: activity.id, response: answer, elapsedMs: 2500, hintsUsed: 0 },
  });
  if (event.status !== 200 || event.body?.correct !== true) {
    allCorrect = false;
    console.log(`        activity ${activity.id} -> ${event.status} ${JSON.stringify(event.body)}`);
  }
}
check('every activity graded correct', allCorrect);

const completed = await call('POST', `/api/v1/sessions/${sessionId}/complete`, { token });
check('session completed', completed.status === 200, `status ${completed.status}`);
check('lesson marked completed', completed.body?.completed === true);
check('stars awarded', (completed.body?.starsEarned ?? 0) > 0);
check(
  'stars never exceed the maximum',
  completed.body?.starsEarned <= completed.body?.starsPossible,
);
check('first badge awarded', completed.body?.newBadges?.some((b) => b.badgeId === 'first-step'));
check('next lesson unlocked', completed.body?.nextLessonId === 'l1-u1-s2');

/* 7. Retry collapsing */
console.log('\nretry handling');
const retrySession = await call('POST', '/api/v1/sessions', {
  token,
  body: { lessonId: 'l1-u1-s2' },
});
const retryActivities = retrySession.body?.lesson?.activities ?? [];
const firstActivity = retryActivities[0];
for (let i = 0; i < 3; i += 1) {
  await call('POST', `/api/v1/sessions/${retrySession.body.sessionId}/events`, {
    token,
    body: { activityId: firstActivity.id, response: 'wrong', elapsedMs: 500, hintsUsed: 0 },
  });
}
for (const activity of retryActivities.slice(1)) {
  await call('POST', `/api/v1/sessions/${retrySession.body.sessionId}/events`, {
    token,
    body: {
      activityId: activity.id,
      response: activity.kind === 'order' ? activity.solution?.join('|') : activity.expected,
      elapsedMs: 500,
      hintsUsed: 0,
    },
  });
}
const retryDone = await call('POST', `/api/v1/sessions/${retrySession.body.sessionId}/complete`, {
  token,
});
check(
  'repeated wrong taps do not inflate stars',
  retryDone.body?.starsEarned <= retryDone.body?.starsPossible,
  `${retryDone.body?.starsEarned}/${retryDone.body?.starsPossible}`,
);

/* 8. Caregiver area */
console.log('\ncaregiver');
const noPin = await call('GET', '/api/v1/parent/settings', { token });
check('settings require a PIN', noPin.status === 400, `status ${noPin.status}`);

const wrongPin = await call('GET', '/api/v1/parent/settings', { token, pin: '0000' });
check('wrong PIN rejected', wrongPin.status === 403, `status ${wrongPin.status}`);

const settings = await call('GET', '/api/v1/parent/settings', { token, pin: '2468' });
check('settings readable with the PIN', settings.status === 200, `status ${settings.status}`);
check('outbound network is off by default', settings.body?.settings?.allowOutboundNetwork === false);

const updated = await call('PUT', '/api/v1/parent/settings', {
  token,
  pin: '2468',
  body: { dailyLimitMinutes: 20 },
});
check('settings updatable', updated.body?.settings?.dailyLimitMinutes === 20);

const report = await call('GET', '/api/v1/parent/report?days=30', { token, pin: '2468' });
check('report served', report.status === 200, `status ${report.status}`);
check('report counts the session', (report.body?.report?.sessionsCompleted ?? 0) >= 1);

const exportData = await call('GET', '/api/v1/parent/export', { token, pin: '2468' });
check('export served', exportData.status === 200, `status ${exportData.status}`);
check('export contains the profile', exportData.body?.profile?.nickname === 'E2E');

/* 9. Erasure */
console.log('\nerasure');
const deleted = await call('DELETE', '/api/v1/parent/profile', { token, pin: '2468' });
check('profile deleted', deleted.status === 200, `status ${deleted.status}`);
check('deletion confirmed', deleted.body?.deleted === true);

const afterDelete = await call('GET', '/api/v1/profiles/me', { token });
check('token no longer resolves', afterDelete.status === 401, `status ${afterDelete.status}`);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
