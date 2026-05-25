# Remote access — use FacilityOS from anywhere

FacilityOS data lives on the **facility server PC** (SQLite). Remote access lets managers and mobile devices reach that server over the internet — without moving data to the cloud.

## Architecture

```
                    ┌─────────────────────────────────────┐
                    │  Manager iPhone / home laptop       │
                    │  PWA or browser                     │
                    │  https://facilityos.yourdomain.com  │
                    └──────────────┬──────────────────────┘
                                   │ HTTPS + access token
                    ┌──────────────▼──────────────────────┐
                    │  Secure tunnel (Cloudflare / Tailscale)│
                    └──────────────┬──────────────────────┘
                                   │
┌───────────────────▼──────────────────────────────────────┐
│  Facility data server PC (Windows)                        │
│  FacilityOS :3847 — SQLite + API + web UI                 │
│  LAN terminals: no token · Remote clients: Bearer token   │
└──────────────────────────────────────────────────────────┘
```

### Access modes

| Mode | Who | How |
|------|-----|-----|
| **Desktop (Electron)** | Office, pool deck PCs | Windows installer, LAN to local server |
| **LAN mobile** | Tablets on-site | `http://192.168.x.x:3847` on Wi‑Fi |
| **Remote mobile/PWA** | Managers off-site | HTTPS tunnel URL + access token |
| **Future: native app** | iOS/Android stores | Same API + token (React Native / Capacitor wrapper) |
| **Future: FacilityOS Cloud** | Multi-site resellers | Hosted sync layer — optional upgrade path |

## Setup (recommended: Cloudflare Tunnel)

### 1. Build and serve the web UI on the server PC

```powershell
cd facilityos
npm run build
# Restart FacilityOS (data server role)
```

### 2. Enable remote access in FacilityOS

**Settings → Remote → Enable remote access**

Copy the **access token** — it is shown once per enable/rotate action. Store it in your password manager.

### 3. Expose port 3847 with a secure tunnel

**Option A — Cloudflare Tunnel (free, HTTPS)**

1. Install [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)
2. Create a tunnel to `http://127.0.0.1:3847`
3. Map a hostname e.g. `facilityos.yourdomain.com`

**Option B — Tailscale Funnel / MagicDNS**

Good for single-site operators already on Tailscale. Use HTTPS funnel URL.

**Option C — ngrok (quick test only)**

```bash
ngrok http 3847
```

Not recommended for production — URLs rotate on free tier.

### 4. Paste tunnel URL in Settings → Remote

Copy the mobile links (Manager, Steam tablet, full app) and share with staff.

### 5. Mobile user connects

1. Open the HTTPS URL on iPhone/Android
2. Enter **server URL** + **access token** on first connect (stored in browser)
3. **Add to Home Screen** for PWA experience
4. Enter **staff PIN** to sign in

## Security model

| Rule | Behaviour |
|------|-----------|
| LAN/private IP | Full API access, no token (facility terminals) |
| Remote, remote disabled | Blocked (`lan_only`) |
| Remote, remote enabled | Requires `Authorization: Bearer <token>` |
| Admin actions | `remote:enable`, licence generator — LAN only |

**Always use HTTPS** for tunnel URLs. Never expose port 3847 directly to the public internet without TLS.

Rotate the access token if staff leave or a device is lost: **Settings → Remote → Rotate token**.

## True mobile app vs PWA

### What you have today (PWA)

- Web UI + manifest + service worker (offline **shell** only)
- Add to Home Screen on iOS/Android
- Same codebase as desktop
- Data always from facility server (online required)

**Good for:** managers checking KPIs, approving actions, steam tablet on VPN/tunnel.

### What a native app would add

| Feature | PWA (now) | Native (future) |
|---------|-----------|-----------------|
| App Store presence | Home screen only | Discoverable install |
| Push notifications | Limited on iOS | Full (APNs / FCM) |
| Offline queue | Not implemented | Cache tests, sync later |
| Biometric unlock | Browser-dependent | Face ID / fingerprint |
| Background sync | No | Yes |

**Recommended path:** ship PWA + remote tunnel now → wrap with **Capacitor** later (reuse React UI) → add push via facility server webhook or future cloud relay.

### FacilityOS Cloud (future resale tier)

For customers who cannot run a tunnel:

1. Optional **FacilityOS Cloud relay** (multi-tenant)
2. On-prem server syncs encrypted snapshots / live replication
3. Mobile connects to `https://app.facilityos.nz` with site login
4. On-prem remains source of truth for compliance data

This preserves your resale model: **on-prem by default**, cloud as premium add-on.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `remote_access_disabled` | Enable remote in Settings → Remote |
| `access_token_required` | Enter token from server admin |
| `invalid_access_token` | Rotate token, update mobile devices |
| `local_admin_required` | Remote admin actions must be done on-site |
| Web UI 404 | Run `npm run build` on server PC |

## API reference (integrators)

Remote clients send:

```http
POST /api/query
Authorization: Bearer <access_token>
Content-Type: application/json

{"channel":"licence:status","args":{},"terminalId":"manager-iphone"}
```

Health check (no auth):

```http
GET /api/health
```

Response includes `remoteAccess.enabled` and `remoteAccess.tokenRequired`.
