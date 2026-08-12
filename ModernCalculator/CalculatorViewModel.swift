import Foundation
import SwiftUI

enum KeyStyle {
    case number, function, operation, equal

    var background: Color {
        switch self {
        case .number, .operation:
            return Color(red: 26 / 255, green: 29 / 255, blue: 34 / 255)
        case .function:
            return Color(red: 37 / 255, green: 41 / 255, blue: 49 / 255)
        case .equal:
            return Color(red: 124 / 255, green: 245 / 255, blue: 177 / 255)
        }
    }

    var foreground: Color {
        switch self {
        case .operation:
            return Color(red: 124 / 255, green: 245 / 255, blue: 177 / 255)
        case .equal:
            return Color(red: 11 / 255, green: 13 / 255, blue: 16 / 255)
        case .number, .function:
            return Color(red: 244 / 255, green: 246 / 255, blue: 248 / 255)
        }
    }
}

enum CalcButton: Hashable {
    case clear, parenthesis, leftParenthesis, rightParenthesis
    case percent, divide, multiply, subtract, add, equal, decimal
    case digit(Int)

    var title: String {
        switch self {
        case .clear: return "AC"
        case .parenthesis: return "( )"
        case .leftParenthesis: return "("
        case .rightParenthesis: return ")"
        case .percent: return "%"
        case .divide: return "÷"
        case .multiply: return "×"
        case .subtract: return "−"
        case .add: return "+"
        case .equal: return "="
        case .decimal: return "."
        case .digit(let number): return "\(number)"
        }
    }

    var style: KeyStyle {
        switch self {
        case .clear, .parenthesis, .leftParenthesis, .rightParenthesis, .percent:
            return .function
        case .divide, .multiply, .subtract, .add:
            return .operation
        case .equal:
            return .equal
        case .decimal, .digit:
            return .number
        }
    }
}

enum Operator: Equatable {
    case add, subtract, multiply, divide

    var symbol: String {
        switch self {
        case .add: return "+"
        case .subtract: return "−"
        case .multiply: return "×"
        case .divide: return "÷"
        }
    }
}

struct CalculationLine: Identifiable, Equatable {
    let id: UUID
    let expression: String
    let result: String
    let isCurrent: Bool

    init(id: UUID = UUID(), expression: String, result: String, isCurrent: Bool = false) {
        self.id = id
        self.expression = expression
        self.result = result
        self.isCurrent = isCurrent
    }
}

private enum ExpressionToken: Equatable {
    case number(String)
    case binary(Operator)
    case leftParenthesis
    case rightParenthesis
    case percent
}

private enum ExpressionError: Error {
    case invalidExpression
    case divisionByZero
}

private struct ExpressionParser {
    let tokens: [ExpressionToken]
    private var index = 0

    init(tokens: [ExpressionToken]) {
        self.tokens = tokens
    }

    mutating func evaluate() throws -> Double {
        guard !tokens.isEmpty else { throw ExpressionError.invalidExpression }
        let value = try parseExpression()
        guard index == tokens.count, value.isFinite else {
            throw ExpressionError.invalidExpression
        }
        return value
    }

    private mutating func parseExpression() throws -> Double {
        var value = try parseTerm()

        while index < tokens.count {
            if consume(.binary(.add)) {
                value += try parseTerm()
            } else if consume(.binary(.subtract)) {
                value -= try parseTerm()
            } else {
                break
            }
        }

        return value
    }

    private mutating func parseTerm() throws -> Double {
        var value = try parseUnary()

        while index < tokens.count {
            if consume(.binary(.multiply)) {
                value *= try parseUnary()
            } else if consume(.binary(.divide)) {
                let divisor = try parseUnary()
                guard divisor != 0 else { throw ExpressionError.divisionByZero }
                value /= divisor
            } else {
                break
            }
        }

        return value
    }

    private mutating func parseUnary() throws -> Double {
        if consume(.binary(.add)) {
            return try parseUnary()
        }

        if consume(.binary(.subtract)) {
            return -(try parseUnary())
        }

        var value = try parsePrimary()
        while consume(.percent) {
            value /= 100
        }
        return value
    }

    private mutating func parsePrimary() throws -> Double {
        guard index < tokens.count else { throw ExpressionError.invalidExpression }

        switch tokens[index] {
        case .number(let rawValue):
            guard let value = Double(rawValue) else {
                throw ExpressionError.invalidExpression
            }
            index += 1
            return value

        case .leftParenthesis:
            index += 1
            let value = try parseExpression()
            guard consume(.rightParenthesis) else {
                throw ExpressionError.invalidExpression
            }
            return value

        default:
            throw ExpressionError.invalidExpression
        }
    }

    private mutating func consume(_ token: ExpressionToken) -> Bool {
        guard index < tokens.count, tokens[index] == token else { return false }
        index += 1
        return true
    }
}

final class CalculatorViewModel: ObservableObject {
    @Published private(set) var history: [CalculationLine] = []
    @Published private(set) var currentExpression = "0"
    @Published private(set) var currentResult = "0"

    let rows: [[CalcButton]] = [
        [.clear, .parenthesis, .percent, .divide],
        [.digit(7), .digit(8), .digit(9), .multiply],
        [.digit(4), .digit(5), .digit(6), .subtract],
        [.digit(1), .digit(2), .digit(3), .add],
        [.digit(0), .decimal, .equal]
    ]

    private let currentLineID = UUID()
    private var tokens: [ExpressionToken] = []
    private var completedResultRaw: String?
    private var lastActionWasEqual = false

    var visibleLines: [CalculationLine] {
        visibleLines(limit: 3)
    }

    func visibleLines(limit: Int) -> [CalculationLine] {
        let lineLimit = max(1, limit)

        if lastActionWasEqual, !history.isEmpty {
            return Array(history.suffix(lineLimit))
        }

        let recent = Array(history.suffix(max(0, lineLimit - 1)))
        let current = CalculationLine(
            id: currentLineID,
            expression: currentExpression,
            result: currentResult,
            isCurrent: true
        )
        return recent + [current]
    }

    func tap(_ button: CalcButton) {
        switch button {
        case .digit(let number): inputDigit(number)
        case .decimal: inputDecimal()
        case .clear: clearCurrentInput()
        case .parenthesis: inputParenthesisToggle()
        case .leftParenthesis: inputLeftParenthesis()
        case .rightParenthesis: inputRightParenthesis()
        case .percent: inputPercent()
        case .add: inputOperator(.add)
        case .subtract: inputOperator(.subtract)
        case .multiply: inputOperator(.multiply)
        case .divide: inputOperator(.divide)
        case .equal: completeExpression()
        }

        refreshPresentation()
    }

    func clearHistory() {
        history.removeAll()
        refreshPresentation()
    }

    @discardableResult
    func pasteExpression(_ source: String) -> Bool {
        guard let pastedTokens = tokenizePastedExpression(source), !pastedTokens.isEmpty else {
            return false
        }

        tokens = pastedTokens
        completedResultRaw = nil
        lastActionWasEqual = false

        do {
            let result = try evaluate(tokens)
            commitCompletedExpression(result)
            refreshPresentation()
            return true
        } catch {
            refreshPresentation()
            return false
        }
    }

    func deleteBackward() {
        guard !tokens.isEmpty else { return }

        if lastActionWasEqual {
            lastActionWasEqual = false
            completedResultRaw = nil
        }

        if case .number(var rawValue) = tokens[tokens.count - 1] {
            rawValue.removeLast()
            if rawValue.isEmpty {
                tokens.removeLast()
            } else {
                tokens[tokens.count - 1] = .number(rawValue)
            }
        } else {
            tokens.removeLast()
        }

        refreshPresentation()
    }

    private func inputDigit(_ number: Int) {
        beginFreshExpressionIfNeeded()

        if case .number(let rawValue)? = tokens.last {
            let nextValue = rawValue == "0" ? "\(number)" : rawValue + "\(number)"
            tokens[tokens.count - 1] = .number(nextValue)
            return
        }

        insertImplicitMultiplicationIfNeeded()
        tokens.append(.number("\(number)"))
    }

    private func inputDecimal() {
        beginFreshExpressionIfNeeded()

        if case .number(let rawValue)? = tokens.last {
            guard !rawValue.contains(".") else { return }
            tokens[tokens.count - 1] = .number(rawValue + ".")
            return
        }

        insertImplicitMultiplicationIfNeeded()
        tokens.append(.number("0."))
    }

    private func inputOperator(_ newOperator: Operator) {
        continueFromCompletedResultIfNeeded()

        guard let lastToken = tokens.last else {
            if newOperator == .add || newOperator == .subtract {
                tokens.append(.binary(newOperator))
            }
            return
        }

        switch lastToken {
        case .number, .rightParenthesis, .percent:
            tokens.append(.binary(newOperator))

        case .binary(let existingOperator):
            if newOperator == .subtract, existingOperator != .subtract {
                tokens.append(.binary(.subtract))
            } else {
                tokens[tokens.count - 1] = .binary(newOperator)
            }

        case .leftParenthesis:
            if newOperator == .add || newOperator == .subtract {
                tokens.append(.binary(newOperator))
            }
        }
    }

    private func inputPercent() {
        beginFreshExpressionIfNeeded()
        guard let lastToken = tokens.last else { return }

        if lastToken.isValueEnding, lastToken != .percent {
            tokens.append(.percent)
        }
    }

    private func inputParenthesisToggle() {
        beginFreshExpressionIfNeeded()

        if unmatchedLeftParentheses > 0, tokens.last?.isValueEnding == true {
            inputRightParenthesis()
        } else {
            inputLeftParenthesis()
        }
    }

    private func inputLeftParenthesis() {
        beginFreshExpressionIfNeeded()
        insertImplicitMultiplicationIfNeeded()
        tokens.append(.leftParenthesis)
    }

    private func inputRightParenthesis() {
        beginFreshExpressionIfNeeded()
        guard unmatchedLeftParentheses > 0, tokens.last?.isValueEnding == true else { return }
        tokens.append(.rightParenthesis)
    }

    private func completeExpression() {
        guard !lastActionWasEqual, !tokens.isEmpty else { return }

        do {
            let result = try evaluate(tokens)
            commitCompletedExpression(result)
        } catch {
            currentResult = "错误"
        }
    }

    private func commitCompletedExpression(_ result: Double) {
        let expression = displayExpression(for: tokens)
        let rawResult = formatRaw(result)
        let formattedResult = formatForDisplay(rawResult)

        history.append(CalculationLine(expression: expression, result: formattedResult))
        if history.count > 50 {
            history.removeFirst(history.count - 50)
        }

        completedResultRaw = rawResult
        lastActionWasEqual = true
    }

    private func clearCurrentInput() {
        tokens.removeAll()
        completedResultRaw = nil
        lastActionWasEqual = false
    }

    private func beginFreshExpressionIfNeeded() {
        guard lastActionWasEqual else { return }
        tokens.removeAll()
        completedResultRaw = nil
        lastActionWasEqual = false
    }

    private func continueFromCompletedResultIfNeeded() {
        guard lastActionWasEqual, let completedResultRaw else { return }
        tokens = [.number(completedResultRaw)]
        self.completedResultRaw = nil
        lastActionWasEqual = false
    }

    private func insertImplicitMultiplicationIfNeeded() {
        guard tokens.last?.isValueEnding == true else { return }
        tokens.append(.binary(.multiply))
    }

    private var unmatchedLeftParentheses: Int {
        tokens.reduce(into: 0) { count, token in
            switch token {
            case .leftParenthesis: count += 1
            case .rightParenthesis: count = max(0, count - 1)
            default: break
            }
        }
    }

    private func refreshPresentation() {
        currentExpression = tokens.isEmpty ? "0" : displayExpression(for: tokens)

        if lastActionWasEqual, let completedResultRaw {
            currentResult = formatForDisplay(completedResultRaw)
            return
        }

        guard !tokens.isEmpty else {
            currentResult = "0"
            return
        }

        do {
            currentResult = formatForDisplay(formatRaw(try evaluate(previewTokens)))
        } catch ExpressionError.divisionByZero {
            currentResult = "错误"
        } catch {
            currentResult = "—"
        }
    }

    private var previewTokens: [ExpressionToken] {
        var preview = tokens

        while let lastToken = preview.last,
              lastToken.isBinaryOperator || lastToken == .leftParenthesis {
            preview.removeLast()
        }

        let balance = preview.reduce(into: 0) { count, token in
            switch token {
            case .leftParenthesis: count += 1
            case .rightParenthesis: count -= 1
            default: break
            }
        }

        if balance > 0 {
            preview.append(contentsOf: Array(repeating: .rightParenthesis, count: balance))
        }

        return preview
    }

    private func evaluate(_ expressionTokens: [ExpressionToken]) throws -> Double {
        var parser = ExpressionParser(tokens: expressionTokens)
        return try parser.evaluate()
    }

    private func tokenizePastedExpression(_ source: String) -> [ExpressionToken]? {
        let normalized = normalizeExpressionSymbols(source)
        var parsedTokens: [ExpressionToken] = []
        var numberBuffer = ""

        func appendBufferedNumber() -> Bool {
            guard !numberBuffer.isEmpty else { return true }
            guard numberBuffer != ".", Double(numberBuffer) != nil else { return false }

            if parsedTokens.last?.isValueEnding == true {
                parsedTokens.append(.binary(.multiply))
            }
            parsedTokens.append(.number(numberBuffer))
            numberBuffer = ""
            return true
        }

        for character in normalized {
            if character.wholeNumberValue != nil {
                numberBuffer.append(character)
                continue
            }

            if character == "." {
                guard !numberBuffer.contains(".") else { return nil }
                if numberBuffer.isEmpty {
                    numberBuffer = "0"
                }
                numberBuffer.append(character)
                continue
            }

            if character == "," || character.unicodeScalars.allSatisfy({
                CharacterSet.whitespacesAndNewlines.contains($0)
            }) {
                continue
            }

            guard appendBufferedNumber() else { return nil }

            switch character {
            case "+": parsedTokens.append(.binary(.add))
            case "-": parsedTokens.append(.binary(.subtract))
            case "*", "x", "X": parsedTokens.append(.binary(.multiply))
            case "/": parsedTokens.append(.binary(.divide))
            case "%": parsedTokens.append(.percent)

            case "(":
                if parsedTokens.last?.isValueEnding == true {
                    parsedTokens.append(.binary(.multiply))
                }
                parsedTokens.append(.leftParenthesis)

            case ")": parsedTokens.append(.rightParenthesis)
            case "=": break
            default: return nil
            }

            if character == "=" {
                break
            }
        }

        guard appendBufferedNumber() else { return nil }
        return parsedTokens
    }

    private func normalizeExpressionSymbols(_ source: String) -> String {
        let halfWidthSource = source.applyingTransform(.fullwidthToHalfwidth, reverse: false) ?? source

        return String(halfWidthSource.map { character in
            switch character {
            case "（", "[", "［", "【", "{", "｛": return "("
            case "）", "]", "］", "】", "}", "｝": return ")"
            case "＋": return "+"
            case "−", "–", "—", "﹣": return "-"
            case "×", "✕", "✖", "＊", "∙": return "*"
            case "÷", "／", "∕": return "/"
            case "％": return "%"
            case "．", "。": return "."
            case "，": return ","
            case "＝": return "="
            case "\u{00A0}", "\u{2007}", "\u{202F}": return " "
            default: return character
            }
        })
    }

    private func displayExpression(for expressionTokens: [ExpressionToken]) -> String {
        expressionTokens.map { token in
            switch token {
            case .number(let rawValue): return formatForDisplay(rawValue)
            case .binary(let operation): return operation.symbol
            case .leftParenthesis: return "("
            case .rightParenthesis: return ")"
            case .percent: return "%"
            }
        }
        .joined(separator: " ")
        .replacingOccurrences(of: "( ", with: "(")
        .replacingOccurrences(of: " )", with: ")")
        .replacingOccurrences(of: " %", with: "%")
    }

    private func formatRaw(_ value: Double) -> String {
        if value == value.rounded(), abs(value) < 1e15 {
            return String(format: "%.0f", value)
        }

        var valueString = String(format: "%.8g", value)
        if valueString.contains("e") {
            valueString = String(format: "%.4e", value)
        }
        return valueString
    }

    private func formatForDisplay(_ rawValue: String) -> String {
        guard !rawValue.hasSuffix("."), let number = Double(rawValue) else {
            return rawValue
        }

        let formatter = NumberFormatter()
        formatter.locale = Locale(identifier: "en_US")
        formatter.numberStyle = .decimal
        formatter.usesGroupingSeparator = true
        formatter.minimumFractionDigits = 0
        formatter.maximumFractionDigits = 8
        return formatter.string(from: NSNumber(value: number)) ?? rawValue
    }
}

private extension ExpressionToken {
    var isValueEnding: Bool {
        switch self {
        case .number, .rightParenthesis, .percent: return true
        default: return false
        }
    }

    var isBinaryOperator: Bool {
        if case .binary = self { return true }
        return false
    }
}
