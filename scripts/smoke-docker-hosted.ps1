# FacilityOS — Docker hosted stack smoke test
# Requires Docker Desktop running.
param(
  [int]$Port = 3847,
  [switch]$KeepRunning
)

$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
$Compose = Join-Path $Root "deploy\docker\docker-compose.hosted.yml"

Write-Host "=== FacilityOS Docker hosted smoke test ===" -ForegroundColor Cyan

docker info *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Host "ERROR: Docker Desktop is not running." -ForegroundColor Red
  Write-Host "Start Docker Desktop, then re-run: npm run smoke:docker:hosted"
  exit 1
}

Write-Host "Building and starting hosted stack (Postgres + app)..." -ForegroundColor Yellow
$env:FACILITYOS_PORT = "$Port"
Push-Location $Root
try {
  docker compose -f $Compose down
  docker compose -f $Compose up --build -d
  if ($LASTEXITCODE -ne 0) { throw "docker compose up failed" }
} finally {
  Pop-Location
}

$base = "http://127.0.0.1:$Port"
$deadline = (Get-Date).AddMinutes(5)
Write-Host "Waiting for $base/api/health ..." -ForegroundColor Yellow
$ready = $false
while ((Get-Date) -lt $deadline) {
  try {
    $r = Invoke-RestMethod -Uri "$base/api/health" -TimeoutSec 5
    if ($r.ok) { $ready = $true; break }
  } catch { }
  Start-Sleep -Seconds 3
}

if (-not $ready) {
  Write-Host "ERROR: Server did not become healthy in 5 minutes." -ForegroundColor Red
  docker compose -f $Compose logs facilityos
  exit 1
}
Write-Host "Server healthy." -ForegroundColor Green

$env:SMOKE_BASE_URL = $base
node (Join-Path $Root "scripts\smoke-test-hosted.js")
if ($LASTEXITCODE -ne 0) {
  docker compose -f $Compose logs facilityos
  exit $LASTEXITCODE
}

Write-Host ""
Write-Host "Open in browser: $base" -ForegroundColor Cyan
Write-Host "Sign in with PIN 1234 (Sarah Johnson, supervisor)" -ForegroundColor Cyan

if (-not $KeepRunning) {
  Write-Host "Stopping containers..." -ForegroundColor Yellow
  docker compose -f $Compose down
} else {
  Write-Host "Containers left running. Stop with: npm run docker:down:hosted"
}

Write-Host "Done." -ForegroundColor Green
