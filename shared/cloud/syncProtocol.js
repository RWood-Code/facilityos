/**
 * FacilityOS Cloud sync protocol — shared contract for on-prem agent and relay API.
 * Version bumps when envelope shape changes.
 */

const SYNC_PROTOCOL_VERSION = 1;

/** Entity types replicated through the relay (on-prem authoritative). */
const SYNC_ENTITY_TYPES = [
  'water_test',
  'steam_check',
  'pool_closure',
  'work_order',
  'maintenance_schedule',
  'staff_profile', // no PIN
  'audit_event',
];

/** Channels that must never be invoked via cloud relay. */
const CLOUD_BLOCKED_CHANNELS = new Set([
  'licence:generate',
  'remote:enable',
  'remote:disable',
  'remote:rotate_token',
  'cloud:pair',
  'backup:',
]);

function buildSyncEvent({ siteId, entityType, entityId, operation, payload, updatedAt }) {
  return {
    v: SYNC_PROTOCOL_VERSION,
    site_id: siteId,
    entity_type: entityType,
    entity_id: entityId,
    op: operation, // create | update | delete
    payload: payload || {},
    updated_at: updatedAt || new Date().toISOString(),
  };
}

function isChannelCloudAllowed(channel) {
  if (!channel) return false;
  for (const blocked of CLOUD_BLOCKED_CHANNELS) {
    if (channel.startsWith(blocked)) return false;
  }
  return true;
}

module.exports = {
  SYNC_PROTOCOL_VERSION,
  SYNC_ENTITY_TYPES,
  CLOUD_BLOCKED_CHANNELS,
  buildSyncEvent,
  isChannelCloudAllowed,
};
