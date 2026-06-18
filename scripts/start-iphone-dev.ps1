param(
  [string]$Ip,
  [switch]$SkipEnvUpdate,
  [switch]$SkipDbChecks
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$mobileEnvPath = Join-Path $repoRoot "apps\mobile\.env"
$apiDir = Join-Path $repoRoot "apps\api"

function Get-LocalIPv4 {
  $configs = Get-NetIPConfiguration -ErrorAction SilentlyContinue |
    Where-Object {
      $_.IPv4Address -and
      $_.NetAdapter.Status -eq "Up" -and
      $_.IPv4DefaultGateway
    }

  $candidate = $configs |
    Sort-Object { if ($_.InterfaceAlias -match "Wi-Fi|Wireless|WLAN") { 0 } else { 1 } } |
    Select-Object -First 1

  if ($candidate) {
    return $candidate.IPv4Address.IPAddress
  }

  $fallback = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object {
      $_.IPAddress -notmatch "^127\." -and
      $_.IPAddress -notmatch "^169\.254\."
    } |
    Select-Object -First 1

  if ($fallback) {
    return $fallback.IPAddress
  }

  throw "Could not detect a local IPv4 address. Re-run with -Ip 192.168.x.x."
}

if (-not $Ip) {
  $Ip = Get-LocalIPv4
}

Write-Host "Using PC LAN IP: $Ip"

if (-not $SkipEnvUpdate) {
  if (-not (Test-Path -LiteralPath $mobileEnvPath)) {
    throw "Missing mobile env file: $mobileEnvPath"
  }

  $apiUrl = "EXPO_PUBLIC_API_URL=http://$Ip`:3000"
  $envLines = Get-Content -LiteralPath $mobileEnvPath
  $updated = $false
  $envLines = $envLines | ForEach-Object {
    if ($_ -match "^EXPO_PUBLIC_API_URL=") {
      $updated = $true
      $apiUrl
    } else {
      $_
    }
  }

  if (-not $updated) {
    $envLines += $apiUrl
  }

  Set-Content -LiteralPath $mobileEnvPath -Value $envLines
  Write-Host "Updated apps/mobile/.env: $apiUrl"
}

function Start-DevWindow {
  param(
    [string]$Title,
    [string]$WorkingDirectory,
    [string]$Command
  )

  $windowCommand = "cd `"$WorkingDirectory`"; `$host.UI.RawUI.WindowTitle = `"$Title`"; $Command"
  Start-Process powershell.exe -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $windowCommand
}

Write-Host "Starting Prisma dev, API, and Metro in separate PowerShell windows..."

Start-DevWindow `
  -Title "Kinora Prisma Dev" `
  -WorkingDirectory $apiDir `
  -Command "pnpm exec prisma dev start tv-app"

Start-Sleep -Seconds 3

if (-not $SkipDbChecks) {
  Write-Host "Running DB deploy and verify in this window..."
  Push-Location $repoRoot
  try {
    pnpm --filter api db:deploy
    pnpm --filter api db:verify
  } finally {
    Pop-Location
  }
}

Start-DevWindow `
  -Title "Kinora API" `
  -WorkingDirectory $repoRoot `
  -Command "pnpm --filter api start:dev"

Start-Sleep -Seconds 3

Start-DevWindow `
  -Title "Kinora Metro iPhone" `
  -WorkingDirectory $repoRoot `
  -Command "`$env:REACT_NATIVE_PACKAGER_HOSTNAME=`"$Ip`"; pnpm --filter mobile exec expo start --dev-client --host lan --port 8081 --clear"

Write-Host ""
Write-Host "Started local iPhone dev processes."
Write-Host "Open the Kinora development build on the iPhone and use the LAN/QR URL from the Metro window."
Write-Host "API health checks:"
Write-Host "  Invoke-RestMethod http://localhost:3000/health"
Write-Host "  Invoke-RestMethod http://$Ip`:3000/health"
