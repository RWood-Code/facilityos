# Mobile & tablet access

FacilityOS is primarily a **Windows desktop app** (Electron). Phones and tablets use a **browser or PWA** — on facility Wi‑Fi **or remotely** via HTTPS tunnel.

See **[REMOTE_ACCESS.md](REMOTE_ACCESS.md)** for anywhere access (Cloudflare Tunnel, access tokens).

## How it works

### On-site (LAN)

```
┌─────────────────┐     Wi‑Fi LAN      ┌──────────────────────────┐
│  Data server PC │ ◄───────────────── │  iPhone / iPad / tablet  │
│  port 3847      │   http://IP:3847   │  Safari / Chrome / PWA   │
└─────────────────┘                    └──────────────────────────┘
```

### Off-site (remote)

```
Manager phone ──HTTPS + token──► Cloudflare Tunnel ──► Facility server :3847
```

Enable in **Settings → Remote**, share tunnel URL + token with managers.

1. The **data server PC** hosts the database and API (port **3847**).
2. Run **`npm run build`** once on that PC so the web UI is served from the same port.
3. Mobile devices open `http://<server-ip>:3847/` in a browser.

Desktop terminals can still use the Windows installer; mobile uses the browser.

## Setup (production)

### On the data server PC

```powershell
cd facilityos
npm run build
# Restart FacilityOS (or run npm run serve:web for testing)
```

Allow port **3847** through Windows Firewall (`scripts/install-server-firewall.ps1`).

### Find your links

**Settings → Terminals → Mobile & tablet access** lists copy-ready URLs for:

| Link | Use case |
|------|----------|
| Full app | General mobile access |
| `#steam-tablet` | Steam/sauna kiosk — large touch buttons |
| `#manager` | Manager dashboard on iPhone |

### Steam room tablet

1. Mount an iPad or Android tablet on the wall (same Wi‑Fi as server).
2. Open the **steam-tablet** URL.
3. **Add to Home Screen** (Safari Share menu / Chrome install).
4. Optional: enable **Guided Access** (iOS) or kiosk app to lock the device to FacilityOS.

Tablet mode shows:

- Large area buttons (steam room / sauna)
- One-tap clean / towels / temp logging
- Recent checks list
- Minimal chrome — no sidebar

### Manager on iPhone

1. Open the **manager** URL (or full app → Manager View).
2. **Share → Add to Home Screen** for app-like access.
3. Bottom navigation: Home, Pools, Steam, Manager, More.

Requires **Professional** or **Enterprise** licence (Manager View module).

## Development / testing

```bash
npm run dev:mobile
```

On your phone (same Wi‑Fi), open `http://<dev-pc-ip>:5173`. Vite proxies `/api` to the local data server.

First visit from a phone may show **Connect to FacilityOS** — enter `http://<server-ip>:3847` if auto-detect fails.

## Connection screen

Browser clients (not the Windows app) may see a connect screen when:

- The server URL is not configured
- The device cannot reach the API

Enter:

- **Server URL:** `http://192.168.1.50:3847` (your data server IP)
- **Device name:** e.g. `steam-tablet-1`, `manager-iphone`

## PWA (Add to Home Screen)

The web app includes a manifest, service worker (offline UI shell), and iOS meta tags. After adding to the home screen, FacilityOS opens full-screen like a native app.

**Data requires network access** to the facility server (LAN or remote tunnel). Offline test entry is a future native-app feature.

## True mobile app roadmap

| Stage | Delivery | Access |
|-------|----------|--------|
| **Now** | PWA + responsive UI | LAN or HTTPS tunnel + token |
| **Next** | Capacitor wrapper | App Store / Play Store, same API |
| **Future** | FacilityOS Cloud relay | Login anywhere, no tunnel setup |

See [REMOTE_ACCESS.md](REMOTE_ACCESS.md) for security and tunnel setup.

## What mobile is not (today)

- **Not** a native iOS/Android app in the stores (browser + optional home screen only).
- **Not** offline — all data lives on the facility server.
- **Not** a replacement for the Windows installer on fixed desk terminals.

## Environment variable (advanced)

For a fixed remote API when hosting the UI elsewhere:

```bash
VITE_API_URL=http://192.168.1.50:3847 npm run build
```

Or set the URL in the connect screen (stored in browser localStorage).
