# Deployment

Sparkle English is designed to run on **one machine you own**. The reference
deployment is three containers behind Caddy, with the child's entire data set
in a single SQLite file inside a named Docker volume.

There are two sensible deployment shapes, and the difference matters:

| Shape | When | TLS | Notes |
|---|---|---|---|
| **A. LAN-only** | The tablet and the server are on the same trusted home network | Not required, but recommended | Simplest and safest. Nothing is reachable from the internet. |
| **B. Public with a domain** | The child is away from home, or you want the app on several devices | Automatic via Caddy + Let's Encrypt | Requires a real domain with DNS pointing at the host, and ports 80/443 open. |

---

## 1. Requirements

| Requirement | Version | Purpose |
|---|---|---|
| Docker Engine | 24+ | Container runtime |
| Docker Compose | v2 (`docker compose`) | Orchestration |
| A host with 512 MiB RAM free | — | The API is small; the PWA is static files |
| A persistent disk | 100 MiB | Database, media, Caddy certificates |
| *(Shape B only)* A domain with an A/AAAA record | — | Certificate issuance |
| *(Shape B only)* Inbound TCP 80 and 443 | — | ACME HTTP-01 challenge and TLS |

Nothing else. No database server, no object store, no certificate broker
account, no paid tier.

> **Verification status.** The Compose topology was checked by parsing
> `infra/docker-compose.yml` and resolving every `depends_on` and every
> `reverse_proxy` upstream in `infra/caddy/Caddyfile` against the declared
> service names — all references resolve. The images themselves were **not**
> built and run on the machine that produced this documentation, because
> Docker was not installed there. Build and smoke-test the stack on your own
> target architecture before you trust it with a child's data; §2.3 and §9
> list the checks to perform.

---

## 2. Shape A — LAN-only deployment

### 2.1 Prepare

```bash
git clone <your-fork> sparke-english
cd sparke-english/infra
cp .env.example .env
```

Edit `.env`:

```dotenv
SPARKLE_DOMAIN=localhost
ACME_EMAIL=admin@example.invalid
SPARKLE_HTTP_PORT=8080
SPARKLE_HTTPS_PORT=8443
```

> With `SPARKLE_DOMAIN=localhost`, Caddy serves its **internal** certificate
> for `localhost`. Browsers will warn on first visit unless you trust it. For
> a LAN deployment it is simpler to run the edge container without TLS at all
> — see §2.4.

### 2.2 Build and start

```bash
docker compose up -d --build
docker compose ps
```

Three containers come up:

| Container | Image | Role | Ports |
|---|---|---|---|
| `sparkle-edge` | `caddy:2.10-alpine` | TLS, security headers, routing | 80 → 443 |
| `sparkle-api` | `sparkle/api:latest` | Fastify API + media | internal only |
| `sparkle-web` | `sparkle/web:latest` | Static PWA | internal only |

### 2.3 Verify

```bash
curl -fsS http://localhost:8080/health
# {"status":"ok","service":"sparkle-english-api","offline":true}

docker compose logs -f edge
```

Open `http://<server-lan-ip>:8080` on the tablet and install the PWA
(*Add to Home Screen* / *Install app*).

### 2.4 LAN without TLS (optional, simplest)

If the traffic never leaves a trusted home network, drop the edge container
and publish the API and web directly:

```bash
docker compose stop edge
docker compose port api 8080
```

Or edit `infra/docker-compose.yml` to publish the ports:

```yaml
  api:
    ports:
      - "8080:8080"
  web:
    ports:
      - "5173:8080"
```

> **Do not do this on a network you do not control.** The device token and the
> caregiver PIN travel in clear text without TLS. See `docs/PRIVACY.md` §5.2.

---

## 3. Shape B — public deployment with automatic TLS

### 3.1 DNS

Create an `A` record for your domain pointing at the host's public IP:

```
learn.example.com.   A   203.0.113.10
```

Wait for it to resolve before starting Caddy, or the first certificate
request will fail.

### 3.2 Configure

```bash
cd infra
cp .env.example .env
```

```dotenv
SPARKLE_DOMAIN=learn.example.com
ACME_EMAIL=you@example.com
SPARKLE_HTTP_PORT=80
SPARKLE_HTTPS_PORT=443
```

`ACME_EMAIL` is the only address Caddy ever uses. It is used for certificate
expiry warnings.

### 3.3 Start

```bash
docker compose up -d --build
docker compose logs -f edge
```

Caddy obtains and renews the certificate automatically — no cron job, no
certificate broker account, no third-party API call beyond the ACME
certificate authority itself (which is required for TLS to exist at all).

Verify:

```bash
curl -fsS https://learn.example.com/health
echo | openssl s_client -connect learn.example.com:443 2>/dev/null | openssl x509 -noout -dates
```

### 3.4 What the edge sets for you

From `infra/caddy/Caddyfile`:

- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `Content-Security-Policy` with `default-src 'self'` and `connect-src 'self'`
- `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`
- `Referrer-Policy: no-referrer`
- `Permissions-Policy: geolocation=(), camera=(), microphone=(self), …`
- `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy: same-origin`
- gzip + zstd compression

The CSP is the privacy guarantee made concrete: the browser refuses any
request to any origin other than the one serving the app.

### 3.5 CORS

The API reflects the request origin by default. For a public deployment,
pin it explicitly in `infra/docker-compose.yml`:

```yaml
      SPARKLE_CORS_ORIGINS: "https://learn.example.com"
```

---

## 4. Operating the deployment

### 4.1 Commands

```bash
docker compose ps                 # status
docker compose logs -f api        # API logs
docker compose logs -f edge       # proxy + access logs
docker compose restart api        # restart just the API
docker compose pull && docker compose up -d   # refresh base images
docker compose down               # stop (data survives)
docker compose down -v            # stop AND delete the data volume
```

> `docker compose down -v` destroys the child's data. It is the "erase
> everything" operation.

### 4.2 Upgrading

```bash
git pull
docker compose build
docker compose up -d
```

The database schema is migrated automatically on boot by idempotent
`CREATE TABLE IF NOT EXISTS` statements. **Take a backup first** (see §5) —
the migrations are additive, but a backup costs nothing.

The web container serves a fresh build with hashed asset filenames; the old
service worker is replaced by the new one on the next load. The app shell and
the service worker are served with `Cache-Control: no-cache` so a stale worker
cannot pin a child to an old version.

### 4.3 Health checks

The API image declares a `HEALTHCHECK` that polls `/health` every 30 s.
`docker compose ps` shows `(healthy)` once it passes.

```bash
docker inspect --format '{{.State.Health.Status}}' sparkle-api
```

---

## 5. Backup and restore

Everything about a child lives in **one file**: `sparkle.db` inside the
`api_data` volume. A backup is a file copy.

### 5.1 Back up

**Preferred — SQLite's online backup API** (safe while the server is running):

```bash
cd infra

docker compose exec -T api node -e "
  const Database = require('better-sqlite3');
  const db = new Database('/data/sparkle.db');
  db.backup('/data/sparkle-backup.db')
    .then(() => { db.close(); console.log('backup written'); })
    .catch((err) => { console.error(err); process.exit(1); });
"

docker compose cp api:/data/sparkle-backup.db "./backups/sparkle-$(date +%F).db"
```

The online backup API takes a consistent snapshot while the API is serving
requests, so there is no need to stop the server.

**Simpler — stop the API and copy the file:**

```bash
cd infra
docker compose stop api
docker compose cp api:/data/sparkle.db "./backups/sparkle-$(date +%F).db"
docker compose start api
```

> Copying `sparkle.db` while the server is running can capture a torn WAL
> state. Either stop the API first, or use the online backup API above.

### 5.2 Restore

```bash
cd infra
docker compose stop api

# Remove the live database and its write-ahead log.
docker compose exec -T api sh -c 'rm -f /data/sparkle.db /data/sparkle.db-wal /data/sparkle.db-shm'

# Copy the backup in and give it back to the `node` user (uid/gid 1000).
docker compose cp "./backups/sparkle-2026-11-07.db" api:/data/sparkle.db
docker compose exec -T api chown 1000:1000 /data/sparkle.db

docker compose start api
docker compose ps          # api should report (healthy)
curl -fsS https://learn.example.com/health
```

The API container runs as the unprivileged `node` user (uid/gid `1000`), hence
the `chown`. The schema is re-created on boot by the idempotent migrations, so
a restore into a fresh volume works too.

### 5.3 A realistic backup schedule

```cron
# 02:17 every night - an odd minute so it does not collide with every other
# cron job on the planet
17 2 * * * cd /opt/sparkle-english/infra && \
  mkdir -p backups && \
  docker compose exec -T api node -e "
    const Database = require('better-sqlite3');
    const db = new Database('/data/sparkle.db');
    db.backup('/data/sparkle-backup.db').then(() => db.close());
  " && \
  docker compose cp api:/data/sparkle-backup.db ./backups/sparkle-$(date +\%F).db && \
  find ./backups -name 'sparkle-*.db' -mtime +30 -delete
```

**A backup you have never restored is not a backup.** Rehearse the restore at
least once, into a throwaway container, before you rely on it.

---

## 6. Running without Docker

Docker is a convenience, not a requirement.

### 6.1 Requirements

Node.js ≥ 20.19 and a writable directory.

### 6.2 Run it

```bash
npm ci
npm run assets
npm run build

# API
SPARKLE_DB_PATH=/var/lib/sparkle/sparkle.db \
SPARKLE_MEDIA_ROOT="$PWD/apps/web/public/media" \
node apps/api/dist/server.js

# Web (any static server; Caddy, nginx or `vite preview`)
npx vite preview --root apps/web --port 5173
```

### 6.3 Put a reverse proxy in front

Point your existing reverse proxy at the two ports and copy the security
headers from `infra/caddy/Caddyfile`. The `Content-Security-Policy` is the
important one:

```
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self';
connect-src 'self'; worker-src 'self'; manifest-src 'self';
frame-ancestors 'none'; base-uri 'self'; form-action 'self'
```

### 6.4 systemd unit

```ini
[Unit]
Description=Sparkle English API
After=network.target

[Service]
Type=simple
User=sparkle
Group=sparkle
WorkingDirectory=/opt/sparkle-english
Environment=NODE_ENV=production
Environment=PORT=8080
Environment=HOST=127.0.0.1
Environment=SPARKLE_DATA_DIR=/var/lib/sparkle
Environment=SPARKLE_DB_PATH=/var/lib/sparkle/sparkle.db
Environment=SPARKLE_MEDIA_ROOT=/opt/sparkle-english/apps/web/public/media
ExecStart=/usr/bin/node apps/api/dist/server.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Bind to `127.0.0.1` and let the reverse proxy be the only public entry point.

---

## 7. Configuration reference

All configuration is environment variables. See `apps/api/src/config.ts`.

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `8080` | API port |
| `HOST` | `0.0.0.0` | API bind address |
| `SPARKLE_DATA_DIR` | `apps/api/data` | Base directory for local state |
| `SPARKLE_DB_PATH` | `<DATA_DIR>/sparkle.db` | SQLite file path |
| `SPARKLE_MEDIA_ROOT` | `apps/web/public/media` | Where lesson media lives |
| `SPARKLE_CORS_ORIGINS` | *(empty — reflect origin)* | Comma-separated allowed origins |
| `SPARKLE_RATE_LIMIT_MAX` | `600` | Requests per minute per client |

Compose-level variables (in `infra/.env`):

| Variable | Default | Purpose |
|---|---|---|
| `SPARKLE_DOMAIN` | `localhost` | Hostname Caddy issues a certificate for |
| `ACME_EMAIL` | — | Certificate expiry notice address |
| `SPARKLE_HTTP_PORT` | `80` | Host port for HTTP |
| `SPARKLE_HTTPS_PORT` | `443` | Host port for HTTPS |

---

## 8. Hardware notes

### 8.1 Raspberry Pi and other small hosts

The reference images are `node:24-alpine` and `caddy:2.10-alpine`, both of
which run comfortably on a Pi 3 or better. `better-sqlite3` compiles a native
addon at image build time; on an ARM host, the build stage needs a compiler:

```dockerfile
# add to the build stage of infra/Dockerfile.api
RUN apk add --no-cache python3 make g++
```

or build on the target architecture with `docker buildx`.

### 8.2 Offline installation

The images pull `node:24-alpine` and `caddy:2.10-alpine` from Docker Hub.
For a fully air-gapped install:

```bash
docker pull node:24-alpine
docker pull caddy:2.10-alpine
docker save node:24-alpine caddy:2.10-alpine -o base-images.tar
# copy to the target host
docker load -i base-images.tar
docker compose build
```

The npm dependencies are fetched at build time. For a fully offline build,
populate `node_modules` on a connected machine and copy it in, or use a local
npm registry mirror.

### 8.3 Storage

| Item | Size |
|---|---|
| Container images | ~350 MiB total |
| SQLite database | < 1 MiB for a year of use |
| Lesson media (in the web image) | ~1.7 MiB |
| Caddy certificates and state | < 10 MiB |

---

## 9. Post-deployment checklist

- [ ] TLS certificate issued and auto-renewal verified
      (`docker compose logs edge | grep -i renew`)
- [ ] `SPARKLE_DOMAIN` and `ACME_EMAIL` set correctly in `infra/.env`
- [ ] `infra/.env` is **not** committed (it is in `.gitignore`)
- [ ] Default caregiver PIN changed from the seeded `1234`
- [ ] Backup scheduled **and a restore rehearsed**
- [ ] `Content-Security-Policy` confirmed in the browser console — no violations
- [ ] Device token survives a reboot (it lives in `localStorage`)
- [ ] Offline mode tested with the network physically disconnected
- [ ] Microphone permission prompt tested and understood by the caregiver
- [ ] Time limit and bedtime lock verified once enforced (Phase 2)
- [ ] The guardian has read `docs/PRIVACY.md`

---

## 10. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `Caddy` will not obtain a certificate | DNS not resolving, or 80/443 blocked | `dig $SPARKLE_DOMAIN`; check the firewall and the router's port forwarding |
| Browser warns about the certificate | Using `localhost` with a public deployment | Set a real `SPARKLE_DOMAIN` |
| `502 Bad Gateway` from the edge | The API container is not healthy | `docker compose ps`; `docker compose logs api` |
| `fetch` fails with a CSP error | A third-party URL crept into the client | Every request must be same-origin; check the browser console |
| PWA will not install | Not served over HTTPS, or the manifest is missing | `curl -I https://$SPARKLE_DOMAIN/manifest.webmanifest` |
| Audio does not play | The browser's autoplay policy blocked it | The first interaction unlocks it; check `audioEnabled` in the caregiver console |
| The tablet cannot reach the server | Firewall or client isolation on the Wi-Fi | Confirm the API answers on the LAN IP, not just `localhost` |
| Progress is not syncing | The server is unreachable | Events are queued in IndexedDB and flush automatically on reconnect |

---

## 11. Upstream links

| Resource | Where |
|---|---|
| Docker Compose file | `infra/docker-compose.yml` |
| Edge proxy config | `infra/caddy/Caddyfile` |
| Static file server config | `infra/caddy/web.Caddyfile` |
| API image | `infra/Dockerfile.api` |
| Web image | `infra/Dockerfile.web` |
| Environment template | `infra/.env.example` |
