-- v1.5: ILTP/PoolSafe, notifications, maintenance budget, staff training records

CREATE TABLE IF NOT EXISTS notification (
  id TEXT PRIMARY KEY,
  user_ref TEXT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  related_id TEXT,
  link_module TEXT,
  is_read INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS maintenance_budget (
  id TEXT PRIMARY KEY,
  facility_id TEXT,
  period_label TEXT NOT NULL,
  year INTEGER,
  budget_amount REAL NOT NULL,
  category TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS iltp_document (
  id TEXT PRIMARY KEY,
  facility_id TEXT,
  document_name TEXT NOT NULL,
  document_type TEXT DEFAULT 'training_manual',
  upload_date TEXT NOT NULL,
  expiry_date TEXT,
  description TEXT,
  notes TEXT,
  attachments TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS poolsafe_audit (
  id TEXT PRIMARY KEY,
  facility_id TEXT,
  audit_date TEXT NOT NULL,
  audit_type TEXT DEFAULT 'annual_inspection',
  auditor TEXT,
  status TEXT DEFAULT 'pending',
  summary TEXT,
  notes TEXT,
  attachments TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS poolsafe_document (
  id TEXT PRIMARY KEY,
  facility_id TEXT,
  document_name TEXT NOT NULL,
  category TEXT DEFAULT 'policy',
  version TEXT DEFAULT '1.0',
  upload_date TEXT NOT NULL,
  effective_date TEXT,
  review_date TEXT,
  supersedes_id TEXT,
  is_current INTEGER DEFAULT 1,
  description TEXT,
  change_summary TEXT,
  notes TEXT,
  attachments TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS staff_training_record (
  id TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL,
  training_name TEXT NOT NULL,
  training_type TEXT DEFAULT 'internal',
  completed_date TEXT,
  expiry_date TEXT,
  provider TEXT,
  cert_number TEXT,
  notes TEXT,
  attachments TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO setting (key, value) VALUES ('show_iltp_poolsafe', '1');
INSERT OR IGNORE INTO setting (key, value) VALUES ('iltp_poolsafe', '1');

INSERT OR IGNORE INTO module_registry (id, module_key, label, enabled, sort_order) VALUES
  ('mod_iltp', 'iltp_poolsafe', 'ILTP & PoolSafe', 1, 15);
