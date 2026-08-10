param(
  [string]$Ip,
  [switch]$SkipEnvUpdate,
  [switch]$SkipDbChecks
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$apiDir = Join-Path $repoRoot "apps\api"
$apiEnvPath = Join-Path $apiDir ".env"
$mobileEnvPath = Join-Path $repoRoot "apps\mobile\.env"
$pnpmPath = (Get-Command pnpm.cmd -ErrorAction Stop).Source

function Get-LocalIPv4 {
  $config = Get-NetIPConfiguration -ErrorAction SilentlyContinue |
    Where-Object {
      $_.IPv4Address -and
      $_.IPv4DefaultGateway -and
      $_.NetAdapter.Status -eq "Up"
    } |
    Sort-Object { if ($_.InterfaceAlias -match "Wi-Fi|Wireless|WLAN") { 0 } else { 1 } } |
    Select-Object -First 1

  if ($config) {
    return ($config.IPv4Address | Select-Object -First 1).IPAddress
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

function Invoke-PnpmChecked {
  param([string[]]$Arguments)

  & $pnpmPath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "pnpm failed with exit code ${LASTEXITCODE}: $($Arguments -join ' ')"
  }
}

function Stop-WatchlyServer {
  param(
    [int]$Port,
    [string]$Label
  )

  $listeners = @(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)
  if ($listeners.Count -eq 0) {
    return
  }

  $processes = @(Get-CimInstance Win32_Process)
  $normalizedRepo = $repoRoot.Replace("/", "\").ToLowerInvariant()
  $listenerProcesses = @($listeners | ForEach-Object {
    $owningProcess = $_.OwningProcess
    $processes | Where-Object { $_.ProcessId -eq $owningProcess } | Select-Object -First 1
  })
  $process = $listenerProcesses | Where-Object {
    ([string]$_.CommandLine).Replace("/", "\").ToLowerInvariant().Contains($normalizedRepo)
  } | Select-Object -First 1

  if (-not $process) {
    $blockingProcess = $listenerProcesses | Where-Object {
      $normalizedCommand = ([string]$_.CommandLine).Replace("/", "\").ToLowerInvariant()
      -not (
        $normalizedCommand.Contains("\@prisma\cli-dev@latest-") -and
        $normalizedCommand.Contains("\@prisma\dev\dist\daemon.cjs tv-app")
      )
    } | Select-Object -First 1
    if ($blockingProcess) {
      throw "Port $Port is used by an unrelated process: $($blockingProcess.CommandLine)"
    }
    return
  }

  while ($true) {
    $parent = $processes |
      Where-Object { $_.ProcessId -eq $process.ParentProcessId } |
      Select-Object -First 1
    $parentCommand = ([string]$parent.CommandLine).Replace("/", "\").ToLowerInvariant()
    if (-not $parent -or -not $parentCommand.Contains($normalizedRepo)) {
      break
    }
    $process = $parent
  }

  Write-Host "Stopping previous $Label process tree (PID $($process.ProcessId))..."
  & taskkill.exe /PID $process.ProcessId /T /F *> $null

  $deadline = (Get-Date).AddSeconds(15)
  while ((Get-Date) -lt $deadline) {
    $watchlyListener = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue |
      Where-Object {
        $owningProcess = $_.OwningProcess
        $listenerProcess = Get-CimInstance Win32_Process -Filter "ProcessId=$owningProcess"
        ([string]$listenerProcess.CommandLine).Replace("/", "\").ToLowerInvariant().Contains($normalizedRepo)
      } |
      Select-Object -First 1
    if (-not $watchlyListener) {
      return
    }
    Start-Sleep -Milliseconds 500
  }

  throw "Port $Port is still in use after stopping the previous $Label process."
}

function Get-DatabasePort {
  $databaseUrl = Get-Content -LiteralPath $apiEnvPath |
    Where-Object { $_ -match "^DATABASE_URL=" } |
    Select-Object -First 1

  if (-not $databaseUrl) {
    throw "DATABASE_URL is missing from apps/api/.env."
  }
  if ($databaseUrl -notmatch "localhost:(\d+)") {
    throw "Could not read the local Prisma port from DATABASE_URL."
  }

  return [int]$Matches[1]
}

function Wait-ForPort {
  param(
    [int]$Port,
    [int]$TimeoutSeconds = 60
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    if (Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue) {
      return
    }
    Start-Sleep -Seconds 1
  }

  throw "Timed out waiting for localhost:$Port."
}

function Test-DatabaseConnection {
  Push-Location $repoRoot
  try {
    & $pnpmPath --filter api db:verify *> $null
    return $LASTEXITCODE -eq 0
  } finally {
    Pop-Location
  }
}

function Stop-PrismaDevServer {
  param([int]$Port)

  $listener = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue |
    Select-Object -First 1
  if (-not $listener) {
    return
  }

  $process = Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)"
  $normalizedCommand = ([string]$process.CommandLine).Replace("/", "\").ToLowerInvariant()
  if (-not $process -or $normalizedCommand -notmatch "@prisma\\dev\\dist\\daemon\.cjs tv-app") {
    throw "Database port $Port is used by an unrelated process: $($process.CommandLine)"
  }

  Write-Host "Stopping unhealthy Prisma dev daemon (PID $($process.ProcessId))..."
  & taskkill.exe /PID $process.ProcessId /T /F *> $null

  $deadline = (Get-Date).AddSeconds(15)
  while ((Get-Date) -lt $deadline) {
    if (-not (Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)) {
      return
    }
    Start-Sleep -Milliseconds 500
  }

  throw "Database port $Port is still in use after stopping Prisma dev."
}

function Start-PrismaDevServer {
  param(
    [int]$Port,
    [string]$LogDirectory
  )

  Start-Process `
    -FilePath powershell.exe `
    -ArgumentList @("-NoExit", "-ExecutionPolicy", "Bypass", "-Command", "pnpm exec prisma dev start tv-app") `
    -WorkingDirectory $apiDir `
    -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $LogDirectory "prisma.out.log") `
    -RedirectStandardError (Join-Path $LogDirectory "prisma.err.log") | Out-Null
  Wait-ForPort -Port $Port
}

function Wait-ForHttp {
  param(
    [string]$Url,
    [int]$TimeoutSeconds = 60
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  $lastError = "No response"

  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 10
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300) {
        return $response
      }
      $lastError = "HTTP $($response.StatusCode)"
    } catch {
      $lastError = $_.Exception.Message
    }
    Start-Sleep -Seconds 1
  }

  throw "Timed out waiting for $Url. Last error: $lastError"
}

if (-not $Ip) {
  $Ip = Get-LocalIPv4
}

$apiUrl = "http://$Ip`:3000"
$metroUrl = "http://$Ip`:8081"
$expoUrl = "exp://$Ip`:8081"

Write-Host "Using PC LAN IP: $Ip"

if (-not $SkipEnvUpdate) {
  if (-not (Test-Path -LiteralPath $mobileEnvPath)) {
    throw "Missing mobile env file: $mobileEnvPath"
  }

  $mobileApiUrl = "EXPO_PUBLIC_API_URL=$apiUrl"
  $envLines = Get-Content -LiteralPath $mobileEnvPath
  if ($envLines -match "^EXPO_PUBLIC_API_URL=") {
    $envLines = $envLines | ForEach-Object {
      if ($_ -match "^EXPO_PUBLIC_API_URL=") { $mobileApiUrl } else { $_ }
    }
  } else {
    $envLines += $mobileApiUrl
  }
  Set-Content -LiteralPath $mobileEnvPath -Value $envLines
  Write-Host "Updated apps/mobile/.env: $mobileApiUrl"
}

Stop-WatchlyServer -Port 8081 -Label "Metro"
Stop-WatchlyServer -Port 3000 -Label "API"

$runDirectory = Join-Path $env:TEMP ("watchly-expo-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
New-Item -ItemType Directory -Path $runDirectory -Force | Out-Null
Write-Host "Logs: $runDirectory"

$databasePort = Get-DatabasePort
Write-Host "Ensuring Prisma dev is running..."
if (-not (Get-NetTCPConnection -State Listen -LocalPort $databasePort -ErrorAction SilentlyContinue)) {
  Start-PrismaDevServer -Port $databasePort -LogDirectory $runDirectory
}
Wait-ForPort -Port $databasePort

if (-not $SkipDbChecks) {
  if (-not (Test-DatabaseConnection)) {
    Stop-PrismaDevServer -Port $databasePort
    Start-PrismaDevServer -Port $databasePort -LogDirectory $runDirectory
  }

  Write-Host "Checking database migrations and connection..."
  Push-Location $repoRoot
  try {
    Invoke-PnpmChecked -Arguments @("--filter", "api", "db:deploy")
    Invoke-PnpmChecked -Arguments @("--filter", "api", "db:verify")
  } finally {
    Pop-Location
  }
}

Write-Host "Starting API in the background..."
$apiProcess = Start-Process `
  -FilePath $pnpmPath `
  -ArgumentList @("--filter", "api", "start:dev") `
  -WorkingDirectory $repoRoot `
  -WindowStyle Hidden `
  -RedirectStandardOutput (Join-Path $runDirectory "api.out.log") `
  -RedirectStandardError (Join-Path $runDirectory "api.err.log") `
  -PassThru

$apiLocalResponse = Wait-ForHttp -Url "http://127.0.0.1:3000/health"
$apiLanResponse = Wait-ForHttp -Url "$apiUrl/health"
$apiLocalHealth = $apiLocalResponse.Content | ConvertFrom-Json
$apiLanHealth = $apiLanResponse.Content | ConvertFrom-Json
if ($apiLocalHealth.service -ne "api" -or $apiLanHealth.service -ne "api") {
  throw "Port 3000 is not serving the Watchly API. Check for a conflicting Prisma dev port."
}
Write-Host "API health: local $($apiLocalResponse.StatusCode), LAN $($apiLanResponse.StatusCode)"

Write-Host "Starting Metro in Expo Go mode..."
$previousPackagerHostname = $env:REACT_NATIVE_PACKAGER_HOSTNAME
$env:REACT_NATIVE_PACKAGER_HOSTNAME = $Ip
try {
  $metroProcess = Start-Process `
    -FilePath $pnpmPath `
    -ArgumentList @("--filter", "mobile", "exec", "expo", "start", "--go", "--host", "lan", "--port", "8081", "--clear") `
    -WorkingDirectory $repoRoot `
    -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $runDirectory "metro.out.log") `
    -RedirectStandardError (Join-Path $runDirectory "metro.err.log") `
    -PassThru
} finally {
  if ($null -eq $previousPackagerHostname) {
    Remove-Item Env:REACT_NATIVE_PACKAGER_HOSTNAME -ErrorAction SilentlyContinue
  } else {
    $env:REACT_NATIVE_PACKAGER_HOSTNAME = $previousPackagerHostname
  }
}

$metroStatusResponse = Wait-ForHttp -Url "$metroUrl/status"
$metroStatus = if ($metroStatusResponse.Content -is [byte[]]) {
  [Text.Encoding]::UTF8.GetString($metroStatusResponse.Content)
} else {
  [string]$metroStatusResponse.Content
}
if ($metroStatus -ne "packager-status:running") {
  throw "Unexpected Metro status: $metroStatus"
}

$metroListener = Get-NetTCPConnection -State Listen -LocalPort 8081 |
  Select-Object -First 1
$metroCommand = (Get-CimInstance Win32_Process -Filter "ProcessId=$($metroListener.OwningProcess)").CommandLine
if ($metroCommand -notmatch "--go") {
  throw "Metro is not running in Expo Go mode: $metroCommand"
}

Write-Host "Requesting Expo manifest and iOS bundle..."
$manifestResponse = Invoke-WebRequest `
  -UseBasicParsing `
  -Uri $metroUrl `
  -Headers @{
    "expo-platform" = "ios"
    "expo-protocol-version" = "0"
    "accept" = "application/expo+json,application/json"
  } `
  -TimeoutSec 120
$manifestText = if ($manifestResponse.Content -is [byte[]]) {
  [Text.Encoding]::UTF8.GetString($manifestResponse.Content)
} else {
  [string]$manifestResponse.Content
}
$manifest = $manifestText | ConvertFrom-Json
$bundleUrl = if ($manifest.launchAsset.url) { $manifest.launchAsset.url } else { $manifest.bundleUrl }
if (-not $bundleUrl) {
  throw "Expo manifest did not contain launchAsset.url."
}

$bundleStatus = & curl.exe -sS --max-time 180 -o NUL -w "%{http_code}" $bundleUrl
if ($LASTEXITCODE -ne 0 -or $bundleStatus -ne "200") {
  throw "iOS bundle request failed with HTTP $bundleStatus."
}

Write-Host ""
Write-Host "Watchly is ready in Expo Go."
Write-Host "Expo URL: $expoUrl"
Write-Host "API URL:  $apiUrl"
Write-Host "PIDs:     API launcher $($apiProcess.Id), Metro launcher $($metroProcess.Id)"
