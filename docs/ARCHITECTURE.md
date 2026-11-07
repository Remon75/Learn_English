# Sparkle English — Technical Architecture

A privacy-first, fully open-source English learning platform for children aged
3 and above. Everything runs on hardware the operator owns. No child data is
ever transmitted to a third party, because no third-party service exists in
the product.

**Status:** working MVP — API, PWA, offline mode, scoring, caregiver console
and self-hosted infrastructure are implemented and verified.

**Verification at time of writing**

| Check | Result |
|---|---|
| Shared package unit tests | 28 passed |
| API integration tests (real SQLite) | 23 passed |
| Web contract tests | 15 passed |
| End-to-end smoke test vs. live server | 41 passed |
| Postman collection run vs. live server | 18 requests, 29 assertions, 0 failed |
| OpenAPI 3.1 lint | No issues found |
| Postman collection lint | 18 requests, 0 errors, 0 warnings |
| PWA production build | 16 precache entries, 434 KiB; PixiJS split into a lazy 901 KiB chunk |

> The Docker topology in `infra/` was validated by resolving every service
> reference, but the images were not built on the machine that wrote this
> document — Docker was not installed there. See `docs/DEPLOYMENT.md`.

---

## 1. Fully Open-Source & Free Tech Stack

Every component is permissive-licensed FOSS. Licences were verified against
the npm registry at the versions actually installed (see `docs/LICENSES.md`).

### 1.1 Front-end

| Concern | Choice | Licence | Why |
|---|---|---|---|
| UI framework | **React 19** | MIT | Largest FOSS ecosystem for accessible components; team familiarity. |
| Build tool | **Vite 7** | MIT | Fast cold start; native ESM; first-class PWA plugin. |
| Language | **TypeScript 5.9** | Apache-2.0 | The contract between the client, the server and the curriculum is type-checked. |
| State | **Zustand 5** | MIT | 1 kB, no provider tree, works outside React for the audio engine. |
| Local persistence | **Dexie 4** | Apache-2.0 | IndexedDB wrapper with a transactional API; queues offline events. |
| Service worker | **Workbox 7** (via `vite-plugin-pwa` 1.3) | MIT | Battle-tested offline caching primitives. |
| 2D vector engine | **PixiJS 8** | MIT | WebGL/WebGPU particle renderer for reward celebrations. Lazily imported so it never blocks first paint. |
| Vector animation | **Lottie-web 5** | MIT | Plays Lottie JSON authored in any FOSS vector tool; used for mascot and story beats. |
| State-machine animation | **Rive runtime** (`@rive-app/canvas`) | MIT | Interactive, input-driven character animation with a state machine. Runtime is MIT; see §1.8. |
| Audio playback | **Howler.js 2** | MIT | One API for HTML5 and Web Audio backends, with a single HTML5 audio element to satisfy browser autoplay rules. |
| Audio synthesis / analysis | **Web Audio API** | W3C standard | Native browser API — not a dependency. Reward tones are generated on-device; microphone level is measured locally. |
| Speech | **Web Speech API** | W3C standard | Speaks the placeholder vocabulary with the device's own voice when no recording exists. Nothing is sent to a service by the app. |

**Deliberately excluded**

- **GSAP** — its standard licence is not an OSI-approved FOSS licence.
  Animations use CSS, PixiJS and Lottie instead.
- **Firebase, Supabase, Sentry, Google Fonts, any CDN-hosted font or
  library** — all introduce a third-party dependency or proprietary licence.

### 1.2 Back-end

| Concern | Choice | Licence | Why |
|---|---|---|---|
| Runtime | **Node.js 24 LTS** | MIT / others | Long-term support; the same language as the client. |
| HTTP framework | **Fastify 5** | MIT | Schema-first, fast, first-class JSON Schema and OpenAPI support. |
| Schema validation | **Zod 4** | MIT | Runtime validation at every boundary. |
| OpenAPI | **@fastify/swagger 9** + **@fastify/swagger-ui 6** | MIT | The contract is generated from the running server and served at `/docs`. |
| CORS | **@fastify/cors 11** | MIT | Configurable origin allow-list. |
| Rate limiting | **@fastify/rate-limit 11** | MIT | Protects a shared family device from a runaway client. |
| Auth | Hand-rolled on **node:crypto** (`scrypt`) | MIT | No auth framework, no OAuth server, no JWT library. See §1.6. |

### 1.3 Database

| Concern | Choice | Licence | Why |
|---|---|---|---|
| Primary store | **SQLite 3** via `better-sqlite3` 13 | MIT driver / SQLite is public domain | Zero administration, single file, transactional, synchronous and fast enough for a single household. The entire child database is one file that can be copied, backed up or deleted. |
| Query layer | **Drizzle-ready schema** (plain SQL migrations) | — | The schema is explicit SQL in `apps/api/src/db/index.ts`; it is portable to PostgreSQL with a mechanical change if a school deployment needs concurrent multi-user writes. |
| Migrations | Idempotent `CREATE TABLE IF NOT EXISTS` | — | Runs safely on every deploy; no migration tool to operate. |

**Why SQLite and not PostgreSQL:** the target deployment is one household on
one device. A server database would add an operational burden and a second
thing to back up without adding value. The schema avoids SQLite-specific
features so PostgreSQL remains a drop-in for a shared school deployment.

### 1.4 Asset and animation pipeline

| Concern | Choice | Licence | Why |
|---|---|---|---|
| Vector authoring | **Inkscape** | GPL-2.0 | The authoring tool is FOSS. Output (SVG) is a royalty-free format. |
| Vector animation authoring | **Synfig Studio** | GPL-3.0 | Free, scriptable, exports Lottie-compatible animation. |
| Raster generation | **ImageMagick** | ImageMagick License (MIT-like) | Batch conversion to WebP and PNG. |
| SVG optimisation | **SVGO** | MIT | Shrinks the vector payload. |
| Audio encoding | **FFmpeg** | LGPL-2.1/GPL-2.0 | Transcodes master recordings to Opus/OGG and MP3. |
| Offline TTS (optional) | **Piper** | MIT | Fully offline neural TTS. Generates narration on your own hardware, so no text ever reaches a cloud service. |
| Speech assessment (planned) | **whisper.cpp** | MIT | Local-only pronunciation scoring. See `docs/ROADMAP.md`. |
| Procedural audio | **Web Audio API** oscillators | W3C standard | Reward tones are synthesised in-browser; no files to ship. |
| Icons / illustrations | **OpenMoji** (CC-BY-SA 4.0) or hand-authored SVG | CC-BY-SA / MIT | Share-alike obligations are honoured for CC-BY-SA assets; the icons shipped here are generated from code and carry no third-party rights. |

**The shipped asset library is generated from code.** `scripts/generate-media.mjs`
synthesises every audio file and draws every SVG from scratch. The repository
contains no third-party binaries, no stock photography and no fonts with
restrictive licences. Swapping in recorded human narration is a drop-in
replacement: the curriculum references media by *logical* path, and the API
resolves each path to whatever format actually exists on disk.

### 1.5 Audio engine

- **Playback:** Howler.js, one pooled `HTMLAudioElement` per source, muted
  until the first user gesture (browser autoplay policy).
- **Synthesis:** Web Audio API oscillators for tap/correct/reward tones. No
  audio files, nothing downloaded, nothing transmitted.
- **Speech:** the Web Speech API speaks the lesson vocabulary when the media
  library only holds a placeholder tone. The media manifest
  (`/media/manifest.json`) decides what is a placeholder; a local
  (`localService`) voice is preferred. See `docs/ASSETS.md` §2.1 and
  `docs/PRIVACY.md` §2.4.
- **Analysis:** `AnalyserNode` drives a visual loudness meter so a child can
  see that the app is hearing them even with the volume off.
- **Format negotiation:** the API resolves `/media/audio/<id>` to the best
  format the client accepts (`audio/ogg` → `audio/mpeg` → `audio/wav`), and
  returns concrete extension-bearing URLs so browser decoders never guess.

### 1.6 Authentication and privacy model

No accounts. No email. No OAuth. No password reset email, because there is
no server to email from.

| Secret | Form | Stored as | Purpose |
|---|---|---|---|
| Device token | 256-bit random (`crypto.randomBytes`) | Salted scrypt hash | Proves "this tablet owns this profile". Presented as `X-Device-Token`. |
| Caregiver PIN | 4 digits, chosen by an adult | Salted scrypt hash | Gates adult-only screens. Presented as `X-Caregiver-Pin`. |

The PIN is a **household gate**, not a security boundary — it stops a
three-year-old from changing settings. It is documented as such rather than
oversold.

### 1.7 Self-hosted infrastructure

| Concern | Choice | Licence | Why |
|---|---|---|---|
| Orchestration | **Docker Compose** | Apache-2.0 | One file, three containers, no orchestrator to learn. |
| Reverse proxy / TLS | **Caddy 2** | Apache-2.0 | Automatic certificate issuance and renewal with no third-party account and no cron job. |
| Base image | **node:24-alpine**, **caddy:2.10-alpine** | — | Small, actively maintained, reproducible. |
| Storage | **Named Docker volumes** | — | The SQLite database and Caddy state survive rebuilds. |
| Backup | `sqlite3 .backup` + `tar` | — | Two commands, documented in `docs/DEPLOYMENT.md`. |

```
                    ┌──────────────┐
   internet  ──────▶│ edge (Caddy) │  TLS, security headers, routing
                    └──────┬───────┘
                 ┌─────────┴─────────┐
                 ▼                   ▼
        ┌────────────────┐   ┌──────────────┐
        │ web (Caddy)    │   │ api (Node)   │  Fastify + SQLite
        │ static PWA     │   └──────┬───────┘
        └────────────────┘          ▼
                              ┌──────────────┐
                              │ media volume │  lesson audio + images
                              └──────────────┘
```

The API container runs as the unprivileged `node` user. The edge container
sets a strict `Content-Security-Policy` that permits **only** `'self'` — the
app is structurally incapable of calling a third party.

### 1.8 Licence caveats and deliberate substitutions

| Requested technology | Status | Note |
|---|---|---|
| PixiJS | **Included** | MIT. Used for reward particles. |
| Lottie-Web | **Included** | MIT. Used for mascot and story beats. |
| Rive runtime | **Included** | The *runtime* is MIT. The Rive editor is proprietary, so it is **not** required: animations can be authored in Synfig and exported to Lottie. Rive is an optional drop-in. |
| Howler.js | **Included** | MIT. |
| Web Audio API | **Included** | Native browser API. |
| GSAP | **Excluded** | Not permissively licensed. CSS + PixiJS + Lottie cover the same needs. |
| Proprietary TTS/STT APIs | **Excluded** | Piper (MIT) and whisper.cpp (MIT) cover these locally. |

---

## 2. Core Features & Gamification Mechanics

### 2.1 Feature matrix

| Area | Implemented | Behaviour |
|---|---|---|
| **Curriculum** | ✅ | 6 levels, 14 units, 21 lessons, 68 activities, 7 activity types, 15 skill tags. |
| **Server-side scoring** | ✅ | The client never grants stars or badges. |
| **Badges** | ✅ | 12 badges, evaluated server-side against a progress snapshot. |
| **Skill mastery** | ✅ | Per-skill 0–1 mastery, weighted so one lesson cannot erase a history. |
| **Learning map** | ✅ | Every lesson visible; sequential unlocking; per-lesson stars. |
| **Offline / PWA** | ✅ | Service worker, cache-first media, network-first API with fallback, queued events. |
| **Offline event queue** | ✅ | Events captured while offline are flushed on reconnect; the child never loses progress. |
| **Speaking practice** | ✅ | Microphone capture with a live loudness meter. Audio is never uploaded or stored. |
| **Caregiver console** | ✅ | PIN-gated: report, settings, export, erasure. |
| **Data export** | ✅ | One JSON download containing everything held about the child. |
| **Data erasure** | ✅ | One action removes the profile and every dependent row. |
| **Time limits & bedtime lock** | ⚙️ Schema + settings UI | Enforcement of the daily cap and bedtime window is Phase 2 (§4). |
| **Multiple children** | ⚙️ Schema + switcher | Concurrent profile switching is Phase 2. |
| **Localisation** | ⚠️ Schema only | `caregiverLocale` exists; UI translation is Phase 3. |
| **Automatic pronunciation scoring** | 📋 Planned | whisper.cpp on the operator's hardware, Phase 3. |

### 2.2 Reward design — engagement without dark patterns

The reward system is deliberately conservative, because the brief excludes
manipulative patterns.

**Rules**

1. **Stars are earned, never bought, never lost.** Completing a lesson is
   the only way to earn them. A daily limit never removes them.
2. **No streak punishment.** A streak counts consecutive days of activity,
   but a missed day resets only the *counter*. It never removes stars,
   badges, or unlocked lessons. A child who is ill does not lose progress.
3. **No randomised rewards.** Every badge is deterministic and its condition
   is explicit. There are no loot boxes, no mystery multipliers, no
   "99% chance" animations.
4. **No urgency, scarcity or nagging.** There are no timers, no "streak at
   risk!" banners, no red dots, no push notifications, no streaks that
   expire.
5. **No social mechanics.** Nothing is compared to other children. There are
   no leaderboards, no public profiles, no sharing without an adult.
6. **Unearned badges stay visible.** Greyed out, never hidden — the child can
   see the goal without being nagged toward it.
7. **Hints are not punished.** Using a scaffold reduces that activity's star
   value by at most two, never to zero, so a child never refuses help to
   protect a score.
8. **Retries are free.** Repeated attempts at one activity collapse to the
   best attempt, so tapping the wrong answer three times neither penalises
   the child nor inflates their stars.

**Scoring formula** (deterministic, in `packages/shared/src/scoring.ts`)

```
stars(activity, attempt) =
    0                                     if attempt.score < 0.5
    min(activity.stars, activity.stars - 1)   if hintsUsed == 1
    min(activity.stars, activity.stars - 2)   if hintsUsed >= 2
    activity.stars                        otherwise

skillMastery' = previous * (1 - w) + sessionMastery * w
    where w = attempts / (attempts + 5)
```

**Badge catalogue** (12, all server-evaluated)

`First Step` · `Bright Spark` · `Story Star` · `Star Collector` ·
`Star Galaxy` · `Sharp Ear` · `Letter Master` · `Sound Wizard` ·
`Word Builder` · `Grammar Champ` · `Brave Voice` · `Three in a Row`

### 2.3 Offline and PWA behaviour

| Layer | Strategy | Effect |
|---|---|---|
| App shell | Precache (16 entries, 434 KiB) | Installs and launches with no network. |
| Lesson media | Cache-first, 90-day expiry | A played lesson replays instantly offline. |
| API reads | Network-first, 3 s timeout, cached fallback | The map still opens when the server is unreachable. |
| Write events | Queue in IndexedDB | Progress is captured offline and flushed on reconnect. |
| Curriculum | Versioned data shipped with the app | Content is available offline by construction. |

PixiJS is excluded from precache and imported dynamically — a child on a
slow connection never waits for a particle engine to see their first lesson.

### 2.4 Caregiver controls

| Control | Default | Notes |
|---|---|---|
| Daily time limit | 0 (off) | Off by default. A limit pauses the app; it never removes rewards. |
| Bedtime lock / wake | unset | Local clock, no server coordination. |
| Microphone | enabled | Off disables speaking activities entirely. |
| Offline downloads | enabled | Controls media caching. |
| Audio | enabled | Silence the whole app. |
| Sharing requires approval | enabled | Any export needs an adult's PIN. |
| **Outbound network** | **disabled** | Master switch. The app is designed to need it never. |
| Export / erase | available | GDPR-K portability and erasure, one action each. |

### 2.5 Privacy posture in one table

| Data category | Collected | Stored | Leaves the device |
|---|---|---|---|
| Child identifier | Random opaque UUID | Yes | Never |
| Nickname | Optional | Yes | Never |
| Avatar, age band | Yes | Yes | Never |
| Device token | Random 256-bit secret | Hashed (scrypt + salt) | Never |
| Caregiver PIN | 4 digits | Hashed (scrypt + salt) | Never |
| Activity attempts | Activity id, answer, score, duration | Yes | Never |
| Voice recordings | **Not collected** | **Never stored** | Never |
| Device identifiers | None | None | Never |
| Third-party requests | None | — | **Never** |

There is no analytics sink, no error-reporting service, no advertising SDK,
no crash reporter and no CDN. The `Content-Security-Policy` enforces this at
the browser level.

---

## 3. UX/UI & Curriculum Architecture

### 3.1 Child-facing UX principles

1. **Audio first, text second.** Every activity speaks its instruction. A
   child who cannot read yet is never blocked.
2. **Every sound has a visual twin.** Correct/incorrect feedback is a
   colour, an icon and an animation *and* a sound. A child with the volume
   off loses nothing.
3. **Minimum 64 px touch targets**, well above the 44 px guideline. Large
   hands, imprecise aim, and tablet use are the design assumption.
4. **One decision per screen.** One activity at a time, one clear next step.
5. **No reading required to navigate.** The map uses colour-coded units,
   icons and stars. Icons are decorative; the meaning is carried by shape
   and position.
6. **Mistakes are cheap.** "Try again!" is framed as encouragement, never as
   failure, and the correct answer is revealed rather than punishing.
7. **Motion respects the child.** `prefers-reduced-motion` collapses all
   animation to a fade.
8. **Accessibility beyond compliance.** Focus outlines, live regions for
   feedback, `aria-meter` for the loudness meter, and screen-reader labels
   on every icon-only control.

### 3.2 Curriculum architecture

The curriculum is **data, not code**. It lives in
`packages/shared/src/curriculum.ts` as a typed tree and is shared verbatim by
the client, the API and the tests.

```
Level  (a themed world, an age band, a colour)
└── Unit  (a theme: "Greetings", "The Alphabet")
    └── Lesson  (one concrete objective: "Greet someone and say hello.")
        └── Activity  (one interaction; 1–3 stars; skill tags)
```

**Level progression**

| Level | Title | Age band | Focus | Skills |
|---|---|---|---|---|
| 1 | Hello, World! | 3–4 | First words, greetings, colours, shapes | listening, greetings, vocabulary, speaking, grammar, colours, shapes, numbers |
| 2 | Alphabet Adventure | 3–4 | Every letter, its sound, tracing | alphabet, writing, vocabulary, phonics, listening |
| 3 | Sound Magic | 5–6 | Blending, segmenting, rhyme, word families | phonics, listening, vocabulary, speaking |
| 4 | Word Builder | 5–6 | Everyday nouns, animals, sorting | vocabulary, listening, speaking, grammar, logic |
| 5 | Little Grammar | 5–6 | Plurals, pronouns, sentence order | grammar, vocabulary, listening, reading |
| 6 | Storyteller | 7–8 | Narrative comprehension, retelling, sequencing | listening, comprehension, logic, emotions, speaking, grammar |

**Activity types**

| Type | Interaction | Server grading |
|---|---|---|
| `listen` | Hear a word, tap the matching picture | exact match on the chosen option |
| `choose` | Four large picture buttons | option id → correct flag |
| `match` | Pair picture with word | every `left=right` pair must be right |
| `order` | Tap word tiles into sequence | ordered token comparison |
| `trace` | Drag a finger over a letter | pixel coverage of the reference glyph |
| `speak` | Tap the mic, say the phrase | self-rated by the child |
| `story` | Narrate a picture sequence | engagement only; no wrong answer |

**Pedagogical design rules encoded in the data**

- Every activity is budgeted at 20 seconds, so a full lesson stays under
  two minutes and a session stays under ten.
- Prompts are at most 8 words so a caregiver can read them aloud in one
  breath.
- Difficulty rises *inside* a unit (`difficulty: 1 → 3`), not by skipping
  ahead.
- Every activity carries skill tags; these drive the mastery meters and the
  caregiver report.
- Lessons unlock sequentially, but **locked lessons remain visible** so the
  child sees the whole journey rather than a single next step.

### 3.3 Screen architecture

```
Welcome ──▶ Map ──┬──▶ Lesson ──▶ Activity (× N) ──▶ Celebration ──┐
  (onboarding)    │                                                   │
                  ├──▶ Rewards (badges + mastery) ◀──────────────────┘
                  │
                  └──▶ Parent console (PIN) ──▶ Report / Settings / Export / Erase
```

The API contract behind these screens is documented in
`postman/specs/sparkle-english.yaml` (OpenAPI 3.1) and exercised by
`postman/collections/sparkle-english`.

---

## 4. Implementation Roadmap

Each phase ends in something runnable and verifiable. Effort estimates are
for one experienced full-time developer.

### Phase 0 — Foundations ✅ *(complete)*

| Item | Status |
|---|---|
| Monorepo (npm workspaces), TypeScript strict mode | ✅ |
| Shared domain package: types, curriculum, badges, scoring | ✅ |
| Fastify API with SQLite, schema, migrations | ✅ |
| Auth: device token + caregiver PIN (scrypt) | ✅ |
| Curriculum, map, session, event, completion, parent endpoints | ✅ |
| React PWA with all 7 activity renderers | ✅ |
| Audio engine (Howler + Web Audio), PixiJS celebration | ✅ |
| Offline: service worker, Dexie queue, cache strategies | ✅ |
| Caregiver console: report, settings, export, erasure | ✅ |
| OpenAPI 3.1 spec, Postman collection with assertions | ✅ |
| Docker Compose + Caddy + TLS + strict CSP | ✅ |
| 66 automated tests + 41-check e2e smoke test | ✅ |

### Phase 1 — Real content ✅ *(complete)*

| Item | Status |
|---|---|
| Full 6-level curriculum (14 units, 21 lessons, 68 activities, 7 activity types) | ✅ |
| Procedurally generated media library (53 audio, 63 images) + 3 PWA icons | ✅ |
| Generated PWA icons and favicon | ✅ |
| Skill mastery model and caregiver report | ✅ |

### Phase 2 — Human narration and production polish *(4–6 weeks)*

| Item | Detail |
|---|---|
| **Recorded narration** | Commission a human voice for 200+ prompts. Drop-in via the logical-path media system; no code change. |
| **Illustrated art set** | Replace generated SVGs with hand-authored vector art in Inkscape/Synfig. |
| **Real illustrations + Lottie mascot** | A mascot that reacts to correct/incorrect answers via a Rive state machine. |
| **Enforce the daily limit and bedtime lock** | Server-enforced with a calm, non-punitive pause screen. |
| **Multiple child profiles** | Profile switcher on the caregiver side; per-child avatars and settings. |
| **Accessibility audit** | Full WCAG 2.2 AA audit with manual screen-reader testing and expert review. |
| **Localisation** | Extract strings; ship English + Spanish caregiver UI. |
| **Monorepo CI** | Woodpecker CI or GitLab CE, both FOSS: typecheck → test → lint → build → collection run. |

### Phase 3 — Pedagogy and assessment *(6–8 weeks)*

| Item | Detail |
|---|---|
| **Offline pronunciation scoring** | whisper.cpp (MIT) on the operator's hardware. Two-stage scoring: phonetic similarity first, then a neural model. |
| **Adaptive difficulty** | Server-side item selection using the mastery model, with a bounded range so the child is never challenged beyond their level. |
| **Spaced repetition** | Schedule review lessons based on per-skill mastery decay. |
| **Teacher dashboard** | A classroom view for a shared school deployment, built from the same aggregate report API. |
| **Curriculum authoring tool** | A local editor that writes to the same typed curriculum schema, so teachers can add units without touching code. |
| **Printable worksheets** | Generate from the curriculum for offline practice. |

### Phase 4 — Distribution and scale *(8–12 weeks)*

| Item | Detail |
|---|---|
| **PostgreSQL option** | Mechanical switch for multi-user school deployments; the schema avoids SQLite-specific features. |
| **Signed offline packs** | Export/import a lesson pack with a detached signature so a tablet can move between devices. |
| **Native wrappers** | Capacitor (MIT) for a store-distributable Android build; optional and not required. |
| **App-store compliance** | Google Play Families Policy and Apple Kids Category: no ads, no tracking, no third-party SDKs. |
| **F-Droid / software heritage** | Submit the project so the source is permanently archived. |

### Phase 5 — Ecosystem *(ongoing)*

| Item | Detail |
|---|---|
| **Translation platform** | Weblate (AGPL) or Pontoon (Apache-2.0) for community translations. |
| **Asset contribution** | Document the pipeline so illustrators can contribute art under CC-BY-SA with clear attribution rules. |
| **Plugin API** | Let a school add its own activity types without forking. |

### Operational readiness checklist

Before a real child uses a deployment:

- [ ] TLS certificate issued and auto-renewal verified
- [ ] `SPARKLE_DOMAIN` and `ACME_EMAIL` set in `infra/.env`
- [ ] Database backup scheduled and a restore rehearsed
- [ ] Default caregiver PIN changed from the seed value
- [ ] Content-Security-Policy confirmed in the browser console (no violations)
- [ ] Device token storage confirmed to survive a reboot
- [ ] Offline mode tested with the network physically disconnected
- [ ] Time limit and bedtime lock enforced and verified
- [ ] Parental consent and privacy notice displayed to the guardian

---

## Repository map

```
learn-english/
├── apps/
│   ├── api/                  Fastify API, SQLite, auth, media serving
│   └── web/                  React PWA, 7 activity renderers, offline queue
├── packages/
│   └── shared/               Types, curriculum, badges, scoring (single source of truth)
├── postman/
│   ├── specs/                OpenAPI 3.1 contract (authoritative)
│   ├── collections/          v3 collection with assertions
│   └── environments/         Local environment
├── infra/                    Docker Compose, Caddy, Dockerfiles
├── scripts/                  Media/icon generation, Postman build, e2e smoke test
└── docs/
    ├── ARCHITECTURE.md       This document
    ├── PRIVACY.md            COPPA / GDPR-K posture, data inventory, export & erasure
    ├── LICENSES.md           Per-dependency licence audit
    ├── DEPLOYMENT.md         Docker Compose, TLS, backup and restore
    ├── ASSETS.md             The generated media library and how to replace it
    └── ROADMAP.md            Phased delivery plan
```

## Related documents

| Document | Read it when you want to know… |
|---|---|
| [`README.md`](../README.md) | How to install, run and verify the project |
| [`PRIVACY.md`](PRIVACY.md) | Exactly what data exists, where it lives, and how to erase it |
| [`LICENSES.md`](LICENSES.md) | The licence of every dependency, and what was deliberately excluded |
| [`DEPLOYMENT.md`](DEPLOYMENT.md) | How to run it on a LAN or on the public internet, and how to back it up |
| [`ASSETS.md`](ASSETS.md) | How the media library is generated and how to replace it with real narration |
| [`ROADMAP.md`](ROADMAP.md) | What comes next, and what is deliberately out of scope |
