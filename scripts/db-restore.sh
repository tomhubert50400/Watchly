#!/usr/bin/env bash
# Decrypt and restore a backup produced by scripts/db-backup.sh.
#
# Usage:
#   TARGET_DATABASE_URL=postgresql://... BACKUP_ENCRYPTION_PASSPHRASE=... \
#   RESTORE_CONFIRM=<target database name> scripts/db-restore.sh <backup.dump.gpg>
#
# RESTORE_CONFIRM must equal the database name in TARGET_DATABASE_URL. The
# restore replaces existing objects in the target, so never point it at the
# production database unless you are recovering production on purpose.
set -euo pipefail

archive="${1:?usage: db-restore.sh <backup.dump.gpg>}"
: "${TARGET_DATABASE_URL:?TARGET_DATABASE_URL is required}"
: "${BACKUP_ENCRYPTION_PASSPHRASE:?BACKUP_ENCRYPTION_PASSPHRASE is required}"

db_url="$(printf '%s' "$TARGET_DATABASE_URL" | sed -E 's/([?&])schema=[^&]*&?/\1/; s/[?&]$//')"
db_name="$(printf '%s' "$db_url" | sed -E 's#^[^/]*//[^/]*/##; s#\?.*$##')"

if [ "${RESTORE_CONFIRM:-}" != "$db_name" ]; then
  echo "Refusing to restore: set RESTORE_CONFIRM=$db_name to confirm the target database." >&2
  exit 1
fi

if [ -f "$archive.sha256" ]; then
  (cd "$(dirname "$archive")" && sha256sum --check --quiet "$(basename "$archive").sha256")
fi

work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT
dump="$work_dir/restore.dump"

gpg --batch --yes --quiet --pinentry-mode loopback --passphrase-fd 3 \
  --decrypt --output "$dump" "$archive" \
  3<<<"$BACKUP_ENCRYPTION_PASSPHRASE"

pg_restore --no-owner --no-acl --clean --if-exists --exit-on-error \
  --single-transaction --dbname="$db_url" "$dump"

echo "Restored $(basename "$archive") into $db_name."
