# Backup And Restore Readiness

Production PostgreSQL runs on Railway Hobby, which provides no managed backups or point-in-time recovery. Watchly therefore runs its own encrypted daily backups from GitHub Actions to a dedicated Cloudflare R2 bucket.

## How it works

The workflow `.github/workflows/db-backup.yml` runs every day at 18:17 UTC (03:17 KST) and on demand from the Actions tab. Each run:

1. Dumps production with `pg_dump` in custom format (`scripts/db-backup.sh`).
2. Checks that the archive is readable and contains the `users` and `_prisma_migrations` data.
3. Encrypts it with GPG (AES-256, symmetric passphrase) and writes a SHA-256 checksum. The plain dump is deleted immediately.
4. Uploads `watchly-<UTC timestamp>.dump.gpg` and its `.sha256` to `s3://<bucket>/postgres/production/`.
5. Runs a restore drill: decrypts and restores the new backup into a throwaway PostgreSQL 18 container (`scripts/db-restore.sh`), then runs `db:verify` and `security:backup-readiness` against it.
6. Deletes backups older than 30 days (`BACKUP_RETENTION_DAYS`).
7. Pings an optional heartbeat URL so a missed run raises an alert.

A failed step fails the run, and GitHub sends a failure e-mail to the repository owner. Recovery point objective: 24 hours.

## One-time setup

1. **R2 bucket.** Create a private bucket dedicated to backups (for example `watchly-db-backups`), separate from the media bucket. Create an R2 API token with *Object Read & Write* limited to this bucket.
2. **Database URL.** In Railway, open the production Postgres service and copy `DATABASE_PUBLIC_URL` (TCP proxy). The internal URL is not reachable from GitHub.
3. **Passphrase.** The setup script below generates a random passphrase and asks you to store it in your password manager. Without it, no backup can be restored. Never commit it.
4. **GitHub secrets.** Run `powershell -ExecutionPolicy Bypass -File scripts/setup-db-backup-secrets.ps1` from the repository root. It generates the passphrase (step 3), prompts for the other values without echoing them and stores them with `gh`. The resulting secrets are:

| Secret | Value |
| --- | --- |
| `PROD_DATABASE_URL` | Railway `DATABASE_PUBLIC_URL` of production |
| `BACKUP_ENCRYPTION_PASSPHRASE` | Passphrase from step 3 |
| `R2_ACCOUNT_ID` | Cloudflare account ID |
| `R2_BACKUP_BUCKET` | Bucket name from step 1 |
| `R2_BACKUP_ACCESS_KEY_ID` | R2 token access key |
| `R2_BACKUP_SECRET_ACCESS_KEY` | R2 token secret |
| `BACKUP_HEARTBEAT_URL` | Optional. Better Stack heartbeat URL with a 26-hour period |

5. Run the workflow manually once (Actions > Database backup > Run workflow) and confirm that the object appears in R2 and that the restore drill step passes.

`PG_CLIENT_VERSION` in the workflow must be greater than or equal to the production server major version (`SHOW server_version;`).

## Before risky operations

Before a manual migration, a bulk edit or destructive maintenance, trigger the workflow manually and wait for it to succeed.

## Restoring

Download the chosen backup and its checksum from R2 into an empty folder, then from a machine with the PostgreSQL client and GPG:

```bash
TARGET_DATABASE_URL='postgresql://...' \
BACKUP_ENCRYPTION_PASSPHRASE='...' \
RESTORE_CONFIRM='<target database name>' \
bash scripts/db-restore.sh ./watchly-20261105T181700Z.dump.gpg
```

`RESTORE_CONFIRM` must match the database name in the target URL. The restore drops and recreates the objects contained in the backup, so restore into a new database first, verify it, then switch the API's `DATABASE_URL` to it rather than overwriting production in place. Verify the target with:

```bash
DATABASE_URL='postgresql://...' pnpm --filter api db:verify
DATABASE_URL='postgresql://...' pnpm --filter api security:backup-readiness
```

Record each manual restore (date, backup file, target, verification result) in this document.

## Restore log

| Date | Backup | Target | Result |
| --- | --- | --- | --- |
| 2026-11-05 | Local dump of a database migrated with all 60 migrations | Local PostgreSQL 18 container | Restored, `db:verify` and `security:backup-readiness` passed. Wrong passphrase and wrong `RESTORE_CONFIRM` were refused. |
