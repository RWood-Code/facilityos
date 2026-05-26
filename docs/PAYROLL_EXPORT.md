# FacilityOS Payroll Export (Bespoke CSV)

FacilityOS exports payroll data as a **bespoke CSV** designed for manual import into your payroll system (replacing RosterIt export workflows). Column names and order are stable across releases.

## How to export

1. Open **Staff Rostering** → **Payroll export**
2. Set pay period **from** and **to** dates
3. Choose export source:
   - **Scheduled roster** — one row per assigned shift in the date range
   - **Approved timesheets only** — rows from timesheets with status `approved`
4. Download `payroll-YYYY-MM-DD-to-YYYY-MM-DD.csv`

## CSV columns

| Column | Description | Example |
|--------|-------------|---------|
| `employee_number` | From staff profile (Settings → Staff) | `E042` |
| `staff_name` | Full name | `Jane Smith` |
| `work_date` | Shift / timesheet date | `2026-05-26` |
| `pay_component_code` | Export code from pay component | `ORD` |
| `pay_component_name` | Human-readable pay type | `Ordinary hours` |
| `hours` | Paid hours (shift end − start − break) | `7.50` |
| `rate` | Hourly rate snapshot at assignment | `28.50` |
| `amount` | `hours × rate × multiplier` | `213.75` |
| `location` | Roster location | `Main Pool Deck` |
| `role` | Roster role | `Pool Lifeguard` |
| `shift_start` | Scheduled start time | `09:00` |
| `shift_end` | Scheduled end time | `17:00` |
| `roster_status` | `draft` or `published` | `published` |
| `timesheet_status` | `scheduled`, `draft`, or `approved` | `approved` |

## Example rows

```csv
employee_number,staff_name,work_date,pay_component_code,pay_component_name,hours,rate,amount,location,role,shift_start,shift_end,roster_status,timesheet_status
E001,Jane Smith,2026-05-26,ORD,Ordinary hours,7.50,28.50,213.75,Main Pool Deck,Pool Lifeguard,09:00,17:00,published,approved
E002,Bob Jones,2026-05-26,SAT150,Saturday,8.00,28.50,342.00,Learners / Leisure,Pool Lifeguard,06:00,14:30,published,approved
E003,Sam Lee,2026-05-27,AL,Annual leave,8.00,25.00,200.00,,,,,published,approved
```

## Pay component codes (default seed)

| Code | Export code | Name | Multiplier |
|------|-------------|------|------------|
| ORD | ORD | Ordinary hours | 1.0 |
| SAT | SAT150 | Saturday | 1.5 |
| SUN | SUN200 | Sunday | 2.0 |
| PH | PH200 | Public holiday | 2.0 |
| OT150 | OT150 | Overtime 1.5x | 1.5 |
| OT200 | OT200 | Overtime 2x | 2.0 |
| AL | AL | Annual leave | 1.0 |
| SICK | SICK | Sick leave | 1.0 |
| LWOP | LWOP | Leave without pay | 0.0 |
| MEET | MEET | Meeting / training paid | 1.0 |
| TRAIN | TRAIN | Training (unpaid) | 0.0 |

Manage codes under **Staff Rostering → Pay codes**.

## Rate resolution (at assignment)

When staff is assigned to a shift, FacilityOS snapshots pay data on the assignment:

1. Shift pay component (required on every shift)
2. Staff `base_hourly_rate` (if set)
3. Pay component `default_rate`
4. Rate multiplier from pay component

## Recommended workflow

1. Configure **pay codes** and staff **employee numbers** / **base rates**
2. Build roster with pay component on each shift
3. **Publish week** (auto-generates draft timesheets)
4. Review and **approve** timesheets
5. Export **approved timesheets** for payroll processing

## Notes

- Overnight shifts: hours are calculated allowing end time before start (adds 24h).
- Break minutes on the shift are subtracted from hours.
- This format is **not** tied to Xero, MYOB, or PaySauce — map columns in your payroll import template.
