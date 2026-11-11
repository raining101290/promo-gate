#!/usr/bin/env bash
# Builds release.tgz for the cPanel server from a standalone build. Run from the repo root after:
#   NEXT_OUTPUT=standalone npm run build
# Usage: bash deploy/cpanel/package.sh [out.tgz]   (DIST=.next by default)
set -euo pipefail
DIST="${DIST:-.next}"
OUT="${1:-release.tgz}"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

[[ -f "$DIST/standalone/server.js" ]] || { echo "no standalone build in $DIST (set NEXT_OUTPUT=standalone)"; exit 1; }

cp -R "$DIST/standalone/." "$STAGE/"
mkdir -p "$STAGE/$DIST" && cp -R "$DIST/static" "$STAGE/$DIST/static"
rm -rf "$STAGE/public" && cp -R public "$STAGE/public"

# Migrations + tools manifest (activate.sh installs these exact versions on the server).
mkdir -p "$STAGE/migrate"
cp -R prisma "$STAGE/migrate/prisma"
rm -f "$STAGE/migrate/prisma/seed.ts" "$STAGE/migrate/prisma/seed-admin.ts" # no demo data in production; create-admin.mjs replaces seed-admin
cp prisma7.config.ts deploy/cpanel/create-admin.mjs "$STAGE/migrate/"
node -e '
  const v = (p) => require(`./node_modules/${p}/package.json`).version;
  const pkg = { private: true, type: "module", dependencies: Object.fromEntries(["prisma", "dotenv", "pg", "bcryptjs"].map((p) => [p, v(p)])) };
  require("fs").writeFileSync(process.argv[1], JSON.stringify(pkg, null, 2) + "\n");
' "$STAGE/migrate/package.json"

mkdir -p "$STAGE/deploy"
cp deploy/cpanel/app.cjs deploy/cpanel/activate.sh deploy/cpanel/cron.sh deploy/cpanel/rollback.sh deploy/cpanel/backup.sh "$STAGE/deploy/"

# Secrets and dev data must never ship: Next copies .env files into standalone output.
find "$STAGE" -name 'node_modules' -prune -o \( -name '.env*' -o -name '.outbox*' -o -name '.storage*' \) -print | while read -r f; do rm -rf "$f"; done
leaked="$(find "$STAGE" -path '*/node_modules' -prune -o \( -name '.env*' -o -name '*.pem' -o -name '.storage*' -o -name '.outbox*' \) -print)"
[[ -z "$leaked" ]] || { echo "refusing to package secrets/dev data:"; echo "$leaked"; exit 1; }
for d in src tests docs scripts; do [[ ! -e "$STAGE/$d" ]] || { echo "unexpected $d/ in the bundle (file tracing pulled in the repo)"; exit 1; }; done

tar -C "$STAGE" -czf "$OUT" .
echo "packaged $OUT ($(du -h "$OUT" | cut -f1))"
