'use strict';
const model = new CalculatorViewModel();
const desktop = window.calculatorDesktop;
const byId = (id) => document.getElementById(id);
let historyOpen = false;
let statusTimer;

function status(message) {
  clearTimeout(statusTimer);
  byId('status').textContent = message;
  statusTimer = setTimeout(() => { byId('status').textContent = ''; }, 3500);
}

function render() {
  const expression = byId('expression');
  expression.replaceChildren();
  expression.classList.toggle('has-value', !!model.currentExpression);
  for (const part of model.currentExpression.split(/([+−×÷()%])/)) {
    const span = document.createElement('span');
    span.textContent = part;
    if (/^[+−×÷()%]$/.test(part)) span.className = 'operator';
    expression.append(span);
  }
  expression.scrollTop = expression.scrollHeight;
  const result = byId('result');
  result.textContent = model.currentResult;
  result.classList.toggle('long', model.currentResult.length > 14);
  const line = byId('display').querySelector('.calculation-line');
  line.classList.remove('stacked');
  line.classList.toggle('stacked', expression.scrollWidth + result.scrollWidth + 16 > line.clientWidth);
  byId('history-count').textContent = model.history.length ? `${model.history.length} 条计算` : '暂无记录';
  byId('clear-history').disabled = !model.history.length;
  byId('history-empty').hidden = model.history.length > 0;
  const list = byId('history-list');
  list.hidden = !model.history.length;
  list.replaceChildren();
  for (const line of [...model.history].reverse()) {
    const row = document.createElement('article');
    row.className = 'history-row';
    const expr = document.createElement('div');
    expr.className = 'history-expression';
    expr.textContent = line.expression;
    const value = document.createElement('div');
    value.className = 'history-result';
    value.textContent = line.result;
    const actions = document.createElement('div');
    actions.className = 'history-actions';
    for (const [label, text] of [
      ['复制算式', line.expression], ['复制结果', line.result],
      ['复制整条', `${line.expression.replace(/ /g, '')}=${line.result}`]
    ]) {
      const button = document.createElement('button');
      button.textContent = label;
      button.addEventListener('click', () => copy(text));
      actions.append(button);
    }
    row.append(expr, value, actions);
    list.append(row);
  }
}

function tap(key) { model.tap(key); render(); }
for (const row of model.rows) {
  for (const key of row) {
    const button = document.createElement('button');
    button.className = `key ${buttonStyle(key)}${key === 'digit-0' ? ' wide' : ''}`;
    button.textContent = buttonTitle(key);
    button.dataset.key = key;
    button.addEventListener('click', () => tap(key));
    byId('keypad').append(button);
  }
}

async function copy(text) {
  try {
    if (!await desktop.writeClipboard(text)) throw new Error('clipboard');
    status('已复制');
  } catch { status('复制失败，请重试'); }
}
async function paste() {
  try {
    const text = await desktop.readClipboard();
    if (!text.trim()) { status('剪贴板里没有算式'); return; }
    const ok = model.pasteExpression(text);
    render();
    byId('display').focus();
    if (!ok) status('无法计算，请检查算式');
  } catch { status('无法读取剪贴板，请重试'); }
}

async function setHistory(open) {
  historyOpen = open;
  byId('history').hidden = !open;
  byId('history-toggle').setAttribute('aria-expanded', String(open));
  byId('history-toggle').setAttribute('aria-label', open ? '收起历史记录' : '展开历史记录');
  try { await desktop.setHistoryOpen(open); } catch { status('窗口调整失败，请重新打开应用'); }
}
desktop.onPaste(paste);
byId('display').addEventListener('contextmenu', (event) => {
  if (window.getSelection().toString()) return;
  event.preventDefault(); desktop.showContextMenu();
});
for (const action of ['close', 'minimize', 'zoom']) {
  byId(`window-${action}`).addEventListener('click', () => desktop.windowControl(action));
}
byId('history-toggle').addEventListener('click', () => setHistory(!historyOpen));
byId('close-history').addEventListener('click', () => setHistory(false));
byId('clear-history').addEventListener('click', () => { model.clearHistory(); render(); });

const keys = { '+': 'add', '-': 'subtract', '*': 'multiply', '/': 'divide', '%': 'percent',
  '(': 'leftParenthesis', ')': 'rightParenthesis', '.': 'decimal', '=': 'equal', Enter: 'equal',
  Escape: 'clear', c: 'clear', C: 'clear' };
document.addEventListener('keydown', (event) => {
  if (event.isComposing || event.altKey) return;
  if (event.ctrlKey || event.metaKey) {
    switch (event.key.toLowerCase()) {
      case 'v': event.preventDefault(); paste(); return;
      case 'h': event.preventDefault(); setHistory(!historyOpen); return;
      case 'c':
        if (!window.getSelection().toString() && model.currentResult) {
          event.preventDefault(); copy(model.currentResult);
        }
        return;
      default: return;
    }
  }
  // Enter/Space activate focused utility buttons. Calculator keys always evaluate on Enter.
  if (event.key === 'Enter' && event.target.closest('button') && !event.target.closest('#keypad')) return;
  if (event.key === 'Backspace' || event.key === 'Delete') {
    event.preventDefault(); model.deleteBackward(); render(); return;
  }
  const key = /^[0-9]$/.test(event.key) ? `digit-${event.key}` : keys[event.key];
  if (key) { event.preventDefault(); tap(key); byId('display').focus(); }
});

render();
