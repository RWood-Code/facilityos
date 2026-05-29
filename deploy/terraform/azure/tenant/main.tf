locals {
  name_prefix = "fos-${var.site_slug}-${var.environment}"
  default_url = "https://${azurerm_linux_web_app.app.default_hostname}"
  public_url  = var.facilityos_public_url != "" ? var.facilityos_public_url : (var.custom_domain != "" ? "https://${var.custom_domain}" : local.default_url)
  common_tags = merge({
    product     = "FacilityOS"
    site        = var.site_slug
    environment = var.environment
    managed_by  = "terraform"
  }, var.tags)
}

resource "azurerm_resource_group" "rg" {
  name     = "${local.name_prefix}-rg"
  location = var.location
  tags     = local.common_tags
}

resource "random_password" "postgres" {
  length  = 24
  special = true
}

resource "random_password" "session" {
  length  = 32
  special = false
}

resource "azurerm_postgresql_flexible_server" "pg" {
  name                   = "${local.name_prefix}-pg"
  resource_group_name    = azurerm_resource_group.rg.name
  location               = azurerm_resource_group.rg.location
  version                = "16"
  administrator_login    = "facilityos"
  administrator_password = random_password.postgres.result
  storage_mb             = 32768
  sku_name               = var.postgres_sku
  zone                   = "1"
  tags                   = local.common_tags
}

resource "azurerm_postgresql_flexible_server_database" "db" {
  name      = "facilityos"
  server_id = azurerm_postgresql_flexible_server.pg.id
  charset   = "UTF8"
  collation = "en_US.utf8"
}

resource "azurerm_postgresql_flexible_server_firewall_rule" "allow_azure" {
  name             = "AllowAzureServices"
  server_id        = azurerm_postgresql_flexible_server.pg.id
  start_ip_address = "0.0.0.0"
  end_ip_address   = "0.0.0.0"
}

resource "azurerm_storage_account" "storage" {
  name                     = substr(replace("${local.name_prefix}st", "-", ""), 0, 24)
  resource_group_name      = azurerm_resource_group.rg.name
  location                 = azurerm_resource_group.rg.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
  min_tls_version          = "TLS1_2"
  tags                     = local.common_tags
}

resource "azurerm_storage_container" "uploads" {
  name                  = "uploads"
  storage_account_name  = azurerm_storage_account.storage.name
  container_access_type = "private"
}

resource "azurerm_service_plan" "plan" {
  name                = "${local.name_prefix}-plan"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  os_type             = "Linux"
  sku_name            = var.app_service_sku
  tags                = local.common_tags
}

resource "azurerm_linux_web_app" "app" {
  name                = "${local.name_prefix}-app"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  service_plan_id     = azurerm_service_plan.plan.id
  tags                = local.common_tags

  site_config {
    always_on = true

    application_stack {
      docker_image_name        = var.docker_image
      docker_registry_url      = var.docker_registry_url
      docker_registry_username = var.docker_registry_username != "" ? var.docker_registry_username : null
      docker_registry_password = var.docker_registry_password != "" ? var.docker_registry_password : null
    }
  }

  app_settings = {
    FACILITYOS_DEPLOYMENT   = "hosted"
    FACILITYOS_DB_DRIVER    = "postgres"
    FACILITYOS_HOST         = "0.0.0.0"
    FACILITYOS_PORT         = "3847"
    WEBSITES_PORT           = "3847"
    FACILITYOS_PG_SSL       = "1"
    FACILITYOS_PUBLIC_URL   = local.public_url
    FACILITYOS_STORAGE      = "blob"
    FACILITYOS_AUTH_MODE    = "session"
    FACILITYOS_SESSION_SECRET = random_password.session.result
    FACILITYOS_DATABASE_URL = "postgresql://facilityos:${random_password.postgres.result}@${azurerm_postgresql_flexible_server.pg.fqdn}:5432/facilityos?sslmode=require"
    DOCKER_ENABLE_CI        = "true"
    # Phase 3 — blob uploads
    AZURE_STORAGE_CONNECTION_STRING = azurerm_storage_account.storage.primary_connection_string
    AZURE_STORAGE_CONTAINER         = azurerm_storage_container.uploads.name
  }

  logs {
    application_logs {
      file_system_level = "Information"
    }
    http_logs {
      file_system {
        retention_in_days = 7
        retention_in_mb   = 35
      }
    }
  }
}

# Custom domain: add in Azure Portal after DNS CNAME → default_hostname, or extend with azurerm_app_service_managed_certificate
