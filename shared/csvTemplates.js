/** CSV import/export column definitions per module */
const CSV_MODULES = {
  pools: {
    label: 'Pools',
    licenceKey: 'pools',
    headers: ['name', 'type', 'location', 'volume_litres', 'max_patrons', 'temp_min', 'temp_max', 'sort_order'],
    required: ['name'],
    example: ['Main Pool', 'pool', 'Indoor', '1100000', '200', '26', '30', '1'],
  },
  staff: {
    label: 'Staff',
    licenceKey: 'staff',
    headers: ['first_name', 'last_name', 'email', 'phone', 'role', 'status', 'pin', 'employee_number', 'nzrrp_number', 'nzrrp_expiry'],
    required: ['first_name', 'last_name'],
    example: ['Alex', 'Smith', 'alex@example.com', '', 'lifeguard', 'active', '1234', 'E001', '', ''],
  },
  assets: {
    label: 'Assets',
    licenceKey: 'assets',
    headers: ['name', 'asset_type', 'category', 'location', 'manufacturer', 'model_number', 'serial_number', 'status', 'purchase_date', 'notes'],
    required: ['name', 'location'],
    example: ['Main Pool Pump', 'pool_equipment', 'Pump', 'Plant Room', 'Grundfos', '', '', 'operational', '2020-01-15', ''],
  },
  workorders: {
    label: 'Work orders',
    licenceKey: 'workorders',
    headers: ['title', 'description', 'location', 'priority', 'status', 'asset_name', 'assigned_to', 'due_date'],
    required: ['title', 'location'],
    example: ['Filter backwash', 'Scheduled backwash', 'Plant Room', 'medium', 'open', 'Sand Filter #1', '', '2026-06-01'],
  },
  schedules: {
    label: 'Maintenance schedules',
    licenceKey: 'schedules',
    headers: ['task_name', 'description', 'frequency', 'category', 'asset_name', 'assigned_to', 'estimated_hours', 'next_due'],
    required: ['task_name'],
    example: ['Pump inspection', 'Monthly visual check', 'monthly', 'Inspection', 'Main Pool Pump A', '', '1.0', '2026-06-15'],
  },
  tests: {
    label: 'Water tests',
    licenceKey: 'pools',
    headers: ['pool_name', 'test_date', 'test_time', 'tested_by', 'ph', 'free_chlorine', 'total_available_chlorine', 'combined_chlorine', 'temperature', 'is_compliant', 'notes'],
    required: ['pool_name', 'test_date'],
    example: ['Main Pool', '2026-05-29', '08:00', 'Wood Master', '7.4', '1.2', '1.5', '0.3', '28.5', '1', ''],
  },
  closures: {
    label: 'Pool closures',
    licenceKey: 'pools',
    headers: ['pool_name', 'reason', 'closed_at', 'closed_by', 'notes'],
    required: ['pool_name', 'reason'],
    example: ['Main Pool', 'Contamination event', '2026-05-29T10:00:00', 'Wood Master', 'Superchlorination'],
  },
  steamchecks: {
    label: 'Steam room checks',
    licenceKey: 'steam',
    headers: ['pool_name', 'check_date', 'check_time', 'checked_by', 'temperature', 'humidity', 'patron_count', 'is_clean', 'towels_stocked', 'notes'],
    required: ['pool_name', 'check_date'],
    example: ['Spa Pool', '2026-05-29', '09:00', 'Wood Master', '42', '100', '3', '1', '1', ''],
  },
};

function csvEscape(v) {
  const s = v == null ? '' : String(v);
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
}

function templateCsv(moduleKey) {
  const mod = CSV_MODULES[moduleKey];
  if (!mod) throw new Error(`Unknown module: ${moduleKey}`);
  const lines = [mod.headers.join(',')];
  if (mod.example?.length) {
    lines.push(mod.headers.map((_, i) => csvEscape(mod.example[i] ?? '')).join(','));
  }
  return {
    csv: lines.join('\n'),
    filename: `${moduleKey}-import-template.csv`,
    headers: mod.headers,
  };
}

module.exports = {
  CSV_MODULES,
  csvEscape,
  templateCsv,
};
