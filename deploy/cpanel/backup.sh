#!/usr/bin/env bash
# Nightly database dump (cPanel > Cron Jobs):  30 21 * * *  bash $HOME/perks/current/deploy/backup.sh
# (21:30 UTC = 03:30 Dhaka). Writes ~/perks/backups/perks-<UTC time>.dump (pg_dump custom format) and keeps
# BACKUP_KEEP_DAYS (default 14). Receipts in shared/storage are covered by cPanel's home-directory backups.
# Restore:  pg_restore --clean --if-exists --no-owner -d "$DATABASE_URL" <file>
set -euo pipefail
HOME_DIR="${PERKS_HOME:-$HOME/perks}"
ENV_FILE="$HOME_DIR/shared/.env"
get() { { grep -E "^$1=" "$ENV_FILE" || true; } | tail -1 | cut -d= -f2- | sed -E 's/^"(.*)"$/\1/; s/^'"'"'(.*)'"'"'$/\1/'; }
URL="$(get DIRECT_DATABASE_URL)"
URL="${URL:-$(get DATABASE_URL)}"
URL="${URL%%\?*}" # pg_dump doesn't understand Prisma's ?schema=public
OUT_DIR="$HOME_DIR/backups"
mkdir -p "$OUT_DIR" && chmod 700 "$OUT_DIR"
FILE="$OUT_DIR/perks-$(date -u +%Y%m%d-%H%M%S).dump"
umask 077
trap 'rm -f "$FILE.part"' EXIT
pg_dump --format=custom --no-owner --file="$FILE.part" "$URL"
mv "$FILE.part" "$FILE" && chmod 600 "$FILE"
find "$OUT_DIR" -name 'perks-*.dump' -mtime +"${BACKUP_KEEP_DAYS:-14}" -delete
