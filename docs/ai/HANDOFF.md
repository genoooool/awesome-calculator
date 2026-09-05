# Current handoff

Updated: 2026-09-05

## Delivered versions

- macOS remains 1.5.1; its Swift source was not changed by the Windows work.
- Windows 1.6.0 is rebuilt from maintained `Windows/` source on 小呆电脑
  (`DESKTOP-RMIV2F3`, Windows 11 x64), using the existing `windows-build` channel.
- Installed EXE: `D:\Awesome Calculator 1.6\Awesome Calculator.exe`. The existing
  desktop, Start-menu and pinned taskbar **Awesome Calculator** shortcuts target
  that EXE. The taskbar entry was corrected in the follow-up below.
- Old 1.0.0 installation remains at `D:\Awesome Calculator`. Its executable and
  source hashes were verified unchanged; original shortcuts/source are backed up
  under the Windows run's `legacy-backup` directory. Do not remove it unprompted.

## Build and evidence

- Local delivery: `Dist/Awesome-Calculator-Setup-1.6.0-Windows-x64.exe`.
- Installer SHA-256:
  `e2a921e99c65b36bab3e1b58f434864e4533ec82b1cdeb5171c94b94b55e994b`.
- Installed EXE SHA-256:
  `79dceb6eee5b849110a840cd8c57603c98e54888381d0416fa4aeb86a404e0f0`.
- Installed ASAR SHA-256:
  `c6053dba441783b8ec191d498e672d75ac465e3a2f09952176012b530bee3379`.
- Local receipts: `Dist/windows-20260905/verified-evidence/`. Installer, source
  snapshot, prior attempts and remote command logs are retained under
  `Dist/windows-20260905/`.
- Windows run:
  `C:\Users\Administrator\codex-builds\awesome-calculator\20260905-1140`.
  Current package is in `source\dist-delivery`, **not** earlier `dist-final`,
  `dist-verified` or `dist-release` attempts.
- `source-delivered.zip` is the final Windows source snapshot; SHA-256:
  `9aa2b65933ea92139c27ea49837b42720b1a38d8e380f17dfdeb8ef6c9c9307c`.
  Every installed runtime source file/icon was compared to that snapshot.

## Verification

- 18 Node logic tests passed on Mac and Windows, including 106 reference states
  generated from the actual current Swift model.
- Ten real executable UI checks cover mouse/keyboard calculation, fullwidth
  clipboard paste, continuing/editing results, AC/history separation, copying all
  three history forms, invalid/oversized clipboard input, repeated panel resize,
  visibility, native frame and sandbox settings.
- The final package passed at the host's 125% scale and forced 150% scale in the
  logged-in Windows console session. Installed-file checks confirm AMD64,
  version 1.6.0.0, matching ASAR and correct shortcut targets.
- Screenshots and JSON results distinguish packaged and installed EXE checks.
- Both the final package and installed EXE passed all ten UI checks at 125% and
  150%. A normal launch in console session 1, without inspection/debugging/scale
  flags, reported a visible responsive window. The installed app was left open.
- All 13 temporary desktop test/launch tasks were removed after verification;
  `final-verification.json` records cleanup and the normal running process.
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
The verified network-recovery build used official, checksum-verified tools staged
in this run: `electron-runtime`, `tools\nsis-bundle`, and `tools\rcedit`.

With those directories already available, from the run's `source` directory:

```powershell
$env:ELECTRON_BUILDER_NSIS_DIR = '..\tools\nsis-bundle'
$env:ELECTRON_BUILDER_NSIS_RESOURCES_DIR = '..\tools\nsis-bundle'
$env:ELECTRON_BUILDER_RCEDIT_PATH = '..\tools\rcedit'
node node_modules\electron-builder\cli.js --win nsis --x64 --publish never --config.electronDist=../electron-runtime
```

The environment values apply only to the build process/session. Do not change
system policies or use GUI control for ordinary source upload/build work. After
future calculation changes, regenerate the Swift reference fixtures and test the
newly packaged/installed executable again before calling it ready.
