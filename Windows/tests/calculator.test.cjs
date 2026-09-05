const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { CalculatorViewModel } = require('../src/calculator');

const evaluate = (expression) => {
  const model = new CalculatorViewModel();
  assert.equal(model.pasteExpression(expression), true, expression);
  return model.currentResult;
};

test('arithmetic, precedence, unary operators and implicit multiplication', () => {
  for (const [expression, result] of [
    ['2+3*4', '14'], ['(2+3)*4', '20'], ['2(3+4)', '14'],
    ['(2+3)(4+5)', '45'], ['-5+2', '-3'], ['2*-3', '-6'],
    ['200*10%', '20'], ['50%%', '0.005'], ['1/3', '0.33333333'],
    ['0.1+0.2', '0.3'], ['999999+1', '1,000,000'],
    ['2+5+18+55+（2*5）/3+75', '158.33333']
  ]) assert.equal(evaluate(expression), result, expression);
});
test('fullwidth symbols, bracket variants and copied records', () => {
  for (const text of ['２＋３×４', '２＋【３＊４】', '2+[3*4]', '2+｛3*4｝', '2+3*4=14'])
    assert.equal(evaluate(text), '14', text);
});
test('Windows also accepts the Chinese full stop as a decimal point', () => {
  // The current Swift fullwidth transform turns 。 into ｡ before its replacement
  // table runs; Windows intentionally fixes that normalization edge case.
  assert.equal(evaluate('１，０００＋２。５'), '1,002.5');
});
test('current-only display, AC preservation, independent history clearing', () => {
  const model = new CalculatorViewModel();
  assert.deepEqual(model.visibleLines(), []);
  model.pasteExpression('2+3'); model.pasteExpression('4+6');
  assert.equal(model.visibleLines().length, 1);
  assert.equal(model.visibleLines()[0].expression, '4 + 6');
  model.tap('clear');
  assert.equal(model.currentExpression, ''); assert.equal(model.currentResult, '');
  assert.equal(model.history.length, 2); assert.deepEqual(model.visibleLines(), []);
  model.tap('digit-9'); model.clearHistory();
  assert.equal(model.currentExpression, '9'); assert.equal(model.history.length, 0);
});
test('repeated operator replaces; equals does not duplicate; next digit starts fresh', () => {
  const m = new CalculatorViewModel();
  for (const b of ['digit-2', 'add', 'multiply', 'digit-3', 'equal', 'equal']) m.tap(b);
  assert.equal(m.currentExpression, '2 × 3'); assert.equal(m.currentResult, '6');
  assert.equal(m.history.length, 1);
  m.tap('add'); m.tap('digit-4'); m.tap('equal');
  assert.equal(m.currentExpression, '6 + 4'); assert.equal(m.currentResult, '10');
  m.tap('digit-7'); assert.equal(m.currentExpression, '7');
});
test('backspace edits original completed expression; preview closes brackets', () => {
  const m = new CalculatorViewModel(); m.pasteExpression('12+34'); m.deleteBackward();
  assert.equal(m.currentExpression, '12 + 3'); assert.equal(m.currentResult, '15');
  m.tap('clear');
  for (const b of ['digit-2', 'multiply', 'leftParenthesis', 'digit-3', 'add', 'digit-4']) m.tap(b);
  assert.equal(m.currentResult, '14'); m.tap('rightParenthesis'); m.tap('equal');
  assert.equal(m.currentResult, '14');
});
test('invalid input and division by zero never enter history or execute code', () => {
  const m = new CalculatorViewModel();
  for (const text of ['1/0', '(1+2', '1..2', 'process.exit()', '<script>alert(1)</script>', '1'.repeat(10001)]) {
    assert.equal(m.pasteExpression(text), false, text.slice(0, 30));
    assert.equal(m.history.length, 0);
  }
  m.pasteExpression('1/0'); assert.equal(m.currentResult, '错误');
  m.tap('clear'); m.tap('digit-5'); assert.equal(m.currentResult, '5');
});
test('history is capped at the latest 50; 500-term paste works', () => {
  const m = new CalculatorViewModel();
  for (let i = 0; i < 55; i++) m.pasteExpression(String(i));
  assert.equal(m.history.length, 50); assert.equal(m.history[0].result, '5');
  assert.equal(evaluate(Array(500).fill('1').join('+')), '500');
});
test('tiny/large results can continue from their raw value', () => {
  const m = new CalculatorViewModel(); m.pasteExpression('1/1000000000');
  m.tap('multiply'); for (const c of '1000000000') m.tap(`digit-${c}`); m.tap('equal');
  assert.equal(m.currentResult, '1');
  assert.equal(evaluate('1000000000000000+1'), '1,000,000,000,000,000');
});
const fixtures = path.join(__dirname, 'macos-parity.json');
if (fs.existsSync(fixtures)) {
  const sequences = JSON.parse(fs.readFileSync(fixtures, 'utf8'));
  for (const fixture of sequences) test(`macOS parity: ${fixture.name}`, () => {
    const m = new CalculatorViewModel();
    for (const step of fixture.steps) {
      if (step.action === 'paste') m.pasteExpression(step.value);
      else if (step.action === 'delete') m.deleteBackward();
      else if (step.action === 'clearHistory') m.clearHistory();
      else m.tap(step.value);
      assert.deepEqual({ expression: m.currentExpression, result: m.currentResult,
        history: m.history.map(({ expression, result }) => ({ expression, result })) }, step.expected);
    }
  });
}
