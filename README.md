# FacilityOS v1 — Multi-terminal facility operations

Installable desktop system for aquatic and recreation centre operations: pool water testing (NZS 5826:2010), staff, assets, work orders, maintenance schedules, and reports. **All terminals share one database** via a built-in data server.

## Features

- **Windows installer** (NSIS) — desktop app per terminal
- **Shared data** — one SQLite database on the primary PC; pool deck, reception, and plant room terminals connect over LAN
- **Module registry** — enable/disable features; rostering scaffold included for future development
- **NZS 5826 compliance** — limits, scheduled test times, compliance reporting

## Quick start (development)

```bash
cd facilityos
npm install
npm run dev
```

Starts the data server, Vite UI, and Electron shell.

## Production install

See [BUILD.md](BUILD.md) for building `FacilityOS Setup 1.0.0.exe`.

### Multi-terminal setup

| PC | Role | Settings → Terminals |
|----|------|----------------------|
| Office / plant room | **Data server** | Role: *Data server* (default). Runs database at `%ProgramData%\FacilityOS\data\` |
| Pool deck, reception, gym | **Client** | Role: *Client terminal*, URL: `http://<server-ip>:3847` |

On the server PC, run (as Administrator):

```powershell
.\scripts\install-server-firewall.ps1
```

## Architecture

```
facilityos/
├── server/           # Express API + SQLite (better-sqlite3, WAL)
├── shared/db/        # Schema + handlers (single source of truth)
├── electron/         # Desktop shell, spawns data server when role=server
├── src/
│   ├── config/modules.js   # Add new modules here (e.g. rostering)
│   ├── hooks/useDb.js      # HTTP API — same on every terminal
│   └── modules/            # UI modules
```

All data access uses channels (`pools:list`, `tests:create`, …). UI code does not change when adding terminals or future cloud sync.

## Adding a new module (e.g. rostering)

1. Add UI in `src/modules/<name>/`
2. Register in `src/config/modules.js` (`MODULE_REGISTRY`)
3. Add tables to `shared/db/schema.sql` and handlers in `shared/db/handlers.js`
4. Optional: row in `module_registry` for admin toggles

## Data location

| Item | Path |
|------|------|
| Shared database | `%ProgramData%\FacilityOS\data\facilityos.db` |
| Backups | `%ProgramData%\FacilityOS\data\backups\` |
| Per-terminal config | `%APPDATA%\FacilityOS\terminal-config.json` |

Backups use SQLite's atomic backup API. Configure automatic backups in **Settings → Data**. Restore creates a pre-restore safety snapshot first.

## Licensing & modules

FacilityOS uses a **two-layer** access model:

1. **Licence plan** (vendor/reseller) — caps which modules a customer can use (`trial`, `standard`, `professional`, `enterprise`)
2. **Facility settings** (site admin) — toggles licensed modules on/off in **Settings → Modules**

Plans and entitlements live in `shared/db/entitlements.js`. The API returns effective access on `licence:status` as a `modules` map. The data server blocks API channels for unlicensed modules.

To upgrade a site: **Settings → Licence → Activate** with plan `professional` or `enterprise`, then **Sync modules from plan**.

### Licence key generator

Generate customer licence keys with a module chooser in three ways:

| Method | Use case |
|--------|----------|
| **Settings → Licence → Licence issuer** | In-app UI: pick plan, toggle modules, generate key, apply or copy |
| **CLI** | `npm run licence:generate -- --org "Customer Name" --plan professional` |
| **Browser** | Open `scripts/licence-generator.html` offline (no server required) |

CLI examples:

```bash
npm run licence:generate -- --org "EA Networks Centre" --plan professional
npm run licence:generate -- --org "Gym Pool" --plan standard --years 2 --terminals 5
npm run licence:generate -- --org "Demo" --plan professional --modules pools,reports,rostering --json
```

The licence key is a unique label (e.g. `FACILITYOS-PRO-EANC-2026-XXXX`). **Plan, expiry, and module selection** control what the customer can use — not cryptographic validation of the key string.

| Plan | Rostering | Manager View | Core ops |
|------|-----------|--------------|----------|
| Trial / Standard | — | — | ✓ |
| Professional | ✓ | ✓ | ✓ |
| Enterprise | ✓ | ✓ | ✓ (+ all future modules) |

## API (LAN)

- `GET /api/health` — server status (includes schema version)
- `POST /api/query` — `{ channel, args, terminalId }`
- `POST /api/backup` — atomic database snapshot
- `GET /api/backups` — list available backups
- `POST /api/backup/restore` — `{ filename }` restore from backup
- `GET /api/integrity` — SQLite integrity check

Default port: **3847**

## Auto-updates (packaged builds)

Packaged Windows installs check GitHub Releases for updates on startup. Configure `build.publish` in `package.json` with your GitHub owner/repo, then publish releases with `electron-builder --publish always`.

Users see a banner when an update is available: **Download** → **Restart now** to install.

## Mobile & tablet access

Phones and tablets use a **browser on facility Wi‑Fi** — no app store install. See **[MOBILE.md](MOBILE.md)** for full setup.

| Device | URL | Notes |
|--------|-----|--------|
| General mobile | `http://<server-ip>:3847/` | Run `npm run build` on server PC first |
| Steam room tablet | `…/#steam-tablet` | Kiosk UI — large touch buttons |
| Manager iPhone | `…/#manager` | Bottom nav + Add to Home Screen |

Copy-ready links: **Settings → Terminals → Mobile & tablet access**.

Development: `npm run dev:mobile` then open `http://<pc-ip>:5173` on the device.

Remote access: **Settings → Remote** + [REMOTE_ACCESS.md](REMOTE_ACCESS.md).

**FacilityOS Cloud** (future hosted relay): [FACILITYOS_CLOUD.md](FACILITYOS_CLOUD.md) — Settings → Cloud pairing scaffold.
