-- FacilityOS v4 extensions (safe to re-run)

CREATE TABLE IF NOT EXISTS licence (
  id TEXT PRIMARY KEY,
  licence_key TEXT UNIQUE NOT NULL,
  organisation TEXT,
  plan TEXT DEFAULT 'standard',
  issued_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  max_terminals INTEGER DEFAULT 10,
  max_staff INTEGER DEFAULT 200,
  is_active INTEGER DEFAULT 1,
  notes TEXT,
  last_validated TEXT
);

CREATE TABLE IF NOT EXISTS saved_report (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  report_type TEXT NOT NULL,
  config TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS roster_location (
  id TEXT PRIMARY KEY, facility_id TEXT, name TEXT NOT NULL,
  description TEXT, sort_order INTEGER DEFAULT 0, is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS roster_role (
  id TEXT PRIMARY KEY, facility_id TEXT, name TEXT NOT NULL,
  staff_role TEXT, color TEXT DEFAULT '#0891b2', is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS roster_shift (
  id TEXT PRIMARY KEY, facility_id TEXT, location_id TEXT, role_id TEXT,
  shift_date TEXT NOT NULL, start_time TEXT NOT NULL, end_time TEXT NOT NULL,
  break_minutes INTEGER DEFAULT 0, notes TEXT,
  status TEXT DEFAULT 'draft',
  is_open INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS roster_assignment (
  id TEXT PRIMARY KEY, shift_id TEXT NOT NULL, staff_id TEXT NOT NULL,
  status TEXT DEFAULT 'assigned',
  clock_in TEXT, clock_out TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS roster_unavailability (
  id TEXT PRIMARY KEY, staff_id TEXT NOT NULL,
  start_date TEXT NOT NULL, end_date TEXT NOT NULL,
  reason TEXT, all_day INTEGER DEFAULT 1,
  start_time TEXT, end_time TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS roster_leave (
  id TEXT PRIMARY KEY, staff_id TEXT NOT NULL,
  leave_type TEXT DEFAULT 'annual',
  start_date TEXT NOT NULL, end_date TEXT NOT NULL,
  hours REAL, status TEXT DEFAULT 'pending',
  notes TEXT, reviewed_by TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS roster_shift_offer (
  id TEXT PRIMARY KEY, shift_id TEXT NOT NULL,
  from_staff_id TEXT, to_staff_id TEXT,
  status TEXT DEFAULT 'pending',
  message TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS timesheet_entry (
  id TEXT PRIMARY KEY, staff_id TEXT NOT NULL, shift_id TEXT,
  work_date TEXT NOT NULL, hours REAL NOT NULL,
  status TEXT DEFAULT 'draft', notes TEXT,
  approved_by TEXT, created_at TEXT DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO setting VALUES ('show_dosing','1');
INSERT OR IGNORE INTO setting VALUES ('show_steam','1');
INSERT OR IGNORE INTO setting VALUES ('show_closures','1');
INSERT OR IGNORE INTO setting VALUES ('show_rostering','1');
INSERT OR IGNORE INTO setting VALUES ('licence_grace_days','7');

INSERT OR IGNORE INTO licence (id,licence_key,organisation,plan,expires_at,max_terminals,is_active) VALUES
  ('lic1','FACILITYOS-TRIAL-EVAL','Evaluation','trial',datetime('now','+7 days'),5,1);

INSERT OR IGNORE INTO module_registry (id,module_key,label,enabled,sort_order) VALUES
  ('mod_dosing','dosing','Dosing Calculator',1,5),
  ('mod_steam','steam','Steam & Sauna',1,6),
  ('mod_closures','closures','Pool Closures',1,7);

UPDATE module_registry SET enabled=1, label='Staff Rostering (Beta)' WHERE module_key='rostering';

INSERT OR IGNORE INTO roster_location (id,facility_id,name,sort_order) VALUES
  ('rloc1','fac1','Main Pool Deck',1),
  ('rloc2','fac1','Learners / Leisure',2),
  ('rloc3','fac1','Plant Room',3),
  ('rloc4','fac1','Reception',4),
  ('rloc5','fac1','Gym Floor',5);

INSERT OR IGNORE INTO roster_role (id,facility_id,name,staff_role,color) VALUES
  ('rrole1','fac1','Pool Lifeguard','lifeguard','#0891b2'),
  ('rrole2','fac1','Duty Supervisor','supervisor','#7c3aed'),
  ('rrole3','fac1','Pool Technician','pool_technician','#059669'),
  ('rrole4','fac1','Customer Service','admin_staff','#d97706');
