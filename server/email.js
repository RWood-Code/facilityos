/**
 * SMTP email delivery for operational alerts.
 * Configure via environment variables on the data server PC.
 */
const nodemailer = require('nodemailer');

let transporter;

function isSmtpConfigured() {
  return Boolean(process.env.SMTP_HOST);
}

function smtpSummary() {
  if (!isSmtpConfigured()) return null;
  return {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER || null,
    from: process.env.SMTP_FROM || process.env.SMTP_USER || 'facilityos@localhost',
  };
}

function resetTransporter() {
  transporter = null;
}

function getTransporter() {
  if (!isSmtpConfigured()) return null;
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT || 587);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || '' }
        : undefined,
    });
  }
  return transporter;
}

async function verifySmtp() {
  const transport = getTransporter();
  if (!transport) return { ok: false, reason: 'smtp_not_configured' };
  try {
    await transport.verify();
    return { ok: true, ...smtpSummary() };
  } catch (e) {
    return { ok: false, error: e.message, ...smtpSummary() };
  }
}

async function sendMail({ to, subject, text, html }) {
  const transport = getTransporter();
  if (!transport) {
    return { ok: false, skipped: true, reason: 'smtp_not_configured' };
  }
  const recipients = (Array.isArray(to) ? to : [to]).filter(Boolean);
  if (!recipients.length) {
    return { ok: false, skipped: true, reason: 'no_recipients' };
  }
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'facilityos@localhost';
  try {
    const info = await transport.sendMail({
      from,
      to: recipients.join(', '),
      subject,
      text,
      html: html || text.replace(/\n/g, '<br>'),
    });
    return { ok: true, messageId: info.messageId };
  } catch (e) {
    console.error('[email] send failed:', e.message);
    return { ok: false, error: e.message };
  }
}

module.exports = { isSmtpConfigured, smtpSummary, resetTransporter, verifySmtp, sendMail };
