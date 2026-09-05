# Awesome Calculator for Windows

Windows 1.6.0 follows the current macOS 1.5.1 calculator behavior. It runs entirely
offline and includes its own runtime. The maintained Windows source is now in this
repository; the old 1.0.0 release installer is no longer the current Windows build.

The window uses the native Windows titlebar, an opaque dark surface and the same
264-pixel calculator / 360-pixel history layout as the Mac app. Minimize, close,
dragging and display scaling are handled by Windows. The main display contains only
the current expression. AC clears that display and leaves the last 50 calculations
in the separate history panel. History lasts for the current application session,
as in the Mac version.

## Build on Windows

Prerequisites: Windows x64, Node.js 22 or later, npm, and network access while
installing the locked development dependencies. The resulting app needs no Node
installation or network connection on the destination computer.

In PowerShell, from this directory:

```powershell
.\scripts\build.ps1
```

The script installs the lockfile dependencies, runs the calculation tests, and
builds the x64 NSIS installer with Electron Builder. It never publishes a release.
Output: `dist\Awesome-Calculator-Setup-1.6.0-Windows-x64.exe`.

To run from source, use `npm ci` then `npm start`. To run logic tests, use `npm test`.

## Test the actual executable

Run the following in an interactive Windows session after building:

```powershell
$env:CALCULATOR_TEST_EXE = (Resolve-Path '.\dist\win-unpacked\Awesome Calculator.exe').Path
$env:CALCULATOR_TEST_OUTPUT = (Join-Path $PWD 'test-results\packaged')
npm run test:desktop
```

Repeat with `CALCULATOR_TEST_EXE` pointing to the installed EXE to test the installed
version. `CALCULATOR_TEST_SCALE=1.5` exercises 150% display scaling. Tests drive the
real packaged UI, Windows clipboard and window resize, and save screenshots plus
JSON results. Test tooling is excluded from the packaged application. Close an
already-running copy before a test, because the app intentionally uses one instance.
The test clipboard contents are temporary calculator expressions.

On macOS, `python3 Windows/scripts/macos-parity.py` compiles the current Swift model
without SwiftUI presentation types and generates reference states. The Windows
tests compare expression text, results and history after all 106 steps. The source
file hash is recorded beside the fixture. Regenerate these fixtures when changing
the Swift model; do not edit expected values by hand.

## Controls

| Action | Shortcut |
| --- | --- |
| Calculate | Enter or = |
| Paste and calculate | Ctrl+V or 粘贴算式 |
| Copy result | Ctrl+C with no text selected |
| Show/hide history | Ctrl+H or history button |
| Delete previous character | Backspace or Delete |
| Clear current expression | Esc or C |

Numbers, decimal point, `+ - * / % ( )`, fullwidth input and implicit multiplication
work as on Mac. History provides separate buttons for copying an expression, result
or complete record. Invalid clipboard input shows feedback instead of silently
failing. Windows additionally accepts `。` as a decimal point; the current Swift
fullwidth transform rejects that punctuation. Clipboard expressions are limited to
10,000 characters, with a visible error for longer input.

## Installation and prior versions

The 1.6 application ID and data directory are distinct from the old 1.0 binary, so
the older installation and profile can be preserved during a side-by-side upgrade.
Back up existing desktop, Start-menu and pinned taskbar shortcuts before directing
them to the new installation. A pinned shortcut can still launch 1.0 even after the
desktop shortcut is updated. Preserve the old shortcut, then replace its target
and application identity using the new installer's shortcut. Verify a launch from
that entry point resolves to the new EXE and confirm the running process path.
Inspect the destination's installed version and path before replacing anything.
Never treat an installer merely existing as proof that it works on Windows.

The 2026-09-05 build is performed on 小呆电脑 (`DESKTOP-RMIV2F3`), Windows 11 x64,
through the existing `windows-build` SSH/file channel. Current build and installation
verification details are maintained in `docs/ai/HANDOFF.md` at the repository root.

## Source provenance

The old installed Windows `app.asar` contained a JavaScript port of the Swift parser.
Its calculation core was recovered and brought up to the current Mac behavior;
its window, preload, rendering, packaging and tests were rebuilt here. The source
archive and original installation are preserved in the task's local/Windows build
records. The new app uses Electron's sandbox and context isolation, narrowly scoped
clipboard/window IPC, a local-only content security policy and no runtime network
dependencies. It does not use the old transparent-window or disabled-sandbox flags.
