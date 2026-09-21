// The whole desktop API the game can see. Runs sandboxed with context isolation: no Node in the page.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  getVersion: () => ipcRenderer.invoke('get-version'),
  checkForUpdates: (allowPrerelease) => ipcRenderer.invoke('check-for-updates', allowPrerelease === true),
  quitAndInstall: () => ipcRenderer.send('quit-and-install'),
  onUpdateStatus: (fn) => ipcRenderer.on('update-status', (_event, s) => fn(s)),
});
