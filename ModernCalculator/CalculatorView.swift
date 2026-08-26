import AppKit
import SwiftUI

private enum CalculatorPalette {
    static let background = Color(red: 11 / 255, green: 13 / 255, blue: 16 / 255)
    static let primaryText = Color(red: 244 / 255, green: 246 / 255, blue: 248 / 255)
    static let secondaryText = Color(red: 111 / 255, green: 119 / 255, blue: 130 / 255)
    static let variableText = Color(red: 190 / 255, green: 174 / 255, blue: 160 / 255)
    static let numberText = Color(red: 126 / 255, green: 167 / 255, blue: 232 / 255)
    static let mint = Color(red: 124 / 255, green: 245 / 255, blue: 177 / 255)
}

private enum CalculatorLayout {
    static let calculatorWidth: CGFloat = 264
    static let historyWidth: CGFloat = 360
    static let expandedWidth = calculatorWidth + historyWidth
    static let compactContentHeight: CGFloat = 528
    static let keySize: CGFloat = 56
    static let keyHorizontalSpacing: CGFloat = 8
    static let keyVerticalSpacing: CGFloat = 5
    static let wideKeyWidth = keySize * 2 + keyHorizontalSpacing
    static let keypadEdgeInset: CGFloat = 8
    static let windowCornerRadius: CGFloat = 34
}

struct CalculatorView: View {
    @StateObject private var viewModel = CalculatorViewModel()
    @State private var isHistoryPresented = false
    @State private var isHistoryWindowExpanded = false

    var body: some View {
        HStack(spacing: 0) {
            calculatorPanel

            if isHistoryPresented {
                HistorySidebar(
                    lines: viewModel.history,
                    clearAction: viewModel.clearHistory,
                    closeAction: toggleHistory
                )
                .frame(width: CalculatorLayout.historyWidth)
                .transition(.move(edge: .trailing).combined(with: .opacity))
            }
        }
        .frame(
            minWidth: isHistoryWindowExpanded ? CalculatorLayout.expandedWidth : CalculatorLayout.calculatorWidth,
            maxWidth: isHistoryWindowExpanded ? CalculatorLayout.expandedWidth : CalculatorLayout.calculatorWidth,
            minHeight: CalculatorLayout.compactContentHeight,
            maxHeight: .infinity,
            alignment: .leading
        )
        .background(WindowConfigurator(isHistoryPresented: isHistoryWindowExpanded))
        .background(KeyboardEventMonitor(onKeyDown: handleKeyDown))
    }

    private var calculatorPanel: some View {
        ZStack {
            CalculatorPalette.background
                .ignoresSafeArea()

            VStack(spacing: 0) {
                topBar
                calculationTape(lines: visibleLines(for: CalculatorLayout.compactContentHeight))
                    .frame(maxHeight: .infinity, alignment: .center)
                    .offset(y: -6)

                keypad
                    .padding(.bottom, CalculatorLayout.keypadEdgeInset)
            }
        }
        .frame(width: CalculatorLayout.calculatorWidth)
        .frame(minHeight: CalculatorLayout.compactContentHeight, maxHeight: .infinity)
    }

    private var topBar: some View {
        HStack(spacing: 0) {
            WindowControls()

            Spacer()

            Button(action: toggleHistory) {
                Image(systemName: "clock.arrow.circlepath")
                    .font(.system(size: 16, weight: .medium))
                    .foregroundStyle(isHistoryPresented ? CalculatorPalette.mint : CalculatorPalette.secondaryText)
                    .frame(width: 32, height: 32)
                    .contentShape(Circle())
            }
            .buttonStyle(.plain)
            .help(isHistoryPresented ? "收起计算记录" : "展开计算记录")
        }
        .padding(.horizontal, 24)
        .padding(.top, 7)
        .frame(height: 44)
    }

    private func toggleHistory() {
        if isHistoryPresented {
            withAnimation(.easeOut(duration: 0.12)) {
                isHistoryPresented = false
            }

            DispatchQueue.main.asyncAfter(deadline: .now() + 0.12) {
                isHistoryWindowExpanded = false
            }
        } else {
            isHistoryWindowExpanded = true

            DispatchQueue.main.asyncAfter(deadline: .now() + 0.03) {
                withAnimation(.easeOut(duration: 0.16)) {
                    isHistoryPresented = true
                }
            }
        }
    }

    private func calculationTape(lines: [CalculationLine]) -> some View {
        VStack(spacing: 16) {
            ForEach(lines) { line in
                CalculationLineView(line: line)
            }
        }
        .frame(maxWidth: .infinity, alignment: .top)
        .padding(.horizontal, 24)
        .transaction { transaction in
            transaction.animation = nil
            transaction.disablesAnimations = true
        }
    }

    private var keypad: some View {
        VStack(spacing: CalculatorLayout.keyVerticalSpacing) {
            ForEach(Array(viewModel.rows.enumerated()), id: \.offset) { rowIndex, row in
                HStack(spacing: CalculatorLayout.keyHorizontalSpacing) {
                    ForEach(row, id: \.self) { button in
                        CalculatorKey(
                            button: button,
                            isWide: rowIndex == viewModel.rows.count - 1 && button == .digit(0)
                        ) {
                            viewModel.tap(button)
                        }
                    }
                }
            }
        }
    }

    private func handleKeyDown(_ event: NSEvent) -> Bool {
        if event.modifierFlags.contains(.command),
           event.charactersIgnoringModifiers?.lowercased() == "v",
           let pastedText = NSPasteboard.general.string(forType: .string) {
            viewModel.pasteExpression(pastedText)
            return true
        }

        let blockedModifiers: NSEvent.ModifierFlags = [.command, .control, .option]
        guard event.modifierFlags.intersection(blockedModifiers).isEmpty else {
            return false
        }

        switch event.keyCode {
        case 36, 76:
            viewModel.tap(.equal)
            return true
        case 51, 117:
            viewModel.deleteBackward()
            return true
        case 53:
            viewModel.tap(.clear)
            return true
        default:
            break
        }

        guard let character = event.characters?.first else { return false }

        if let digit = character.wholeNumberValue {
            viewModel.tap(.digit(digit))
            return true
        }

        let button: CalcButton?
        switch character {
        case ".", ",": button = .decimal
        case "(": button = .leftParenthesis
        case ")": button = .rightParenthesis
        case "+": button = .add
        case "-", "−": button = .subtract
        case "*", "×", "x", "X": button = .multiply
        case "/", "÷": button = .divide
        case "%": button = .percent
        case "=": button = .equal
        case "c", "C": button = .clear
        default: button = nil
        }

        guard let button else { return false }
        viewModel.tap(button)
        return true
    }

    private func visibleLines(for height: CGFloat) -> [CalculationLine] {
        let availableHeight = max(72, height - 360)
        let candidates = viewModel.visibleLines
        var selected: [CalculationLine] = []
        var occupiedHeight: CGFloat = 0

        for line in candidates.reversed() {
            let spacing: CGFloat = selected.isEmpty ? 0 : 16
            let nextHeight = estimatedHeight(for: line) + spacing

            guard selected.isEmpty || occupiedHeight + nextHeight <= availableHeight else {
                break
            }

            selected.append(line)
            occupiedHeight += nextHeight
        }

        return selected.reversed()
    }

    private func estimatedHeight(for line: CalculationLine) -> CGFloat {
        let font = NSFont.monospacedSystemFont(ofSize: 14, weight: .medium)
        let expressionWidth = (line.expression as NSString).size(withAttributes: [.font: font]).width

        if expressionWidth <= 168 {
            return 24
        }

        let expressionRows = min(3, max(1, Int(ceil(expressionWidth / 272))))
        return CGFloat(expressionRows * 17 + 21)
    }
}

private struct CalculationLineView: View {
    let line: CalculationLine

    var body: some View {
        ViewThatFits(in: .horizontal) {
            HStack(spacing: 8) {
                expressionContent
                    .fixedSize(horizontal: true, vertical: true)

                Spacer(minLength: 8)
                resultContent
            }

            VStack(alignment: .leading, spacing: 4) {
                expressionContent
                    .lineLimit(3)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)

                HStack {
                    Spacer(minLength: 0)
                    resultContent
                }
            }
        }
        .frame(minHeight: 24)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(line.expression)，结果 \(line.result)")
    }

    private var expressionContent: some View {
        HStack(spacing: 6) {
            SyntaxExpression(expression: line.expression)
                .multilineTextAlignment(.leading)

            if line.isCurrent {
                Rectangle()
                    .fill(CalculatorPalette.mint)
                    .frame(width: 1, height: 16)
            }
        }
    }

    private var resultContent: some View {
        Text(line.result)
            .font(.system(size: 14, weight: line.isCurrent ? .semibold : .medium, design: .monospaced))
            .foregroundStyle(CalculatorPalette.mint.opacity(line.isCurrent ? 1 : 0.74))
            .lineLimit(1)
            .minimumScaleFactor(0.76)
            .frame(width: 88, alignment: .trailing)
    }
}

private struct SyntaxExpression: View {
    let expression: String

    var body: some View {
        renderedText
            .font(.system(size: 14, weight: .medium, design: .monospaced))
    }

    private var renderedText: Text {
        let tokens = expression.split(separator: " ", omittingEmptySubsequences: false)

        return tokens.enumerated().reduce(Text("")) { partial, item in
            let (index, token) = item
            let separator = index == tokens.count - 1 ? "" : " "
            let tokenString = String(token)
            return partial + Text(tokenString + separator).foregroundColor(color(for: tokenString))
        }
    }

    private func color(for token: String) -> Color {
        let numericToken = token
            .replacingOccurrences(of: ",", with: "")
            .replacingOccurrences(of: "%", with: "")
            .replacingOccurrences(of: "$", with: "")

        if Double(numericToken) != nil {
            return CalculatorPalette.numberText
        }

        if ["+", "−", "×", "÷", "=", "%", "(", ")"].contains(token) {
            return CalculatorPalette.primaryText
        }

        return CalculatorPalette.variableText
    }
}

private struct WindowControls: View {
    var body: some View {
        HStack(spacing: 9) {
            WindowControlButton(color: Color(red: 1, green: 95 / 255, blue: 87 / 255), label: "关闭") {
                NSApp.terminate(nil)
            }

            WindowControlButton(color: Color(red: 1, green: 189 / 255, blue: 46 / 255), label: "最小化") {
                activeWindow?.miniaturize(nil)
            }

            WindowControlButton(color: Color(red: 39 / 255, green: 201 / 255, blue: 63 / 255), label: "缩放") {
                activeWindow?.zoom(nil)
            }
        }
        .frame(height: 32)
    }

    private var activeWindow: NSWindow? {
        NSApp.keyWindow ?? NSApp.mainWindow ?? NSApp.windows.first(where: \.isVisible)
    }
}

private struct WindowControlButton: View {
    let color: Color
    let label: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Circle()
                .fill(color)
                .frame(width: 14, height: 14)
                .overlay {
                    Circle()
                        .stroke(.black.opacity(0.14), lineWidth: 0.5)
                }
                .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }
}

private struct CalculatorKey: View {
    let button: CalcButton
    let isWide: Bool
    let action: () -> Void

    @State private var isHovering = false

    var body: some View {
        Button(action: action) {
            Text(button.title)
                .font(.system(
                    size: button.style == .operation || button.style == .equal ? 20 : 18,
                    weight: button.style == .number ? .regular : .medium,
                    design: .rounded
                ))
                .foregroundStyle(button.style.foreground)
                .frame(
                    width: isWide ? CalculatorLayout.wideKeyWidth : CalculatorLayout.keySize,
                    height: CalculatorLayout.keySize
                )
                .background {
                    KeyShape(isWide: isWide)
                        .fill(button.style.background)
                }
                .overlay {
                    KeyShape(isWide: isWide)
                        .fill(.white.opacity(isHovering ? 0.035 : 0))
                }
                .contentShape(KeyShape(isWide: isWide))
        }
        .buttonStyle(FlatKeyButtonStyle())
        .onHover { hovering in
            withAnimation(.easeOut(duration: 0.12)) {
                isHovering = hovering
            }
        }
        .accessibilityLabel(button.title)
    }
}

private struct KeyShape: Shape {
    let isWide: Bool

    func path(in rect: CGRect) -> Path {
        if isWide {
            return Capsule(style: .continuous).path(in: rect)
        }
        return Circle().path(in: rect)
    }
}

private struct FlatKeyButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.955 : 1)
            .opacity(configuration.isPressed ? 0.82 : 1)
            .animation(.spring(response: 0.2, dampingFraction: 0.74), value: configuration.isPressed)
    }
}

private struct HistorySidebar: View {
    let lines: [CalculationLine]
    let clearAction: () -> Void
    let closeAction: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("历史记录")
                        .font(.system(size: 15, weight: .semibold))

                    Text(lines.isEmpty ? "暂无记录" : "\(lines.count) 条计算")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(CalculatorPalette.secondaryText)
                }

                Spacer()

                Button("清除", action: clearAction)
                    .buttonStyle(.plain)
                    .foregroundStyle(CalculatorPalette.mint)
                    .disabled(lines.isEmpty)

                Button(action: closeAction) {
                    Image(systemName: "xmark")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(CalculatorPalette.secondaryText)
                        .frame(width: 28, height: 28)
                        .background(Circle().fill(.white.opacity(0.04)))
                }
                .buttonStyle(.plain)
                .help("收起历史记录")
            }
            .padding(.horizontal, 20)
            .frame(height: 56)

            Rectangle()
                .fill(.white.opacity(0.07))
                .frame(height: 1)

            if lines.isEmpty {
                Text("还没有计算记录")
                    .font(.system(size: 13))
                    .foregroundStyle(CalculatorPalette.secondaryText)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ScrollView(showsIndicators: true) {
                    LazyVStack(spacing: 8) {
                        ForEach(Array(lines.reversed())) { line in
                            HistoryRow(line: line)
                        }
                    }
                    .padding(12)
                }
            }
        }
        .background(Color(red: 15 / 255, green: 18 / 255, blue: 22 / 255))
        .ignoresSafeArea(.container, edges: .top)
        .overlay(alignment: .leading) {
            Rectangle()
                .fill(.white.opacity(0.07))
                .frame(width: 1)
        }
    }
}

private struct HistoryRow: View {
    let line: CalculationLine
    @State private var didCopy = false

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            VStack(alignment: .leading, spacing: 7) {
                Text(line.expression)
                    .font(.system(size: 12, weight: .medium, design: .monospaced))
                    .foregroundStyle(CalculatorPalette.primaryText.opacity(0.76))
                    .lineLimit(4)
                    .truncationMode(.tail)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .layoutPriority(1)

                Text(line.result)
                    .font(.system(size: 14, weight: .semibold, design: .monospaced))
                    .foregroundStyle(CalculatorPalette.mint)
                    .lineLimit(1)
                    .fixedSize(horizontal: false, vertical: true)
                    .textSelection(.enabled)
            }
            .fixedSize(horizontal: false, vertical: true)

            Button(action: copyRecord) {
                Image(systemName: didCopy ? "checkmark" : "doc.on.doc")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(didCopy ? CalculatorPalette.mint : CalculatorPalette.secondaryText)
                    .frame(width: 26, height: 26)
                    .background(Circle().fill(.white.opacity(0.04)))
            }
            .buttonStyle(.plain)
            .help(didCopy ? "已复制" : "复制整条记录")
        }
        .padding(12)
        .background {
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(.white.opacity(0.035))
        }
        .textSelection(.enabled)
        .contextMenu {
            Button("复制算式") { copy(line.expression) }
            Button("复制结果") { copy(line.result) }
            Button("复制整条记录") { copy(recordText) }
        }
    }

    private func copyRecord() {
        copy(recordText)
        withAnimation(.easeOut(duration: 0.15)) {
            didCopy = true
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) {
            withAnimation(.easeOut(duration: 0.15)) {
                didCopy = false
            }
        }
    }

    private func copy(_ value: String) {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(value, forType: .string)
    }

    private var recordText: String {
        let compactExpression = line.expression.replacingOccurrences(of: " ", with: "")
        return "\(compactExpression)=\(line.result)"
    }
}

private struct KeyboardEventMonitor: NSViewRepresentable {
    let onKeyDown: (NSEvent) -> Bool

    func makeCoordinator() -> Coordinator {
        Coordinator(onKeyDown: onKeyDown)
    }

    func makeNSView(context: Context) -> NSView {
        let view = NSView()
        DispatchQueue.main.async {
            context.coordinator.install(for: view.window)
        }
        return view
    }

    func updateNSView(_ nsView: NSView, context: Context) {
        context.coordinator.onKeyDown = onKeyDown

        if context.coordinator.window !== nsView.window {
            DispatchQueue.main.async {
                context.coordinator.install(for: nsView.window)
            }
        }
    }

    static func dismantleNSView(_ nsView: NSView, coordinator: Coordinator) {
        coordinator.uninstall()
    }

    final class Coordinator {
        var onKeyDown: (NSEvent) -> Bool
        weak var window: NSWindow?
        private var monitor: Any?

        init(onKeyDown: @escaping (NSEvent) -> Bool) {
            self.onKeyDown = onKeyDown
        }

        func install(for window: NSWindow?) {
            guard let window, self.window !== window else { return }

            uninstall()
            self.window = window
            monitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { [weak self] event in
                guard let self, event.window === self.window else { return event }
                return self.onKeyDown(event) ? nil : event
            }
        }

        func uninstall() {
            if let monitor {
                NSEvent.removeMonitor(monitor)
                self.monitor = nil
            }
            window = nil
        }

        deinit {
            uninstall()
        }
    }
}

private struct WindowConfigurator: NSViewRepresentable {
    let isHistoryPresented: Bool

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeNSView(context: Context) -> NSView {
        let view = NSView()
        DispatchQueue.main.async {
            configure(view.window, coordinator: context.coordinator)
        }
        return view
    }

    func updateNSView(_ nsView: NSView, context: Context) {
        DispatchQueue.main.async {
            configure(nsView.window, coordinator: context.coordinator)
        }
    }

    private func configure(_ window: NSWindow?, coordinator: Coordinator) {
        guard let window else { return }

        let backgroundColor = NSColor(
            red: 11 / 255,
            green: 13 / 255,
            blue: 16 / 255,
            alpha: 1
        )

        window.isOpaque = false
        window.backgroundColor = .clear
        window.styleMask.remove(.titled)
        window.styleMask.insert(.fullSizeContentView)
        window.styleMask.insert(.resizable)
        window.hasShadow = true
        window.isMovableByWindowBackground = true

        let targetWidth = isHistoryPresented ? CalculatorLayout.expandedWidth : CalculatorLayout.calculatorWidth
        window.contentMinSize = NSSize(width: CalculatorLayout.calculatorWidth, height: CalculatorLayout.compactContentHeight)
        window.contentMaxSize = NSSize(width: CalculatorLayout.expandedWidth, height: 1_000)

        let currentContentWidth = window.contentLayoutRect.width
        if abs(currentContentWidth - targetWidth) > 0.5 {
            var frame = window.frame
            frame.size.width += targetWidth - currentContentWidth
            window.setFrame(frame, display: true, animate: false)
        }

        window.contentMinSize = NSSize(width: targetWidth, height: CalculatorLayout.compactContentHeight)
        window.contentMaxSize = NSSize(width: targetWidth, height: 1_000)

        window.contentView?.wantsLayer = true
        window.contentView?.layer?.backgroundColor = backgroundColor.cgColor
        window.contentView?.layer?.cornerRadius = 0
        window.contentView?.layer?.masksToBounds = false
        window.contentView?.layer?.borderWidth = 0

        window.contentView?.superview?.wantsLayer = true
        window.contentView?.superview?.layer?.backgroundColor = NSColor.clear.cgColor
        window.contentView?.superview?.layer?.cornerRadius = CalculatorLayout.windowCornerRadius
        window.contentView?.superview?.layer?.cornerCurve = .continuous
        window.contentView?.superview?.layer?.masksToBounds = true
        window.contentView?.superview?.layer?.borderWidth = 0.5
        window.contentView?.superview?.layer?.borderColor = NSColor.white.withAlphaComponent(0.16).cgColor
    }

    final class Coordinator {
        private weak var window: NSWindow?
        private var originalButtonY: [NSWindow.ButtonType: CGFloat] = [:]
        private var observers: [NSObjectProtocol] = []

        func install(for window: NSWindow) {
            if self.window !== window {
                removeObservers()
                self.window = window

                let center = NotificationCenter.default
                observers = [
                    center.addObserver(forName: NSWindow.didResizeNotification, object: window, queue: .main) { [weak self] _ in
                        self?.schedulePositioning()
                    },
                    center.addObserver(forName: NSWindow.didBecomeKeyNotification, object: window, queue: .main) { [weak self] _ in
                        self?.schedulePositioning()
                    }
                ]
            }

            schedulePositioning()
        }

        private func schedulePositioning() {
            positionButtons()

            for delay in [0.05, 0.2] {
                DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
                    self?.positionButtons()
                }
            }
        }

        private func positionButtons() {
            guard let window else { return }

            let buttonTypes: [NSWindow.ButtonType] = [.closeButton, .miniaturizeButton, .zoomButton]
            for (index, buttonType) in buttonTypes.enumerated() {
                guard let button = window.standardWindowButton(buttonType) else { continue }

                if originalButtonY[buttonType] == nil {
                    originalButtonY[buttonType] = button.frame.origin.y
                }

                let baselineY = originalButtonY[buttonType] ?? button.frame.origin.y
                button.setFrameOrigin(NSPoint(
                    x: 24 + CGFloat(index) * 23,
                    y: baselineY - 15
                ))
            }
        }

        private func removeObservers() {
            let center = NotificationCenter.default
            observers.forEach(center.removeObserver)
            observers.removeAll()
        }

        deinit {
            removeObservers()
        }
    }
}
