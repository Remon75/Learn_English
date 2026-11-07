# Privacy, Safety and Data Protection

**Sparkle English is designed so that there is nothing to protect.** The child
database is one SQLite file on hardware the operator owns. There is no
analytics sink, no error-reporting service, no advertising SDK, no crash
reporter, no CDN, no cloud TTS, no push notification service, no third-party
font host and no account system. A strict `Content-Security-Policy` permits
only `'self'`, so the browser itself blocks any attempt to contact a
third party.

This document is the honest privacy posture of the project. It states what is
collected, where it lives, what it does **not** do, and how a caregiver
exercises their rights.

---

## 1. Regulatory posture

### 1.1 COPPA (US, Children's Online Privacy Protection Act)

COPPA applies to operators of child-directed online services. Sparkle English
is designed to sit comfortably inside it:

| COPPA requirement | How Sparkle English satisfies it |
|---|---|
| No collection of personal information beyond what is necessary | A random opaque child id, an optional nickname, an avatar id and an age **band** (`3-4`, `5-6`, `7-8`). Never a name, address, school or date of birth. |
| Verifiable parental consent | Consent is implicit and local: the caregiver creates the profile on their own device and sets a PIN. There is no data collected *before* consent because there is no data collected *at all* outside the device. |
| Notice to parents | This document, plus the caregiver console, which states the data position in plain language. |
| Parental access to the child's information | `GET /api/v1/parent/export` — one JSON file, one button. |
| Parental deletion | `DELETE /api/v1/parent/profile` — one button, one confirmation dialog. |
| No third-party disclosure | There is no third party to disclose to. |
| Reasonable security | Salted `scrypt` hashes for both secrets; TLS at the edge; unprivileged container user; no default credentials left in production. |

### 1.2 GDPR / GDPR-K (EU)

Under GDPR the operator of a self-hosted instance is the **controller** and the
household is the **data subject** for its own child.

| GDPR principle | How Sparkle English satisfies it |
|---|---|
| Lawfulness, fairness, transparency | No consent banners because there is no processing that needs consent. The data purpose is stated in the product and in this document. |
| Purpose limitation | Data exists for exactly one purpose: to render a child's own learning progress on their own device. It is not reused, sold or profiled. |
| Data minimisation | No identifiers, no coordinates, no contacts, no behavioural advertising identifiers, no raw recordings, no keystroke capture, no screen capture. |
| Right of access | `GET /api/v1/parent/export` returns the complete record as JSON. |
| Right to portability | The export is machine-readable JSON, not a proprietary format. |
| Right to erasure | `DELETE /api/v1/parent/profile` cascades through every child-scoped table via `ON DELETE CASCADE`. |
| Storage limitation | The caregiver can erase at any time; the operator can delete the single database file. |
| Integrity and confidentiality | Local-only storage, salted `scrypt` hashing, TLS, strict CSP, rate limiting, body size limit of 256 KiB. |
| Data protection by design | The architecture makes the privacy properties structural, not policy-based: there is no code path that could send data elsewhere. |

**GDPR-K note.** The age band `3-4` means the "child" age bracket of the GDPR
(16 by default, 13 with consent). The operator therefore acts as the child's
guardian in practice, and this document is the notice that guardian should
receive before deploying.

### 1.3 What this project does **not** claim

- It is **not** a certified compliance product. Compliance is a legal
  determination that depends on the operator's jurisdiction, context and
  deployment.
- It does **not** provide a hosted service. There is no vendor, no contract,
  no DPA to sign — because there is no vendor.
- It does **not** make the child unrecognisable. A nickname is optional and
  locally stored; the operator should not enter a real name.

---

## 2. Data inventory

Everything the application stores, and where it lives.

### 2.1 Server-side (SQLite, `apps/api/data/sparkle.db` or the `api_data` volume)

| Table | Columns | Personal? | Purpose |
|---|---|---|---|
| `children` | `id` (UUID), `nickname`, `avatar_id`, `age_band`, `created_at`, `current_level_id`, `device_token_hash`, `device_token_salt` | Yes, minimally | Identify the child and bind them to a device |
| `caregiver_pin` | `child_id`, `pin_hash`, `pin_salt`, `updated_at` | Secret | Gate the adult console |
| `lesson_progress` | `child_id`, `lesson_id`, `status`, `stars_earned`, `stars_possible`, `attempts`, `last_attempt_at`, `best_score` | No (behavioural) | Map state, stars, unlocking |
| `badges` | `child_id`, `badge_id`, `awarded_at` | No | Badge awards |
| `sessions` | `id`, `child_id`, `lesson_id`, `started_at`, `ended_at`, `stars_earned`, `stars_possible`, `score` | No | Session history and streaks |
| `session_events` | `id`, `session_id`, `child_id`, `activity_id`, `lesson_id`, `response`, `score`, `elapsed_ms`, `hints_used`, `completed_at` | No | Per-activity answers |
| `skill_mastery` | `child_id`, `skill`, `mastery` | No | Per-skill 0–1 mastery |
| `activity_stats` | `child_id`, `activity_id`, `score` | No | Best-attempt-per-activity rollup |
| `settings` | `child_id`, `daily_limit_minutes`, `bedtime_lock`, `bedtime_wake`, `sharing_requires_approval`, `microphone_enabled`, `offline_downloads_enabled`, `audio_enabled`, `caregiver_locale`, `allow_outbound_network` | No | Caregiver preferences |

### 2.2 Client-side (the child's browser, on the child's device)

| Store | Key | Contents |
|---|---|---|
| `localStorage` | `sparkle.deviceToken` | The 256-bit device token. The only secret held in the browser. |
| IndexedDB (`sparkle-english`, Dexie) | `events` | Queued offline activity attempts awaiting delivery |
| IndexedDB | `lessons` | Cached lesson payloads for offline playback |
| IndexedDB | `sessions` | In-flight session state so a reload does not lose a lesson |
| Cache Storage (Workbox) | precache + runtime | App shell, JS/CSS chunks, lesson media, media manifest |
| Browser microphone | — | **Nothing.** Audio is analysed in memory by an `AnalyserNode` and discarded. |
| Speech synthesis | — | **Nothing.** Words are spoken by the operating system; the app keeps no copy and sends no text. |

### 2.3 What is deliberately **not** collected

| Not collected | Why it matters |
|---|---|
| Voice recordings | The `speak` activity opens the microphone, measures loudness locally and discards the samples. Nothing is written to disk and nothing is uploaded. |
| Camera / images of the child | No camera API is used at all. |
| Name, address, school, birthday | Only an optional nickname and a coarse age band. |
| Precise location | No geolocation API is used. |
| IP addresses retained for profiling | The API logs request lines for debugging; logs are not linked to a child id and are rotated by the operator. |
| Advertising / tracking identifiers | No such SDK is present. |
| Contact list, photos, files | No file picker, no contacts API. |
| Keystrokes / screen recording | Not captured. |
| Third-party request metadata | There are no third-party requests. |
| Spoken text | Lesson words are synthesised by the operating system (see §2.4). The app sends them nowhere. |

### 2.4 The device voice, honestly

The repository ships placeholder audio: a tone per word, not speech. A tone
teaches a child nothing, so the app **speaks** the word instead, using the
Web Speech API of the device it runs on (`apps/web/src/lib/audio.ts`).

| Question | Answer |
|---|---|
| Does the app send the word to a server? | **No.** The app calls `speechSynthesis.speak()` and nothing else. |
| Where is the word synthesised? | Inside the browser and the operating system — typically a local voice (Windows SAPI, macOS `say`, Linux speech-dispatcher). |
| Which voice is chosen? | The app prefers a voice with `localService === true`, i.e. one the device synthesises itself. |
| Can it leave the device? | On a platform where the browser offers **only** cloud voices, the *browser* may send the word to that platform's speech service. The app does not create that situation and does not select such a voice when a local one exists, but it cannot forbid the browser from doing it either. |
| How is it removed? | Ship real recordings. The media manifest (`apps/web/public/media/manifest.json`) then makes the app play the file instead of speaking it. See `docs/ASSETS.md` §2.1. |

The words spoken are the lesson vocabulary itself (`hello`, `cat`,
`the dog runs fast`). No name, no personal data and nothing the child says
is ever spoken.

---

## 3. Data flow

```
┌──────────────────────── the child's device ─────────────────────────┐
│                                                                        │
│  React PWA ──fetch──▶ Fastify API ──▶ SQLite (one file)               │
│     │                    ▲                                           │
│     │                    │                                           │
│     ├── localStorage: device token                                    │
│     ├── IndexedDB: offline queue                                      │
│     ├── Cache: media + app shell                                      │
│     └── speak() ──▶ the operating system's own voice (no network)     │
│                                                                        │
│  No arrows leave this box.                                            │
└────────────────────────────────────────────────────────────────────────┘
```

The API's CORS configuration reflects the origin, the service worker is
same-origin only, and the CSP forbids every other origin. The microphone is
the only peripheral device touched, and its output never reaches the network.
Speech synthesis leaves the browser only as sound, handled by the operating
system (§2.4).

---

## 4. Caregiver rights, one click each

Both operations live in the caregiver console (*Grown-up dashboard → Your
data*) and require the 4-digit PIN.

### 4.1 Export (access + portability)

```
GET /api/v1/parent/export
X-Device-Token: <token>
X-Caregiver-Pin: <pin>
```

Returns a JSON download containing:

```jsonc
{
  "exportedAt": "2026-11-07T10:00:00.000Z",
  "profile": { "id": "...", "nickname": "...", "avatarId": "...", "ageBand": "3-4", "createdAt": "..." },
  "progress": { "totalStars": 12, "badges": [], "lessons": {}, "skillMastery": {}, "currentStreakDays": 1, "...": "..." },
  "sessions": []
}
```

The file is written straight to the caregiver's own downloads folder. It is
never uploaded anywhere.

### 4.2 Erase (right to be forgotten)

```
DELETE /api/v1/parent/profile
X-Device-Token: <token>
X-Caregiver-Pin: <pin>
```

This deletes the `children` row. Every child-scoped table is created with
`ON DELETE CASCADE`, so `lesson_progress`, `badges`, `sessions`,
`session_events`, `skill_mastery`, `settings`, `caregiver_pin` and
`activity_stats` rows are removed in the same transaction. The client then
calls `purgeAll()`, which empties the IndexedDB queues and clears the cached
lessons.

**Complete erasure also requires deleting two things the API cannot reach:**

1. The device token in `localStorage` (the client clears it on sign-out).
2. The database file itself, if the operator wants no residue at all:

   ```bash
   docker compose down
   docker volume rm <project>_api_data
   ```

### 4.3 Changing the caregiver PIN

```
PUT /api/v1/parent/pin        { "newPin": "4821" }
```

The current PIN must be presented. The new PIN is stored with a fresh random
salt. Change the seeded `1234` before any real child uses the instance.

---

## 5. Security model

### 5.1 The two secrets

| Secret | Entropy | Storage | Transmission |
|---|---|---|---|
| Device token | 256 bits (`crypto.randomBytes(32)`) | Salted `scrypt` hash, 64-byte key | `X-Device-Token` header, TLS in transit |
| Caregiver PIN | ~13.3 bits (4 decimal digits) | Salted `scrypt` hash, 64-byte key | `X-Caregiver-Pin` header, TLS in transit |

Verification uses `crypto.timingSafeEqual`, so a wrong PIN cannot be
discovered one byte at a time by timing.

### 5.2 Honest limits

- **The 4-digit PIN is a household gate, not a security boundary.** It stops
  a three-year-old from wandering into the settings screen. It does not
  withstand a determined adult who is willing to brute-force 10,000
  possibilities against a device they physically control. It is documented
  this way on purpose.
- **The device token is bearer-only.** Anyone who copies it from the child's
  browser storage has full access to that child's profile. It is stored in
  `localStorage` because the app must work offline; an attacker with physical
  access to the device and the browser profile already has everything.
- **There is no transport security in a LAN deployment without TLS.** Run Caddy
  (or put the instance behind a reverse proxy that terminates TLS) before
  exposing it beyond a trusted home network. See `docs/DEPLOYMENT.md`.

### 5.3 Defence in depth at the edge

The Caddy configuration in `infra/caddy/Caddyfile` sets:

| Header | Value |
|---|---|
| `Content-Security-Policy` | `default-src 'self'; script-src 'self'; …; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'` |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `no-referrer` |
| `Permissions-Policy` | `geolocation=(), camera=(), microphone=(self), payment=(), usb=()` |
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `Cross-Origin-Resource-Policy` | `same-origin` |

`connect-src 'self'` is the important one: the browser will refuse any
`fetch` or `XHR` to a host other than the origin the app was served from.

### 5.4 Other controls

- **Rate limiting:** 600 requests/minute per client (configurable via
  `SPARKLE_RATE_LIMIT_MAX`), generous enough never to interrupt a child.
- **Request body limit:** 256 KiB. Audio never reaches the server.
- **Path traversal guard** on `/media/*`: the resolved path must stay inside
  `MEDIA_ROOT`.
- **Unprivileged container:** the API image runs as the `node` user.
- **No default credentials in production:** the seed command prints the demo
  token to stdout and refuses to run against a populated database.

---

## 6. Child safety and dark-pattern policy

The reward system in this project is deliberately conservative. These rules
are enforced in `packages/shared/src/scoring.ts` and
`packages/shared/src/badges.ts`, not just described in prose.

1. **Stars are earned, never bought, never lost.** Completing a lesson is the
   only way to earn them. Nothing removes them.
2. **No streak punishment.** A missed day resets the counter only. No stars,
   badges or unlocked lessons are removed.
3. **No randomised rewards.** Every badge has an explicit, deterministic rule.
   No loot boxes, no mystery multipliers, no "99 % chance" animations.
4. **No urgency, scarcity or nagging.** No timers, no "streak at risk"
   banners, no red dots, no push notifications.
5. **No social mechanics.** No leaderboards, no public profiles, no sharing
   without an adult.
6. **Unearned badges stay visible**, greyed out, so the child can see the goal
   without being nagged toward it.
7. **Hints are never punished.** A scaffold reduces an activity's star value by
   at most two and never to zero.
8. **Retries are free.** Repeated attempts collapse to the best attempt
   (`bestAttemptPerActivity`), so tapping the wrong answer three times neither
   penalises the child nor inflates their stars.
9. **No advertising surfaces exist.** There is no ad slot, no ad SDK, no
   sponsored content and no upsell to remove a limitation.

---

## 7. Operator checklist

Before a real child uses an instance:

- [ ] Change the seeded caregiver PIN (`1234`) to something the child cannot guess
- [ ] Decide whether to store a nickname at all (it is optional — leaving it blank removes one identifier)
- [ ] Terminate TLS, or keep the instance on a trusted LAN only
- [ ] Confirm `Content-Security-Policy` in the browser console: no violations
- [ ] Confirm the device token survives a reboot (it lives in `localStorage`)
- [ ] Test offline mode with the network physically disconnected
- [ ] Schedule a database backup and rehearse a restore
- [ ] Set the daily limit and bedtime lock once they are enforced (Phase 2)
- [ ] Read this document to the guardian, and keep a copy with the deployment
- [ ] Confirm your jurisdiction's own requirements (state privacy law, school
      policy, or institutional rules may add to the above)

---

## 8. Disclosure: the Postman cloud workspace

During development, the OpenAPI spec, the Postman collection and a local
environment file were pushed to a **Postman cloud workspace** in order to
exercise Postman tooling.

- **What was uploaded:** `postman/specs/sparkle-english.yaml`,
  `postman/collections/sparkle-english/` and
  `postman/environments/Sparkle Local.environment.yaml`.
- **What was NOT uploaded:** any child profile, any device token, any
  caregiver PIN, any session, any progress record, any database file, any
  media asset.
- **The environment contains one variable:** `baseUrl`, pointing at
  `http://localhost:8080`.

The workspace holds only the API contract. A fresh clone of this repository
reproduces it entirely locally with `npm run postman:build`; the cloud copy is
a convenience, not a dependency.

---

## 9. Contact and responsibility

This is a community project, not a service. The operator of a self-hosted
instance is responsible for:

- securing the host (disk encryption, a strong OS account password, a firewall),
- keeping the database and its backups private,
- honouring the guardian's access and erasure requests,
- and complying with the law that applies to them.

The project keeps no contact details, no user list and no operational
telemetry — by design.
