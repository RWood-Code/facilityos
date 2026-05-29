#!/usr/bin/env bash
# Provision a FacilityOS hosted tenant on Azure.
# Prerequisites: az login, terraform >= 1.5, Docker image published
#
# Usage:
#   ./deploy/scripts/provision-azure-tenant.sh demo staging ghcr.io/org/facilityos:latest

set -euo pipefail

SITE_SLUG="${1:-}"
ENVIRONMENT="${2:-staging}"
DOCKER_IMAGE="${3:-}"

if [[ -z "$SITE_SLUG" || -z "$DOCKER_IMAGE" ]]; then
  echo "Usage: $0 <site_slug> <environment> <docker_image>"
  echo "Example: $0 eac prod ghcr.io/rwood-code/facilityos:1.7.0"
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TF_DIR="$ROOT/deploy/terraform/azure/tenant"
STATE_KEY="facilityos-${SITE_SLUG}-${ENVIRONMENT}.tfstate"

cd "$TF_DIR"

if ! command -v terraform >/dev/null 2>&1; then
  echo "terraform not found — install from https://developer.hashicorp.com/terraform/install"
  exit 1
fi

if ! az account show >/dev/null 2>&1; then
  echo "Run: az login"
  exit 1
fi

terraform init -input=false

terraform apply -input=false -auto-approve \
  -var="site_slug=${SITE_SLUG}" \
  -var="environment=${ENVIRONMENT}" \
  -var="docker_image=${DOCKER_IMAGE}"

echo ""
terraform output deployment_summary
