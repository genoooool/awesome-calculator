# Current handoff

Updated: 2026-09-05

## Delivered versions

- macOS remains 1.5.1; its Swift source was not changed by the Windows work.
- Windows 1.6.2 is rebuilt from maintained `Windows/` source on 小呆电脑
  (`DESKTOP-RMIV2F3`, Windows 11 x64), using the existing `windows-build` channel.
- Installed EXE: `D:\Awesome Calculator 1.6\Awesome Calculator.exe`. The existing
  desktop, Start-menu and pinned taskbar **Awesome Calculator** shortcuts target
  that EXE. The taskbar pin removed during the upgrade was restored through its
  observed native action and verified in the persisted taskbar data.
- Old 1.0.0 installation remains at `D:\Awesome Calculator`. Its executable and
  source hashes were verified unchanged; original shortcuts/source are backed up
  under the Windows run's `legacy-backup` directory. Do not remove it unprompted.
- The complete previous 1.6.1 installation is backed up under the current run's
  `backup-1.6.1` directory; 1.6.0 is preserved in the earlier UI161 run.
  The UI change leaves both calculation models unchanged: the user clarified the
  reported history loss came from not pressing Enter/equals.

## Build and evidence

- Local delivery: `Dist/Awesome-Calculator-Setup-1.6.2-Windows-x64.exe`.
- Installer SHA-256:
  `a11a2167d8c5c217c5d43b782624885f7e6e9a3af3d9b194769f295ac8a6e354`.
- Installed EXE SHA-256:
  `03e25ad87d425dfad15b673ba51309f2d30063aa49f2c068d270d5ca0abb9a37`.
- Installed ASAR SHA-256:
  `c2d450f63ad98c52e84cfd5928dabe1ff1c1deb8cbfe24cbfd5a6b4b562fed94`.
- Local receipts, package/installed screenshots and native-window checks:
  `Dist/windows-ui-20260905/evidence-162/`. Scripts and prior UI161 evidence are
  in the parent directory. Earlier 1.6.0 evidence remains in
  `Dist/windows-20260905/` and `Dist/windows-ac-20260905/`.
- Windows run:
  `C:\Users\Administrator\codex-builds\awesome-calculator\20260905-ui-162`.
  Current package is in `source\dist`.
- `source-162-v2.zip` is the verified build-input snapshot; SHA-256:
  `0136dcdc07f51ce8077dccd545e68c99265898a0ca7d875699b3a827b62d7950`.
  All ten installed runtime/icon/font files match it; later README edits do not
  affect packaged runtime. The test-only RGB getter assertion was corrected after
  packaging; final desktop test SHA-256 is
  `1980abf0478ae0fd79a261b79db36a417bc6188c64714b3f9ad8870a07a49b78`.
  The Windows model SHA-256 remains
  `17285853dbeb37c3f87a02d0c022882b7544399a506fbcd7a35f21f668b2e6c4`.

## Verification

- 18 Node logic tests passed on Mac and Windows, including 106 reference states
  generated from the actual current Swift model.
- Thirteen real executable UI checks cover mouse/keyboard calculation, fullwidth
  clipboard paste, continuing/editing results, AC/history separation, copying all
  three history forms, invalid/oversized clipboard input, repeated panel resize,
  visibility, custom window controls and sandbox settings. The native Windows
  region excludes the rounded corners, has no OS caption, and recognizes the
  top bar as a draggable title area.
- The final package passed at the host's 125% scale and forced 150% scale in the
  logged-in Windows console session. Installed-file checks confirm AMD64,
  version 1.6.2.0, matching ASAR and correct shortcut targets.
- Screenshots and JSON results distinguish packaged and installed EXE checks.
- Both the final package and installed EXE passed all thirteen UI checks at 125% and
  150%. A normal launch in console session 1, without inspection/debugging/scale
  flags, reported a visible responsive window. The installed app was left open.
- Normal desktop screenshot: `evidence-162/normal-desktop-window.png` under the
  local UI receipt directory. It visibly shows desktop background outside all
  four rounded corners; this is a real screen capture of the normal installed app.
- The display outline stays `none` after input/paste and is visually checked in
  screenshots. The reference layout uses a 264 × 560 body, 34-pixel corners,
  three 14-pixel colored controls, 56-pixel keys and rounded Nunito lettering.
- The user's real desktop screenshot exposed an opaque rectangle outside the
  rounded UI161 body despite passing region/page checks. UI162 now uses a
  transparent native/page background, with native edge resizing disabled.
  Four outside-corner pixels match the background with the window hidden at
  both scales, for package and installed EXE. Native region and page screenshots
  alone must not be treated as proof of composited transparency.
- All four temporary UI162 tasks were removed. The first post-install taskbar
  check matched another calculator app as well; the resumed check selected the
  observed Awesome Calculator entry exactly. It did not reinstall or disturb the
  other app. The failed receipt and prior installation are preserved.
- Earlier failed attempts were retained. Clipboard async handling and accumulating
  fractional-DPI window height were fixed before final delivery.
- The installer/application are not certificate signed. This version was not
  pushed or published to GitHub. Other Windows versions/architectures were not
  tested in this task.

## AC report follow-up — 2026-09-05 12:41

- The user's report that AC retained the previous calculation was traced to a
  running **1.0.0** process from `D:\Awesome Calculator`. Initial delivery had
  updated desktop/Start-menu links but missed the pinned taskbar shortcut, which
  still targeted the old EXE and application ID.
- Reproduced the old source's behavior: after `2+3=`, AC produces the previous
  `2+3=5` line plus a new `0` line. The installed 1.6 source clears the display.
- Backed up the original taskbar link, replaced it with the new installed
  shortcut (target and application ID), and notified the shell of that change.
- All ten desktop checks passed again against the installed EXE resolved from
  the repaired link. Added explicit whole-display emptiness, input after AC,
  and AC with the history panel open, with screenshots for both cleared views.
- Launched the repaired `.lnk` through Windows Shell and verified a normal,
  responsive 1.6 window in console session 1. No old process remained. This
  validates the shortcut launch; a native mouse click on taskbar chrome was not
  automated. The installed application and installer hashes are unchanged.
- Local evidence: `Dist/windows-ac-20260905/remote-evidence/`; remote run:
  `C:\Users\Administrator\codex-builds\awesome-calculator\20260905-ac-entrypoint`.
  Includes the old shortcut backup, repair/launch receipts, expanded AC test
  screenshots and cleanup receipt. The temporary verification task was removed.

## Continue / rebuild

Read `Windows/README.md` and run `Windows/scripts/build.ps1` on Windows. It installs
the lockfile dependencies, tests and packages. Normal build needs download access.
The verified network-recovery build uses the official, checksum-verified tools
retained in the earlier `20260905-1140` run. The unchanged lockfile dependencies
were copied into the new isolated source directory before building.

With those directories already available, from the run's `source` directory:

```powershell
$toolRun = 'C:\Users\Administrator\codex-builds\awesome-calculator\20260905-1140'
$env:ELECTRON_BUILDER_NSIS_DIR = Join-Path $toolRun 'tools\nsis-bundle'
$env:ELECTRON_BUILDER_NSIS_RESOURCES_DIR = $env:ELECTRON_BUILDER_NSIS_DIR
$env:ELECTRON_BUILDER_RCEDIT_PATH = Join-Path $toolRun 'tools\rcedit'
node node_modules\electron-builder\cli.js --win nsis --x64 --publish never ("--config.electronDist=" + (Join-Path $toolRun 'electron-runtime'))
```

The environment values apply only to the build process/session. Do not change
system policies or use GUI control for ordinary source upload/build work. After
future calculation changes, regenerate the Swift reference fixtures and test the
newly packaged/installed executable again before calling it ready.
