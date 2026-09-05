"""Capture public calculator state from the current Swift model (run on macOS)."""
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile

project = Path(__file__).resolve().parents[2]
source = project / 'ModernCalculator/CalculatorViewModel.swift'
text = source.read_text()
# Remove presentation-only declarations and SwiftUI observation, keeping the
# actual parser and state methods byte-for-byte for the reference execution.
text = 'import Foundation\n' + text[text.index('enum Operator:'):]
buttons = '''enum CalcButton {
case clear, parenthesis, leftParenthesis, rightParenthesis, percent, divide,
multiply, subtract, add, equal, decimal
case digit(Int)
}
'''
text = text.replace('final class CalculatorViewModel: ObservableObject', 'final class CalculatorViewModel')
text = text.replace('@Published ', '')
text = buttons + text
sequences = [
    ('current and history', [('paste', '2+3'), ('paste', '4+6'), ('tap', 'clear'), ('tap', 'digit-9'), ('clearHistory', '')]),
    ('operator replacement', [('tap', x) for x in ['digit-2', 'add', 'multiply', 'digit-3', 'equal', 'equal', 'add', 'digit-4', 'equal', 'digit-7']]),
    ('fullwidth long paste', [('paste', '2+5+18+55+（2*5）/3+75'), ('paste', '２＋【３＊４】'), ('paste', '１，０００＋２．５'), ('paste', '2+[3*4]')]),
    ('editing and preview', [('paste', '12+34'), ('delete', ''), ('tap', 'clear')] + [('tap', x) for x in ['digit-2', 'multiply', 'leftParenthesis', 'digit-3', 'add', 'digit-4', 'rightParenthesis', 'equal']]),
    ('decimal and percentages', [('paste', x) for x in ['0.1+0.2', '1/3', '200*10%', '50%%', '-5+2', '2*-3', '2(3+4)', '(2+3)(4+5)']]),
    ('errors and recovery', [('paste', x) for x in ['1/0', '(1+2', '1..2', 'hello']] + [('tap', 'clear'), ('tap', 'digit-5')]),
    ('rounding and extremes', [('paste', x) for x in ['1/1000000000', '1000000000000000+1', '123456789/13', '999999+1', '0.00000005', '0.000123456789']]),
    ('history limit', [('paste', str(i)) for i in range(55)]),
    ('long expression', [('paste', '+'.join(['1'] * 500))]),
]
data = [{'name': name, 'steps': [{'action': action, 'value': value} for action, value in steps]} for name, steps in sequences]
work = Path(tempfile.mkdtemp(prefix='calculator-parity-'))
(work / 'input.json').write_text(json.dumps(data, ensure_ascii=False))
runner = r'''
let input = try Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1]))
let fixtures = try JSONSerialization.jsonObject(with: input) as! [[String: Any]]
var output: [[String: Any]] = []
for fixture in fixtures {
    let model = CalculatorViewModel()
    var steps: [[String: Any]] = []
    for var step in fixture["steps"] as! [[String: Any]] {
        let action = step["action"] as! String
        let value = step["value"] as! String
        switch action {
        case "paste": model.pasteExpression(value)
        case "delete": model.deleteBackward()
        case "clearHistory": model.clearHistory()
        default:
            if value.hasPrefix("digit-") { model.tap(.digit(Int(value.dropFirst(6))!)) }
            else {
                let map: [String: CalcButton] = ["clear": .clear, "add": .add, "subtract": .subtract,
                    "multiply": .multiply, "divide": .divide, "equal": .equal, "decimal": .decimal,
                    "leftParenthesis": .leftParenthesis, "rightParenthesis": .rightParenthesis,
                    "parenthesis": .parenthesis, "percent": .percent]
                model.tap(map[value]!)
            }
        }
        step["expected"] = ["expression": model.currentExpression, "result": model.currentResult,
            "history": model.history.map { ["expression": $0.expression, "result": $0.result] }]
        steps.append(step)
    }
    output.append(["name": fixture["name"]!, "steps": steps])
}
let encoded = try JSONSerialization.data(withJSONObject: output, options: [.prettyPrinted, .sortedKeys])
try encoded.write(to: URL(fileURLWithPath: CommandLine.arguments[2]))
'''
(work / 'main.swift').write_text(text + runner)
subprocess.run(['swiftc', '-module-cache-path', str(work / 'module-cache'), str(work / 'main.swift'), '-o', str(work / 'reference')], check=True)
output = project / 'Windows/tests/macos-parity.json'
subprocess.run([str(work / 'reference'), str(work / 'input.json'), str(output)], check=True)
(project / 'Windows/tests/macos-parity-source.json').write_text(json.dumps({
    'source': 'ModernCalculator/CalculatorViewModel.swift',
    'sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
    'sequences': len(data), 'steps': sum(len(x['steps']) for x in data)
}, indent=2) + '\n')
print(f'Swift reference: {len(data)} sequences, {sum(len(x["steps"]) for x in data)} states -> {output}')
