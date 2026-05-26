# Capacitor native mobile — implementation plan

FacilityOS today ships as a **PWA** (Add to Home Screen) for pool-deck phones and a **FacilityOS Cloud** read-only manager view for remote staff. **Capacitor** wraps the same Vite/React UI in a native iOS/Android shell when customers need app-store distribution, richer push, or offline polish.

## Recommended architecture

```mermaid
flowchart LR
  subgraph native [Capacitor shell]
    App[FacilityOS UI - same Vite build]
    Push[@capacitor/push-notifications]
    Net[@capacitor/network]
  end

  subgraph access [Connectivity modes]
    LAN[Facility Wi‑Fi → data server :3847]
    Tunnel[HTTPS tunnel + access token]
    Cloud[FacilityOS Cloud relay login]
  end

  App --> LAN
  App --> Tunnel
  App --> Cloud
  Push --> Cloud
```

| Mode | Use case | Auth |
|------|----------|------|
| LAN PWA / Capacitor | On-site staff | Staff PIN (on-prem) |
| Tunnel + token | DIY remote (Professional) | Remote access token |
| Cloud relay | Managed remote (Cloud tier) | Email/password site login |

**Do not** embed the SQLite database or data server in the mobile app. Mobile always talks to on-prem (LAN/tunnel) or the cloud relay (HTTPS).

## Phase A — Scaffold (1–2 days)

1. Add Capacitor to the existing Vite project:
   ```bash
   npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios
   npx cap init FacilityOS nz.facility.facilityos --web-dir dist
   ```
2. Build web assets: `npm run build`
3. Sync: `npx cap sync`
4. Open Xcode / Android Studio: `npx cap open ios` / `npx cap open android`

**Config notes**

- `server.url` in `capacitor.config.ts` — leave unset for bundled `dist/` (production), or point at dev server during development.
- Reuse `src/utils/mobileAccess.js` and `src/utils/cloudRelay.js` — no duplicate API layer.
- Keep `dbQuery()` as the single data entry point; Capacitor uses the same fetch path as the browser PWA.

## Phase B — Push notifications (pairs with Cloud Phase 3)

| Layer | Implementation |
|-------|------------------|
| Relay | Already scaffolds Web Push (`cloud/relay/push.js`) on non-compliant `water_test` ingest |
| PWA | `CloudManagerView` subscribes when VAPID key is configured |
| Capacitor | `@capacitor/push-notifications` → register FCM/APNs token with relay `POST /api/sites/:id/push/register-native` (to be added) |
| On-prem email | SMTP alerts via Settings → Email alerts (v1.6+) |

**VAPID / FCM setup (production)**

```env
FACILITYOS_VAPID_PUBLIC=...
FACILITYOS_VAPID_PRIVATE=...
FACILITYOS_VAPID_SUBJECT=mailto:alerts@yourdomain.com
```

Generate keys: `npx web-push generate-vapid-keys`

## Phase C — App store packaging

| Item | Guidance |
|------|----------|
| App name | FacilityOS Mobile |
| Bundle ID | `nz.facility.facilityos.mobile` (distinct from desktop `nz.facility.facilityos`) |
| Icons / splash | Export from brand assets; 1024×1024 iOS, adaptive Android |
| Permissions | Camera (QR scan optional), Notifications, Local network (iOS LAN) |
| Review notes | “Connects to customer’s on-premise facility server; no central user account unless Cloud tier” |

## Phase D — Offline behaviour (optional, later)

- Read cache: last manager snapshot from cloud relay (already available via `/manager-dashboard`)
- Write queue: defer `tests:create` until online — requires Cloud Phase 3 agent command queue
- Do **not** ship SQLite on device for compliance records

## Build flavours

| Flavour | Env | Entry |
|---------|-----|-------|
| On-prem mobile | default | LAN QR → full PWA modules |
| Cloud manager | `VITE_CLOUD_RELAY_URL` | Cloud login → read-only dashboard |
| Capacitor universal | bundled dist | MobileConnect or CloudConnect on first launch |

Example cloud-hosted build:

```bash
VITE_CLOUD_RELAY_URL=https://relay.facilityos.nz npm run build
```

Deploy `dist/` to CDN; users sign in with site ID + credentials created in Settings → Cloud.

## Dependencies to add (when executing Phase A)

```json
"@capacitor/core": "^7.x",
"@capacitor/cli": "^7.x",
"@capacitor/android": "^7.x",
"@capacitor/ios": "^7.x",
"@capacitor/push-notifications": "^7.x",
"@capacitor/network": "^7.x"
```

## Related docs

- [MOBILE.md](MOBILE.md) — LAN PWA workflow
- [REMOTE_ACCESS.md](REMOTE_ACCESS.md) — tunnel + token
- [FACILITYOS_CLOUD.md](FACILITYOS_CLOUD.md) — relay, sync, Phase 2 login
- [cloud/README.md](cloud/README.md) — local dev runbook

## Decision log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Capacitor vs React Native | Capacitor | Reuse 100% of Vite UI; faster time-to-store |
| Cloud vs tunnel default for native | Cloud tier for “works everywhere” | No customer VPN setup |
| Local SQLite on phone | No | Compliance + single source of truth on-prem |
