/**
 * SQL dialect helpers — single source for SQLite vs PostgreSQL differences.
 */

function convertPlaceholders(sql, dialect) {
  if (dialect !== 'postgres') return sql;
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

function normalizeSql(sql, dialect) {
  if (dialect === 'sqlite') return sql;
  let s = sql;

  // datetime('now') and datetime('now', '+N days'|'-N days')
  s = s.replace(/datetime\s*\(\s*'now'\s*,\s*'([+-]\d+)\s+days'\s*\)/gi, (_, n) => {
    const sign = n.startsWith('-') ? '-' : '+';
    const days = Math.abs(parseInt(n, 10));
    return `(NOW() ${sign} INTERVAL '${days} days')::TEXT`;
  });
  s = s.replace(/datetime\s*\(\s*'now'\s*\)/gi, 'NOW()::TEXT');

  // date('now') and date('now', '+N days')
  s = s.replace(/date\s*\(\s*'now'\s*,\s*'([+-]\d+)\s+days'\s*\)/gi, (_, n) => {
    const sign = n.startsWith('-') ? '-' : '+';
    const days = Math.abs(parseInt(n, 10));
    return `(CURRENT_DATE ${sign} INTERVAL '${days} days')::TEXT`;
  });
  s = s.replace(/date\s*\(\s*'now'\s*\)/gi, 'CURRENT_DATE::TEXT');

  // strftime('%Y', column) → extract year from text date
  s = s.replace(/strftime\s*\(\s*'%Y'\s*,\s*([^)]+)\)/gi, "EXTRACT(YEAR FROM $1::DATE)::TEXT");

  // INSERT OR REPLACE → Postgres upsert (setting table uses key as conflict target)
  s = s.replace(
    /INSERT\s+OR\s+REPLACE\s+INTO\s+setting\s*\(\s*key\s*,\s*value\s*\)\s*VALUES\s*\(\s*'([^']*)'\s*,\s*'([^']*)'\s*\)/gi,
    "INSERT INTO setting (key, value) VALUES ('$1', '$2') ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value"
  );
  s = s.replace(
    /INSERT\s+OR\s+REPLACE\s+INTO\s+setting\s*\(\s*key\s*,\s*value\s*\)\s*VALUES\s*\(\s*([^,)]+)\s*,\s*([^)]+)\s*\)/gi,
    'INSERT INTO setting (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value'
  );

  // INSERT OR IGNORE → ON CONFLICT DO NOTHING (works when PK/UNIQUE exists)
  s = s.replace(/INSERT\s+OR\s+IGNORE\s+INTO/gi, 'INSERT INTO');
  // Note: seed INSERT OR IGNORE handled in postgres schema with ON CONFLICT

  return s;
}

function prepareSql(sql, dialect) {
  return convertPlaceholders(normalizeSql(sql, dialect), dialect);
}

/** SQL fragment for current timestamp (ISO-ish text, matches app conventions). */
function sqlNow(dialect) {
  return dialect === 'postgres' ? 'NOW()::TEXT' : "datetime('now')";
}

/** Upsert a setting row — used by handlers instead of INSERT OR REPLACE. */
function upsertSettingSql(dialect) {
  if (dialect === 'postgres') {
    return `INSERT INTO setting (key, value) VALUES (?, ?)
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
  }
  return 'INSERT OR REPLACE INTO setting (key, value) VALUES (?, ?)';
}

/** Year filter for work_order.completed_date */
function sqlYearEquals(column, dialect) {
  if (dialect === 'postgres') {
    return `EXTRACT(YEAR FROM ${column}::DATE)::TEXT = ?`;
  }
  return `strftime('%Y', ${column}) = ?`;
}

/** Overdue schedules: next_due <= today */
function sqlDateTodayCompare(column, op, dialect) {
  if (dialect === 'postgres') {
    return `${column}::DATE ${op} CURRENT_DATE`;
  }
  if (op === '<=') return `${column} <= date('now')`;
  return `${column} ${op} date('now')`;
}

module.exports = {
  convertPlaceholders,
  normalizeSql,
  prepareSql,
  sqlNow,
  upsertSettingSql,
  sqlYearEquals,
  sqlDateTodayCompare,
};
