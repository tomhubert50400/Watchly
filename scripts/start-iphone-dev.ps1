param(
  [int]$Port = 8081,
  [switch]$CheckProviders,
  [switch]$ValidateOnly
)

$ErrorActionPreference = 'Stop'
$stagingLauncher = Join-Path $PSScriptRoot 'start-iphone-staging-auth.ps1'

Write-Host 'Using the single Watchly Staging iPhone environment.'
& $stagingLauncher `
  -Port $Port `
  -CheckProviders:$CheckProviders `
  -ValidateOnly:$ValidateOnly

if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}
