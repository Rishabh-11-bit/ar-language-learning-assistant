const { app, BrowserWindow, session, systemPreferences } = require('electron');
const path = require('path');

// Handle Squirrel installer events on Windows (only when installed via NSIS)
try {
  if (require('electron-squirrel-startup')) app.quit();
} catch (_) { /* not installed — running in dev mode */ }

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 860,
    minWidth: 360,
    minHeight: 640,
    title: 'AR Language Learning Assistant',
    backgroundColor: '#12121e',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      // Allow media (camera) without requiring HTTPS
      allowRunningInsecureContent: false,
    },
    // Frameless look — comment out if you prefer default OS chrome
    // frame: false,
    show: false, // don't flash white before content loads
  });

  // Grant camera permission automatically
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media') {
      callback(true);
    } else {
      callback(false);
    }
  });

  // On macOS, explicitly request camera access
  if (process.platform === 'darwin') {
    systemPreferences.askForMediaAccess('camera').then(granted => {
      if (!granted) console.warn('Camera permission not granted on macOS');
    });
  }

  mainWindow.loadFile('index.html');

  // Show window once content is ready (avoids white flash)
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open DevTools only in dev mode (set ELECTRON_DEV=1 env var)
  if (process.env.ELECTRON_DEV === '1') {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Override the user-agent so navigator.mediaDevices works without HTTPS
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    callback({ requestHeaders: details.requestHeaders });
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
