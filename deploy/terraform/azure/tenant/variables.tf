variable "site_slug" {
  description = "Short site identifier (e.g. eac, methven) — used in resource names and default hostname"
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9-]{2,32}$", var.site_slug))
    error_message = "site_slug must be 2-32 lowercase letters, numbers, or hyphens."
  }
}

variable "location" {
  description = "Azure region (australiaeast recommended for NZ customers)"
  type        = string
  default     = "australiaeast"
}

variable "environment" {
  description = "Environment label (staging, prod)"
  type        = string
  default     = "prod"
}

variable "docker_image" {
  description = "Container image (e.g. ghcr.io/org/facilityos:1.7.0)"
  type        = string
}

variable "docker_registry_url" {
  description = "Registry URL (https://ghcr.io or https://<acr>.azurecr.io)"
  type        = string
  default     = "https://ghcr.io"
}

variable "docker_registry_username" {
  description = "Registry username (optional for public images)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "docker_registry_password" {
  description = "Registry password or PAT (optional for public images)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "custom_domain" {
  description = "Optional custom domain (e.g. eac.facilityos.app) — configure DNS separately"
  type        = string
  default     = ""
}

variable "postgres_sku" {
  description = "PostgreSQL Flexible Server SKU"
  type        = string
  default     = "B_Standard_B1ms"
}

variable "app_service_sku" {
  description = "App Service Plan SKU"
  type        = string
  default     = "B1"
}

variable "facilityos_public_url" {
  description = "Public URL shown to customers (defaults to azurewebsites.net if custom_domain empty)"
  type        = string
  default     = ""
}

variable "tags" {
  description = "Additional resource tags"
  type        = map(string)
  default     = {}
}
