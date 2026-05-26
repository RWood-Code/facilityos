-- Cap evaluation trials to 7 days (was 365 on fresh installs)

UPDATE licence
SET expires_at = datetime('now', '+7 days'),
    organisation = COALESCE(NULLIF(organisation, ''), 'Evaluation')
WHERE plan = 'trial' AND is_active = 1;
