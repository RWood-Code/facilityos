const { autoUpdater } = require('electron-updater');
const { app } = require('electron');
const { getInstallVariant } = require('./runtime');

let checkInterval;

function initAutoUpdater(mainWindow) {
  if (!app.isPackaged) return;

  if (getInstallVariant() === 'client') {
    autoUpdater.channel = 'terminal';
  }

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  const send = (event, payload) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update:status', { event, ...payload });
    }
  };

  autoUpdater.on('checking-for-update', () => send('checking'));
  autoUpdater.on('update-available', (info) => send('available', { version: info.version }));
  autoUpdater.on('update-not-available', () => send('not-available'));
  autoUpdater.on('download-progress', (p) => send('progress', { percent: p.percent }));
  autoUpdater.on('update-downloaded', (info) => send('downloaded', { version: info.version }));
  autoUpdater.on('error', (err) => send('error', { message: err.message }));

  const check = () => autoUpdater.checkForUpdates().catch((err) => {
    console.warn('Update check failed:', err.message);
  });

  setTimeout(check, 5000);
  checkInterval = setInterval(check, 4 * 60 * 60 * 1000);
  if (typeof checkInterval.unref === 'function') checkInterval.unref();
}

function downloadUpdate() {
  return autoUpdater.downloadUpdate();
}

function installUpdate() {
  autoUpdater.quitAndInstall(false, true);
}

module.exports = { initAutoUpdater, downloadUpdate, installUpdate };
