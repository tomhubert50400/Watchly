# Store the GitHub Actions secrets used by .github/workflows/db-backup.yml.
#
# Run from the repository root in your own terminal:
#   powershell -ExecutionPolicy Bypass -File scripts/setup-db-backup-secrets.ps1
#
# Values are typed into this terminal only and sent straight to GitHub with gh.
# Nothing is written to disk. See docs/security/backup-restore-readiness.md.

$ErrorActionPreference = 'Stop'
$repo = 'tomhubert50400/Watchly'

function Read-Secret([string]$prompt) {
  $secure = Read-Host -Prompt $prompt -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr).Trim() }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

function Set-RepoSecret([string]$name, [string]$value) {
  if ([string]::IsNullOrWhiteSpace($value)) { throw "$name is empty." }
  gh secret set $name --repo $repo --body $value | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "gh failed to set $name." }
  Write-Host "  $name set." -ForegroundColor Green
}

gh auth status 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Run "gh auth login" first.' }

$existing = @(gh secret list --repo $repo --json name --jq '.[].name')

Write-Host "`n1/4 Production database" -ForegroundColor Cyan
Write-Host '  Railway > production > Postgres > Variables > DATABASE_PUBLIC_URL'
$dbUrl = Read-Secret '  Paste DATABASE_PUBLIC_URL'
if ($dbUrl -notmatch '^postgres(ql)?://') { throw 'This does not look like a PostgreSQL URL.' }
if ($dbUrl -match 'railway\.internal') { throw 'This is the internal URL. Use DATABASE_PUBLIC_URL.' }
Set-RepoSecret 'PROD_DATABASE_URL' $dbUrl
$dbUrl = $null

Write-Host "`n2/4 Encryption passphrase" -ForegroundColor Cyan
$keepPassphrase = $false
if ($existing -contains 'BACKUP_ENCRYPTION_PASSPHRASE') {
  $answer = Read-Host '  A passphrase already exists. Keep it? Existing backups need the old one. [Y/n]'
  $keepPassphrase = ($answer -eq '' -or $answer -match '^[yYoO]')
}
if (-not $keepPassphrase) {
  $bytes = New-Object byte[] 36
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $passphrase = [Convert]::ToBase64String($bytes)
  Write-Host ''
  Write-Host "  $passphrase" -ForegroundColor Yellow
  Write-Host ''
  Write-Host '  Save it NOW in your password manager as "Watchly DB backup passphrase".'
  Write-Host '  Without it, no backup can ever be restored.'
  do { $confirm = Read-Host '  Type SAVED once it is stored' } while ($confirm -ne 'SAVED')
  Clear-Host
  Set-RepoSecret 'BACKUP_ENCRYPTION_PASSPHRASE' $passphrase
  $passphrase = $null
}

Write-Host "`n3/4 Cloudflare R2" -ForegroundColor Cyan
Write-Host '  R2 > Create bucket (private), e.g. watchly-db-backups'
Write-Host '  R2 > Manage API tokens > Create token: Object Read & Write, this bucket only'
$accountId = (Read-Host '  Cloudflare account ID').Trim()
$bucket = (Read-Host '  Bucket name [watchly-db-backups]').Trim()
if ($bucket -eq '') { $bucket = 'watchly-db-backups' }
Set-RepoSecret 'R2_ACCOUNT_ID' $accountId
Set-RepoSecret 'R2_BACKUP_BUCKET' $bucket
Set-RepoSecret 'R2_BACKUP_ACCESS_KEY_ID' (Read-Secret '  Access Key ID')
Set-RepoSecret 'R2_BACKUP_SECRET_ACCESS_KEY' (Read-Secret '  Secret Access Key')

Write-Host "`n4/4 Heartbeat (optional)" -ForegroundColor Cyan
Write-Host '  Better Stack > Heartbeats > new heartbeat, period 26 hours. Leave empty to skip.'
$heartbeat = Read-Secret '  Heartbeat URL'
if ($heartbeat -ne '') { Set-RepoSecret 'BACKUP_HEARTBEAT_URL' $heartbeat }

Write-Host "`nDone. Start the first backup with:" -ForegroundColor Green
Write-Host "  gh workflow run db-backup.yml --repo $repo"
