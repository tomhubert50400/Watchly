#!/usr/bin/env bash
# Dump, verify and encrypt a Watchly PostgreSQL database.
#
# Usage:
#   DATABASE_URL=postgresql://... BACKUP_ENCRYPTION_PASSPHRASE=... scripts/db-backup.sh <output-dir>
#
# Prints the path of the encrypted archive on stdout. A matching .sha256 file is
# written next to it. The unencrypted dump never leaves the output directory and
# is deleted before the script exits.
set -euo pipefail

out_dir="${1:?usage: db-backup.sh <output-dir>}"
: "${DATABASE_URL:?DATABASE_URL is required}"
: "${BACKUP_ENCRYPTION_PASSPHRASE:?BACKUP_ENCRYPTION_PASSPHRASE is required}"

case "$DATABASE_URL" in
  *'${{'*) echo "DATABASE_URL contains an unresolved Railway reference. Store the resolved value." >&2; exit 1 ;;
esac

# Prisma URLs may carry ?schema=public, which libpq rejects.
db_url="$(printf '%s' "$DATABASE_URL" | sed -E 's/([?&])schema=[^&]*&?/\1/; s/[?&]$//')"

mkdir -p "$out_dir"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
dump="$out_dir/watchly-$stamp.dump"
trap 'rm -f "$dump" "$dump.toc"' EXIT

pg_dump --format=custom --compress=9 --no-owner --no-acl --dbname="$db_url" --file="$dump"

# A readable archive must list the core tables, otherwise the backup is useless.
pg_restore --list "$dump" > "$dump.toc"
for table in users _prisma_migrations; do
  if ! grep -q "TABLE DATA public $table " "$dump.toc"; then
    echo "Backup verification failed: table $table is missing from the archive." >&2
    exit 1
  fi
done

gpg --batch --yes --quiet --pinentry-mode loopback --passphrase-fd 3 \
  --symmetric --cipher-algo AES256 --output "$dump.gpg" "$dump" \
  3<<<"$BACKUP_ENCRYPTION_PASSPHRASE"

(cd "$out_dir" && sha256sum "$(basename "$dump.gpg")" > "$(basename "$dump.gpg").sha256")

echo "$dump.gpg"
