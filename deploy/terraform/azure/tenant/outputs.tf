output "resource_group" {
  value = azurerm_resource_group.rg.name
}

output "app_url" {
  description = "Default Azure App Service URL"
  value       = local.default_url
}

output "public_url" {
  description = "URL configured for FacilityOS (custom or default)"
  value       = local.public_url
}

output "health_url" {
  value = "${local.default_url}/api/health"
}

output "postgres_fqdn" {
  value = azurerm_postgresql_flexible_server.pg.fqdn
}

output "storage_account" {
  value = azurerm_storage_account.storage.name
}

output "site_slug" {
  value = var.site_slug
}

output "deployment_summary" {
  value = <<-EOT
    FacilityOS hosted tenant provisioned.

    App URL:     ${local.default_url}
    Public URL:  ${local.public_url}
    Health:      ${local.default_url}/api/health

    Next steps:
    1. Open ${local.default_url} and complete first-run / licence activation
    2. If using custom domain, point DNS CNAME to ${azurerm_linux_web_app.app.default_hostname}
    3. Configure SMTP_* app settings for email alerts (Azure Portal → App Service → Configuration)
  EOT
}
