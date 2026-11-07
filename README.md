# Sparkle English

A **zero-cost, privacy-first, 100 % free-and-open-source** web application that
teaches English to children aged 3 and above.

- **Audio-first.** Every instruction is spoken. A child who cannot read yet is
  never blocked.
- **Icon-driven.** Large touch targets, vector illustrations, no walls of text.
- **No accounts.** A random device token and a 4-digit caregiver PIN. No email,
  no OAuth, no password reset.
- **No third parties.** No analytics, no crash reporter, no CDN, no cloud TTS,
  no advertising SDK. A strict `Content-Security-Policy` allows only `'self'`,
  so the app is structurally incapable of phoning home.
- **Self-hosted.** One SQLite file holds everything about the child. Copy it,
  back it up, or delete it.
- **Permissive licences only.** MIT / Apache-2.0 / ISC throughout. No paid
  tiers, no telemetry, no feature gates.

---

## Quick start

### Requirements

| Requirement | Version | Notes |
|---|---|---|
| Node.js | ≥ 20.19 (24 LTS recommended) | `node --version` |
| npm | ≥ 10 | ships with Node |
| Docker + Compose | v2 | only for the self-hosted deployment |

No database server, no message broker, no cloud account.

### 1. Install

```bash
npm install
```

### 2. Generate the media library

The lesson audio and illustrations are **generated from code** — no third-party
binaries, stock images or fonts are downloaded. This step is idempotent.

```bash
npm run assets
```

Produces 54 audio files and 63 SVG illustrations in
`apps/web/public/media/`, plus the PWA icons.

### 3. Run the API and the web app

Two terminals:

```bash
npm run dev:api     # http://localhost:8080  (Swagger UI at /docs)
npm run dev:web     # http://localhost:5173
```

The API creates and migrates its SQLite database on first boot
(`apps/api/data/sparkle.db`). To also create a demo profile with a known
device token and PIN:

```bash
npm run db:seed
```

The seed prints the demo credentials to stdout and refuses to run twice.

### 4. Verify the install

```bash
npm run typecheck    # strict TypeScript across all workspaces
npm test             # 66 unit + integration tests
npm run smoke        # 41-check end-to-end run against a live API
```

`npm run smoke` needs a running API (`npm run dev:api` in another terminal).

---

## Common commands

| Command | What it does |
|---|---|
| `npm install` | Install every workspace dependency |
| `npm run assets` | Regenerate audio, illustrations and PWA icons |
| `npm run dev:api` | Start the Fastify API with hot reload |
| `npm run dev:web` | Start the Vite dev server for the PWA |
| `npm run build` | Build shared → API → web for production |
| `npm run typecheck` | `tsc --noEmit` in every workspace |
| `npm test` | Vitest across shared, API and web |
| `npm run smoke` | End-to-end smoke test against `http://localhost:8080` |
| `npm run db:migrate` | Apply the idempotent schema migrations |
| `npm run db:seed` | Seed a demo child profile (PIN `1234`) |
| `npm run postman:build` | Regenerate the Postman collection from the OpenAPI spec |
| `npm run postman:run` | Run the Postman collection against a live API |
| `npm run verify` | `typecheck` + `test` + `postman:build` |

> **Stale-`dist` trap:** the API consumes `packages/shared/dist`. After editing
> anything in `packages/shared/src`, run
> `npm run build --workspace @sparkle/shared` before type-checking or testing
> the API.

---

## How it works

```
  ┌──────────────┐        same-origin only        ┌──────────────────┐
  │  PWA client  │ ──────────────────────────────▶ │  Fastify API     │
  │ React + Dexie│ ◀────────────────────────────── │  + SQLite        │
  └──────┬───────┘                                 └──────────────────┘
         │ localStorage: device token                          │
         │ IndexedDB: offline event queue                      ▼
         │                                            ┌──────────────────┐
         └── media (audio + SVG) ◀──────────────────── │ /media/* (files) │
                                                      └──────────────────┘
```

### Authentication

| Secret | Header | Stored as |
|---|---|---|
| Device token (256-bit random) | `X-Device-Token` | salted `scrypt` hash |
| Caregiver PIN (4 digits) | `X-Caregiver-Pin` | salted `scrypt` hash |

The PIN is a **household gate**, not a security boundary: it stops a
three-year-old from changing settings. It is documented as such rather than
oversold.

### API surface

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Liveness + offline capability |
| `POST` | `/api/v1/profiles` | Create a child profile, returns the device token |
| `GET` | `/api/v1/profiles/me` | The profile bound to the presented token |
| `GET` | `/api/v1/profiles` | List local profiles |
| `GET` | `/api/v1/curriculum/levels` | Every level with its units |
| `GET` | `/api/v1/curriculum/lessons` | Every lesson in curriculum order |
| `GET` | `/api/v1/curriculum/lessons/{id}` | One lesson with all activities |
| `GET` | `/api/v1/map` | The child's learning map |
| `POST` | `/api/v1/sessions` | Start a learning session |
| `POST` | `/api/v1/sessions/{id}/events` | Record one activity attempt |
| `POST` | `/api/v1/sessions/{id}/complete` | Finalise a session, apply rewards |
| `GET` | `/api/v1/parent/settings` | Read caregiver settings *(PIN)* |
| `PUT` | `/api/v1/parent/settings` | Update caregiver settings *(PIN)* |
| `PUT` | `/api/v1/parent/pin` | Change the caregiver PIN *(PIN)* |
| `GET` | `/api/v1/parent/report` | Aggregate teacher report *(PIN)* |
| `GET` | `/api/v1/parent/progress` | Full progress snapshot *(PIN)* |
| `GET` | `/api/v1/parent/export` | Export everything as JSON *(PIN)* |
| `DELETE` | `/api/v1/parent/profile` | Erase the child and all data *(PIN)* |
| `GET` | `/media/{kind}/{path}` | Lesson media with content negotiation |

The authoritative contract is the OpenAPI 3.1 document at
`postman/specs/sparkle-english.yaml`. It is also served live at `/docs`.

### Curriculum

6 levels · 14 units · 21 lessons · 68 activities · 7 activity types
(`listen`, `choose`, `match`, `order`, `trace`, `speak`, `story`) · 15 skill
tags. The curriculum is **data, not code**: it lives in
`packages/shared/src/curriculum.ts` and is shared verbatim by the client, the
API and the tests.

---

## Self-hosted deployment

```bash
cd infra
cp .env.example .env      # set SPARKLE_DOMAIN and ACME_EMAIL
docker compose up -d --build
```

Three containers — `edge` (Caddy, TLS + security headers), `api` (Node +
SQLite), `web` (static PWA). Child data lives in the `api_data` named volume
and survives rebuilds.

Full instructions, backup/restore and LAN-vs-public guidance:
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

---

## Repository map

```
.
├── apps/
│   ├── api/                Fastify API, SQLite, auth, media serving
│   └── web/                React PWA, 7 activity renderers, offline queue
├── packages/
│   └── shared/             Types, curriculum, badges, scoring (single source of truth)
├── postman/
│   ├── specs/              OpenAPI 3.1 contract (authoritative)
│   ├── collections/        v3 collection with assertions
│   └── environments/       Local environment
├── infra/                  Docker Compose, Caddy, Dockerfiles
├── scripts/                Media/icon generation, Postman build, e2e smoke test
└── docs/                   Architecture, privacy, licences, deployment, assets, roadmap
```

---

## Documentation

| Document | Contents |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | The full technical architecture: stack, gamification, UX/curriculum, roadmap |
| [`docs/PRIVACY.md`](docs/PRIVACY.md) | COPPA / GDPR-K posture, data inventory, export and erasure |
| [`docs/LICENSES.md`](docs/LICENSES.md) | Per-dependency licence audit |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Docker Compose, TLS, backup and restore |
| [`docs/ASSETS.md`](docs/ASSETS.md) | The generated media library and how to replace it |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | Phased delivery plan |

---

## Verification status

| Check | Result |
|---|---|
| Shared package unit tests | 28 passed |
| API integration tests (real SQLite) | 23 passed |
| Web contract tests | 15 passed |
| End-to-end smoke test vs. live server | 41 checks passed |
| Postman collection run vs. live server | 18 requests, 29 assertions, 0 failed |
| OpenAPI 3.1 lint | No issues found |
| Postman collection lint | 18 requests, 0 errors, 0 warnings |

> The Docker images were not built on the machine that wrote this README
> (Docker was not installed there). The Compose topology was validated by
> resolving every service reference. Build and smoke-test the stack on your
> own host before using it — `docs/DEPLOYMENT.md` lists the checks.

---

## Licence

**MIT** — see [`LICENSE`](LICENSE). Every dependency is permissively licensed
(MIT, Apache-2.0 or ISC); the full audit is in
[`docs/LICENSES.md`](docs/LICENSES.md).
