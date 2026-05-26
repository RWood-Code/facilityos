const { app, BrowserWindow, ipcMain, Menu, session } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { loadConfig, saveConfig, DEFAULT_PORT } = require('./config');
const { startEmbeddedServer, stopEmbeddedServer, waitForHealth } = require('./server-manager');
const { startEmbeddedCloudAgent, stopEmbeddedCloudAgent } = require('./cloud-agent-manager');
const { initAutoUpdater, downloadUpdate, installUpdate } = require('./updater');
const { getDistPath } = require('./paths');

const isDev = !app.isPackaged;
let mainWindow;

function serverHealthUrl(config) {
  const port = config.serverPort || DEFAULT_PORT;
  if (config.role === 'server') return `http://127.0.0.1:${port}`;
  return (config.serverUrl || '').trim().replace(/\/$/, '') || null;
}

async function loadProductionUi(win, config) {
  const healthBase = serverHealthUrl(config);
  if (!healthBase) {
    await win.loadFile(path.join(__dirname, 'load-error.html'), {
      query: { m: 'Terminal not configured. Reinstall FacilityOS Terminal or set the server address in Settings.' },
    });
    return;
  }

  const ok = await waitForHealth(healthBase, 30);
  if (!ok) {
    await win.loadFile(path.join(__dirname, 'load-error.html'), {
      query: { m: 'Data server did not start. Close other FacilityOS copies and try again, or reinstall FacilityOS Server.' },
    });
    return;
  }

  const indexPath = path.join(getDistPath(), 'index.html');
  if (!fs.existsSync(indexPath)) {
    await win.loadFile(path.join(__dirname, 'load-error.html'), {
      query: { m: 'Application files missing. Reinstall FacilityOS Server.' },
    });
    return;
  }

  const uiUrl = `${healthBase}/`;

  try {
    await session.defaultSession.clearStorageData({
      storages: ['serviceworkers', 'cachestorage'],
    });
    await session.defaultSession.clearCache();
    await win.loadURL(uiUrl);

    const mounted = await win.webContents.executeJavaScript(
      'Boolean(document.getElementById("root")?.childElementCount)',
    ).catch(() => false);

    if (!mounted) {
      console.warn('UI root empty after load — reloading without cache');
      await win.webContents.reloadIgnoringCache();
    }
  } catch (e) {
    console.error('loadURL failed:', e.message);
    await win.loadFile(path.join(__dirname, 'load-error.html'), {
      query: { m: 'Could not open the application UI.' },
    });
  }
}

async function ensureDataServer() {
  const config = loadConfig();
  const port = config.serverPort || DEFAULT_PORT;
  const localUrl = `http://127.0.0.1:${port}`;
  const targetUrl = config.role === 'server' ? localUrl : config.serverUrl;

  if (await waitForHealth(targetUrl, 3)) {
    if (config.role === 'server' && config.serverUrl !== localUrl) saveConfig({ serverUrl: localUrl });
    return targetUrl;
  }

  if (config.role === 'server') {
    const url = await startEmbeddedServer(port);
    saveConfig({ serverUrl: url });
    startEmbeddedCloudAgent(port);
    return url;
  }

  console.warn('Remote data server not reachable:', config.serverUrl);
  return config.serverUrl;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    backgroundColor: '#f1f5f9',
    show: false,
    title: 'FacilityOS',
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' });
    else initAutoUpdater(mainWindow);
  });

  const load = isDev
    ? mainWindow.loadURL('http://localhost:5173')
    : loadProductionUi(mainWindow, loadConfig());

  load.catch((e) => console.error('Window load failed:', e.message));

  mainWindow.on('closed', () => { mainWindow = null; });
}

function registerIpc() {
  ipcMain.handle('config:get', () => loadConfig());
  ipcMain.handle('config:set', (_, partial) => {
    const next = saveConfig(partial);
    if (partial.role === 'server' || partial.serverPort) {
      return ensureDataServer().then(() => next);
    }
    return next;
  });
  ipcMain.handle('system:info', () => ({
    hostname: os.hostname(),
    platform: process.platform,
    isPackaged: app.isPackaged,
    userData: app.getPath('userData'),
    version: app.getVersion(),
  }));
  ipcMain.handle('system:restart-server', async () => {
    stopEmbeddedCloudAgent();
    stopEmbeddedServer();
    await ensureDataServer();
    if (mainWindow && !mainWindow.isDestroyed() && !isDev) {
      await loadProductionUi(mainWindow, loadConfig());
    }
    return loadConfig().serverUrl;
  });
  ipcMain.handle('update:download', () => downloadUpdate());
  ipcMain.handle('update:install', () => installUpdate());
  ipcMain.on('set-title', (_, title) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setTitle(title ? `FacilityOS — ${title}` : 'FacilityOS');
    }
  });
}

if (app.isPackaged) {
  app.commandLine.appendSwitch('disable-http-cache');
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);

  session.defaultSession.webRequest.onBeforeRequest(
    { urls: ['*://*/sw.js', '*://*/service-worker.js'] },
    (_details, callback) => callback({ cancel: true }),
  );

  registerIpc();
  try {
    await ensureDataServer();
  } catch (e) {
    console.error('Data server startup failed:', e.message);
  }
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  const config = loadConfig();
  if (config.role === 'server') {
    stopEmbeddedCloudAgent();
    stopEmbeddedServer();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
