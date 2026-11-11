#!/usr/bin/env bash
# Hourly job (cPanel > Cron Jobs):  7 * * * *  bash $HOME/perks/current/deploy/cron.sh >/dev/null
# Expires vouchers and sends "expires soon" reminders. Reads APP_URL and CRON_SECRET from shared/.env so the
# secret never appears in the crontab. Prints nothing on success; cPanel emails the output if it fails.
set -euo pipefail
ENV_FILE="${PERKS_HOME:-$HOME/perks}/shared/.env"
get() { { grep -E "^$1=" "$ENV_FILE" || true; } | tail -1 | cut -d= -f2- | sed -E 's/^"(.*)"$/\1/; s/^'"'"'(.*)'"'"'$/\1/'; }
APP_URL="$(get APP_URL)"
CRON_SECRET="$(get CRON_SECRET)"
curl -fsS --max-time 120 -H "Authorization: Bearer $CRON_SECRET" "$APP_URL/api/cron/expire-vouchers" >/dev/null
