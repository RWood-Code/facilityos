-- Migration 002: licence feature overrides + manager dashboard setting + roster pay fields

ALTER TABLE licence ADD COLUMN features TEXT;

INSERT OR IGNORE INTO setting (key, value) VALUES ('show_manager_dashboard', '0');

-- Payroll fields on roster assignments (safe if columns already exist — ignore errors in migrate runner)
-- Applied via separate statements in migrate.js post-exec hook if needed
