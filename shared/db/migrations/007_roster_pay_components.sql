-- Pay components and roster pay fields (FacilityOS rostering enhancement)

CREATE TABLE IF NOT EXISTS pay_component (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'earning',
  default_rate REAL DEFAULT 0,
  rate_multiplier REAL DEFAULT 1,
  export_code TEXT,
  is_active INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0
);

ALTER TABLE roster_shift ADD COLUMN pay_component_id TEXT;
ALTER TABLE roster_shift ADD COLUMN headcount INTEGER DEFAULT 1;

ALTER TABLE roster_role ADD COLUMN default_pay_component_id TEXT;

ALTER TABLE staff ADD COLUMN employee_number TEXT;
ALTER TABLE staff ADD COLUMN default_pay_component_id TEXT;
ALTER TABLE staff ADD COLUMN base_hourly_rate REAL;
ALTER TABLE staff ADD COLUMN employment_type TEXT DEFAULT 'casual';

ALTER TABLE roster_assignment ADD COLUMN pay_component_id TEXT;

ALTER TABLE timesheet_entry ADD COLUMN pay_component_id TEXT;

INSERT OR IGNORE INTO pay_component (id, code, name, category, default_rate, rate_multiplier, export_code, sort_order) VALUES
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
  ('pc_train', 'TRAIN', 'Training (unpaid)', 'allowance', 0, 0, 'TRAIN', 11);

UPDATE roster_role SET default_pay_component_id='pc_ord' WHERE id='rrole1' AND default_pay_component_id IS NULL;
UPDATE roster_role SET default_pay_component_id='pc_ord' WHERE id='rrole2' AND default_pay_component_id IS NULL;
UPDATE roster_role SET default_pay_component_id='pc_ord' WHERE id='rrole3' AND default_pay_component_id IS NULL;
UPDATE roster_role SET default_pay_component_id='pc_ord' WHERE id='rrole4' AND default_pay_component_id IS NULL;
