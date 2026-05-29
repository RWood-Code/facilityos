/** Allowed columns for dynamic UPDATE handlers — prevents SQL column injection. */

function buildUpdateSets(data, allowedColumns) {
  const allowed = allowedColumns instanceof Set ? allowedColumns : new Set(allowedColumns);
  const keys = Object.keys(data).filter((k) => allowed.has(k));
  if (!keys.length) return null;
  return {
    sets: keys.map((k) => `${k}=?`).join(','),
    values: keys.map((k) => data[k]),
  };
}

const POOL_UPDATE_COLS = new Set([
  'facility_id', 'name', 'type', 'location', 'volume_litres', 'max_patrons',
  'sort_order', 'custom_limits', 'temp_min', 'temp_max', 'is_active',
]);

const STAFF_UPDATE_COLS = new Set([
  'facility_id', 'first_name', 'last_name', 'email', 'phone', 'role', 'status',
  'pin', 'nzrrp_number', 'nzrrp_expiry', 'notes', 'employee_number',
  'default_pay_component_id', 'base_hourly_rate', 'employment_type',
]);

const QUALIFICATION_UPDATE_COLS = new Set([
  'staff_id', 'qualification', 'issuer', 'issued_date', 'expiry_date', 'cert_number', 'notes',
]);

const ASSET_UPDATE_COLS = new Set([
  'facility_id', 'name', 'asset_type', 'category', 'location', 'manufacturer',
  'model_number', 'serial_number', 'purchase_date', 'purchase_cost', 'warranty_expiry',
  'status', 'notes',
]);

const WORKORDER_UPDATE_COLS = new Set([
  'title', 'description', 'asset_id', 'location', 'priority', 'status', 'assigned_to',
  'due_date', 'estimated_hours', 'parts_cost', 'labor_cost', 'completed_date',
]);

const SCHEDULE_UPDATE_COLS = new Set([
  'asset_id', 'task_name', 'description', 'frequency', 'assigned_to', 'estimated_hours',
  'category', 'next_due', 'last_completed', 'is_active',
]);

const TIMESHEET_UPDATE_COLS = new Set([
  'staff_id', 'shift_id', 'work_date', 'hours', 'status', 'notes', 'pay_component_id', 'approved_by',
]);

module.exports = {
  buildUpdateSets,
  POOL_UPDATE_COLS,
  STAFF_UPDATE_COLS,
  QUALIFICATION_UPDATE_COLS,
  ASSET_UPDATE_COLS,
  WORKORDER_UPDATE_COLS,
  SCHEDULE_UPDATE_COLS,
  TIMESHEET_UPDATE_COLS,
};
