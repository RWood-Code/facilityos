-- FacilityOS Schema v3 — SQLite (WAL), multi-terminal ready

CREATE TABLE IF NOT EXISTS facility (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, location TEXT, is_active INTEGER DEFAULT 1, notes TEXT, created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pool (
  id TEXT PRIMARY KEY, facility_id TEXT, name TEXT NOT NULL, type TEXT DEFAULT 'pool',
  location TEXT, volume_litres REAL, temp_min REAL, temp_max REAL, max_patrons INTEGER,
  custom_limits TEXT, is_active INTEGER DEFAULT 1, sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS test_result (
  id TEXT PRIMARY KEY, pool_id TEXT NOT NULL, test_type TEXT DEFAULT 'routine',
  test_date TEXT NOT NULL, test_time TEXT, tested_by TEXT,
  ph REAL, free_chlorine REAL, total_available_chlorine REAL, combined_chlorine REAL,
  temperature REAL, total_alkalinity REAL, total_hardness REAL, tds REAL,
  turbidity REAL, cyanuric_acid REAL, is_compliant INTEGER,
  action_taken TEXT, notes TEXT, retest_required INTEGER DEFAULT 0,
  retest_completed INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pool_closure (
  id TEXT PRIMARY KEY, pool_id TEXT NOT NULL, reason TEXT NOT NULL,
  closed_at TEXT NOT NULL, reopened_at TEXT, closed_by TEXT, reopened_by TEXT,
  notes TEXT, created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS staff (
  id TEXT PRIMARY KEY, facility_id TEXT, first_name TEXT NOT NULL, last_name TEXT NOT NULL,
  email TEXT, phone TEXT, role TEXT DEFAULT 'lifeguard', status TEXT DEFAULT 'active',
  pin TEXT, nzrrp_number TEXT, nzrrp_expiry TEXT, notes TEXT,
  created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS qualification (
  id TEXT PRIMARY KEY, staff_id TEXT NOT NULL, qualification TEXT NOT NULL,
  issuer TEXT, issued_date TEXT, expiry_date TEXT, cert_number TEXT, notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS asset (
  id TEXT PRIMARY KEY, facility_id TEXT, name TEXT NOT NULL,
  asset_type TEXT DEFAULT 'other', category TEXT, location TEXT NOT NULL,
  manufacturer TEXT, model_number TEXT, serial_number TEXT,
  purchase_date TEXT, purchase_cost REAL, warranty_expiry TEXT,
  status TEXT DEFAULT 'operational', notes TEXT,
  created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS work_order (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT,
  asset_id TEXT, location TEXT NOT NULL, priority TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'open', assigned_to TEXT, due_date TEXT,
  completed_date TEXT, estimated_hours REAL, actual_hours REAL,
  parts_cost REAL, labor_cost REAL, completion_notes TEXT,
  created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS maintenance_schedule (
  id TEXT PRIMARY KEY, asset_id TEXT, task_name TEXT NOT NULL, description TEXT,
  frequency TEXT DEFAULT 'monthly', assigned_to TEXT, estimated_hours REAL,
  estimated_cost REAL, actual_cost REAL, category TEXT,
  last_completed TEXT, next_due TEXT, is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS steam_room_check (
  id TEXT PRIMARY KEY, pool_id TEXT NOT NULL, check_date TEXT NOT NULL,
  check_time TEXT, checked_by TEXT, temperature REAL, humidity REAL,
  patron_count INTEGER, is_clean INTEGER, towels_stocked INTEGER,
  notes TEXT, created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS setting (
  key TEXT PRIMARY KEY, value TEXT
);

-- Future modules (e.g. rostering) register rows here
CREATE TABLE IF NOT EXISTS module_registry (
  id TEXT PRIMARY KEY,
  module_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  enabled INTEGER DEFAULT 0,
  config TEXT,
  sort_order INTEGER DEFAULT 100,
  created_at TEXT DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO setting VALUES ('terminal_id','T1');
INSERT OR IGNORE INTO setting VALUES ('show_pools','1');
INSERT OR IGNORE INTO setting VALUES ('show_assets','1');
INSERT OR IGNORE INTO setting VALUES ('show_work_orders','1');
INSERT OR IGNORE INTO setting VALUES ('show_maintenance','1');
INSERT OR IGNORE INTO setting VALUES ('show_staff','1');
INSERT OR IGNORE INTO setting VALUES ('show_reports','1');
INSERT OR IGNORE INTO setting VALUES ('show_rostering','0');
INSERT OR IGNORE INTO setting VALUES ('data_mode','server');
INSERT OR IGNORE INTO setting VALUES ('facility_name','EA Networks Centre');

INSERT OR IGNORE INTO module_registry (id, module_key, label, enabled, sort_order) VALUES
  ('mod_core', 'core', 'Core Operations', 1, 0),
  ('mod_roster', 'rostering', 'Staff Rostering', 0, 10);

INSERT OR IGNORE INTO facility (id,name,location,is_active) VALUES ('fac1','EA Networks Centre','Ashburton, NZ',1);

INSERT OR IGNORE INTO pool (id,facility_id,name,type,volume_litres,sort_order) VALUES
  ('pool1','fac1','Main Pool','pool',1100000,1),
  ('pool2','fac1','Hydrotherapy Pool','pool',180000,2),
  ('pool3','fac1','Leisure Pool','pool',450000,3),
  ('pool4','fac1','Learners Pool','pool',120000,4),
  ('pool5','fac1','Spa Pool','spa',25000,5);

INSERT OR IGNORE INTO staff (id,facility_id,first_name,last_name,role,status,pin) VALUES
  ('staff1','fac1','Sarah','Johnson','supervisor','active','1234'),
  ('staff2','fac1','Mike','Roberts','lifeguard','active','2345'),
  ('staff3','fac1','Emma','Kowalski','admin_staff','active','3456'),
  ('staff4','fac1','James','Chen','lifeguard','active','4567'),
  ('staff5','fac1','Lauren','Brown','pool_technician','active','5678');

INSERT OR IGNORE INTO asset (id,facility_id,name,asset_type,category,location,status) VALUES
  ('asset1','fac1','Main Pool Pump A','pool_equipment','Pump','Plant Room','operational'),
  ('asset2','fac1','Main Pool Pump B','pool_equipment','Pump','Plant Room','operational'),
  ('asset3','fac1','Sand Filter #1','pool_equipment','Filter','Plant Room','operational'),
  ('asset4','fac1','Sand Filter #2','pool_equipment','Filter','Plant Room','needs_maintenance'),
  ('asset5','fac1','UV Disinfection Unit','pool_equipment','UV System','Plant Room','operational'),
  ('asset6','fac1','Treadmill 3','gym_equipment','Treadmill','Gym Floor','needs_maintenance'),
  ('asset7','fac1','Spa Pump','pool_equipment','Pump','Spa Plant Room','operational');

INSERT OR IGNORE INTO work_order (id,title,location,priority,status,asset_id,assigned_to,created_at) VALUES
  ('wo1','Sand Filter #2 — backwash overdue','Plant Room','medium','open','asset4','Mike Roberts',datetime('now','-2 days')),
  ('wo2','Treadmill 3 belt replacement','Gym Floor','high','in_progress','asset6','James Chen',datetime('now','-5 days')),
  ('wo3','Spa pump noise investigation','Spa Plant Room','high','open','asset7','Mike Roberts',datetime('now','-1 day'));

INSERT OR IGNORE INTO maintenance_schedule (id,asset_id,task_name,frequency,assigned_to,estimated_hours,next_due,is_active) VALUES
  ('ms1','asset1','Main Pool Pump A — monthly inspection','monthly','Mike Roberts',1.0,date('now','+5 days'),1),
  ('ms2','asset3','Sand Filter #1 — backwash','weekly','Mike Roberts',0.5,date('now','+2 days'),1),
  ('ms3','asset5','UV Unit lamp check','monthly','Mike Roberts',0.5,date('now','+12 days'),1),
  ('ms4',null,'Pool plant room general inspection','weekly','Mike Roberts',1.5,date('now','-1 day'),1);
