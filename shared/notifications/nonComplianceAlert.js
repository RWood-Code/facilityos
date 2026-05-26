const { sendMail, isSmtpConfigured } = require('../../server/email');

function setting(get, key) {
  return (get(`SELECT value FROM setting WHERE key=?`, [key]) || {}).value || '';
}

function collectAlertRecipientsFromCtx(get, all) {
  const emails = new Set();
  const facilityEmail = setting(get, 'facility_email').trim();
  if (facilityEmail) emails.add(facilityEmail);

  if (all) {
    try {
      for (const row of all(`SELECT email FROM staff WHERE status='active' AND email IS NOT NULL AND email != '' AND role IN ('manager','admin','supervisor')`)) {
        if (row.email?.trim()) emails.add(row.email.trim());
      }
    } catch { /* staff table may not exist */ }
  }

  return [...emails];
}

function shouldSendAlerts(get) {
  if (setting(get, 'email_alerts_enabled') !== '1') return false;
  if (!isSmtpConfigured()) return false;
  return true;
}

async function sendNonComplianceEmail(ctx, { poolName, testDate, testTime, poolId, testId }) {
  const { get, all, run } = ctx;
  if (!shouldSendAlerts(get)) return { skipped: true };

  const recipients = collectAlertRecipientsFromCtx(get, all);
  if (!recipients.length) return { skipped: true, reason: 'no_recipients' };

  const facilityName = setting(get, 'facility_name') || 'FacilityOS facility';
  const when = [testDate, testTime].filter(Boolean).join(' ') || new Date().toISOString().slice(0, 16);
  const subject = `[FacilityOS] Non-compliant pool test — ${poolName || 'Unknown pool'}`;
  const text = [
    `${facilityName}`,
    '',
    'A routine water test failed compliance.',
    '',
    `Pool: ${poolName || poolId || 'Unknown'}`,
    `When: ${when}`,
    `Test ID: ${testId || '—'}`,
    '',
    'Open FacilityOS on the data server or manager dashboard to review and take action.',
  ].join('\n');

  const result = await sendMail({ to: recipients, subject, text });

  if (run && result.ok) {
    try {
      const { writeAudit } = require('../db/audit');
      writeAudit({ run, get, all: all || (() => []) }, {
        action: 'alert.email.non_compliance',
        entity_type: 'test_result',
        entity_id: testId || poolId || '',
        details: { pool_id: poolId, recipient_count: recipients.length },
      });
    } catch { /* audit optional */ }
  }

  return result;
}

module.exports = {
  shouldSendAlerts,
  sendNonComplianceEmail,
  collectAlertRecipientsFromCtx,
  isSmtpConfigured,
};
