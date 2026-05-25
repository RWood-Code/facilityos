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

## API (LAN)

- `GET /api/health` — server status (includes schema version)
- `POST /api/query` — `{ channel, args, terminalId }`
- `POST /api/backup` — atomic database snapshot
- `GET /api/backups` — list available backups
- `POST /api/backup/restore` — `{ filename }` restore from backup
- `GET /api/integrity` — SQLite integrity check

Default port: **3847**
