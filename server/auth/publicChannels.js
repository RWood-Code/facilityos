/** API query channels allowed without staff session (hosted session mode). */
const SESSION_PUBLIC_CHANNELS = new Set([
  'licence:status',
  'licence:activate',
  'licence:ensure_trial',
  'licence:file_info',
  'licence:plans',
  'licence:plan_modules',
  'licence:sync_from_file',
]);

function isSessionPublicQuery(req) {
  if (req.method !== 'POST' || req.path !== '/api/query') return false;
  const channel = req.body?.channel;
  return SESSION_PUBLIC_CHANNELS.has(channel);
}

module.exports = {
  SESSION_PUBLIC_CHANNELS,
  isSessionPublicQuery,
};
