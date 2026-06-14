# Backup And Restore Readiness

M7.2 records the minimum backup and restore gate for the V1 PostgreSQL data model.

## Current Scope

The local repo can verify the schema and migration baseline. It cannot prove Cloud SQL backup settings or a real restore drill until a Google Cloud project, Cloud SQL instance, and production-like database exist.

## Minimum Cloud SQL Requirement

- Production Cloud SQL PostgreSQL must have automated backups enabled before user data is stored.
- Point-in-time recovery must be enabled before production traffic so accidental writes, deletes, or corruptions have a recovery window.
- The chosen backup option, retention window, backup schedule, and PITR window must be recorded with the production environment configuration before launch.
- Take an on-demand backup before risky data operations such as manual migrations, bulk edits, or destructive maintenance.
- Final or retained backup behavior must be confirmed before any production instance deletion.
- A restore drill must be performed against a non-production target before V1 production launch, then repeated regularly.

## Local Verification

Run:

```powershell
pnpm --filter api db:deploy
pnpm --filter api db:verify
pnpm --filter api security:backup-readiness
```

The backup readiness script verifies that the current database has the tables that would need to be present in a V1 backup and that the required Prisma migrations exist locally.

## Production Restore Drill

When the Cloud SQL environment exists:

1. Confirm automated backups and PITR are enabled on the primary instance.
2. Record the recovery window and retention policy.
3. Create a restore target from the selected backup or PITR timestamp.
4. Run `pnpm --filter api db:verify` against the restored target.
5. Run `pnpm --filter api security:backup-readiness` against the restored target.
6. Record the restore date, source instance, restore target, backup timestamp or PITR timestamp, commands used, and verification result.
7. Delete the restore target only after verification is recorded.

## References

- Google Cloud SQL backups overview: https://docs.cloud.google.com/sql/docs/postgres/backup-recovery/backups
- Google Cloud SQL PostgreSQL PITR: https://docs.cloud.google.com/sql/docs/postgres/backup-recovery/pitr
