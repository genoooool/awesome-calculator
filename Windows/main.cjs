const { app, BrowserWindow, ipcMain, clipboard, Menu, nativeTheme, screen } = require('electron');
const path = require('node:path');

const WIDTH = 264;
const HISTORY_WIDTH = 360;
const HEIGHT = 560;
const CORNER_RADIUS = 34;
let window;
let compactOuterWidth;
let minimumOuterHeight;
let unzoomedBounds;

function updateWindowShape() {
  if (process.platform !== 'win32' || !window) return;
  const [width, height] = window.getSize();
  const radius = Math.min(CORNER_RADIUS, width / 2, height / 2);
  const rects = [{ x: 0, y: radius, width, height: height - radius * 2 }];
  for (let y = 0; y < radius; y++) {
    const inset = Math.ceil(radius - Math.sqrt(radius ** 2 - (radius - y - 0.5) ** 2));
    rects.push({ x: inset, y, width: width - inset * 2, height: 1 });
    rects.push({ x: inset, y: height - y - 1, width: width - inset * 2, height: 1 });
  }
  // Clip hit testing at the corners as well as the transparent visual surface.
  window.setShape(rects);
}

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
      frame: false,
      thickFrame: false,
      // Electron transparent windows must not enable native edge resizing.
      // History expansion and the green zoom control resize programmatically.
      transparent: true,
      resizable: false,
      hasShadow: false,
      maximizable: false,
      fullscreenable: false,
      show: false,
      backgroundColor: '#00000000',
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
    updateWindowShape();
    window.on('resize', updateWindowShape);
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
function resizeWindow(target) {
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
  updateWindowShape();
}

ipcMain.handle('window:history', (event, expanded) => {
  if (!fromWindow(event) || typeof expanded !== 'boolean') return;
  resizeWindow({ ...window.getBounds(), width: compactOuterWidth + (expanded ? HISTORY_WIDTH : 0) });
});
ipcMain.handle('window:control', (event, action) => {
  if (!fromWindow(event)) return;
  if (action === 'close') window.close();
  else if (action === 'minimize') window.minimize();
  else if (action === 'zoom') {
    const bounds = window.getBounds();
    if (unzoomedBounds) {
      resizeWindow({ ...unzoomedBounds, width: bounds.width });
      unzoomedBounds = null;
    } else {
      unzoomedBounds = bounds;
      const area = screen.getDisplayMatching(bounds).workArea;
      resizeWindow({ ...bounds, y: area.y + 12, height: Math.max(minimumOuterHeight, Math.min(1000, area.height - 24)) });
    }
  }
});
ipcMain.handle('window:menu', (event) => {
  if (!fromWindow(event)) return;
  Menu.buildFromTemplate([
    { label: '粘贴算式', accelerator: 'CommandOrControl+V', click: () => window.webContents.send('calculator:paste') }
  ]).popup({ window });
});

app.on('window-all-closed', () => app.quit());
