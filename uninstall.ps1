$ErrorActionPreference = 'Stop'

$targetDir = Join-Path $env:USERPROFILE '.gemini\config\plugins\agy-plugin-dock'
if (Test-Path $targetDir) {
  Remove-Item -Recurse -Force $targetDir
  Write-Host "[agy-plugin-dock] Removed $targetDir" -ForegroundColor Yellow
} else {
  Write-Host "[agy-plugin-dock] Not installed ($targetDir does not exist)."
}
