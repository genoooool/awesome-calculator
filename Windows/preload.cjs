const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('calculatorDesktop', Object.freeze({
  readClipboard: () => ipcRenderer.invoke('clipboard:read'),
  writeClipboard: (text) => ipcRenderer.invoke('clipboard:write', text),
  setHistoryOpen: (open) => ipcRenderer.invoke('window:history', open),
  windowControl: (action) => ipcRenderer.invoke('window:control', action),
  showContextMenu: () => ipcRenderer.invoke('window:menu'),
  onPaste: (callback) => ipcRenderer.on('calculator:paste', () => callback())
}));
