# Roadmap

A phased plan for taking Sparkle English from a working MVP to a
production-grade, classroom-capable product — while keeping every promise in
the brief: **zero cost, privacy-first, 100 % FOSS, self-hostable.**

Each phase ends in something **runnable and verifiable**. No phase begins
before the previous one is green. Effort estimates assume one experienced
full-time developer.

---

## Phase 0 — Foundations ✅ *complete*

| Item | Status |
|---|---|
| npm-workspaces monorepo, TypeScript strict mode everywhere | ✅ |
| Shared domain package: types, curriculum, badges, scoring | ✅ |
| Fastify API with SQLite, idempotent schema migrations | ✅ |
| Auth: 256-bit device token + 4-digit caregiver PIN (salted scrypt) | ✅ |
| Endpoints: profiles, curriculum, map, sessions, events, completion, parent | ✅ |
| React PWA with all 7 activity renderers | ✅ |
| Audio engine (Howler + Web Audio), PixiJS celebration | ✅ |
| Offline: service worker, Dexie event queue, cache strategies | ✅ |
| Caregiver console: report, settings, PIN change, export, erasure | ✅ |
| OpenAPI 3.1 spec + Postman collection with 29 assertions | ✅ |
| Docker Compose + Caddy + automatic TLS + strict CSP | ✅ |
| 66 automated tests + a 41-check end-to-end smoke test | ✅ |

---

## Phase 1 — Real content ✅ *complete*

| Item | Status |
|---|---|
| Full 6-level curriculum: 14 units, 21 lessons, 68 activities, 7 activity types | ✅ |
| Generated media library: 53 audio, 63 illustrations, 3 PWA icons | ✅ |
| Skill mastery model with per-skill 0–1 scores | ✅ |
| Aggregate teacher report | ✅ |
| Learning map with sequential unlocking and visible locked lessons | ✅ |
| Badge catalogue (12 badges, all server-evaluated) | ✅ |

**The one gap:** the generated audio is placeholder chimes, not narration.
The app works around this by speaking the words with the device's own voice
(see `docs/ASSETS.md` §2.1), but recorded narration is better, and it is the
first item of Phase 2.

---

## Phase 2 — Human narration and production polish *(4–6 weeks)*

The highest-impact phase. A child does not learn English from placeholder
tones; the rest of the product is already capable of teaching them.

### 2.1 Recorded narration *(2–3 weeks)*

| Item | Detail |
|---|---|
| Script | Every logical media id, the exact line, and an emphasis note. Derive it from `scripts/generate-media.mjs` and `packages/shared/src/curriculum.ts`. |
| Recording | One consistent voice, recorded in mono at 48 kHz. A warm, slow, clear delivery for ages 3+. |
| Post-production | Normalise to −16 LUFS, trim silence, high-pass at 80 Hz to remove rumble. |
| Encoding | Opus at 48 kbps **and** an MP3 fallback. The API negotiates automatically. |
| Integration | Drop-in via the logical-path media system — no code change. Update `durationSec` on each `MediaRef`. |
| Prompts | Every activity's *instruction* gets its own audio file, not just the stimulus. This is what makes the app usable by a child who cannot read. |

### 2.2 Illustrated art set *(2–3 weeks, parallel)*

| Item | Detail |
|---|---|
| Style guide | Flat shapes, thick strokes, 3–5 colours per illustration, no text in the artwork, distinct silhouettes. |
| Tooling | Inkscape (GPL-2.0) or Synfig (GPL-3.0). Both are FOSS; the output carries no GPL obligation. |
| Output | SVG at 200×200, plus a WebP raster fallback for older devices. |
| Coverage | Every existing illustration redrawn, plus new ones for the Phase 2 curriculum additions. |
| Mascot | One character with a neutral, happy, thinking and encouraging expression set. |

### 2.3 Product polish *(2 weeks)*

| Item | Detail |
|---|---|
| Enforce daily limit and bedtime lock | Server-enforced, with a calm, non-punitive pause screen. A limit never removes stars. |
| Multiple child profiles | A caregiver-side profile switcher, per-child avatars and per-child settings. The schema already supports it. |
| Accessibility audit | Full WCAG 2.2 AA: manual screen-reader testing, expert review, keyboard-only passes, contrast verification. |
| Reduced-motion polish | `prefers-reduced-motion` currently collapses animation to a fade; refine per-screen. |
| Offline mode hardening | Test on a real tablet with Wi-Fi physically disabled. Verify the queue drains correctly after a week of intermittent connectivity. |
| Localisation | Extract all strings. Ship English + Spanish caregiver UI; child-facing content stays in the child's language. |

### 2.4 Verification gate for Phase 2

- [ ] Every activity has an instruction audio file
- [ ] No placeholder chime remains in the shipped media tree
- [ ] WCAG 2.2 AA audit passed with no critical findings
- [ ] Daily limit and bedtime lock enforced and verified
- [ ] Two child profiles can be used on one tablet without cross-contamination
- [ ] `npm run verify` green, collection run green, smoke test green

---

## Phase 3 — Pedagogy and assessment *(6–8 weeks)*

### 3.1 Pronunciation scoring *(3 weeks)*

| Item | Detail |
|---|---|
| Engine | `whisper.cpp` (MIT) on the operator's own hardware. A small `whisper` model, base or tiny, is enough for a 3–5 second utterance. |
| Privacy | The child's audio is transcribed **locally** and immediately discarded. Nothing is written to disk, nothing is uploaded. |
| Scoring, stage 1 | Phonetic similarity: the transcript against the target phrase, using a normalised edit distance over phoneme sequences (eSpeak NG, GPL-3.0, is the usual source of phonemes). |
| Scoring, stage 2 | A small acoustic model or an acoustic-feature heuristic (duration, energy contour, spectral tilt) to catch "right word, wrong stress". |
| UX | Feedback stays gentle and immediate: a two-star signal for "close enough", three for "spot on". Never a red cross. |
| Fallback | If the engine is not installed, the app degrades to the current self-rating behaviour. |

### 3.2 Adaptive curriculum *(2 weeks)*

| Item | Detail |
|---|---|
| Item selection | Server-side selection using the mastery model: prefer the skill with the lowest mastery that is adjacent to the child's current position. |
| Bounded range | The child is never challenged more than one difficulty step beyond their current level, and never *below* the last unlocked lesson. |
| Transparency | The caregiver can see why a lesson was offered and can pin any lesson manually. |

### 3.3 Spaced repetition *(1 week)*

| Item | Detail |
|---|---|
| Decay model | Mastery decays toward zero with a half-life per skill, so unused skills come back for review. |
| Review lessons | A generated "review" lesson that mixes the three weakest skills. |
| Non-punitive | Reviews are offered, never demanded; they never reduce earned stars. |

### 3.4 Educator tooling *(2–3 weeks)*

| Item | Detail |
|---|---|
| Teacher dashboard | A classroom view built from the same aggregate report API: per-child mastery, per-skill heat map, recent activity. |
| Curriculum authoring tool | A local editor that writes to the same typed curriculum schema, so a teacher can add units without touching code. |
| Printable worksheets | Generated from the curriculum for offline practice — an SVG/print stylesheet, no PDF library needed. |
| Class export | A PIN-gated bulk export of a class's aggregate reports as CSV or JSON. |

---

## Phase 4 — Distribution and scale *(8–12 weeks)*

| Item | Detail |
|---|---|
| PostgreSQL option | A mechanical switch for multi-user school deployments. The schema already avoids SQLite-specific features. |
| Signed offline packs | Export/import a lesson pack with a detached signature so a tablet can move between devices without losing progress. |
| Native wrappers | Capacitor (MIT) for a store-distributable Android build. Optional; the PWA is the primary target. |
| App-store compliance | Google Play Families Policy and Apple Kids Category: no ads, no tracking, no third-party SDKs, a privacy policy that matches `docs/PRIVACY.md` exactly. |
| F-Droid / Software Heritage | Submit so the source is permanently archived. |
| Container images on a registry | Publish `sparkle/api` and `sparkle/web` so a school can deploy without building. |
| Upgrade migrations | Versioned, transactional migrations with automatic backup before each one. |

---

## Phase 5 — Ecosystem *(ongoing)*

| Item | Detail |
|---|---|
| Translation platform | Weblate (AGPL) or Pontoon (Apache-2.0) for community translations. |
| Asset contribution | Document the pipeline so illustrators can contribute art under CC-BY-SA with clear attribution rules. |
| Plugin API | Let a school add its own activity types without forking the repository. |
| Import/export of progress | A signed, versioned format so a child can move between devices or operators. |
| Theme packs | Colour and mascot packs that a caregiver can install, with no tracking in the pack format. |
| Hardware support | Raspberry Pi and low-end Android tablet performance profiles, plus a documented "minimum viable device" list. |

---

## Cross-cutting work

These run continuously, not in one phase.

| Item | Detail |
|---|---|
| Continuous integration | Woodpecker CI or GitLab CE, both FOSS: `typecheck → test → build → collection run → smoke`. |
| Licence audit in CI | Re-run the licence scan on every build and fail the build if a copyleft or proprietary dependency appears. |
| Dependency updates | `npm outdated` on a schedule, with the collection run as the acceptance gate. |
| Accessibility regression | An automated axe-core pass on every screen, plus a manual checklist per release. |
| Privacy regression | Assert in CI that no source file references a third-party origin, and that the CSP still contains `default-src 'self'`. |
| Documentation | Every pull request updates `docs/ARCHITECTURE.md` if it changes the stack, the contract or the roadmap. |

---

## Explicitly out of scope

Naming these prevents scope creep and keeps the privacy promise honest.

| Not doing | Why |
|---|---|
| Cloud hosting | The brief requires self-hosting; a hosted service would need accounts, billing and a data-processing agreement. |
| Any third-party analytics or crash reporting | It would defeat the entire privacy model. |
| Advertising or "premium" upsells | Excluded by the brief and by COPPA. |
| Social features, leaderboards, sharing between children | Excluded by the brief. |
| Cloud speech recognition | A child's voice must not leave the device. `whisper.cpp` runs locally. |
| Proprietary animation tooling | The Rive editor is proprietary; the runtime is MIT and the FOSS authoring path is Synfig. |
| Monetisation of any kind | The product is zero-cost by requirement, not by accident. |

---

## How to read this document

- The **roadmap is a plan, not a promise.** Phases 2 and beyond are estimates.
- The **verification gate** at the end of each phase is the definition of
  "done". A phase is not complete because the code exists; it is complete
  because the gate passes.
- The **authoritative API contract** is `postman/specs/sparkle-english.yaml`.
  If the roadmap and the spec disagree, the spec is right and the roadmap is
  a bug.
- See `docs/ARCHITECTURE.md` §4 for the architecture-level view of the same
  plan.
