-- Migration 005: FacilityOS Cloud pairing placeholders (on-prem settings)

INSERT OR IGNORE INTO setting (key, value) VALUES ('cloud_enabled', '0');
INSERT OR IGNORE INTO setting (key, value) VALUES ('cloud_site_id', '');
INSERT OR IGNORE INTO setting (key, value) VALUES ('cloud_relay_url', 'https://relay.facilityos.nz');
INSERT OR IGNORE INTO setting (key, value) VALUES ('cloud_last_sync_at', '');
INSERT OR IGNORE INTO setting (key, value) VALUES ('cloud_pairing_code', '');

CREATE TABLE IF NOT EXISTS cloud_sync_outbox (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  op TEXT NOT NULL DEFAULT 'update',
  payload TEXT,
  updated_at TEXT DEFAULT (datetime('now')),
  synced_at TEXT,
  sync_error TEXT
);

CREATE INDEX IF NOT EXISTS idx_cloud_outbox_pending ON cloud_sync_outbox(synced_at, updated_at);
