const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('codexBackup', {
  getSystemInfo: () => ipcRenderer.invoke('system:get-info'),
  setThemeSource: (themeSource) => ipcRenderer.invoke('theme:set-source', themeSource),
  scan: (request) => ipcRenderer.invoke('backup:scan', request),
  chooseBackupOutput: () => ipcRenderer.invoke('backup:choose-output'),
  createBackup: (request) => ipcRenderer.invoke('backup:create', request),
  chooseRestoreInput: () => ipcRenderer.invoke('restore:choose-input'),
  inspectBackup: (request) => ipcRenderer.invoke('restore:inspect', request),
  restoreBackup: (request) => ipcRenderer.invoke('restore:run', request),
  cancelOperation: () => ipcRenderer.invoke('operation:cancel'),
  showItem: (targetPath) => ipcRenderer.invoke('system:show-item', targetPath),
  controlWindow: (action) => ipcRenderer.send('window:control', action),
  onProgress: (callback) => {
    const listener = (_event, progress) => callback(progress);
    ipcRenderer.on('operation:progress', listener);
    return () => ipcRenderer.removeListener('operation:progress', listener);
  },
  onWindowState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('window:state', listener);
    return () => ipcRenderer.removeListener('window:state', listener);
  },
  onThemeChanged: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('theme:changed', listener);
    return () => ipcRenderer.removeListener('theme:changed', listener);
  },
});
