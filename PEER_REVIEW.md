# FacilityOS — peer review brief

Use this document as context when reviewing the attached codebase.

## What this project is

**FacilityOS** is a resellable facility operations platform for aquatic and recreation centres (pool water testing to NZS 5826:2010, staff, assets, work orders, maintenance, rostering, reports). It is designed as **one codebase, two commercial SKUs**:

| SKU | Deployment | Database | Typical install |
|-----|------------|----------|-----------------|
| **Self-Host** | `FACILITYOS_DEPLOYMENT=selfhost` (default) | SQLite on local PC | Windows Electron installer (.exe), Docker |
| **Hosted (FacilityOS Online)** | `FACILITYOS_DEPLOYMENT=hosted` | PostgreSQL | Azure App Service (Terraform in `deploy/`), Docker |

Remote staff and on-site staff use the **same server URL** — not a hybrid sync/relay model.

## Architecture (high level)

```
React UI (src/) + PWA/mobile browser
       ↓ HTTP / Electron IPC
Express server (server/index.js)
       ↓ channel API (shared/db/handlers*.js)
Database adapter (shared/db/adapters/) — SQLite or PostgreSQL
Storage adapter (server/storage/) — local filesystem or Azure Blob
Auth — legacy (LAN + remote token) for self-host; session JWT for hosted
Licence — Ed25519 signed facilityos.lic (shared/db/licenceSigning.js)
```

Key directories:

- `server/` — Express API, auth, storage, security, DB bootstrap
- `server/auth/` — session JWT, rate limits, public licence channels
- `shared/db/` — schema, migrations, handlers, pin hashing (bcrypt), licence signing
- `electron/` — desktop shell (server + terminal roles)
- `licence-issuer/` — vendor licence generator (separate Electron app)
- `src/` — React UI, modules, mobile/PWA helpers
- `deploy/` — Docker, Azure Terraform, CI workflows
- `scripts/` — smoke tests (`smoke-test.js`, `smoke-test-hosted.js`, `smoke-docker-hosted.ps1`)
- `test/` — DB adapter + Phase 3 tests

Start with `README.md`, `DEPLOYMENT.md`, and `BUILD.md`.

## Implementation phases (current state)

| Phase | Status | Scope |
|-------|--------|-------|
| 1 | Done | DB adapter layer (SQLite ↔ Postgres), async handlers |
| 2 | Done | Docker self-host/hosted, Azure Terraform tenant stack, GHCR CI |
| 3 | Done | Blob storage adapter, session auth for hosted, legacy path preserved |
| 3b | Done | Security hardening (peer review): bcrypt PINs, rate limits, CORS, trust proxy, SQL allowlists, Postgres migrations |
| 4 | Planned | Reseller portal, subscription billing, PWA offline queue |
| 5 | Planned | Retire legacy cloud relay UI |

**Version string in health:** `1.7.1-security`

**Important constraint:** Existing self-host customers (Electron + SQLite + LAN) must keep working unchanged with zero new env vars. Hosted features are opt-in via deployment env.

## Recent fixes (since last review)

- Session auth exempts licence channels (`server/auth/publicChannels.js`) so licence gate works before staff login
- Licence Issuer packaging includes `licenceSigning.js` + `licenceKeys.js`
- Docker entrypoint CRLF fix for Windows builds
- Hosted smoke tests pass (session auth, minimal health, licence bootstrap)

## What we want from this review

Please review as a **senior engineer preparing for production resale**. Focus on:

1. **Architecture & dual-SKU design** — Is the self-host vs hosted split sound? Any coupling that will hurt maintenance?
2. **Security** — Auth (legacy vs session), bcrypt PINs, rate limits, upload allowlist, Terraform secrets, session public channels scope
3. **Database layer** — SQLite/Postgres adapter correctness, Postgres migration runner, SQL dialect normalisation
4. **Backward compatibility** — Risk of breaking existing Electron/.exe installs or LAN workflows
5. **Hosted readiness** — Azure Terraform, blob storage, session auth, licence activation flow on hosted
6. **Licence system** — Ed25519 signing, issuer app, activation path in LicenseGate.jsx
7. **Code quality** — Error handling, async patterns, test coverage gaps
8. **Operational concerns** — Backups, logging, health checks, deployment docs accuracy

Please structure your response as:

- **Critical** (must fix before hosted staging)
- **Important** (should fix soon)
- **Suggestions** (nice to have)
- **What looks good** (brief)

Do not rewrite the whole app — prioritise actionable findings with file references where possible.

## How to run locally (reviewer)

```bash
npm install
npm run test:db        # SQLite adapter tests
npm run test:phase3    # storage + session + auth + legacy smoke
npm run dev:server     # API only (port 3847)
npm run dev:web        # API + Vite UI
npm run smoke          # live HTTP smoke (server must be running)
```

Docker:

```bash
npm run docker:hosted      # Postgres + session auth (local)
npm run docker:selfhost    # SQLite legacy path
npm run smoke:docker:hosted  # PowerShell — build + test hosted stack
```

Licence Issuer (vendor tool):

```bash
npm run issuer:dev         # http://127.0.0.1:3920
npm run licence:generate -- --org "Demo" --plan professional --out facilityos.lic
```

## Excluded from this zip

- `node_modules/`, build output (`dist/`, `dist-electron*/`), local `.db` files, secrets (`.env`), signing keys, `[object Object]` artefact folder if present

Reviewer should run `npm install` after extracting.
