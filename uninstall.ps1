$ErrorActionPreference = 'Stop'

$targetDir = Join-Path $env:USERPROFILE '.gemini\config\plugins\agy-plugin-dock'
if (Test-Path $targetDir) {
  try {
    Remove-Item -Recurse -Force $targetDir
    Write-Host "[agy-plugin-dock] Removed $targetDir" -ForegroundColor Yellow
  } catch {
    Write-Host "[agy-plugin-dock] Failed to remove $targetDir (files may be in use)." -ForegroundColor Red
    Write-Host "Close Antigravity or disable the plugin first, then run uninstall.ps1 again." -ForegroundColor Yellow
    exit 1
  }
} else {
  Write-Host "[agy-plugin-dock] Not installed ($targetDir does not exist)."
}
