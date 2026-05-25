const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const os = require('os');
const { loadConfig, saveConfig, DEFAULT_PORT } = require('./config');
const { startEmbeddedServer, stopEmbeddedServer, waitForHealth } = require('./server-manager');

const isDev = !app.isPackaged;
let mainWindow;

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
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    backgroundColor: '#f9fafb',
    show: false,
    title: 'FacilityOS',
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' });
  });

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
    stopEmbeddedServer();
    return ensureDataServer();
  });
}

app.whenReady().then(async () => {
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
  if (config.role === 'server') stopEmbeddedServer();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
