# FacilityOS deployment — dual SKU platform (Phase 1+)

FacilityOS ships as **one codebase** with two commercial deployment modes:

| SKU | Env | Database | Typical host |
|-----|-----|----------|--------------|
| **Self-Host** | `FACILITYOS_DEPLOYMENT=selfhost` | SQLite | Windows installer, Docker |
| **Hosted (Online)** | `FACILITYOS_DEPLOYMENT=hosted` | PostgreSQL | Azure App Service, AWS, Fly.io |

Remote access and on-site use the **same URL** for that installation — no sync relay required.

---

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `FACILITYOS_DEPLOYMENT` | `selfhost` | `selfhost` or `hosted` |
| `FACILITYOS_DB_DRIVER` | auto | `sqlite` (self-host) or `postgres` (hosted) |
| `FACILITYOS_DB_PATH` | `%ProgramData%\FacilityOS\data\facilityos.db` | SQLite file path |
| `FACILITYOS_DATABASE_URL` | — | PostgreSQL connection string (hosted) |
| `FACILITYOS_DATA_DIR` | `%ProgramData%\FacilityOS\data` | SQLite data directory |
| `FACILITYOS_PORT` | `3847` | HTTP API + web UI port |
| `FACILITYOS_HOST` | `0.0.0.0` | Bind address |
| `FACILITYOS_PUBLIC_URL` | — | Public HTTPS URL shown to customers |
| `FACILITYOS_STORAGE` | `local` / `blob` | Upload storage backend |
| `FACILITYOS_AUTH_MODE` | `legacy` / `session` | API auth: legacy (self-host default) or session JWT (hosted default) |
| `FACILITYOS_SESSION_SECRET` | — | HMAC secret for staff session tokens (required in production hosted) |
| `FACILITYOS_SESSION_TTL_HOURS` | `12` | Staff session lifetime |
| `AZURE_STORAGE_CONNECTION_STRING` | — | Azure Blob connection (hosted blob storage) |
| `AZURE_STORAGE_CONTAINER` | `uploads` | Blob container name |
| `FACILITYOS_PG_SSL` | `0` | Set `1` for managed Postgres SSL |

---

## Self-Host (default — unchanged for existing customers)

```powershell
# Development
npm run dev:server

# Production (after npm run build)
node server/index.js
```

Electron **FacilityOS Server Setup.exe** sets `FACILITYOS_DEPLOYMENT=selfhost` implicitly (default).

Health check:

```http
GET /api/health
```

Response includes:

```json
"deployment": {
  "mode": "selfhost",
  "dbDriver": "sqlite",
  "storage": "local",
  "publicUrl": null
}
```

---

## Hosted (PostgreSQL)

```powershell
$env:FACILITYOS_DEPLOYMENT="hosted"
$env:FACILITYOS_DATABASE_URL="postgresql://user:pass@host:5432/facilityos"
$env:FACILITYOS_PUBLIC_URL="https://eac.facilityos.app"
npm run build
node server/index.js
```

On first start, the server applies `shared/db/schema.postgres.sql` automatically.

**Note:** SQLite-style backup/restore in Settings is disabled on hosted Postgres — use platform backups (Azure automated backup, RDS snapshots, etc.).

---

## Architecture (Phase 1)

```
React UI (dist/)
       ↓ HTTP
Express server (server/index.js)
       ↓
Channel API (shared/db/handlers*.js)
       ↓
Database adapter (shared/db/adapters/)
   ├── sqlite.js  → better-sqlite3
   └── postgres.js → pg
```

SQL dialect differences (`datetime('now')`, `INSERT OR REPLACE`, etc.) are normalised in `shared/db/adapters/sql.js`.

---

## Tests

```powershell
npm run test:db                  # SQLite (always)
npm run test:db:postgres         # PostgreSQL (requires FACILITYOS_DATABASE_URL)
npm run test:phase3              # Storage + session auth + legacy self-host smoke
```
```

---

## Roadmap

| Phase | Deliverable | Status |
|-------|-------------|--------|
| **1** | DB adapters, Postgres schema, deployment flags, async channel API | Done |
| **2** | Docker + docker-compose self-host; Azure Terraform tenant stack | Done |
| **3** | Blob storage adapter; unified session auth | Planned |
| **4** | PWA offline queue; reseller portal provisioning | Planned |
| **5** | Deprecate legacy hybrid cloud relay from customer UI | Planned |

---

## Docker (Phase 2 — self-host)

Build and run with **SQLite in a persistent volume**:

```powershell
npm run docker:build
npm run docker:selfhost
```

Open **http://localhost:3847** — same app as the Windows installer, without Electron.

Stop:

```powershell
npm run docker:down
```

Data persists in Docker volume `facilityos-data`. Licence file can be mounted:

```yaml
volumes:
  - ./licence/facilityos.lic:/var/lib/facilityos/licence/facilityos.lic:ro
```

### Local hosted stack (PostgreSQL)

Test the **hosted SKU** locally:

```powershell
npm run docker:hosted
```

This starts Postgres 16 + FacilityOS with `FACILITYOS_DEPLOYMENT=hosted`.

---

## Azure hosted tenant (Phase 2)

One command per customer site (requires `az login` + Terraform):

```powershell
.\deploy\scripts\provision-azure-tenant.ps1 `
  -SiteSlug eac `
  -Environment prod `
  -DockerImage ghcr.io/rwood-code/facilityos:latest
```

Or on Linux/macOS:

```bash
chmod +x deploy/scripts/provision-azure-tenant.sh
./deploy/scripts/provision-azure-tenant.sh eac prod ghcr.io/rwood-code/facilityos:latest
```

### What Terraform creates (per tenant)

| Resource | Purpose |
|----------|---------|
| Resource group | Isolation per site |
| PostgreSQL Flexible Server 16 | Hosted database |
| Storage account + uploads container | File uploads (Phase 3 wiring) |
| Linux App Service (B1) | Runs FacilityOS container |
| App settings | `FACILITYOS_DEPLOYMENT=hosted`, DB URL, public URL |

Copy and edit `deploy/terraform/azure/tenant/terraform.tfvars.example` for repeatable deploys.

### CI/CD

| Workflow | Trigger | Output |
|----------|---------|--------|
| `build-container.yml` | Push to `main` / tags | Image → GHCR |
| `deploy-azure-staging.yml` | Manual | Provisions staging tenant |

GitHub secrets required for Azure deploy: `AZURE_CREDENTIALS` (service principal JSON).

See `deploy/terraform/azure/tenant/README.md` for DNS, SMTP, and custom domain steps.

---

## Phase 3 — Storage + session auth

Phase 3 adds **pluggable upload storage** and **staff session login** for hosted deployments. The existing self-host / Electron path is unchanged unless you opt in via environment variables.

### Storage backends

| Backend | When | Path |
|---------|------|------|
| `local` | Self-host default | `%ProgramData%\FacilityOS\uploads` (or Docker volume) |
| `blob` | Hosted default | Azure Blob (`AZURE_STORAGE_CONNECTION_STRING`) |

Upload API is unchanged: `POST /api/upload` → `GET /api/uploads/:folder/:file`.

If blob credentials are missing, the server **falls back to local** storage and logs a warning.

### Auth modes

| Mode | Default for | Behaviour |
|------|-------------|-----------|
| `legacy` | Self-host | LAN open; remote requires `remote_access_token` (unchanged) |
| `session` | Hosted | Remote requires staff JWT from `POST /api/auth/pin` |

**Self-host integrity:** No new env vars required. Electron IPC, LAN browser access, remote bearer token, and SQLite backups all work as before.

**Hosted flow:**

1. Open `https://your-tenant.facilityos.app`
2. Staff enters PIN → `POST /api/auth/pin` → session JWT stored in browser
3. All `/api/*` calls send `Authorization: Bearer <session>`
4. Uploads stored in Azure Blob when `FACILITYOS_STORAGE=blob`

### Quick test paths

```powershell
# Existing live path (unchanged)
npm run dev:server
npm run test:db
npm run test:phase3

# Self-host Docker (SQLite, legacy auth)
npm run docker:selfhost

# Hosted stack locally (Postgres + session auth, local uploads)
npm run docker:hosted
# Then open http://localhost:3847 — sign in with staff PIN

# Simulate hosted auth on dev server
$env:FACILITYOS_DEPLOYMENT="hosted"
$env:FACILITYOS_DATABASE_URL="postgresql://..."
$env:FACILITYOS_AUTH_MODE="session"
$env:FACILITYOS_SESSION_SECRET="dev-secret"
node server/index.js
```

Health response now includes:

```json
"deployment": { "authMode": "legacy", "storage": "local" },
"auth": { "mode": "legacy", "sessionLogin": null }
```

---

## Roadmap (remaining)

| Phase | Scope |
|-------|-------|
| 4 | Reseller portal, subscription billing, PWA offline queue, session revocation (Redis/jti) |
| 5 | Retire legacy cloud relay UI |

---

## Security hardening (peer review — May 2026)

The following critical items from external peer review are addressed in `1.7.1-security`:

| # | Issue | Fix |
|---|-------|-----|
| 1 | PIN brute force | Rate limit on `/api/auth/pin` and `staff:by_pin` (10 / 15 min / IP) |
| 2 | Plaintext PINs | bcrypt (cost 12) on create/update; auto-migrate existing DBs on startup |
| 3 | Hosted LAN bypass | Session mode on hosted: only `127.0.0.1` bypass; `trust proxy: 1` on hosted |
| 4 | Wildcard CORS | Hosted locks to `FACILITYOS_PUBLIC_URL` |
| 5 | Terraform local state | See `deploy/terraform/azure/tenant/backend.tf.example` |
| 6 | Backup restore roles | Requires supervisor/manager/admin_staff (LAN exempt on self-host) |
| 7 | SQL column injection | Column allowlists on UPDATE handlers |
| 8 | Postgres migrations | `runPostgresMigrations()` applies shared migration SQL files |
| 10 | Health info leak | Public hosted health returns minimal `{ ok, version, uptime }` |
| 11 | PG TLS verification | CA bundle via `FACILITYOS_PG_CA_PATH` — see `deploy/certs/README.md` |
| 12 | Upload MIME | Extension allowlist + `Content-Disposition: attachment` on serve |

Remaining suggestions (Phase 4+): session revocation, shorter TTL, Redis rate limit for multi-instance.

---

## Licence

Self-host continues to use `facilityos.lic` on disk. Hosted tenants will use subscription billing (Phase 4 portal).
