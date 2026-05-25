const { contextBridge, ipcRenderer } = require('electron');

async function apiQuery(channel, args) {
  const config = await ipcRenderer.invoke('config:get');
  const res = await fetch(`${config.serverUrl}/api/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      channel,
      args: args ?? {},
      terminalId: config.terminalId,
    }),
  });
  const result = await res.json();
  if (res.status === 402 || result.error === 'licence_expired') {
    const err = new Error('licence_expired');
    err.licence = result.data;
    throw err;
  }
  if (!res.ok) throw new Error(result.error || `HTTP ${res.status}`);
  return result;
}

contextBridge.exposeInMainWorld('db', {
  query: (channel, args) => apiQuery(channel, args),
});

contextBridge.exposeInMainWorld('facilityos', {
  getConfig: () => ipcRenderer.invoke('config:get'),
  setConfig: (cfg) => ipcRenderer.invoke('config:set', cfg),
  getSystemInfo: () => ipcRenderer.invoke('system:info'),
  restartServer: () => ipcRenderer.invoke('system:restart-server'),
  checkHealth: async () => {
    const config = await ipcRenderer.invoke('config:get');
    try {
      const res = await fetch(`${config.serverUrl}/api/health`);
      return res.ok ? res.json() : { ok: false };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  },
  onUpdateStatus: (callback) => {
    const handler = (_, payload) => callback(payload);
    ipcRenderer.on('update:status', handler);
    return () => ipcRenderer.removeListener('update:status', handler);
  },
  downloadUpdate: () => ipcRenderer.invoke('update:download'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  setTitle: (title) => ipcRenderer.send('set-title', title),
});

contextBridge.exposeInMainWorld('appInfo', {
  platform: process.platform,
  isElectron: true,
});
