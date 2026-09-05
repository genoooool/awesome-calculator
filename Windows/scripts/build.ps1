param([string]$OutputDirectory = '')
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
if ($env:OS -ne 'Windows_NT') { throw 'This build must run on Windows.' }
function Invoke-Checked([string]$Command, [string[]]$Arguments) {
  # PowerShell 5 emits NativeCommandError for ordinary stderr warnings when a
  # caller captures streams. Native exit codes, rather than that stream, decide success.
  $previousPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = 'Continue'
    & $Command @Arguments
    $code = $LASTEXITCODE
  } finally { $ErrorActionPreference = $previousPreference }
  if ($code -ne 0) { throw "$Command exited with code $code" }
}
Invoke-Checked 'node' @('--version')
Invoke-Checked 'npm.cmd' @('ci', '--no-audit', '--no-fund')
Invoke-Checked 'npm.cmd' @('test')
Invoke-Checked 'npm.cmd' @('run', 'dist:win')
Get-ChildItem 'dist\*.exe' | ForEach-Object { Get-FileHash $_.FullName -Algorithm SHA256 } | Format-List
if ($OutputDirectory) {
  New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
  Copy-Item 'dist\*.exe' -Destination $OutputDirectory
}
