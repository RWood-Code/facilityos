# Building FacilityOS — Windows installer

## Prerequisites

- Node.js 20+ (LTS recommended)
- Windows 10/11
- Internet for first `npm install`

`better-sqlite3` uses prebuilt binaries on Windows; no Visual Studio required for most setups.

## Build steps

### 1. Open terminal in project folder

```text
cd facilityos
```

### 2. Install dependencies (~2–3 min)

```bash
npm install
```

If `better-sqlite3` fails to compile, install [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with “Desktop development with C++”, then run `npm install` again.

### 3. Build installer (~5–8 min)

```bash
npm run dist
```

Output:

```text
dist-electron/FacilityOS Setup 1.0.0.exe
```

### 4. Install on each terminal

1. Run the installer on every PC that needs FacilityOS.
2. **Primary PC (data server):** Settings → Terminals → Role: *Data server*. Leave port `3847`.
3. Run `scripts\install-server-firewall.ps1` as Administrator on that PC.
4. **Other PCs:** Settings → Terminals → Role: *Client*, URL: `http://<server-ip>:3847` (e.g. `http://192.168.1.50:3847`).
5. Set a unique **Terminal ID** per machine (T1, T2, PoolDeck, etc.).

## Verify LAN access

On a client PC, open a browser:

```text
http://<server-ip>:3847/api/health
```

You should see JSON with `"ok": true`.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `npm install` fails on sqlite | Install VS Build Tools; delete `node_modules` and retry |
| Blank app window | Re-run `npm run dist` |
| Client shows “Data server offline” | Check server PC is on, firewall rule, correct IP URL |
| Port in use | Change server port in Settings and firewall script |

## Optional: server only (no UI)

The data server uses the same runtime as the desktop app (required for SQLite):

```bash
# After npm install, rebuild native module for Electron once:
npm run rebuild:electron

# Then start server:
scripts\start-data-server.bat
```
