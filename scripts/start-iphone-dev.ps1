param(
  [string]$Ip,
  [switch]$SkipEnvUpdate,
  [switch]$SkipDbChecks
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$mobileEnvPath = Join-Path $repoRoot "apps\mobile\.env"
$apiEnvPath = Join-Path $repoRoot "apps\api\.env"
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

  $escapedTitle = $Title.Replace("'", "''")
  $windowCommand = "cd `"$WorkingDirectory`"; `$host.UI.RawUI.WindowTitle = '$escapedTitle'; $Command"
  Start-Process powershell.exe -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $windowCommand
}

function Invoke-Checked {
  param(
    [string]$Command
  )

  Invoke-Expression $Command
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed with exit code ${LASTEXITCODE}: $Command"
  }
}

function Get-DatabasePort {
  if (-not (Test-Path -LiteralPath $apiEnvPath)) {
    throw "Missing API env file: $apiEnvPath"
  }

  $databaseUrlLine = Get-Content -LiteralPath $apiEnvPath |
    Where-Object { $_ -match "^DATABASE_URL=" } |
    Select-Object -First 1

  if (-not $databaseUrlLine) {
    throw "DATABASE_URL is missing from apps/api/.env"
  }

  if ($databaseUrlLine -notmatch "localhost:(\d+)") {
    throw "Could not read localhost port from DATABASE_URL in apps/api/.env"
  }

  return [int]$Matches[1]
}

function Wait-ForDatabase {
  param(
    [int]$Port,
    [int]$TimeoutSeconds = 60
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  Write-Host "Waiting for Prisma dev database on localhost:$Port..."

  while ((Get-Date) -lt $deadline) {
    try {
      $client = [System.Net.Sockets.TcpClient]::new()
      $asyncResult = $client.BeginConnect("localhost", $Port, $null, $null)
      $connected = $asyncResult.AsyncWaitHandle.WaitOne(1000, $false)
      if ($connected) {
        $client.EndConnect($asyncResult)
        $client.Close()
        Write-Host "Prisma dev database is reachable on localhost:$Port"
        return
      }
      $client.Close()
    } catch {
      Start-Sleep -Seconds 1
    }

    Start-Sleep -Seconds 1
  }

  throw "Timed out waiting for Prisma dev database on localhost:$Port. Check the 'Watchly Prisma Dev' PowerShell window."
}

Write-Host "Starting Prisma dev, API, and Metro in separate PowerShell windows..."

Start-DevWindow `
  -Title "Watchly Prisma Dev" `
  -WorkingDirectory $apiDir `
  -Command "pnpm exec prisma dev start tv-app"

$databasePort = Get-DatabasePort
Wait-ForDatabase -Port $databasePort

if (-not $SkipDbChecks) {
  Write-Host "Running DB deploy and verify in this window..."
  Push-Location $repoRoot
  try {
    Invoke-Checked "pnpm --filter api db:deploy"
    Invoke-Checked "pnpm --filter api db:verify"
  } finally {
    Pop-Location
  }
}

Start-DevWindow `
  -Title "Watchly API" `
  -WorkingDirectory $repoRoot `
  -Command "pnpm --filter api start:dev"

Start-Sleep -Seconds 3

Start-DevWindow `
  -Title "Watchly Metro iPhone" `
  -WorkingDirectory $repoRoot `
  -Command "`$env:REACT_NATIVE_PACKAGER_HOSTNAME=`"$Ip`"; pnpm --filter mobile exec expo start --dev-client --host lan --port 8081 --clear"

Write-Host ""
Write-Host "Started local iPhone dev processes."
Write-Host "Open the Watchly development build on the iPhone and use the LAN/QR URL from the Metro window."
Write-Host "API health checks:"
Write-Host "  Invoke-RestMethod http://localhost:3000/health"
Write-Host "  Invoke-RestMethod http://$Ip`:3000/health"
