# Building FacilityOS — Windows installers

## Two installers (recommended for end users)

| Installer | PC | What happens on launch |
|-----------|-----|------------------------|
| **FacilityOS Server** | Office / plant room (one per site) | Database + API + UI + cloud sync agent — one double-click |
| **FacilityOS Terminal** | Pool deck, reception, gym | UI only — connects to the server PC over LAN |

Build both:

```bash
npm run dist:all
```

Or individually:

```bash
npm run dist:server    # → dist-electron/FacilityOS Server Setup *.exe
npm run dist:client    # → dist-electron/FacilityOS Terminal Setup *.exe
```

`npm run dist` builds the **Server** installer by default.

### End-user setup (simple)

**Server PC (once)**

1. Install **FacilityOS Server Setup.exe**
2. Double-click the desktop shortcut — app, database, and phone/tablet access all start automatically
3. Run `scripts\install-server-firewall.ps1` as Administrator (allows LAN + phones on Wi‑Fi)
4. Optional: Settings → Cloud → pair if the site uses FacilityOS Cloud (agent runs in the background)

**Other PCs**

1. Install **FacilityOS Terminal Setup.exe**
2. Open app → Settings → Terminals & phones → enter server URL: `http://<server-ip>:3847`
3. Set a unique Terminal ID (PoolDeck, Reception, etc.)

No npm, no separate cloud commands, no second port for staff.

### What runs where

| Component | Server PC | Terminal PC | Your cloud (vendor) |
|-----------|-----------|-------------|---------------------|
| Desktop UI | ✓ | ✓ | — |
| SQLite database | ✓ | — | — |
| LAN API (:3847) | ✓ auto | connects to server | — |
| Cloud sync agent | ✓ auto (idle until paired) | — | — |
| Cloud relay | — | — | ✓ hosted by you |

The **cloud relay** is not installed at the facility — it runs on your infrastructure (Azure, Fly.io, etc.). The server installer only includes the **agent** that talks outbound to your relay when Cloud is enabled.

## Prerequisites (developers)

- Node.js 22 LTS recommended
- Windows 10/11
- Internet for first `npm install`

Before building:

```bash
npm install
npm run rebuild:electron
```

If `better-sqlite3` fails, install [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with “Desktop development with C++”.

## Verify LAN access

On a client PC or phone (facility Wi‑Fi):

```text
http://<server-ip>:3847/api/health
```

You should see JSON with `"ok": true`.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `npm install` fails on sqlite | Install VS Build Tools; delete `node_modules` and retry |
| Blank app window | Re-run `npm run dist:server` |
| Terminal shows “Data server offline” | Check server PC is on, firewall rule, correct IP URL |
| Port in use | Close other FacilityOS instances; or change port in Settings |

## Optional: data server only (no UI)

```bash
npm run rebuild:electron
scripts\start-data-server.bat
```
