# FacilityOS Licence Issuer

Standalone **vendor tool** for generating FacilityOS licence keys and tracking issued licences across customer sites. Runs separately from FacilityOS — no licence required to use this app.

## Quick start

From the `facilityos` project root (after `npm install`):

```bash
npm run issuer:dev
```

Open **http://localhost:3921**

- **Issue licence** — organisation, plan, modules, expiry → key + copy JSON / customer email
- **Registry** — local history of all keys you've issued (`licence-issuer/data/issued.json`)

## Production (single server)

```bash
npm run issuer:build
npm run issuer:start
```

Serves the UI and API on **http://127.0.0.1:3920** (set `ISSUER_PORT` to change).

## Windows `.exe` (recommended for vendors)

Build a standalone executable — no Node.js required on your PC:

```bash
npm run issuer:dist
```

Output in `dist-electron-issuer/`:

| File | Description |
|------|-------------|
| `FacilityOS-Licence-Issuer-1.0.0-portable.exe` | Single portable exe — run anywhere, no install |
| `FacilityOS-Licence-Issuer-1.0.0-Setup.exe` | NSIS installer with Start Menu shortcut |

Portable only (faster build):

```bash
npm run issuer:dist:portable
```

**Registry location when using the exe:** `%APPDATA%\\facilityos-licence-issuer\\data\\issued.json`

Dev mode (`npm run issuer:dev`) still stores registry in `licence-issuer/data/issued.json`.

## Customer activation

Send the customer:

1. **Licence key**
2. **Expiry date** (YYYY-MM-DD)
3. **Plan** (if activating via Settings manually)

On their FacilityOS PC:

- If expired: **Administrator → activate licence** on the gate screen
- If licensed: **Settings → Licence → Activate**

Paste the key and expiry, then click Activate.

## API (local)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/meta` | Plans and module labels |
| GET | `/api/plan-modules?plan=professional` | Default modules for plan |
| POST | `/api/generate` | Generate and register licence |
| GET | `/api/issued` | List registry |
| DELETE | `/api/issued/:id` | Remove registry entry |

Generation logic is shared with FacilityOS via [`shared/db/licenceGenerator.js`](../shared/db/licenceGenerator.js).

## Notes

- Registry is **local only** — back up `licence-issuer/data/issued.json` or export JSON from the registry tab
- Removing a registry row does **not** revoke a licence on a customer site
- This tool is for **you** (vendor/reseller), not for facility staff
