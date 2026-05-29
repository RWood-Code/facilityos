# Provision a FacilityOS hosted tenant on Azure.
# Prerequisites: az login, terraform >= 1.5
#
# Usage:
#   .\deploy\scripts\provision-azure-tenant.ps1 -SiteSlug demo -Environment staging -DockerImage ghcr.io/org/facilityos:latest

param(
  [Parameter(Mandatory = $true)][string]$SiteSlug,
  [string]$Environment = "staging",
  [Parameter(Mandatory = $true)][string]$DockerImage
)

$ErrorActionPreference = "Stop"
$Root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$TfDir = Join-Path $Root "deploy\terraform\azure\tenant"

if (-not (Get-Command terraform -ErrorAction SilentlyContinue)) {
  throw "terraform not found — install from https://developer.hashicorp.com/terraform/install"
}

$account = az account show 2>$null | ConvertFrom-Json
if (-not $account) {
  throw "Run: az login"
}

Push-Location $TfDir
try {
  terraform init -input=false
  terraform apply -input=false -auto-approve `
    -var="site_slug=$SiteSlug" `
    -var="environment=$Environment" `
    -var="docker_image=$DockerImage"
  terraform output deployment_summary
} finally {
  Pop-Location
}
