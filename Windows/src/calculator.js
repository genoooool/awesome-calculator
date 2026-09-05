/**
 * Awesome Calculator - Core Logic
 * Ported from CalculatorViewModel.swift
 */

// ─── Operator ──────────────────────────────────────────────
const Operator = {
  ADD: 'add',
  SUBTRACT: 'subtract',
  MULTIPLY: 'multiply',
  DIVIDE: 'divide',
};

const operatorSymbol = {
  [Operator.ADD]: '+',
  [Operator.SUBTRACT]: '\u2212', // −
  [Operator.MULTIPLY]: '\u00D7', // ×
  [Operator.DIVIDE]: '\u00F7',   // ÷
};

// ─── ExpressionToken ───────────────────────────────────────
// Token types: { type: 'number', value: string }
//              { type: 'binary', op: Operator }
//              { type: 'leftParen' }
//              { type: 'rightParen' }
//              { type: 'percent' }

function isValueEnding(token) {
  if (!token) return false;
  return token.type === 'number' || token.type === 'rightParen' || token.type === 'percent';
}

function isBinaryOperator(token) {
  return token && token.type === 'binary';
}

// ─── ExpressionParser (recursive descent) ──────────────────
class ExpressionParser {
  constructor(tokens) {
    this.tokens = tokens;
    this.index = 0;
  }

  evaluate() {
    if (this.tokens.length === 0) throw new Error('invalidExpression');
    const value = this.parseExpression();
    if (this.index !== this.tokens.length || !Number.isFinite(value)) {
      throw new Error('invalidExpression');
    }
    return value;
  }

  parseExpression() {
    let value = this.parseTerm();
    while (this.index < this.tokens.length) {
      if (this.consumeBinary(Operator.ADD)) {
        value += this.parseTerm();
      } else if (this.consumeBinary(Operator.SUBTRACT)) {
        value -= this.parseTerm();
      } else {
        break;
      }
    }
    return value;
  }

  parseTerm() {
    let value = this.parseUnary();
    while (this.index < this.tokens.length) {
      if (this.consumeBinary(Operator.MULTIPLY)) {
        value *= this.parseUnary();
      } else if (this.consumeBinary(Operator.DIVIDE)) {
        const divisor = this.parseUnary();
        if (divisor === 0) throw new Error('divisionByZero');
        value /= divisor;
      } else {
        break;
      }
    }
    return value;
  }

  parseUnary() {
    if (this.consumeBinary(Operator.ADD)) {
      return this.parseUnary();
    }
    if (this.consumeBinary(Operator.SUBTRACT)) {
      return -this.parseUnary();
    }
    let value = this.parsePrimary();
    while (this.consume('percent')) {
      value /= 100;
    }
    return value;
  }

  parsePrimary() {
    if (this.index >= this.tokens.length) throw new Error('invalidExpression');
    const token = this.tokens[this.index];
    if (token.type === 'number') {
      const value = parseFloat(token.value);
      if (isNaN(value)) throw new Error('invalidExpression');
      this.index++;
      return value;
    }
    if (token.type === 'leftParen') {
      this.index++;
      const value = this.parseExpression();
      if (!this.consume('rightParen')) throw new Error('invalidExpression');
      return value;
    }
    throw new Error('invalidExpression');
  }

  consume(type) {
    if (this.index < this.tokens.length && this.tokens[this.index].type === type) {
      this.index++;
      return true;
    }
    return false;
  }

  consumeBinary(op) {
    if (this.index < this.tokens.length &&
        this.tokens[this.index].type === 'binary' &&
        this.tokens[this.index].op === op) {
      this.index++;
      return true;
    }
    return false;
  }
}

// ─── CalculatorViewModel ───────────────────────────────────
class CalculatorViewModel {
  constructor() {
    this.history = [];
    this.currentExpression = '';
    this.currentResult = '';
    this.tokens = [];
    this.completedResultRaw = null;
    this.lastActionWasEqual = false;
    this.currentLineID = this._uuid();

    this.rows = [
      ['clear', 'parenthesis', 'percent', 'divide'],
      ['digit-7', 'digit-8', 'digit-9', 'multiply'],
      ['digit-4', 'digit-5', 'digit-6', 'subtract'],
      ['digit-1', 'digit-2', 'digit-3', 'add'],
      ['digit-0', 'decimal', 'equal'],
    ];
  }

  _uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  visibleLines() {
    if (!this.currentExpression) return [];
    return [{
      id: this.currentLineID,
      expression: this.currentExpression,
      result: this.currentResult,
      isCurrent: true,
    }];
  }

  tap(button) {
    switch (button) {
      case 'clear': this.clearCurrentInput(); break;
      case 'parenthesis': this.inputParenthesisToggle(); break;
      case 'leftParenthesis': this.inputLeftParenthesis(); break;
      case 'rightParenthesis': this.inputRightParenthesis(); break;
      case 'percent': this.inputPercent(); break;
      case 'divide': this.inputOperator(Operator.DIVIDE); break;
      case 'multiply': this.inputOperator(Operator.MULTIPLY); break;
      case 'subtract': this.inputOperator(Operator.SUBTRACT); break;
      case 'add': this.inputOperator(Operator.ADD); break;
      case 'equal': this.completeExpression(); break;
      case 'decimal': this.inputDecimal(); break;
      default:
        if (button.startsWith('digit-')) {
          this.inputDigit(parseInt(button.split('-')[1]));
        }
        break;
    }
    this.refreshPresentation();
  }

  clearHistory() {
    this.history = [];
    this.refreshPresentation();
  }

  pasteExpression(source) {
    if (typeof source !== 'string' || source.length > 10000) return false;
    const pastedTokens = this.tokenizePastedExpression(source);
    if (!pastedTokens || pastedTokens.length === 0) return false;

    this.tokens = pastedTokens;
    this.completedResultRaw = null;
    this.lastActionWasEqual = false;

    try {
      const result = this.evaluate(this.tokens);
      this.commitCompletedExpression(result);
      this.refreshPresentation();
      return true;
    } catch (e) {
      this.refreshPresentation();
      return false;
    }
  }

  deleteBackward() {
    if (this.tokens.length === 0) return;
    if (this.lastActionWasEqual) {
      this.lastActionWasEqual = false;
      this.completedResultRaw = null;
    }
    const lastToken = this.tokens[this.tokens.length - 1];
    if (lastToken.type === 'number') {
      let rawValue = lastToken.value.slice(0, -1);
      if (rawValue.length === 0) {
        this.tokens.pop();
      } else {
        this.tokens[this.tokens.length - 1] = { type: 'number', value: rawValue };
      }
    } else {
      this.tokens.pop();
    }
    this.refreshPresentation();
  }

  // ─── Input handlers ─────────────────────────────────
  inputDigit(number) {
    this.beginFreshExpressionIfNeeded();
    const lastToken = this.tokens[this.tokens.length - 1];
    if (lastToken && lastToken.type === 'number') {
      const nextValue = lastToken.value === '0' ? `${number}` : lastToken.value + `${number}`;
      this.tokens[this.tokens.length - 1] = { type: 'number', value: nextValue };
      return;
    }
    this.insertImplicitMultiplicationIfNeeded();
    this.tokens.push({ type: 'number', value: `${number}` });
  }

  inputDecimal() {
    this.beginFreshExpressionIfNeeded();
    const lastToken = this.tokens[this.tokens.length - 1];
    if (lastToken && lastToken.type === 'number') {
      if (lastToken.value.includes('.')) return;
      this.tokens[this.tokens.length - 1] = { type: 'number', value: lastToken.value + '.' };
      return;
    }
    this.insertImplicitMultiplicationIfNeeded();
    this.tokens.push({ type: 'number', value: '0.' });
  }

  inputOperator(newOperator) {
    this.continueFromCompletedResultIfNeeded();
    const lastToken = this.tokens[this.tokens.length - 1];

    if (!lastToken) {
      if (newOperator === Operator.ADD || newOperator === Operator.SUBTRACT) {
        this.tokens.push({ type: 'binary', op: newOperator });
      }
      return;
    }

    if (lastToken.type === 'number' || lastToken.type === 'rightParen' || lastToken.type === 'percent') {
      this.tokens.push({ type: 'binary', op: newOperator });
    } else if (lastToken.type === 'binary') {
      this.tokens[this.tokens.length - 1] = { type: 'binary', op: newOperator };
    } else if (lastToken.type === 'leftParen') {
      if (newOperator === Operator.ADD || newOperator === Operator.SUBTRACT) {
        this.tokens.push({ type: 'binary', op: newOperator });
      }
    }
  }

  inputPercent() {
    this.beginFreshExpressionIfNeeded();
    const lastToken = this.tokens[this.tokens.length - 1];
    if (!lastToken) return;
    if (isValueEnding(lastToken) && lastToken.type !== 'percent') {
      this.tokens.push({ type: 'percent' });
    }
  }

  inputParenthesisToggle() {
    this.beginFreshExpressionIfNeeded();
    if (this.unmatchedLeftParentheses > 0 && isValueEnding(this.tokens[this.tokens.length - 1])) {
      this.inputRightParenthesis();
    } else {
      this.inputLeftParenthesis();
    }
  }

  inputLeftParenthesis() {
    this.beginFreshExpressionIfNeeded();
    this.insertImplicitMultiplicationIfNeeded();
    this.tokens.push({ type: 'leftParen' });
  }

  inputRightParenthesis() {
    this.beginFreshExpressionIfNeeded();
    if (this.unmatchedLeftParentheses <= 0) return;
    if (!isValueEnding(this.tokens[this.tokens.length - 1])) return;
    this.tokens.push({ type: 'rightParen' });
  }

  completeExpression() {
    if (this.lastActionWasEqual || this.tokens.length === 0) return;
    try {
      const result = this.evaluate(this.tokens);
      this.commitCompletedExpression(result);
    } catch (e) {
      this.currentResult = '错误';
    }
  }

  commitCompletedExpression(result) {
    const expression = this.displayExpression(this.tokens);
    const rawResult = this.formatRaw(result);
    const formattedResult = this.formatForDisplay(rawResult);

    this.history.push({
      id: this._uuid(),
      expression,
      result: formattedResult,
      isCurrent: false,
    });
    if (this.history.length > 50) {
      this.history.splice(0, this.history.length - 50);
    }
    this.completedResultRaw = rawResult;
    this.lastActionWasEqual = true;
  }

  clearCurrentInput() {
    this.tokens = [];
    this.completedResultRaw = null;
    this.lastActionWasEqual = false;
  }

  beginFreshExpressionIfNeeded() {
    if (!this.lastActionWasEqual) return;
    this.tokens = [];
    this.completedResultRaw = null;
    this.lastActionWasEqual = false;
  }

  continueFromCompletedResultIfNeeded() {
    if (!this.lastActionWasEqual || !this.completedResultRaw) return;
    this.tokens = [{ type: 'number', value: this.completedResultRaw }];
    this.completedResultRaw = null;
    this.lastActionWasEqual = false;
  }

  insertImplicitMultiplicationIfNeeded() {
    if (!isValueEnding(this.tokens[this.tokens.length - 1])) return;
    this.tokens.push({ type: 'binary', op: Operator.MULTIPLY });
  }

  get unmatchedLeftParentheses() {
    return this.tokens.reduce((count, token) => {
      if (token.type === 'leftParen') return count + 1;
      if (token.type === 'rightParen') return Math.max(0, count - 1);
      return count;
    }, 0);
  }

  // ─── Presentation ────────────────────────────────────
  refreshPresentation() {
    this.currentExpression = this.tokens.length === 0 ? '' : this.displayExpression(this.tokens);

    if (this.lastActionWasEqual && this.completedResultRaw) {
      this.currentResult = this.formatForDisplay(this.completedResultRaw);
      return;
    }

    if (this.tokens.length === 0) {
      this.currentResult = '';
      return;
    }

    try {
      this.currentResult = this.formatForDisplay(this.formatRaw(this.evaluate(this.previewTokens)));
    } catch (e) {
      if (e.message === 'divisionByZero') {
        this.currentResult = '\u9519\u8bef';
      } else {
        this.currentResult = '—';
      }
    }
  }

  get previewTokens() {
    let preview = [...this.tokens];
    while (preview.length > 0) {
      const last = preview[preview.length - 1];
      if (isBinaryOperator(last) || last.type === 'leftParen') {
        preview.pop();
      } else {
        break;
      }
    }
    const balance = preview.reduce((count, token) => {
      if (token.type === 'leftParen') return count + 1;
      if (token.type === 'rightParen') return count - 1;
      return count;
    }, 0);
    if (balance > 0) {
      for (let i = 0; i < balance; i++) {
        preview.push({ type: 'rightParen' });
      }
    }
    return preview;
  }

  evaluate(expressionTokens) {
    const parser = new ExpressionParser(expressionTokens);
    return parser.evaluate();
  }

  // ─── Paste / Tokenize ────────────────────────────────
  tokenizePastedExpression(source) {
    const normalized = this.normalizeExpressionSymbols(source);
    const parsedTokens = [];
    let numberBuffer = '';

    const appendBufferedNumber = () => {
      if (numberBuffer === '') return true;
      if (numberBuffer === '.' || isNaN(parseFloat(numberBuffer))) return false;
      if (isValueEnding(parsedTokens[parsedTokens.length - 1])) {
        parsedTokens.push({ type: 'binary', op: Operator.MULTIPLY });
      }
      parsedTokens.push({ type: 'number', value: numberBuffer });
      numberBuffer = '';
      return true;
    };

    for (const char of normalized) {
      if (/[0-9]/.test(char)) {
        numberBuffer += char;
        continue;
      }
      if (char === '.') {
        if (numberBuffer.includes('.')) return null;
        if (numberBuffer === '') numberBuffer = '0';
        numberBuffer += char;
        continue;
      }
      if (char === ',' || /\s/.test(char)) continue;

      if (!appendBufferedNumber()) return null;

      switch (char) {
        case '+': parsedTokens.push({ type: 'binary', op: Operator.ADD }); break;
        case '-': parsedTokens.push({ type: 'binary', op: Operator.SUBTRACT }); break;
        case '*': case 'x': case 'X': parsedTokens.push({ type: 'binary', op: Operator.MULTIPLY }); break;
        case '/': parsedTokens.push({ type: 'binary', op: Operator.DIVIDE }); break;
        case '%': parsedTokens.push({ type: 'percent' }); break;
        case '(':
          if (isValueEnding(parsedTokens[parsedTokens.length - 1])) {
            parsedTokens.push({ type: 'binary', op: Operator.MULTIPLY });
          }
          parsedTokens.push({ type: 'leftParen' });
          break;
        case ')': parsedTokens.push({ type: 'rightParen' }); break;
        case '=': return appendBufferedNumber() ? parsedTokens : null;
        default: return null;
      }
    }

    if (!appendBufferedNumber()) return null;
    return parsedTokens;
  }

  normalizeExpressionSymbols(source) {
    // Full-width to half-width conversion
    let result = source.replace(/[\uFF01-\uFF5E]/g,
      (char) => String.fromCharCode(char.charCodeAt(0) - 0xFEE0));
    const replacements = {
      '\uFF08': '(', '\u3010': '(', '\u3008': '(', '\uFE3D': '(', '\uFF3B': '[', '\uFF5B': '{',
      '\uFF09': ')', '\u3011': ')', '\u3009': ')', '\uFE3E': ')', '\uFF3D': ']', '\uFF5D': '}',
      '\uFF0B': '+',
      '\u2212': '-', '\u2013': '-', '\u2014': '-', '\uFE63': '-',
      '\u00D7': '*', '\u2715': '*', '\u2716': '*', '\uFF0A': '*', '\u2219': '*',
      '\u00F7': '/', '\uFF0F': '/', '\u2215': '/',
      '\uFF05': '%',
      '\uFF0E': '.', '\u3002': '.',
      '\uFF0C': ',',
      '\uFF1D': '=',
      '\u00A0': ' ', '\u2007': ' ', '\u202F': ' ',
    };
    let normalized = '';
    for (const char of result) {
      if ('[{'.includes(char)) normalized += '(';
      else if (']}'.includes(char)) normalized += ')';
      else normalized += replacements[char] || char;
    }
    // Also handle fullwidth digits
    normalized = normalized.replace(/[\uFF10-\uFF19]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFF10 + 0x30));
    return normalized;
  }

  displayExpression(expressionTokens) {
    let str = expressionTokens.map((token) => {
      switch (token.type) {
        case 'number': return this.formatForDisplay(token.value);
        case 'binary': return operatorSymbol[token.op];
        case 'leftParen': return '(';
        case 'rightParen': return ')';
        case 'percent': return '%';
      }
    }).join(' ');

    str = str.replace(/\( /g, '(').replace(/ \)/g, ')').replace(/ %/g, '%');
    return str;
  }

  formatRaw(value) {
    if (value === Math.round(value) && Math.abs(value) < 1e15) {
      return String(Math.round(value));
    }
    // Swift uses %.8g, with scientific results rounded to %.4e.
    const precise = Number(value.toPrecision(8));
    if (Math.abs(precise) >= 1e8 || (precise !== 0 && Math.abs(precise) < 1e-4)) {
      return value.toExponential(4);
    }
    return String(precise);
  }

  formatForDisplay(rawValue) {
    if (rawValue.endsWith('.')) return rawValue;
    const number = parseFloat(rawValue);
    if (isNaN(number)) return rawValue;

    // Use en-US formatting (commas as thousands separator)
    return number.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 8,
    });
  }
}

// ─── Button definitions ────────────────────────────────────
const buttonTitles = {
  'clear': 'AC',
  'parenthesis': '( )',
  'leftParenthesis': '(',
  'rightParenthesis': ')',
  'percent': '%',
  'divide': '\u00F7',
  'multiply': '\u00D7',
  'subtract': '\u2212',
  'add': '+',
  'equal': '=',
  'decimal': '.',
};

function buttonTitle(button) {
  if (button.startsWith('digit-')) return button.split('-')[1];
  return buttonTitles[button] || button;
}

const buttonStyles = {
  'clear': 'function',
  'parenthesis': 'function',
  'leftParenthesis': 'function',
  'rightParenthesis': 'function',
  'percent': 'function',
  'divide': 'operation',
  'multiply': 'operation',
  'subtract': 'operation',
  'add': 'operation',
  'equal': 'equal',
  'decimal': 'number',
};

function buttonStyle(button) {
  if (button.startsWith('digit-')) return 'number';
  return buttonStyles[button] || 'number';
}

if (typeof module !== 'undefined') {
  module.exports = { CalculatorViewModel, buttonTitle, buttonStyle, Operator };
}
