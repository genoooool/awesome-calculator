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
