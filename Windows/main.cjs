const { app, BrowserWindow, ipcMain, clipboard, Menu, nativeTheme, screen } = require('electron');
const path = require('node:path');

const WIDTH = 264;
const HISTORY_WIDTH = 360;
const HEIGHT = 528;
let window;
let compactOuterWidth;
let minimumOuterHeight;

// A separate profile preserves the old Windows installation's local data.
app.setPath('userData', path.join(app.getPath('appData'), 'Awesome Calculator Windows'));
app.setAppUserModelId('com.genoooool.awesome-calculator.windows');
nativeTheme.themeSource = 'dark';

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (window) {
      if (window.isMinimized()) window.restore();
      window.show();
      window.focus();
    }
  });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    window = new BrowserWindow({
      title: `Awesome Calculator ${app.getVersion()}`,
      width: WIDTH,
      height: HEIGHT,
      useContentSize: true,
      resizable: true,
      maximizable: false,
      fullscreenable: false,
      show: false,
      backgroundColor: '#0b0d10',
      icon: path.join(__dirname, 'build/icon.png'),
      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        spellcheck: false
      }
    });
    const [outerWidth, outerHeight] = window.getSize();
    compactOuterWidth = outerWidth;
    minimumOuterHeight = outerHeight;
    window.setMinimumSize(outerWidth, outerHeight);
    window.setMaximumSize(outerWidth, 1400);
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', (event) => event.preventDefault());
    window.webContents.on('page-title-updated', (event) => event.preventDefault());
    window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    window.loadFile(path.join(__dirname, 'src/index.html'));
    window.once('ready-to-show', () => window.show());
    window.on('closed', () => { window = null; });
  });
}

function fromWindow(event) {
  return window && event.sender === window.webContents && event.senderFrame === window.webContents.mainFrame;
}

// Keep one excess character so the model rejects oversized input rather than
// accidentally evaluating a silently truncated expression.
ipcMain.handle('clipboard:read', async (event) => fromWindow(event) ? (await clipboard.readText()).slice(0, 10001) : '');
ipcMain.handle('clipboard:write', async (event, text) => {
  if (!fromWindow(event) || typeof text !== 'string' || text.length > 20000) return false;
  await clipboard.writeText(text);
  return true;
});
ipcMain.handle('window:history', (event, expanded) => {
  if (!fromWindow(event) || typeof expanded !== 'boolean') return;
  const target = { ...window.getBounds(), width: compactOuterWidth + (expanded ? HISTORY_WIDTH : 0) };
  const area = screen.getDisplayMatching(target).workArea;
  target.x = Math.max(area.x, Math.min(target.x, area.x + area.width - target.width));
  target.y = Math.max(area.y, Math.min(target.y, area.y + area.height - target.height));
  // Release both width constraints before resizing; otherwise collapsing can be clamped.
  window.setMinimumSize(1, 1);
  window.setMaximumSize(10000, 10000);
  // Windows fractional-DPI conversion may return a bounds rectangle two pixels
  // larger than requested, even on a position-only change. Correct the measured
  // difference rather than feeding that error into the next history toggle.
  const request = { ...target };
  for (let pass = 0; pass < 3; pass++) {
    window.setBounds(request);
    const actual = window.getBounds();
    let changed = false;
    for (const key of ['x', 'y', 'width', 'height']) {
      const error = actual[key] - target[key];
      request[key] -= error;
      changed ||= error !== 0;
    }
    if (!changed) break;
  }
  window.setMinimumSize(target.width, minimumOuterHeight);
  window.setMaximumSize(target.width, 1400);
});

app.on('window-all-closed', () => app.quit());
