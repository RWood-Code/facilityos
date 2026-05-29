# Azure hosted tenant — Terraform

Provisions an isolated **FacilityOS Online** stack for one aquatic centre.

## Prerequisites

- [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli) — `az login`
- [Terraform](https://developer.hashicorp.com/terraform/install) >= 1.5
- Container image in GHCR or ACR (build via `npm run docker:build` or GitHub Actions)

## Quick start

```powershell
cd deploy/terraform/azure/tenant
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars — set site_slug, docker_image

terraform init
terraform apply
```

Or use the wrapper script from repo root:

```powershell
.\deploy\scripts\provision-azure-tenant.ps1 -SiteSlug eac -Environment prod -DockerImage ghcr.io/org/facilityos:latest
```

## Outputs

After apply:

```powershell
terraform output public_url
terraform output deployment_summary
```

## Custom domain

1. Note `azurerm_linux_web_app.app.default_hostname` from Azure Portal
2. Create CNAME: `eac.facilityos.app` → `fos-eac-prod-app.azurewebsites.net`
3. Add managed certificate in App Service → Custom domains
4. Set app setting `FACILITYOS_PUBLIC_URL=https://eac.facilityos.app`

## SMTP (email alerts)

App Service → Configuration → Application settings:

| Setting | Example |
|---------|---------|
| `SMTP_HOST` | `smtp.sendgrid.net` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | `apikey` |
| `SMTP_PASS` | *(secret)* |
| `SMTP_FROM` | `alerts@yourdomain.com` |

## Destroy

```powershell
terraform destroy
```

## Cost estimate (Australia East, 2025)

| Resource | ~Monthly |
|----------|----------|
| App Service B1 | USD 13 |
| PostgreSQL B1ms | USD 25 |
| Storage (minimal) | USD 1 |
| **Total** | **~USD 40/site** |

Mark up in hosted subscription pricing.
