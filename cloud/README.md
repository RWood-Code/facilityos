# FacilityOS Cloud — Phase 1 runbook

## Local development (all three processes)

```powershell
cd facilityos
npm run cloud:dev
```

This starts:

| Process | Port | Role |
|---------|------|------|
| Data server | 3847 | SQLite + API |
| Cloud relay | 4850 | Pairing + event ingest |
| Sync agent | — | Pushes outbox → relay every 30s |

## Pair a site (UI)

1. Open FacilityOS → **Settings → Cloud**
2. Relay URL: `http://127.0.0.1:4850`
3. **Generate code** → **Pair with relay**
4. **Send demo event** or log a water test (cloud must be enabled after pair)
5. **Sync now** or wait for agent

## Verify relay received events

```powershell
curl http://127.0.0.1:4850/api/health
curl http://127.0.0.1:4850/api/sites
# Replace SITE_ID from pairing response:
curl http://127.0.0.1:4850/api/sites/SITE_ID/snapshot
```

## Production deployment

1. Deploy `cloud/relay` to your host (Fly.io, Azure, etc.)
2. Set `FACILITYOS_RELAY_PORT` and persistent volume for `cloud/data/relay.db`
3. On facility PC: `npm run cloud:agent` as Windows service (Task Scheduler / NSSM)
4. Customer pairs once in Settings → Cloud

See [FACILITYOS_CLOUD.md](../FACILITYOS_CLOUD.md) for architecture and Phase 2+ roadmap.
