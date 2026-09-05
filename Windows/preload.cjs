const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('calculatorDesktop', Object.freeze({
  readClipboard: () => ipcRenderer.invoke('clipboard:read'),
  writeClipboard: (text) => ipcRenderer.invoke('clipboard:write', text),
  setHistoryOpen: (open) => ipcRenderer.invoke('window:history', open)
}));
