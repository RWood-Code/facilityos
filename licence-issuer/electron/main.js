const { app, BrowserWindow } = require('electron');
const path = require('path');
const { startIssuerServer, DEFAULT_PORT } = require('../server');

let mainWindow;
let httpServer;

async function boot() {
  const issuerRoot = path.join(__dirname, '..');
  const distDir = path.join(issuerRoot, 'dist');
  const dataDir = path.join(app.getPath('userData'), 'data');

  const { server, url } = await startIssuerServer({
    port: DEFAULT_PORT,
    distDir,
    dataDir,
  });
  httpServer = server;

  mainWindow = new BrowserWindow({
    width: 1100,
    height: 820,
    minWidth: 900,
    minHeight: 640,
    title: 'FacilityOS Licence Issuer',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadURL(url);
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(boot).catch((err) => {
  console.error('[licence-issuer]', err);
  app.quit();
});

app.on('window-all-closed', () => {
  if (httpServer) httpServer.close();
  app.quit();
});

app.on('activate', () => {
  if (mainWindow === null && app.isReady()) boot();
});
