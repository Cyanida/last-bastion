// Electron shell: one window around the same dist/ build the browser gets. No game logic lives here.
const { app, BrowserWindow, Menu, ipcMain, screen, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const fs = require('node:fs');
const path = require('node:path');

const DEV_URL = process.env.LB_DEV_URL; // set by scripts/dev-electron.mjs
let win = null;
let lastStatus = null;

// ---------- window state ----------
const stateFile = () => path.join(app.getPath('userData'), 'window.json');
function loadState() {
  try {
    const s = JSON.parse(fs.readFileSync(stateFile(), 'utf8'));
    const visible = screen.getAllDisplays().some((d) => s.x >= d.bounds.x - 50 && s.y >= d.bounds.y - 50 && s.x < d.bounds.x + d.bounds.width - 100 && s.y < d.bounds.y + d.bounds.height - 100);
    return visible ? s : { width: s.width, height: s.height, maximized: s.maximized }; // monitor gone: keep the size, recentre
  } catch {
    return { width: 1280, height: 800 };
  }
}
function saveState() {
  if (!win || win.isDestroyed()) return;
  const normal = win.isMaximized() || win.isFullScreen() ? win.getNormalBounds() : win.getBounds();
  try {
    fs.writeFileSync(stateFile(), JSON.stringify({ ...normal, maximized: win.isMaximized() }));
  } catch {
    /* a read-only profile must not stop the game from closing */
  }
}

function createWindow() {
  const state = loadState();
  win = new BrowserWindow({
    x: state.x, y: state.y, width: state.width || 1280, height: state.height || 800,
    minWidth: 800, minHeight: 480,
    backgroundColor: '#14110f',
    autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  if (state.maximized) win.maximize();
  win.on('close', saveState);

  // F11 toggles fullscreen (there is no menu to carry the accelerator)
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      win.setFullScreen(!win.isFullScreen());
      event.preventDefault();
    }
  });
  // the window only ever shows the game: no popups, no navigating away
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (!DEV_URL || !url.startsWith(DEV_URL)) event.preventDefault();
  });
  win.webContents.on('did-finish-load', () => lastStatus && win.webContents.send('update-status', lastStatus));

  if (DEV_URL) void win.loadURL(DEV_URL);
  else void win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
}

// ---------- auto-update (GitHub Releases, see "build.publish" in package.json) ----------
// Downloads in the background and installs on quit. The renderer shows "Update ready" on the title screen;
// nothing here ever interrupts a run.
function status(s) {
  lastStatus = s;
  if (win && !win.isDestroyed()) win.webContents.send('update-status', s);
}
let pendingVersion = '';
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.on('checking-for-update', () => status({ state: 'checking' }));
autoUpdater.on('update-not-available', () => status({ state: 'none' }));
autoUpdater.on('update-available', (info) => status({ state: 'available', version: (pendingVersion = info.version) }));
autoUpdater.on('download-progress', (p) => status({ state: 'downloading', version: pendingVersion, percent: p.percent }));
autoUpdater.on('update-downloaded', (info) => status({ state: 'ready', version: info.version }));
autoUpdater.on('error', (err) => status({ state: 'error', message: String(err && err.message ? err.message : err).split('\n')[0] }));

ipcMain.handle('get-version', () => app.getVersion());
ipcMain.handle('check-for-updates', async (_event, allowPrerelease) => {
  if (!app.isPackaged) return status({ state: 'none' }); // dev: nothing to update
  // pre-releases only when the player opted in (or is already running one)
  autoUpdater.allowPrerelease = allowPrerelease === true || app.getVersion().includes('-');
  try {
    await autoUpdater.checkForUpdates();
  } catch (err) {
    status({ state: 'error', message: String(err && err.message ? err.message : err).split('\n')[0] });
  }
});
ipcMain.on('quit-and-install', () => autoUpdater.quitAndInstall(true, true)); // silent install, relaunch afterwards

// ---------- lifecycle ----------
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });
  Menu.setApplicationMenu(null);
  app.whenReady().then(createWindow);
  app.on('window-all-closed', () => app.quit());
}
