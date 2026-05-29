-- FacilityOS PostgreSQL schema — hosted deployment (Phase 1)
-- Mirrors SQLite schema + migrations for channel API compatibility.

CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at TEXT DEFAULT (NOW()::TEXT),
  description TEXT
);

CREATE TABLE IF NOT EXISTS facility (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT,
  is_active INTEGER DEFAULT 1,
  notes TEXT,
  created_at TEXT DEFAULT (NOW()::TEXT)
);

CREATE TABLE IF NOT EXISTS pool (
  id TEXT PRIMARY KEY,
  facility_id TEXT,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'pool',
  location TEXT,
  volume_litres DOUBLE PRECISION,
  temp_min DOUBLE PRECISION,
  temp_max DOUBLE PRECISION,
  max_patrons INTEGER,
  custom_limits TEXT,
  is_active INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (NOW()::TEXT)
);

CREATE TABLE IF NOT EXISTS test_result (
  id TEXT PRIMARY KEY,
  pool_id TEXT NOT NULL,
  test_type TEXT DEFAULT 'routine',
  test_date TEXT NOT NULL,
  test_time TEXT,
  tested_by TEXT,
  ph DOUBLE PRECISION,
  free_chlorine DOUBLE PRECISION,
  total_available_chlorine DOUBLE PRECISION,
  combined_chlorine DOUBLE PRECISION,
  temperature DOUBLE PRECISION,
  total_alkalinity DOUBLE PRECISION,
  total_hardness DOUBLE PRECISION,
  tds DOUBLE PRECISION,
  turbidity DOUBLE PRECISION,
  cyanuric_acid DOUBLE PRECISION,
  is_compliant INTEGER,
  action_taken TEXT,
  notes TEXT,
  retest_required INTEGER DEFAULT 0,
  retest_completed INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (NOW()::TEXT)
);

CREATE TABLE IF NOT EXISTS pool_closure (
  id TEXT PRIMARY KEY,
  pool_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  closed_at TEXT NOT NULL,
  reopened_at TEXT,
  closed_by TEXT,
  reopened_by TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (NOW()::TEXT)
);

CREATE TABLE IF NOT EXISTS staff (
  id TEXT PRIMARY KEY,
  facility_id TEXT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role TEXT DEFAULT 'lifeguard',
  status TEXT DEFAULT 'active',
  pin TEXT,
  nzrrp_number TEXT,
  nzrrp_expiry TEXT,
  notes TEXT,
  employee_number TEXT,
  default_pay_component_id TEXT,
  base_hourly_rate DOUBLE PRECISION,
  employment_type TEXT DEFAULT 'casual',
  created_at TEXT DEFAULT (NOW()::TEXT),
  updated_at TEXT DEFAULT (NOW()::TEXT)
);

CREATE TABLE IF NOT EXISTS qualification (
  id TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL,
  qualification TEXT NOT NULL,
  issuer TEXT,
  issued_date TEXT,
  expiry_date TEXT,
  cert_number TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (NOW()::TEXT)
);

CREATE TABLE IF NOT EXISTS asset (
  id TEXT PRIMARY KEY,
  facility_id TEXT,
  name TEXT NOT NULL,
  asset_type TEXT DEFAULT 'other',
  category TEXT,
  location TEXT NOT NULL,
  manufacturer TEXT,
  model_number TEXT,
  serial_number TEXT,
  purchase_date TEXT,
  purchase_cost DOUBLE PRECISION,
  warranty_expiry TEXT,
  status TEXT DEFAULT 'operational',
  notes TEXT,
  created_at TEXT DEFAULT (NOW()::TEXT),
  updated_at TEXT DEFAULT (NOW()::TEXT)
);

CREATE TABLE IF NOT EXISTS work_order (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  asset_id TEXT,
  location TEXT NOT NULL,
  priority TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'open',
  assigned_to TEXT,
  due_date TEXT,
  completed_date TEXT,
  estimated_hours DOUBLE PRECISION,
  actual_hours DOUBLE PRECISION,
  parts_cost DOUBLE PRECISION,
  labor_cost DOUBLE PRECISION,
  completion_notes TEXT,
  created_at TEXT DEFAULT (NOW()::TEXT),
  updated_at TEXT DEFAULT (NOW()::TEXT)
);

CREATE TABLE IF NOT EXISTS maintenance_schedule (
  id TEXT PRIMARY KEY,
  asset_id TEXT,
  task_name TEXT NOT NULL,
  description TEXT,
  frequency TEXT DEFAULT 'monthly',
  assigned_to TEXT,
  estimated_hours DOUBLE PRECISION,
  estimated_cost DOUBLE PRECISION,
  actual_cost DOUBLE PRECISION,
  category TEXT,
  last_completed TEXT,
  next_due TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (NOW()::TEXT)
);

CREATE TABLE IF NOT EXISTS steam_room_check (
  id TEXT PRIMARY KEY,
  pool_id TEXT NOT NULL,
  check_date TEXT NOT NULL,
  check_time TEXT,
  checked_by TEXT,
  temperature DOUBLE PRECISION,
  humidity DOUBLE PRECISION,
  patron_count INTEGER,
  is_clean INTEGER,
  towels_stocked INTEGER,
  notes TEXT,
  created_at TEXT DEFAULT (NOW()::TEXT)
);

CREATE TABLE IF NOT EXISTS setting (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS module_registry (
  id TEXT PRIMARY KEY,
  module_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  enabled INTEGER DEFAULT 0,
  config TEXT,
  sort_order INTEGER DEFAULT 100,
  created_at TEXT DEFAULT (NOW()::TEXT)
);

CREATE TABLE IF NOT EXISTS licence (
  id TEXT PRIMARY KEY,
  licence_key TEXT UNIQUE NOT NULL,
  organisation TEXT,
  plan TEXT DEFAULT 'standard',
  issued_at TEXT DEFAULT (NOW()::TEXT),
  expires_at TEXT NOT NULL,
  max_terminals INTEGER DEFAULT 10,
  max_staff INTEGER DEFAULT 200,
  is_active INTEGER DEFAULT 1,
  notes TEXT,
  last_validated TEXT,
  features TEXT
);

CREATE TABLE IF NOT EXISTS saved_report (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  report_type TEXT NOT NULL,
  config TEXT,
  created_at TEXT DEFAULT (NOW()::TEXT)
);

CREATE TABLE IF NOT EXISTS roster_location (
  id TEXT PRIMARY KEY,
  facility_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS roster_role (
  id TEXT PRIMARY KEY,
  facility_id TEXT,
  name TEXT NOT NULL,
  staff_role TEXT,
  color TEXT DEFAULT '#0891b2',
  is_active INTEGER DEFAULT 1,
  default_pay_component_id TEXT
);

CREATE TABLE IF NOT EXISTS roster_shift (
  id TEXT PRIMARY KEY,
  facility_id TEXT,
  location_id TEXT,
  role_id TEXT,
  shift_date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  break_minutes INTEGER DEFAULT 0,
  notes TEXT,
  status TEXT DEFAULT 'draft',
  is_open INTEGER DEFAULT 0,
  pay_component_id TEXT,
  headcount INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (NOW()::TEXT)
);

CREATE TABLE IF NOT EXISTS roster_assignment (
  id TEXT PRIMARY KEY,
  shift_id TEXT NOT NULL,
  staff_id TEXT NOT NULL,
  status TEXT DEFAULT 'assigned',
  clock_in TEXT,
  clock_out TEXT,
  pay_rate DOUBLE PRECISION,
  pay_type TEXT DEFAULT 'hourly',
  pay_component_id TEXT,
  created_at TEXT DEFAULT (NOW()::TEXT)
);

CREATE TABLE IF NOT EXISTS roster_unavailability (
  id TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  reason TEXT,
  all_day INTEGER DEFAULT 1,
  start_time TEXT,
  end_time TEXT,
  created_at TEXT DEFAULT (NOW()::TEXT)
);

CREATE TABLE IF NOT EXISTS roster_leave (
  id TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL,
  leave_type TEXT DEFAULT 'annual',
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  hours DOUBLE PRECISION,
  status TEXT DEFAULT 'pending',
  notes TEXT,
  reviewed_by TEXT,
  created_at TEXT DEFAULT (NOW()::TEXT)
);

CREATE TABLE IF NOT EXISTS roster_shift_offer (
  id TEXT PRIMARY KEY,
  shift_id TEXT NOT NULL,
  from_staff_id TEXT,
  to_staff_id TEXT,
  status TEXT DEFAULT 'pending',
  message TEXT,
  created_at TEXT DEFAULT (NOW()::TEXT)
);

CREATE TABLE IF NOT EXISTS timesheet_entry (
  id TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL,
  shift_id TEXT,
  work_date TEXT NOT NULL,
  hours DOUBLE PRECISION NOT NULL,
  status TEXT DEFAULT 'draft',
  notes TEXT,
  approved_by TEXT,
  pay_component_id TEXT,
  created_at TEXT DEFAULT (NOW()::TEXT)
);

CREATE TABLE IF NOT EXISTS pay_component (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'earning',
  default_rate DOUBLE PRECISION DEFAULT 0,
  rate_multiplier DOUBLE PRECISION DEFAULT 1,
  export_code TEXT,
  is_active INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  actor TEXT,
  terminal_id TEXT,
  details TEXT,
  created_at TEXT DEFAULT (NOW()::TEXT)
);

CREATE TABLE IF NOT EXISTS cloud_sync_outbox (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  op TEXT NOT NULL DEFAULT 'update',
  payload TEXT,
  updated_at TEXT DEFAULT (NOW()::TEXT),
  synced_at TEXT,
  sync_error TEXT
);

CREATE TABLE IF NOT EXISTS notification (
  id TEXT PRIMARY KEY,
  user_ref TEXT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  related_id TEXT,
  link_module TEXT,
  is_read INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (NOW()::TEXT)
);

CREATE TABLE IF NOT EXISTS maintenance_budget (
  id TEXT PRIMARY KEY,
  facility_id TEXT,
  period_label TEXT NOT NULL,
  year INTEGER,
  budget_amount DOUBLE PRECISION NOT NULL,
  category TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (NOW()::TEXT),
  updated_at TEXT DEFAULT (NOW()::TEXT)
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
  created_at TEXT DEFAULT (NOW()::TEXT),
  updated_at TEXT DEFAULT (NOW()::TEXT)
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
  created_at TEXT DEFAULT (NOW()::TEXT),
  updated_at TEXT DEFAULT (NOW()::TEXT)
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
  created_at TEXT DEFAULT (NOW()::TEXT),
  updated_at TEXT DEFAULT (NOW()::TEXT)
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
  created_at TEXT DEFAULT (NOW()::TEXT),
  updated_at TEXT DEFAULT (NOW()::TEXT)
);

CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_cloud_outbox_pending ON cloud_sync_outbox(synced_at, updated_at);

-- Seed data (idempotent)
INSERT INTO setting (key, value) VALUES ('terminal_id','T1') ON CONFLICT (key) DO NOTHING;
INSERT INTO setting (key, value) VALUES ('show_pools','1') ON CONFLICT (key) DO NOTHING;
INSERT INTO setting (key, value) VALUES ('show_assets','1') ON CONFLICT (key) DO NOTHING;
INSERT INTO setting (key, value) VALUES ('show_work_orders','1') ON CONFLICT (key) DO NOTHING;
INSERT INTO setting (key, value) VALUES ('show_maintenance','1') ON CONFLICT (key) DO NOTHING;
INSERT INTO setting (key, value) VALUES ('show_staff','1') ON CONFLICT (key) DO NOTHING;
INSERT INTO setting (key, value) VALUES ('show_reports','1') ON CONFLICT (key) DO NOTHING;
INSERT INTO setting (key, value) VALUES ('show_rostering','0') ON CONFLICT (key) DO NOTHING;
INSERT INTO setting (key, value) VALUES ('data_mode','server') ON CONFLICT (key) DO NOTHING;
INSERT INTO setting (key, value) VALUES ('facility_name','Demo Aquatic Centre') ON CONFLICT (key) DO NOTHING;
INSERT INTO setting (key, value) VALUES ('show_dosing','1') ON CONFLICT (key) DO NOTHING;
INSERT INTO setting (key, value) VALUES ('show_steam','1') ON CONFLICT (key) DO NOTHING;
INSERT INTO setting (key, value) VALUES ('show_closures','1') ON CONFLICT (key) DO NOTHING;
INSERT INTO setting (key, value) VALUES ('show_rostering','1') ON CONFLICT (key) DO NOTHING;
INSERT INTO setting (key, value) VALUES ('licence_grace_days','7') ON CONFLICT (key) DO NOTHING;
INSERT INTO setting (key, value) VALUES ('show_manager_dashboard','0') ON CONFLICT (key) DO NOTHING;
INSERT INTO setting (key, value) VALUES ('backup_auto_enabled','1') ON CONFLICT (key) DO NOTHING;
INSERT INTO setting (key, value) VALUES ('backup_interval_hours','24') ON CONFLICT (key) DO NOTHING;
INSERT INTO setting (key, value) VALUES ('backup_retention_count','14') ON CONFLICT (key) DO NOTHING;
INSERT INTO setting (key, value) VALUES ('remote_access_enabled','0') ON CONFLICT (key) DO NOTHING;
INSERT INTO setting (key, value) VALUES ('remote_access_token','') ON CONFLICT (key) DO NOTHING;
INSERT INTO setting (key, value) VALUES ('cloud_enabled','0') ON CONFLICT (key) DO NOTHING;
INSERT INTO setting (key, value) VALUES ('cloud_site_id','') ON CONFLICT (key) DO NOTHING;
INSERT INTO setting (key, value) VALUES ('cloud_relay_url','https://relay.facilityos.nz') ON CONFLICT (key) DO NOTHING;
INSERT INTO setting (key, value) VALUES ('cloud_last_sync_at','') ON CONFLICT (key) DO NOTHING;
INSERT INTO setting (key, value) VALUES ('cloud_pairing_code','') ON CONFLICT (key) DO NOTHING;
INSERT INTO setting (key, value) VALUES ('cloud_agent_key','') ON CONFLICT (key) DO NOTHING;
INSERT INTO setting (key, value) VALUES ('show_iltp_poolsafe','1') ON CONFLICT (key) DO NOTHING;
INSERT INTO setting (key, value) VALUES ('iltp_poolsafe','1') ON CONFLICT (key) DO NOTHING;

INSERT INTO module_registry (id, module_key, label, enabled, sort_order) VALUES
  ('mod_core', 'core', 'Core Operations', 1, 0),
  ('mod_roster', 'rostering', 'Staff Rostering (Beta)', 1, 10),
  ('mod_dosing', 'dosing', 'Dosing Calculator', 1, 5),
  ('mod_steam', 'steam', 'Steam & Sauna', 1, 6),
  ('mod_closures', 'closures', 'Pool Closures', 1, 7),
  ('mod_iltp', 'iltp_poolsafe', 'ILTP & PoolSafe', 1, 15)
ON CONFLICT (id) DO NOTHING;

INSERT INTO facility (id, name, location, is_active) VALUES ('fac1','Demo Aquatic Centre','New Zealand',1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO pool (id, facility_id, name, type, volume_litres, sort_order) VALUES
  ('pool1','fac1','Main Pool','pool',1100000,1),
  ('pool2','fac1','Hydrotherapy Pool','pool',180000,2),
  ('pool3','fac1','Leisure Pool','pool',450000,3),
  ('pool4','fac1','Learners Pool','pool',120000,4),
  ('pool5','fac1','Spa Pool','spa',25000,5)
ON CONFLICT (id) DO NOTHING;

INSERT INTO staff (id, facility_id, first_name, last_name, role, status, pin) VALUES
  ('staff1','fac1','Sarah','Johnson','supervisor','active','1234'),
  ('staff2','fac1','Mike','Roberts','lifeguard','active','2345'),
  ('staff3','fac1','Emma','Kowalski','admin_staff','active','3456'),
  ('staff4','fac1','James','Chen','lifeguard','active','4567'),
  ('staff5','fac1','Lauren','Brown','pool_technician','active','5678')
ON CONFLICT (id) DO NOTHING;

INSERT INTO asset (id, facility_id, name, asset_type, category, location, status) VALUES
  ('asset1','fac1','Main Pool Pump A','pool_equipment','Pump','Plant Room','operational'),
  ('asset2','fac1','Main Pool Pump B','pool_equipment','Pump','Plant Room','operational'),
  ('asset3','fac1','Sand Filter #1','pool_equipment','Filter','Plant Room','operational'),
  ('asset4','fac1','Sand Filter #2','pool_equipment','Filter','Plant Room','needs_maintenance'),
  ('asset5','fac1','UV Disinfection Unit','pool_equipment','UV System','Plant Room','operational'),
  ('asset6','fac1','Treadmill 3','gym_equipment','Treadmill','Gym Floor','needs_maintenance'),
  ('asset7','fac1','Spa Pump','pool_equipment','Pump','Spa Plant Room','operational')
ON CONFLICT (id) DO NOTHING;

INSERT INTO work_order (id, title, location, priority, status, asset_id, assigned_to, created_at) VALUES
  ('wo1','Sand Filter #2 — backwash overdue','Plant Room','medium','open','asset4','Mike Roberts',(NOW() - INTERVAL '2 days')::TEXT),
  ('wo2','Treadmill 3 belt replacement','Gym Floor','high','in_progress','asset6','James Chen',(NOW() - INTERVAL '5 days')::TEXT),
  ('wo3','Spa pump noise investigation','Spa Plant Room','high','open','asset7','Mike Roberts',(NOW() - INTERVAL '1 day')::TEXT)
ON CONFLICT (id) DO NOTHING;

INSERT INTO maintenance_schedule (id, asset_id, task_name, frequency, assigned_to, estimated_hours, next_due, is_active) VALUES
  ('ms1','asset1','Main Pool Pump A — monthly inspection','monthly','Mike Roberts',1.0,(CURRENT_DATE + INTERVAL '5 days')::TEXT,1),
  ('ms2','asset3','Sand Filter #1 — backwash','weekly','Mike Roberts',0.5,(CURRENT_DATE + INTERVAL '2 days')::TEXT,1),
  ('ms3','asset5','UV Unit lamp check','monthly','Mike Roberts',0.5,(CURRENT_DATE + INTERVAL '12 days')::TEXT,1),
  ('ms4',NULL,'Pool plant room general inspection','weekly','Mike Roberts',1.5,(CURRENT_DATE - INTERVAL '1 day')::TEXT,1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO licence (id, licence_key, organisation, plan, expires_at, max_terminals, is_active) VALUES
  ('lic1','FACILITYOS-TRIAL-EVAL','Evaluation','trial',(NOW() + INTERVAL '7 days')::TEXT,5,1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO roster_location (id, facility_id, name, sort_order) VALUES
  ('rloc1','fac1','Main Pool Deck',1),
  ('rloc2','fac1','Learners / Leisure',2),
  ('rloc3','fac1','Plant Room',3),
  ('rloc4','fac1','Reception',4),
  ('rloc5','fac1','Gym Floor',5)
ON CONFLICT (id) DO NOTHING;

INSERT INTO roster_role (id, facility_id, name, staff_role, color, default_pay_component_id) VALUES
  ('rrole1','fac1','Pool Lifeguard','lifeguard','#0891b2','pc_ord'),
  ('rrole2','fac1','Duty Supervisor','supervisor','#7c3aed','pc_ord'),
  ('rrole3','fac1','Pool Technician','pool_technician','#059669','pc_ord'),
  ('rrole4','fac1','Customer Service','admin_staff','#d97706','pc_ord')
ON CONFLICT (id) DO NOTHING;

INSERT INTO pay_component (id, code, name, category, default_rate, rate_multiplier, export_code, sort_order) VALUES
  ('pc_ord', 'ORD', 'Ordinary hours', 'earning', 0, 1, 'ORD', 1),
  ('pc_sat', 'SAT', 'Saturday', 'earning', 0, 1.5, 'SAT150', 2),
  ('pc_sun', 'SUN', 'Sunday', 'earning', 0, 2, 'SUN200', 3),
  ('pc_ph', 'PH', 'Public holiday', 'earning', 0, 2, 'PH200', 4),
  ('pc_ot150', 'OT150', 'Overtime 1.5x', 'earning', 0, 1.5, 'OT150', 5),
  ('pc_ot200', 'OT200', 'Overtime 2x', 'earning', 0, 2, 'OT200', 6),
  ('pc_al', 'AL', 'Annual leave', 'leave', 0, 1, 'AL', 7),
  ('pc_sick', 'SICK', 'Sick leave', 'leave', 0, 1, 'SICK', 8),
  ('pc_lwop', 'LWOP', 'Leave without pay', 'leave', 0, 0, 'LWOP', 9),
  ('pc_meet', 'MEET', 'Meeting / training paid', 'earning', 0, 1, 'MEET', 10),
  ('pc_train', 'TRAIN', 'Training (unpaid)', 'allowance', 0, 0, 'TRAIN', 11)
ON CONFLICT (id) DO NOTHING;

INSERT INTO schema_version (version, description) VALUES (9, '009_v15_base44_features')
ON CONFLICT (version) DO NOTHING;
