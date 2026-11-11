#!/usr/bin/env bash
# Runs ON the cPanel server, from inside a freshly unpacked release (CI calls it over SSH):
#   bash ~/perks/releases/<id>/deploy/activate.sh
# 1. installs the Prisma CLI for this release (cached per version), 2. runs `prisma migrate deploy`,
# 3. switches ~/perks/current to this release and restarts Passenger, 4. waits for /api/health to report
# this release (rolls the symlink back if it doesn't), 5. keeps the newest $KEEP_RELEASES releases.
# Migrations are not rolled back, so they must stay compatible with the previous release.
set -euo pipefail

REL="$(cd "$(dirname "$0")/.." && pwd)"
ID="$(basename "$REL")"
HOME_DIR="${PERKS_HOME:-$HOME/perks}"
# Atomic symlink replace: GNU mv -T on the server, BSD mv -h for local tests on macOS.
swap_link() { if mv --version >/dev/null 2>&1; then mv -Tf "$1" "$2"; else mv -fh "$1" "$2"; fi; }
SHARED="$HOME_DIR/shared"
KEEP_RELEASES="${KEEP_RELEASES:-5}"
log() { printf '[deploy %s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }
die() { log "ERROR: $*"; exit 1; }

[[ "$REL" == "$HOME_DIR/releases/"* ]] || die "release must live in $HOME_DIR/releases (got $REL)"
[[ -f "$SHARED/.env" ]] || die "$SHARED/.env is missing (see docs/DEPLOY-CPANEL.md step 4)"
chmod 600 "$SHARED/.env"

# Node from the cPanel Node.js selector's virtualenv (newest version installed for perks/app).
if [[ -z "${NODE_BIN:-}" ]]; then
  NODE_BIN="$(ls -d "$HOME"/nodevenv/perks/app/*/bin 2>/dev/null | sort -V | tail -1 || true)"
fi
[[ -x "${NODE_BIN:-}/node" ]] || die "no Node.js found. Create the app in cPanel > Setup Node.js App first (root perks/app), or set NODE_BIN"
export PATH="$NODE_BIN:$PATH"
node -e 'const [a,b]=process.versions.node.split(".").map(Number); process.exit(a>22||(a===22&&b>=18)?0:1)' \
  || die "Node $(node -v) is too old; pick 24.x in Setup Node.js App"
log "release $ID, node $(node -v)"

env_get() { node -e 'process.loadEnvFile(process.argv[1]); process.stdout.write(process.env[process.argv[2]] ?? "")' "$SHARED/.env" "$1"; }
APP_URL="$(env_get APP_URL)"
[[ -n "$APP_URL" ]] || die "APP_URL is not set in $SHARED/.env"
STORAGE_DIR="$(env_get STORAGE_LOCAL_DIR)"
if [[ -n "$STORAGE_DIR" ]]; then mkdir -p "$STORAGE_DIR" && chmod 700 "$STORAGE_DIR"; fi

# 1. Prisma CLI (+ pg/bcryptjs for create-admin.mjs). Installed here so npm fetches the schema engine
#    built for this server's OS; cached by the exact versions in migrate/package.json.
TOOLS="$HOME_DIR/tools/$({ sha1sum 2>/dev/null || shasum; } < "$REL/migrate/package.json" | cut -c1-12)"
if [[ ! -x "$TOOLS/node_modules/.bin/prisma" ]]; then
  log "installing migration tools into $TOOLS"
  rm -rf "$TOOLS.tmp" && mkdir -p "$TOOLS.tmp"
  cp "$REL/migrate/package.json" "$TOOLS.tmp/"
  (cd "$TOOLS.tmp" && npm install --omit=dev --no-audit --no-fund --loglevel=error)
  rm -rf "$TOOLS" && mv "$TOOLS.tmp" "$TOOLS"
fi
ln -sfn "$TOOLS/node_modules" "$REL/migrate/node_modules"
ln -sfn "$SHARED/.env" "$REL/migrate/.env"

# 2. Migrations
log "prisma migrate deploy"
(cd "$REL/migrate" && ./node_modules/.bin/prisma migrate deploy --config prisma7.config.ts)

# 3. Switch + restart
PREV="$(readlink "$HOME_DIR/current" 2>/dev/null || true)"
switch_to() {
  ln -sfn "$1" "$HOME_DIR/current.new" && swap_link "$HOME_DIR/current.new" "$HOME_DIR/current"
  mkdir -p "$HOME_DIR/app/tmp"
  cp "$1/deploy/app.cjs" "$HOME_DIR/app/app.cjs"
  touch "$HOME_DIR/app/tmp/restart.txt"
}
switch_to "$REL"
log "switched current -> $ID (previous: ${PREV:-none})"

# 4. Health: the first request starts the new process; wait until it reports this release.
for i in $(seq 1 40); do
  body="$(curl -fsS --max-time 15 "$APP_URL/api/health" 2>/dev/null || true)"
  if [[ "$body" == *"\"release\":\"$ID\""* && "$body" == *'"ok":true'* ]]; then
    log "healthy: $body"
    # 5. Prune old releases (never the active one)
    ls -1dt "$HOME_DIR"/releases/*/ | tail -n +"$((KEEP_RELEASES + 1))" | while read -r old; do
      [[ "${old%/}" == "$REL" ]] || rm -rf -- "${old%/}"
    done
    log "done"
    exit 0
  fi
  sleep 3
done

log "health check failed. Last response: ${body:-<none>}"
if [[ -n "$PREV" && -d "$PREV" ]]; then
  switch_to "$PREV"
  log "rolled back to $(basename "$PREV")"
fi
die "deploy of $ID failed (check ~/perks/app/stderr.log and Setup Node.js App logs)"
