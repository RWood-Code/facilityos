# PostgreSQL TLS CA bundle

When `FACILITYOS_PG_SSL=1`, FacilityOS verifies the server certificate using a CA bundle at:

`deploy/certs/DigiCertGlobalRootG2.crt.pem`

Download (Azure Database for PostgreSQL Flexible Server):

https://cacerts.digicert.com/DigiCertGlobalRootG2.crt.pem

Save to this path, or set `FACILITYOS_PG_CA_PATH` to your copy.

Without the CA file, the server logs a warning and falls back to `rejectUnauthorized: false` (not recommended for production).
