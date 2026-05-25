-- Migration 001: audit trail + backup policy defaults

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  actor TEXT,
  terminal_id TEXT,
  details TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);

INSERT OR IGNORE INTO setting (key, value) VALUES ('backup_auto_enabled', '1');
INSERT OR IGNORE INTO setting (key, value) VALUES ('backup_interval_hours', '24');
INSERT OR IGNORE INTO setting (key, value) VALUES ('backup_retention_count', '14');
