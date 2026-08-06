const path = require('node:path');
const { app, BrowserWindow, nativeTheme, session } = require('electron');
const { registerIpcHandlers } = require('./ipc-handlers.cjs');
const { loadPreferences } = require('./services/preferences.cjs');

let mainWindow = null;

function sendWindowState() {
  mainWindow?.webContents.send('window:state', { maximized: mainWindow.isMaximized() });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 980,
    minHeight: 680,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#121212' : '#F7F9F9',
    icon: path.join(__dirname, '..', 'assets', 'app.ico'),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  mainWindow.removeMenu();
  mainWindow.on('maximize', sendWindowState);
  mainWindow.on('unmaximize', sendWindowState);
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const developmentUrl = process.env.VITE_DEV_SERVER_URL;
    if (!developmentUrl || !url.startsWith(developmentUrl)) event.preventDefault();
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

const hasLock = app.requestSingleInstanceLock();
if (!hasLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(async () => {
    app.setAppUserModelId('com.lht02.codexbackupmanager');
    const preferences = await loadPreferences(app);
    nativeTheme.themeSource = preferences.themeSource;
    session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
    registerIpcHandlers(() => mainWindow);
    nativeTheme.on('updated', () => {
      const darkMode = nativeTheme.shouldUseDarkColors;
      mainWindow?.setBackgroundColor(darkMode ? '#121414' : '#F6F8F8');
      mainWindow?.webContents.send('theme:changed', {
        themeSource: nativeTheme.themeSource,
        darkMode,
      });
    });
    createWindow();
  });
}

app.on('window-all-closed', () => app.quit());
