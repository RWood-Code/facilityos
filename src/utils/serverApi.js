export async function getServerBase() {
  if (typeof window !== 'undefined' && window.facilityos) {
    const config = await window.facilityos.getConfig();
    return config?.serverUrl || 'http://127.0.0.1:3847';
  }
  return import.meta.env.VITE_API_URL || 'http://127.0.0.1:3847';
}

async function serverFetch(path, options = {}) {
  const base = await getServerBase();
  const res = await fetch(`${base}${path}`, options);
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Request failed');
  return json.data;
}

export function listBackups() {
  return serverFetch('/api/backups');
}

export function createBackup(meta = {}) {
  return serverFetch('/api/backup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(meta),
  });
}

export function restoreBackup(filename, meta = {}) {
  return serverFetch('/api/backup/restore', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename, ...meta }),
  });
}

export function checkIntegrity() {
  return serverFetch('/api/integrity');
}

export function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
