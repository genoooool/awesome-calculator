const { _electron: electron } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Exercise real input, native clipboard, window sizing and screenshots against
// the packaged/installed EXE. No test hooks are shipped in the application.
(async () => {
  const output = path.resolve(process.env.CALCULATOR_TEST_OUTPUT || 'test-results');
  fs.mkdirSync(output, { recursive: true });
  const executablePath = process.env.CALCULATOR_TEST_EXE;
  const args = executablePath ? [] : ['.'];
  if (process.env.CALCULATOR_TEST_SCALE) args.push(`--force-device-scale-factor=${process.env.CALCULATOR_TEST_SCALE}`);
  const application = await electron.launch({ executablePath, args, timeout: 60000 });
  let page;
  const passed = [];
  const errors = [];
  const check = async (name, action) => { await action(); passed.push(name); console.log(`PASS ${name}`); };
  try {
    await application.evaluate(async ({ clipboard, ClipboardItem }) => {
      // Materialize every format before tests change the OS clipboard. Electron
      // 44 uses asynchronous ClipboardItem/Blob APIs, including raw OS formats.
      const items = await clipboard.read();
      globalThis.calculatorTestClipboard = await Promise.all(items.map(async item =>
        new ClipboardItem(Object.fromEntries(await Promise.all(item.types.map(async type =>
          [type, await item.getType(type)]))))));
    });
    page = await application.firstWindow();
    page.on('pageerror', error => errors.push(error.message));
    await page.waitForSelector('[data-key="digit-1"]');
    const key = (name) => page.locator(`[data-key="${name}"]`).click();
    const text = (id) => page.locator(`#${id}`).textContent();
    const clipboardWrite = (value) => application.evaluate(({ clipboard }, data) => clipboard.writeText(data), value);
    const clipboardRead = () => application.evaluate(({ clipboard }) => clipboard.readText());
    const result = async (value) => {
      await page.waitForFunction(v => document.getElementById('result').textContent === v, value);
      assert.equal(await text('result'), value);
    };
    const width = async (expected) => {
      await page.waitForFunction(value => innerWidth >= value && innerWidth <= value + 2, expected);
      const layout = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
      assert.equal(layout.scrollWidth, layout.width);
    };
    await check('empty current display on startup', async () => {
      assert.equal(await text('expression'), ''); assert.equal(await text('result'), '');
      const security = await application.evaluate(({ BrowserWindow }) => {
        const prefs = BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences();
        return { contextIsolation: prefs.contextIsolation, nodeIntegration: prefs.nodeIntegration, sandbox: prefs.sandbox };
      });
      assert.deepEqual(security, { contextIsolation: true, nodeIntegration: false, sandbox: true });
    });
    await check('mouse buttons and keyboard evaluate the current expression', async () => {
      await key('digit-2'); await key('add'); await key('digit-3'); await key('equal'); await result('5');
      await page.keyboard.type('4*6'); await page.keyboard.press('Enter'); await result('24');
      assert.equal(await text('expression'), '4 × 6');
      assert.equal(await page.locator('.history-row').count(), 2);
      await page.screenshot({ path: path.join(output, 'compact.png') });
    });
    await check('AC empties display and preserves history', async () => {
      await key('clear'); assert.equal(await text('expression'), ''); assert.equal(await text('result'), '');
      assert.equal(await page.locator('.history-row').count(), 2);
    });
    await check('Ctrl+V pastes a fullwidth long expression through Windows clipboard', async () => {
      await clipboardWrite('2+5+18+55+（2*5）/3+75');
      await page.keyboard.press('Control+v'); await result('158.33333');
      assert.equal(await text('expression'), '2 + 5 + 18 + 55 + (2 × 5) ÷ 3 + 75');
    });
    await check('backspace edits completed expression and operators continue from result', async () => {
      await page.keyboard.press('Backspace'); await result('90.333333');
      await page.keyboard.press('Enter'); await result('90.333333');
      await page.keyboard.type('+1'); await page.keyboard.press('Enter'); await result('91.333333');
    });
    await check('history expands, copies and collapses repeatedly without clipping', async () => {
      const originalSize = await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getSize());
      await page.locator('#history-toggle').click();
      await width(624);
      const row = page.locator('.history-row').first();
      await row.getByText('复制结果', { exact: true }).click();
      assert.equal(await clipboardRead(), '91.333333');
      await row.getByText('复制整条', { exact: true }).click();
      assert.equal(await clipboardRead(), '90.333333+1=91.333333');
      await row.getByText('复制算式', { exact: true }).click();
      assert.equal(await clipboardRead(), '90.333333 + 1');
      await page.screenshot({ path: path.join(output, 'history.png') });
      for (let i = 0; i < 3; i++) {
        await page.locator('#close-history').click();
        await width(264);
        await page.locator('#history-toggle').click();
        await width(624);
      }
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      assert.equal(overflow, false);
      await page.locator('#close-history').click();
      await width(264);
      const finalSize = await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getSize());
      assert.equal(finalSize[1], originalSize[1], 'History toggles must not accumulate window height');
    });
    await check('invalid paste reports error and recovery works', async () => {
      const count = await page.locator('.history-row').count();
      await clipboardWrite('1/0'); await page.locator('#paste').click(); await result('错误');
      assert.equal(await page.locator('.history-row').count(), count);
      assert.equal(await text('status'), '无法计算，请检查算式');
      await page.keyboard.press('Escape'); await page.keyboard.type('10/2'); await page.keyboard.press('Enter'); await result('5');
    });
    await check('oversized clipboard input is rejected without truncation or new history', async () => {
      const count = await page.locator('.history-row').count();
      await clipboardWrite('1+'.repeat(6000) + '1');
      await page.locator('#paste').click();
      await page.waitForFunction(() => document.getElementById('status').textContent === '无法计算，请检查算式');
      assert.equal(await page.locator('.history-row').count(), count);
      assert.equal(await text('expression'), '10 ÷ 2'); await result('5');
    });
    await check('clear history preserves current calculation', async () => {
      await page.locator('#history-toggle').click(); await page.locator('#clear-history').click();
      assert.equal(await page.locator('.history-row').count(), 0); await result('5');
      await page.locator('#close-history').click();
    });
    await check('packaged window is visible, opaque and has a native titlebar', async () => {
      const state = await application.evaluate(({ app, BrowserWindow }) => {
        const w = BrowserWindow.getAllWindows()[0];
        return { version: app.getVersion(), visible: w.isVisible(), size: w.getContentSize(),
          outerSize: w.getSize(), background: w.getBackgroundColor(), executable: process.execPath, platform: process.platform };
      });
      assert.equal(state.version, '1.6.0'); assert.equal(state.visible, true);
      // At fractional Windows scaling, GetClientRect <-> DIP conversion can
      // differ by up to two pixels. The DOM widths above are checked separately.
      assert.ok(state.size[0] >= 264 && state.size[0] <= 266); assert.ok(state.size[1] >= 528);
      assert.ok(state.outerSize[1] > state.size[1]);
      assert.equal(state.background.toLowerCase(), '#0b0d10');
      fs.writeFileSync(path.join(output, 'runtime.json'), JSON.stringify(state, null, 2));
      assert.deepEqual(errors, []);
    });
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ passed, errors, status: 'passed' }, null, 2));
  } catch (error) {
    if (page) {
      await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
      const layout = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, scale: devicePixelRatio,
        scrollWidth: document.documentElement.scrollWidth, body: document.body.innerText })).catch(() => null);
      fs.writeFileSync(path.join(output, 'failure-layout.json'), JSON.stringify(layout, null, 2));
    }
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ passed, errors, status: 'failed', error: String(error) }, null, 2));
    throw error;
  } finally {
    await application.evaluate(async ({ clipboard }) => {
      if (globalThis.calculatorTestClipboard) {
        await clipboard.write(globalThis.calculatorTestClipboard);
      }
    }).catch(() => {});
    await application.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
