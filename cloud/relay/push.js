/**
 * Web Push notification delivery (Phase 2 scaffold).
 * Set FACILITYOS_VAPID_PUBLIC / FACILITYOS_VAPID_PRIVATE for production push.
 */

function isPushConfigured() {
  return Boolean(process.env.FACILITYOS_VAPID_PUBLIC && process.env.FACILITYOS_VAPID_PRIVATE);
}

async function sendPushToSubscription(subscription, payload) {
  if (!isPushConfigured()) {
    console.log('[push] VAPID not configured — would notify:', subscription.endpoint?.slice(0, 48), payload.title);
    return { ok: false, skipped: true };
  }
  try {
    const webpush = require('web-push');
    webpush.setVapidDetails(
      process.env.FACILITYOS_VAPID_SUBJECT || 'mailto:alerts@facilityos.nz',
      process.env.FACILITYOS_VAPID_PUBLIC,
      process.env.FACILITYOS_VAPID_PRIVATE
    );
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return { ok: true };
  } catch (e) {
    console.error('[push] delivery failed:', e.message);
    return { ok: false, error: e.message };
  }
}

async function notifySiteSubscribers(db, siteId, payload) {
  const subs = db.listPushSubscriptions(siteId);
  const results = [];
  for (const sub of subs) {
    results.push(await sendPushToSubscription(
      { endpoint: sub.endpoint, keys: sub.keys },
      payload
    ));
  }
  return results;
}

module.exports = { isPushConfigured, sendPushToSubscription, notifySiteSubscribers };
