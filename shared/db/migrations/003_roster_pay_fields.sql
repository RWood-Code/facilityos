-- Migration 003: roster pay fields for payroll export

ALTER TABLE roster_assignment ADD COLUMN pay_rate REAL;
ALTER TABLE roster_assignment ADD COLUMN pay_type TEXT DEFAULT 'hourly';
