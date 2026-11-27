$ErrorActionPreference = 'Stop'

$sourceDir = Join-Path $PSScriptRoot 'agy-plugin-dock'
$targetRoot = Join-Path $env:USERPROFILE '.gemini\config\plugins'
$targetDir = Join-Path $targetRoot 'agy-plugin-dock'

if (-not (Test-Path $sourceDir)) {
  throw "Plugin source folder not found: $sourceDir"
}

New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
Copy-Item -Recurse -Force (Join-Path $sourceDir '*') $targetDir

Write-Host "[agy-plugin-dock] Installed to $targetDir" -ForegroundColor Green
Write-Host "Restart or reload Antigravity if the top-bar icons do not appear automatically."
