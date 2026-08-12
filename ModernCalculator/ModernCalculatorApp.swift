import SwiftUI

@main
struct ModernCalculatorApp: App {
    var body: some Scene {
        WindowGroup {
            CalculatorView()
        }
        .windowStyle(.hiddenTitleBar)
        .defaultSize(width: 320, height: 528)
        .windowResizability(.contentSize)
    }
}
