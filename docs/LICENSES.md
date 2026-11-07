# Licences and Third-Party Audit

**Sparkle English is MIT licensed.** Every runtime and development dependency
is permissively licensed (MIT, Apache-2.0, ISC or BSD). There is no copyleft
dependency in the shipped product, no proprietary SDK, no commercial licence,
no usage-based billing and no telemetry.

This document is the audit trail. It was produced by reading the `license`
field of every installed `package.json` in the dependency closure, not by
copying a list from a website.

---

## 1. Project licence

| Item | Licence |
|---|---|
| Sparkle English source code | **MIT** — see [`../LICENSE`](../LICENSE) |
| Curriculum data (`packages/shared/src/curriculum.ts`) | MIT (part of the project) |
| Generated audio (`apps/web/public/media/audio/*.wav`) | MIT (synthesised by `scripts/generate-media.mjs`) |
| Generated illustrations (`apps/web/public/media/img/*.svg`) | MIT (drawn by `scripts/generate-media.mjs`) |
| Generated icons (`apps/web/public/icons/*.png`) | MIT (drawn by `scripts/generate-icons.mjs`) |
| OpenAPI spec and Postman collection | MIT (part of the project) |

Because every shipped asset is generated from source code in this repository,
**there are no third-party asset licences to honour**. There is no stock
photography, no icon font, no sample pack, no scraped illustration.

---

## 2. Direct runtime dependencies

Verified against the versions actually installed in this checkout
(`package-lock.json` is committed and pins every version).

### 2.1 API (`apps/api`)

| Package | Version | Licence | Role |
|---|---|---|---|
| `fastify` | 5.12.8 | MIT | HTTP framework |
| `@fastify/cors` | 11.4.1 | MIT | CORS handling |
| `@fastify/cookie` | 11.1.5 | MIT | Cookie parsing |
| `@fastify/rate-limit` | 11.2.2 | MIT | Request rate limiting |
| `@fastify/static` | 10.1.10 | MIT | Static file serving |
| `@fastify/swagger` | 9.9.3 | MIT | OpenAPI 3.1 generation |
| `@fastify/swagger-ui` | 6.1.3 | MIT | Swagger UI at `/docs` |
| `better-sqlite3` | 13.0.3 | MIT | SQLite driver (SQLite itself is public domain) |
| `zod` | 4.6.7 | MIT | Runtime request validation |
| `@sparkle/shared` | 0.1.0 | MIT | First-party workspace package |

### 2.2 Web (`apps/web`)

| Package | Version | Licence | Role |
|---|---|---|---|
| `react` | 19.3.1 | MIT | UI runtime |
| `react-dom` | 19.3.1 | MIT | DOM renderer |
| `zustand` | 5.1.0 | MIT | State store |
| `dexie` | 4.4.7 | Apache-2.0 | IndexedDB wrapper (offline queue) |
| `howler` | 2.2.4 | MIT | Audio playback |
| `lottie-web` | 5.13.0 | MIT | Vector animation playback |
| `@rive-app/canvas` | 2.49.4 | MIT | Rive runtime (state-machine animation) |
| `pixi.js` | 8.22.0 | MIT | WebGL/WebGPU particle renderer (lazy-loaded) |
| `@sparkle/shared` | 0.1.0 | MIT | First-party workspace package |

### 2.3 Development dependencies

| Package | Version | Licence | Role |
|---|---|---|---|
| `typescript` | 5.9.3 | Apache-2.0 | Compiler |
| `vite` | 7.3.7 | MIT | Bundler / dev server |
| `@vitejs/plugin-react` | 5.2.0 | MIT | React fast refresh |
| `vite-plugin-pwa` | 1.3.0 | MIT | Service worker generation |
| `vitest` | 3.2.7 | MIT | Test runner |
| `jsdom` | 27.2.0 | MIT | DOM environment for tests |
| `tsx` | 4.23.15 | MIT | TypeScript execution for dev/seed |
| `yaml` | 2.8.1 | **ISC** | YAML parsing for the Postman build script |
| `@types/node` | 24.19.2 | MIT | Type definitions |
| `@types/react` | 19.3.0 | MIT | Type definitions |
| `@types/react-dom` | 19.3.0 | MIT | Type definitions |
| `@types/howler` | 2.2.13 | MIT | Type definitions |
| `@types/better-sqlite3` | 9.6.0 | MIT | Type definitions |

---

## 3. Full transitive closure

### 3.1 Runtime closure — 104 installed packages

| Licence | Packages |
|---|---|
| MIT | 84 |
| ISC | 7 |
| BlueOak-1.0.0 | 6 |
| BSD-3-Clause | 6 |
| Apache-2.0 | 1 |
| **Copyleft (GPL/LGPL/AGPL)** | **0** |

`BlueOak-1.0.0` is a permissive OSI-approved licence (it is a permissive
licence with a patent grant). It appears via `glob`, `minimatch`, `lru-cache`,
`minipass` and `path-scurry` in the `pino` logging tree.

### 3.2 Development closure — 427 additional packages

| Licence | Packages |
|---|---|
| MIT | 377 |
| ISC | 17 |
| Apache-2.0 | 8 |
| BlueOak-1.0.0 | 8 |
| BSD-3-Clause | 6 |
| BSD-2-Clause | 6 |
| MIT-0 | 2 |
| CC-BY-4.0 | 1 (`caniuse-lite` — browser support data, attribution only) |
| CC0-1.0 | 1 (`caniuse-lite` feature data) |
| MIT OR CC0-1.0 | 1 |
| **Copyleft (GPL/LGPL/AGPL)** | **0** |

> `caniuse-lite` is CC-BY-4.0 for its data file (attribution required, no
> share-alike, no copyleft). It is a build-time browser-support database; it
> is not redistributed in the shipped images.

---

## 4. Runtime closure, package by package

Every package installed in production, with its declared licence.

| Package | Version | Licence |
|---|---|---|
| `@fastify/accept-negotiator` | 2.1.2 | MIT |
| `@fastify/ajv-compiler` | 4.0.7 | MIT |
| `@fastify/cookie` | 11.1.5 | MIT |
| `@fastify/cors` | 11.4.1 | MIT |
| `@fastify/deepmerge` | 3.2.4 | MIT |
| `@fastify/error` | 4.2.1 | MIT |
| `@fastify/fast-json-stringify-compiler` | 5.1.1 | MIT |
| `@fastify/forwarded` | 3.1.2 | MIT |
| `@fastify/merge-json-schemas` | 0.2.2 | MIT |
| `@fastify/proxy-addr` | 5.1.2 | MIT |
| `@fastify/rate-limit` | 11.2.2 | MIT |
| `@fastify/send` | 4.2.1 | MIT |
| `@fastify/static` | 10.1.10 | MIT |
| `@fastify/swagger` | 9.9.3 | MIT |
| `@fastify/swagger-ui` | 6.1.3 | MIT |
| `@isaacs/nonrecursive-glob-match` | 1.1.0 | BlueOak-1.0.0 |
| `@lukeed/ms` | 2.0.2 | MIT |
| `@pinojs/redact` | 0.4.0 | MIT |
| `@pixi/colord` | 2.9.6 | MIT |
| `@rive-app/canvas` | 2.49.4 | MIT |
| `@types/earcut` | 3.0.0 | MIT |
| `@webgpu/types` | 0.1.74 | BSD-3-Clause |
| `@xmldom/xmldom` | 0.8.15 | MIT |
| `abstract-logging` | 2.0.1 | MIT |
| `ajv` | 8.20.0 | MIT |
| `ajv-formats` | 3.0.1 | MIT |
| `atomic-sleep` | 1.0.0 | MIT |
| `avvio` | 9.3.1 | MIT |
| `balanced-match` | 4.0.4 | MIT |
| `better-sqlite3` | 13.0.3 | MIT |
| `brace-expansion` | 5.0.12 | MIT |
| `content-disposition` | 3.0.0 | MIT |
| `cookie` | 2.0.2 | MIT |
| `debug` | 4.4.3 | MIT |
| `depd` | 2.0.0 | MIT |
| `dequal` | 2.0.3 | MIT |
| `dexie` | 4.4.7 | Apache-2.0 |
| `earcut` | 3.2.4 | ISC |
| `escape-html` | 1.0.3 | MIT |
| `eventemitter3` | 5.0.4 | MIT |
| `fast-decode-uri-component` | 1.0.1 | MIT |
| `fast-deep-equal` | 3.1.3 | MIT |
| `fast-json-stringify` | 7.3.1 | MIT |
| `fast-querystring` | 1.1.2 | MIT |
| `fast-uri` | 3.1.9 | BSD-3-Clause |
| `fast-uri` | 4.2.3 | BSD-3-Clause |
| `fastify` | 5.12.8 | MIT |
| `fastify-plugin` | 6.0.1 | MIT |
| `fastq` | 1.20.3 | ISC |
| `find-my-way` | 9.10.0 | MIT |
| `gifuct-js` | 2.1.2 | MIT |
| `glob` | 14.0.4 | BlueOak-1.0.0 |
| `howler` | 2.2.4 | MIT |
| `http-errors` | 2.0.1 | MIT |
| `inherits` | 2.0.4 | ISC |
| `ip-address` | 10.7.6 | MIT |
| `ipaddr.js` | 2.5.0 | MIT |
| `ismobilejs` | 1.1.1 | MIT |
| `js-binary-schema-parser` | 2.0.3 | MIT |
| `json-schema-ref-resolver` | 3.0.1 | MIT |
| `json-schema-resolver` | 3.0.0 | MIT |
| `json-schema-traverse` | 1.0.0 | MIT |
| `light-my-request` | 6.8.0 | BSD-3-Clause |
| `lottie-web` | 5.13.0 | MIT |
| `lru-cache` | 11.5.3 | BlueOak-1.0.0 |
| `mime` | 3.0.0 | MIT |
| `minimatch` | 11.0.5 | BlueOak-1.0.0 |
| `minipass` | 7.1.3 | BlueOak-1.0.0 |
| `ms` | 2.1.3 | MIT |
| `node-addon-api` | 8.9.2 | MIT |
| `on-exit-leak-free` | 2.1.2 | MIT |
| `openapi-types` | 12.1.3 | MIT |
| `parse-svg-path` | 0.2.0 | MIT |
| `path-scurry` | 3.0.0 | BlueOak-1.0.0 |
| `pino` | 10.4.0 | MIT |
| `pino-abstract-transport` | 3.0.0 | MIT |
| `pino-std-serializers` | 7.1.0 | MIT |
| `pixi.js` | 8.22.0 | MIT |
| `process-warning` | 5.1.1 | MIT |
| `quick-format-unescaped` | 4.0.4 | MIT |
| `react` | 19.3.1 | MIT |
| `react-dom` | 19.3.1 | MIT |
| `real-require` | 1.0.0 | MIT |
| `require-from-string` | 2.0.2 | MIT |
| `ret` | 0.5.1 | MIT |
| `reusify` | 1.1.0 | MIT |
| `rfdc` | 1.4.1 | MIT |
| `safe-regex2` | 5.1.2 | MIT |
| `safe-stable-stringify` | 2.5.0 | MIT |
| `scheduler` | 0.28.0 | MIT |
| `secure-json-parse` | 4.1.1 | BSD-3-Clause |
| `semver` | 7.8.6 | ISC |
| `set-cookie-parser` | 3.2.2 | MIT |
| `setprototypeof` | 1.2.0 | ISC |
| `sonic-boom` | 4.2.1 | MIT |
| `split2` | 4.2.0 | ISC |
| `statuses` | 2.0.2 | MIT |
| `thread-stream` | 4.2.1 | MIT |
| `tiny-lru` | 11.4.7 | BSD-3-Clause |
| `toad-cache` | 3.7.4 | MIT |
| `toidentifier` | 1.0.1 | MIT |
| `yaml` | 2.8.1 | ISC |
| `zod` | 4.6.7 | MIT |
| `zustand` | 5.1.0 | MIT |

### 4.1 Optional peer dependencies that are **not** installed

`zustand` declares `immer` and `use-sync-external-store` as **optional** peer
dependencies. Neither is installed, and the project uses neither. If they
were added later: `immer` is MIT, `use-sync-external-store` is MIT.

---

## 5. Infrastructure and tooling licences

These are not npm dependencies, but they are part of the deployment and the
authoring pipeline.

| Tool | Licence | Role | Notes |
|---|---|---|---|
| **Docker Compose** | Apache-2.0 | Orchestration | |
| **Caddy 2** | Apache-2.0 | Edge proxy, TLS | |
| **Node.js 24** | MIT (+ bundled deps) | Runtime | |
| **SQLite 3** | Public domain | Database | Public domain is more permissive than MIT. |
| **better-sqlite3** | MIT | SQLite bindings | Native addon, compiled at image build time. |
| **Inkscape** | GPL-2.0 | Vector authoring | Authoring tool only; output (SVG) is royalty-free and carries no GPL obligation. |
| **Synfig Studio** | GPL-3.0 | Vector animation authoring | Authoring tool only; exported Lottie JSON is not a derived work of the tool. |
| **ImageMagick** | ImageMagick License | Raster conversion | MIT-like, permissive. |
| **SVGO** | MIT | SVG optimisation | |
| **FFmpeg** | LGPL-2.1 / GPL-2.0 (per build) | Audio encoding | Use an LGPL build to keep the obligation simple. |
| **Piper** | MIT | Offline neural TTS (optional) | Fully local; no cloud speech API. |
| **whisper.cpp** | MIT | Local pronunciation scoring (planned) | Fully local. |
| **Postman CLI** | Apache-2.0 | Spec → collection generation | Development-time only; not in the shipped images. |

> **GPL authoring tools do not infect the output.** Inkscape and Synfig are
> used as *tools*; the SVG and Lottie files they produce are outputs, not
> derivative works of the tool. The shipped assets are, in any case, generated
> from code in this repository and carry no third-party rights at all.

---

## 6. Deliberately excluded technologies

| Technology | Licence | Why excluded |
|---|---|---|
| **GSAP** | Standard "no charge" licence | Not an OSI-approved FOSS licence. CSS, PixiJS and Lottie cover the same needs. |
| **Firebase / Supabase** | Proprietary | Vendor lock-in, hosted backend, telemetry. |
| **Sentry / Datadog / Bugsnag** | Mixed, proprietary tiers | Error reporting leaves the device. |
| **Google Fonts / any CDN** | Proprietary or tracking | Fetches from a third party; violates the CSP and the privacy model. |
| **Cloud TTS / STT (Google, Azure, AWS, OpenAI)** | Proprietary | Sends a child's voice or prompt text to a third party, and costs money per request. |
| **Analytics (Google Analytics, Mixpanel, Amplitude, Plausible Cloud)** | Proprietary service | Collects behaviour about children. |
| **Ad SDKs (AdMob, Unity Ads, …)** | Proprietary | Advertising is excluded by the brief and by COPPA. |
| **Firebase Crashlytics** | Proprietary | Uploads crash data. |
| **Rive *editor*** | Proprietary | The Rive **runtime** is MIT and is included; the editor is not required and not shipped. |
| **Figma** (asset authoring) | Proprietary | Use Inkscape or Synfig instead. |
| **Pexels / Unsplash / Shutterstock** | Restrictive | Stock assets carry their own licences and attribution obligations. |

---

## 7. How to reproduce this audit

```bash
npm install

# Every installed package with its declared licence
node -e "
const fs=require('fs'),path=require('path');
const out={};
function scan(dir){
  for(const e of fs.readdirSync(dir)){
    if(e.startsWith('.')) continue;
    const full=path.join(dir,e);
    if(!fs.statSync(full).isDirectory()) continue;
    if(e.startsWith('@')){ scan(full); continue; }
    try{
      const pj=JSON.parse(fs.readFileSync(path.join(full,'package.json'),'utf8'));
      out[pj.name]=pj.license||'(see LICENSE file)';
    }catch{}
    const nm=path.join(full,'node_modules');
    if(fs.existsSync(nm)) scan(nm);
  }
}
scan('node_modules');
const counts={};
for(const l of Object.values(out)) counts[l]=(counts[l]||0)+1;
console.log(counts);
"
```

Because `package-lock.json` is committed and CI runs `npm ci`, the tree is
reproducible and the audit above matches what actually ships.

---

## 8. Compliance checklist

- [x] Every direct dependency is MIT, Apache-2.0 or ISC.
- [x] The complete runtime closure contains **zero** copyleft licences.
- [x] The complete development closure contains **zero** copyleft licences.
- [x] No proprietary SaaS, SDK or API is contacted at runtime.
- [x] No third-party fonts, images, audio or icons are redistributed.
- [x] The project itself is MIT.
- [x] `package-lock.json` is committed for reproducibility.
- [x] No dependency is loaded from a CDN at runtime — the CSP forbids it.
