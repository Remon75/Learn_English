#!/usr/bin/env node
/**
 * Builds the Postman collection from the OpenAPI contract.
 *
 * The OpenAPI spec at `postman/specs/sparkle-english.yaml` is the source of
 * truth for the interface. This script:
 *
 *   1. generates the v3 collection from the spec,
 *   2. applies the maintained overrides that the generator cannot know:
 *      auth variable names, collection variables, and assertion scripts,
 *   3. writes the result to `postman/collections/sparkle-english/`.
 *
 * It is idempotent: run it after every contract change and commit the
 * result. The assertions live here, in one place, rather than being
 * scattered across hand-edited request files.
 *
 * The output is byte-for-byte reproducible. The Postman CLI generator stamps
 * `format: date-time` examples with the current time, so step 5 rewrites
 * those timestamps to a fixed instant.
 *
 * Usage: node scripts/build-postman.mjs
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const specPath = join(root, 'postman', 'specs', 'sparkle-english.yaml');
const collectionsDir = join(root, 'postman', 'collections');
const targetName = 'sparkle-english';
const targetDir = join(collectionsDir, targetName);
const stagingDir = join(root, '.postman-staging');

/* ----------------------------- 1. Generate ----------------------------- */

rmSync(stagingDir, { recursive: true, force: true });
mkdirSync(stagingDir, { recursive: true });

execFileSync(
  'postman',
  [
    'spec',
    'generate',
    'collection',
    specPath,
    '-n',
    'Sparkle English API',
    '--folder-strategy',
    'Tags',
    '--force',
  ],
  { cwd: stagingDir, stdio: 'inherit' },
);

// The CLI writes to `<cwd>/postman/collections/<name>`.
const generatedDir = join(stagingDir, 'postman', 'collections', 'Sparkle English API');
if (!existsSync(generatedDir)) {
  throw new Error(`Expected the generator to produce "${generatedDir}"`);
}

rmSync(targetDir, { recursive: true, force: true });
cpSync(generatedDir, targetDir, { recursive: true });
rmSync(stagingDir, { recursive: true, force: true });

/* ------------------------------ 2. Helpers ------------------------------ */

function readYaml(file) {
  return YAML.parse(readFileSync(file, 'utf8'));
}

function writeYaml(file, value) {
  writeFileSync(file, YAML.stringify(value, { lineWidth: 0 }), 'utf8');
}

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const requestFiles = walk(targetDir).filter((f) => f.endsWith('.request.yaml'));
const definitionFiles = walk(targetDir).filter((f) => f.endsWith('definition.yaml'));

/* ---------------------- 3. Collection-level context ---------------------- */

/**
 * The generated collection names the device secret `apiKey`, which is
 * misleading. Rename it to `deviceToken` and add the other values the
 * contract tests need.
 */
const COLLECTION_VARIABLES = [
  { key: 'baseUrl', value: 'http://localhost:8080' },
  { key: 'deviceToken', value: '', description: 'Issued by POST /api/v1/profiles.' },
  { key: 'caregiverPin', value: '1234', description: '4-digit PIN for adult-only endpoints.' },
  { key: 'newPin', value: '1357', description: 'Replacement PIN used by the PIN-change request.' },
  { key: 'lessonId', value: 'l1-u1-s1' },
  { key: 'sessionId', value: '' },
  { key: 'activityId', value: '' },
  { key: 'correctResponse', value: '' },
];

/**
 * A collection-level before-request script injects the two credentials that
 * the generated requests do not model: the device token and the caregiver
 * PIN. Requests keep their own auth block, so this only adds what is
 * missing.
 */
const BEFORE_REQUEST_SCRIPT = `
const deviceToken = pm.collectionVariables.get('deviceToken');
if (deviceToken && !pm.request.headers.has('X-Device-Token')) {
  pm.request.headers.add('X-Device-Token', deviceToken);
}

const caregiverPin = pm.collectionVariables.get('caregiverPin');
if (caregiverPin && pm.request.url.toString().includes('/api/v1/parent/')) {
  pm.request.headers.add('X-Caregiver-Pin', caregiverPin);
}
`.trim();

for (const file of definitionFiles) {
  const definition = readYaml(file);

  if (definition.$kind === 'collection') {
    definition.name = 'Sparkle English API';
    definition.variables = COLLECTION_VARIABLES;
    definition.scripts = [
      ...(definition.scripts ?? []),
      {
        type: 'http:beforeRequest',
        language: 'text/javascript',
        code: BEFORE_REQUEST_SCRIPT,
      },
    ];
  }

  writeYaml(file, definition);
}

/* ------------------------- 4. Per-request overrides ------------------------- */

/** Maps a request file to the assertions it should carry. */
const ASSERTIONS = {
  'profiles/List local profiles.request.yaml': [
    "pm.test('returns a profiles array', () => pm.expect(pm.response.json()).to.have.property('profiles'));",
  ],
  'profiles/Create a child profile.request.yaml': [
    "pm.test('creates the profile', () => pm.response.to.have.status(201));",
    "pm.test('issues a device token', () => pm.expect(pm.response.json().deviceToken).to.be.a('string').and.have.length.above(20));",
    "pm.test('returns no email or password', () => { const p = pm.response.json().profile; pm.expect(p).to.not.have.property('email'); pm.expect(p).to.not.have.property('password'); });",
    "pm.collectionVariables.set('deviceToken', pm.response.json().deviceToken);",
  ],
  "profiles/Get the profile bound to the presented device token.request.yaml": [
    "pm.test('returns the profile', () => pm.response.to.have.status(200));",
  ],
  'curriculum/List curriculum levels.request.yaml': [
    "pm.test('returns at least six levels', () => pm.expect(pm.response.json().levels.length).to.be.at.least(6));",
  ],
  'curriculum/List every lesson in curriculum order.request.yaml': [
    "pm.test('returns the lesson index', () => pm.expect(pm.response.json().lessons.length).to.be.above(0));",
  ],
  "curriculum/Get one lesson with all of its activities.request.yaml": [
    "pm.test('returns the lesson', () => pm.response.to.have.status(200));",
    "pm.test('has activities', () => pm.expect(pm.response.json().lesson.activities.length).to.be.above(0));",
    "pm.test('media references stay on our own origin', () => { const json = pm.response.text(); pm.expect(json).to.not.include('http://'); pm.expect(json).to.not.include('https://'); });",
  ],
  "curriculum/The child's learning map.request.yaml": [
    "pm.test('returns the map', () => pm.response.to.have.status(200));",
    "pm.test('exactly one lesson is available at the start', () => { const nodes = pm.response.json().nodes; pm.expect(nodes.filter(n => n.status === 'available').length).to.eql(1); });",
    "pm.test('locked lessons stay visible', () => pm.expect(pm.response.json().nodes.filter(n => n.status === 'locked').length).to.be.above(0));",
  ],
  'sessions/Start a learning session.request.yaml': [
    "pm.test('starts the session', () => pm.response.to.have.status(201));",
    "const lesson = pm.response.json().lesson;",
    "const choose = lesson.activities.find(a => a.kind === 'choose');",
    "const activity = choose || lesson.activities[0];",
    "pm.collectionVariables.set('activityId', activity.id);",
    "pm.collectionVariables.set('correctResponse', choose ? choose.options.find(o => o.correct).id : (activity.expected || 'said'));",
    "pm.collectionVariables.set('sessionId', pm.response.json().sessionId);",
  ],
  'sessions/Record one activity attempt.request.yaml': [
    "pm.test('grades the attempt', () => { const r = pm.response.json(); pm.expect(r).to.have.property('score'); pm.expect(r.score).to.be.within(0, 1); });",
  ],
  'sessions/Finalise a session and apply rewards.request.yaml': [
    "pm.test('completes the session', () => pm.response.to.have.status(200));",
    "pm.test('stars never exceed the maximum', () => { const r = pm.response.json(); pm.expect(r.starsEarned).to.be.at.most(r.starsPossible); });",
    "pm.test('awards badges as an array', () => pm.expect(pm.response.json().newBadges).to.be.an('array'));",
  ],
  'parent/Read caregiver settings.request.yaml': [
    "pm.test('returns the settings', () => pm.response.to.have.status(200));",
    "pm.test('outbound network is off by default', () => pm.expect(pm.response.json().settings.allowOutboundNetwork).to.eql(false));",
  ],
  'parent/Update caregiver settings.request.yaml': [
    "pm.test('saves the settings', () => pm.response.to.have.status(200));",
  ],
  'parent/Full progress snapshot.request.yaml': [
    "pm.test('returns the progress snapshot', () => pm.response.to.have.status(200));",
  ],
  'parent/Aggregate teacher report.request.yaml': [
    "pm.test('returns the report', () => pm.response.to.have.status(200));",
    "pm.test('the report is aggregate', () => { const r = pm.response.json().report; pm.expect(r).to.not.have.property('events'); pm.expect(r).to.not.have.property('keystrokes'); });",
  ],
  'parent/Export all data for this child as JSON.request.yaml': [
    "pm.test('returns the export', () => pm.response.to.have.status(200));",
    "pm.test('exports the profile', () => pm.expect(pm.response.json()).to.have.property('profile'));",
  ],
  'parent/Change the caregiver PIN.request.yaml': [
    "pm.test('changes the PIN', () => pm.response.to.have.status(200));",
    "// Later requests must use the new PIN.",
    "pm.collectionVariables.set('caregiverPin', pm.collectionVariables.get('newPin'));",
  ],
  'parent/Erase the child profile and all associated data.request.yaml': [
    "pm.test('erases the profile', () => pm.response.to.have.status(200));",
    "pm.test('confirms deletion', () => pm.expect(pm.response.json().deleted).to.eql(true));",
  ],
};

/**
 * Explicit ordering for the caregiver folder.
 *
 * The PIN change has to run after every read that still uses the old PIN,
 * and the erasure has to run last because it invalidates the device token.
 */
const REQUEST_ORDER = {
  'parent/Read caregiver settings.request.yaml': 1000,
  'parent/Update caregiver settings.request.yaml': 2000,
  'parent/Full progress snapshot.request.yaml': 3000,
  'parent/Aggregate teacher report.request.yaml': 4000,
  'parent/Export all data for this child as JSON.request.yaml': 5000,
  'parent/Change the caregiver PIN.request.yaml': 6000,
  'parent/Erase the child profile and all associated data.request.yaml': 7000,
};

const BODY_BINDINGS = {
  'sessions/Start a learning session.request.yaml': { lessonId: '{{lessonId}}' },
  'sessions/Record one activity attempt.request.yaml': {
    activityId: '{{activityId}}',
    response: '{{correctResponse}}',
  },
  'parent/Change the caregiver PIN.request.yaml': { newPin: '{{newPin}}' },
};

/** Requests gated behind the caregiver PIN. */
const CAREGIVER_REQUESTS = new Set([
  'parent/Read caregiver settings.request.yaml',
  'parent/Update caregiver settings.request.yaml',
  'parent/Full progress snapshot.request.yaml',
  'parent/Aggregate teacher report.request.yaml',
  'parent/Export all data for this child as JSON.request.yaml',
  'parent/Change the caregiver PIN.request.yaml',
  'parent/Erase the child profile and all associated data.request.yaml',
]);

for (const file of requestFiles) {
  const relative = file.slice(targetDir.length + 1).split('\\').join('/');
  const request = readYaml(file);

  // Rename the device-secret variable the generator produced.
  // The generator writes `credentials` as a map; the v3 schema also allows
  // an array of `{key, value}` entries, so both shapes are handled.
  if (request.auth?.type === 'apikey') {
    const credentials = request.auth.credentials;
    if (Array.isArray(credentials)) {
      for (const credential of credentials) {
        if (credential.key === 'X-Device-Token') credential.value = '{{deviceToken}}';
      }
    } else if (credentials && typeof credentials === 'object') {
      if (credentials.key === 'X-Device-Token') credentials.value = '{{deviceToken}}';
    }
  }

  // Caregiver endpoints are PIN-gated. The header is declared explicitly on
  // each request rather than injected by a collection-level script, so the
  // requirement is visible in the request itself and does not depend on
  // script-scope resolution.
  if (CAREGIVER_REQUESTS.has(relative)) {
    if (request.headers && !Array.isArray(request.headers)) {
      request.headers['X-Caregiver-Pin'] = '{{caregiverPin}}';
    } else {
      request.headers = [
        ...(request.headers ?? []),
        { key: 'X-Caregiver-Pin', value: '{{caregiverPin}}' },
      ];
    }
  }

  // Path variables are generated as literal placeholders such as "string".
  // Bind them to collection variables so a value captured by an earlier
  // request flows into this one.
  if (Array.isArray(request.pathVariables)) {
    for (const pathVariable of request.pathVariables) {
      pathVariable.value = `{{${pathVariable.key}}}`;
    }
  }

  // Body fields that chain from a previous response.
  const bindings = BODY_BINDINGS[relative];
  if (bindings && request.body?.type === 'json') {
    try {
      const parsedBody = JSON.parse(request.body.content);
      for (const [key, value] of Object.entries(bindings)) {
        if (key in parsedBody) parsedBody[key] = value;
      }
      request.body.content = `${JSON.stringify(parsedBody, null, 2)}\n`;
    } catch {
      // Leave the body untouched if it is not the expected JSON shape.
    }
  }

  const assertions = ASSERTIONS[relative];
  if (assertions) {    request.scripts = [
      ...(request.scripts ?? []),
      {
        type: 'afterResponse',
        language: 'text/javascript',
        code: assertions.join('\n'),
      },
    ];
  }

  if (REQUEST_ORDER[relative] !== undefined) {
    request.order = REQUEST_ORDER[relative];
  }

  writeYaml(file, request);
}

/* --------------------- 5. Normalise generated example timestamps --------------------- */

/**
 * The Postman CLI generator fills `format: date-time` example values with a
 * fresh timestamp on every run. That makes the build non-deterministic: two
 * runs of this script on the same spec produce different files, and every
 * rebuild shows up as a diff in review.
 *
 * Replacing the generated timestamps with one fixed instant makes the output
 * byte-for-byte reproducible. The value is the generator's own canonical
 * example date, so it stays recognisable.
 */
const EXAMPLE_TIMESTAMP = '1971-10-16T21:01:08.456Z';
const ISO_DATE_TIME = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})/g;

const exampleFiles = walk(targetDir).filter((f) => f.endsWith('.example.yaml'));
let normalised = 0;

for (const file of exampleFiles) {
  const original = readFileSync(file, 'utf8');
  const updated = original.replace(ISO_DATE_TIME, EXAMPLE_TIMESTAMP);
  if (updated !== original) {
    writeFileSync(file, updated, 'utf8');
    normalised += 1;
  }
}

/* ------------------------------ 6. Summary ------------------------------ */

console.log(`Built ${targetName} collection`);
console.log(`  requests: ${requestFiles.length}`);
console.log(`  with assertions: ${Object.keys(ASSERTIONS).length}`);
console.log(`  examples normalised: ${normalised}/${exampleFiles.length}`);
console.log(`  path: ${targetDir}`);

/* ------------------------- 7. Keep the workflow in sync ------------------------- */

/**
 * `.postman/workflows.yaml` tells the Postman CLI which collection is
 * generated from which spec. It must point at the collection this script
 * actually writes, otherwise `postman init` warns about a missing
 * collection.
 */
const workflowsPath = join(root, '.postman', 'workflows.yaml');
if (existsSync(workflowsPath)) {
  const workflows = readYaml(workflowsPath);
  const entries = workflows?.workflows?.syncSpecToCollection;
  if (Array.isArray(entries)) {
    for (const entry of entries) {
      if (entry.spec?.endsWith('sparkle-english.yaml')) {
        entry.collection = '../postman/collections/sparkle-english';
      }
    }
    writeYaml(workflowsPath, workflows);
    console.log('  workflow: synced to the generated collection path');
  }
}
