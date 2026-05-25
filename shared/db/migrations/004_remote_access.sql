-- Migration 004: secure remote API access (token auth for non-LAN clients)

INSERT OR IGNORE INTO setting (key, value) VALUES ('remote_access_enabled', '0');
INSERT OR IGNORE INTO setting (key, value) VALUES ('remote_access_token', '');
