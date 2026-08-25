param(
  [int]$Port = 8081,
  [switch]$ValidateOnly
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$mobileRoot = Join-Path $repoRoot 'apps/mobile'
$ansiPattern = "$([char]27)\[[0-?]*[ -/]*[@-~]"

Push-Location $mobileRoot
try {
  $env:CI = '1'
  $env:PNPM_CONFIG_REPORTER = 'silent'
  $environmentOutput = (& pnpm dlx eas-cli@latest env:list preview --format short 2>&1 | Out-String)
  if ($LASTEXITCODE -ne 0) {
    throw 'Unable to load the EAS Preview environment.'
  }

  foreach ($line in ($environmentOutput -split "`r?`n")) {
    $cleanLine = [regex]::Replace([string]$line, $ansiPattern, '').Trim()
    if ($cleanLine -match '^(EXPO_PUBLIC_[A-Z0-9_]+|SENTRY_ORG|SENTRY_PROJECT)=(.+)$') {
      [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2], 'Process')
    }
  }

  $env:APP_VARIANT = 'staging'
  $env:EXPO_PUBLIC_APP_ENV = 'staging'
  $env:WATCHLY_DEV_CLIENT = 'true'
  $env:NODE_OPTIONS = '--max-old-space-size=8192'

  $requiredPublicVariables = @(
    'EXPO_PUBLIC_API_URL',
    'EXPO_PUBLIC_ERROR_TRACKING_DSN',
    'EXPO_PUBLIC_FIREBASE_API_KEY',
    'EXPO_PUBLIC_FIREBASE_APP_ID',
    'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
    'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID',
    'EXPO_PUBLIC_MICROSOFT_CLIENT_ID'
  )
  $missingVariables = $requiredPublicVariables | Where-Object {
    [string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($_, 'Process'))
  }
  if ($missingVariables.Count -gt 0) {
    throw "EAS Preview is missing: $($missingVariables -join ', ')."
  }

  $firebaseAppMatch = [regex]::Match($env:EXPO_PUBLIC_FIREBASE_APP_ID, '^1:([0-9]+):')
  if (-not $firebaseAppMatch.Success) {
    throw 'EXPO_PUBLIC_FIREBASE_APP_ID is invalid.'
  }
  if (-not $env:EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID.StartsWith("$($firebaseAppMatch.Groups[1].Value)-")) {
    throw 'The Google iOS client belongs to a different Firebase project.'
  }

  $configOutput = ''
  $configExitCode = 1
  foreach ($attempt in 1..2) {
    $configOutput = (& pnpm exec expo config --type public --json 2>$null | Out-String)
    $configExitCode = $LASTEXITCODE
    if ($configExitCode -eq 0) {
      break
    }
    if ($attempt -eq 1) {
      Write-Warning 'Expo staging manifest resolution failed once. Retrying.'
      Start-Sleep -Seconds 1
    }
  }
  if ($configExitCode -ne 0) {
    throw 'Unable to resolve the Expo staging manifest after two attempts.'
  }
  $config = $configOutput | ConvertFrom-Json
  $requiredSchemes = @(
    'com.tom.tvapp.staging',
    'msauth.com.tom.tvapp.staging',
    'discord-1539925787333890090'
  )
  $manifestIsValid = $config.name -eq 'Watchly Staging' `
    -and $config.ios.bundleIdentifier -eq 'com.tom.tvapp.staging' `
    -and $config.ios.usesAppleSignIn -eq $true `
    -and $config.extra.appEnvironment -eq 'staging' `
    -and -not ($requiredSchemes | Where-Object { $_ -notin $config.scheme })
  if (-not $manifestIsValid) {
    throw 'The Expo manifest does not match the Watchly staging auth configuration.'
  }

  Write-Host 'Watchly staging auth configuration is valid.'
  if ($ValidateOnly) {
    return
  }

  pnpm exec expo start --dev-client --host lan --port $Port
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
} finally {
  Pop-Location
}
