const path = require('node:path');
const { app, dialog, ipcMain, nativeTheme, shell } = require('electron');
const { COMPONENTS } = require('./services/catalog.cjs');
const { scanComponents } = require('./services/discovery.cjs');
const { createBackup } = require('./services/backup-engine.cjs');
const { inspectBackup } = require('./services/backup-inspector.cjs');
const { restoreBackup } = require('./services/restore-engine.cjs');
const { findRunningCodexProcesses } = require('./services/process-guard.cjs');
const { THEME_SOURCES, saveThemeSource } = require('./services/preferences.cjs');

let activeOperation = null;

function sanitizeComponentIds(componentIds) {
  const allowed = new Set(COMPONENTS.map((item) => item.id));
  if (!Array.isArray(componentIds)) return [];
  return componentIds.filter((id) => typeof id === 'string' && allowed.has(id));
}

function startOperation(type, sender) {
  if (activeOperation) throw new Error(`已有${activeOperation.type}操作正在进行`);
  const controller = new AbortController();
  activeOperation = { type, controller };
  return {
    signal: controller.signal,
    onProgress: (progress) => sender.send('operation:progress', { type, ...progress }),
    finish: () => {
      if (activeOperation?.controller === controller) activeOperation = null;
    },
  };
}

function defaultBackupName(prefix = 'Codex-Backup') {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${prefix}-${stamp}.cxbak`;
}

function registerIpcHandlers(getMainWindow) {
  ipcMain.handle('system:get-info', async () => ({
    appVersion: app.getVersion(),
    electronVersion: process.versions.electron,
    platform: process.platform,
    arch: process.arch,
    darkMode: nativeTheme.shouldUseDarkColors,
    themeSource: nativeTheme.themeSource,
    components: COMPONENTS.map(({ locations, ...component }) => component),
  }));

  ipcMain.handle('theme:set-source', async (_event, themeSource) => {
    if (!THEME_SOURCES.has(themeSource)) throw new Error('无效的窗口主题模式');
    nativeTheme.themeSource = themeSource;
    await saveThemeSource(app, themeSource);
    return {
      themeSource: nativeTheme.themeSource,
      darkMode: nativeTheme.shouldUseDarkColors,
    };
  });

  ipcMain.handle('backup:scan', async (event, request = {}) => {
    const operation = startOperation('scan', event.sender);
    try {
      return await scanComponents({
        componentIds: sanitizeComponentIds(request.componentIds),
        signal: operation.signal,
        onProgress: operation.onProgress,
      });
    } finally {
      operation.finish();
    }
  });

  ipcMain.handle('backup:choose-output', async () => {
    const result = await dialog.showSaveDialog(getMainWindow(), {
      title: '保存 Codex 单文件备份',
      defaultPath: path.join(
        app.getPath('documents'),
        'Codex Backups',
        defaultBackupName(),
      ),
      buttonLabel: '选择此位置',
      filters: [
        { name: 'Codex 单文件备份', extensions: ['cxbak'] },
        { name: '所有文件', extensions: ['*'] },
      ],
      properties: ['createDirectory', 'showOverwriteConfirmation'],
    });
    return result.canceled ? null : result.filePath;
  });

  ipcMain.handle('backup:create', async (event, request = {}) => {
    if (typeof request.destination !== 'string') throw new Error('未选择备份保存位置');
    const operation = startOperation('backup', event.sender);
    try {
      return await createBackup({
        destination: request.destination,
        componentIds: sanitizeComponentIds(request.componentIds),
        password: request.encrypt ? request.password : undefined,
        compressionLevel: Number.isInteger(request.compressionLevel)
          ? Math.min(9, Math.max(0, request.compressionLevel))
          : 9,
        appVersion: app.getVersion(),
        signal: operation.signal,
        onProgress: operation.onProgress,
      });
    } finally {
      operation.finish();
    }
  });

  ipcMain.handle('restore:choose-input', async () => {
    const result = await dialog.showOpenDialog(getMainWindow(), {
      title: '选择 Codex 单文件备份',
      buttonLabel: '打开备份',
      properties: ['openFile'],
      filters: [
        { name: 'Codex 单文件备份', extensions: ['cxbak'] },
        { name: 'ZIP 兼容备份', extensions: ['zip'] },
        { name: '所有文件', extensions: ['*'] },
      ],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('restore:inspect', async (event, request = {}) => {
    if (typeof request.filePath !== 'string') throw new Error('未选择备份文件');
    return inspectBackup(request.filePath, request.password, {
      onProgress: (progress) => event.sender.send('operation:progress', { type: 'inspect', ...progress }),
    });
  });

  ipcMain.handle('restore:run', async (event, request = {}) => {
    if (typeof request.filePath !== 'string') throw new Error('未选择备份文件');
    const running = await findRunningCodexProcesses();
    if (running.length > 0) {
      const error = new Error(`检测到 Codex 正在运行（PID ${running.map((item) => item.pid).join(', ')}），请关闭后再还原。`);
      error.code = 'CODEX_RUNNING';
      throw error;
    }
    const operation = startOperation('restore', event.sender);
    try {
      return await restoreBackup({
        filePath: request.filePath,
        password: request.password,
        componentIds: sanitizeComponentIds(request.componentIds),
        mode: request.mode,
        createRollback: request.createRollback !== false,
        appVersion: app.getVersion(),
        signal: operation.signal,
        onProgress: operation.onProgress,
      });
    } finally {
      operation.finish();
    }
  });

  ipcMain.handle('operation:cancel', async () => {
    if (!activeOperation) return false;
    activeOperation.controller.abort();
    return true;
  });

  ipcMain.handle('system:show-item', async (_event, targetPath) => {
    if (typeof targetPath !== 'string' || !path.isAbsolute(targetPath)) return false;
    shell.showItemInFolder(targetPath);
    return true;
  });

  ipcMain.on('window:control', (_event, action) => {
    const window = getMainWindow();
    if (!window) return;
    if (action === 'minimize') window.minimize();
    if (action === 'maximize') window.isMaximized() ? window.unmaximize() : window.maximize();
    if (action === 'close') window.close();
  });
}

module.exports = { registerIpcHandlers };
