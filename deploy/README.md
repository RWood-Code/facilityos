# FacilityOS deployment assets

| Path | Purpose |
|------|---------|
| `docker/` | Dockerfile, compose files, entrypoint |
| `terraform/azure/tenant/` | One Azure stack per hosted customer |
| `scripts/` | Provision wrappers (PowerShell + bash) |

## Quick commands

```powershell
npm run docker:selfhost    # SQLite in Docker
npm run docker:hosted      # Postgres + app (local test)
npm run docker:build       # Build image only
```

```powershell
.\deploy\scripts\provision-azure-tenant.ps1 -SiteSlug demo -Environment staging -DockerImage facilityos:latest
```

Full guide: [DEPLOYMENT.md](../../DEPLOYMENT.md)
