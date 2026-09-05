# Tasks

## Windows 1.6.0 rebuild — 2026-09-05

- [x] Inspect latest Mac behavior and 小呆电脑's existing Windows installation.
- [x] Recover and preserve the old Windows source/shortcuts; retain the original
  installation and profile.
- [x] Add maintained Windows source, native window handling, secure clipboard IPC,
  packaging and regression tests.
- [x] Compare 106 Swift reference states; pass 18 logic tests on both platforms.
- [x] Build the x64 installer on 小呆电脑 and compare source/artifact checksums.
- [x] Validate the final package at 125% and 150% scale, including repeated history
  toggles with no height accumulation.
- [x] Install the final build; verify architecture, version, installed ASAR and
  replacement desktop/Start-menu targets.
- [x] Revalidate the installed EXE at both scales, confirm normal desktop launch
  and remove the temporary test tasks.
- [x] Commit the Windows source and verification documentation and land locally
  on `main` with a clean working tree.

GitHub publication, certificate signing, Windows ARM64 and other Windows versions
are outside this delivery. Preserve the old install until the user asks to remove it.

## AC behavior report — 2026-09-05

- [x] Inspect live processes and desktop, Start-menu and pinned taskbar entries.
- [x] Reproduce the old source's retained line and identify the stale taskbar link.
- [x] Back up and correct that link's target and application identity.
- [x] Verify installed AC behavior, subsequent input and preserved separate history.
- [x] Verify normal launch through the repaired shortcut and remove the test task.

## Windows 1.6.1 visual alignment — 2026-09-05

- [x] Compare the two supplied screenshots and current SwiftUI layout.
- [x] Respect the clarification: UI only; no AC/history/model behavior changes.
- [x] Match the compact rounded layout and window controls; remove display focus
  outlines after mouse/keyboard/paste and move paste into the context menu.
- [x] Build on 小呆电脑 and pass all 12 desktop checks at 125% and 150%.
- [x] Install 1.6.1, compare installed source/font hashes and pass the same desktop
  checks against the installed EXE at both scales.
- [x] Restore the taskbar pin removed by the upgrade and remove temporary tasks.
- The user then rejected the opaque rectangle visible outside the rounded body;
  this visual result is superseded by 1.6.2 below.

## Windows 1.6.2 desktop corner correction — 2026-09-05

- [x] Make the native window and page transparent outside the rounded body,
  keeping native corner hit testing and programmatic panel/zoom controls.
- [x] Build on 小呆电脑; verify the source snapshot and returned installer hash.
- [x] Pass all 13 real executable checks for package and installed app at both
  125% and 150%, including actual desktop pixels with the window shown/hidden.
- [x] Back up 1.6.1, install 1.6.2, verify installed source/font hashes and all
  shortcuts, and restore the taskbar pin through its observed native action.
- [x] Inspect a normal-launch desktop screenshot, verify the responsive process,
  preserve prior attempts and remove all temporary verification tasks.
- [x] Review the UI-only diff, pass the 18 focused calculation tests and syntax
  checks, and land the source/documentation commit locally with a clean checkout.
