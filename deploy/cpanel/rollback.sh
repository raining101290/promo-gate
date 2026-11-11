#!/usr/bin/env bash
# Switch back to the previous release (on the server):  bash ~/perks/current/deploy/rollback.sh
# Only the code goes back; database migrations stay applied.
set -euo pipefail
HOME_DIR="${PERKS_HOME:-$HOME/perks}"
# Atomic symlink replace: GNU mv -T on the server, BSD mv -h for local tests on macOS.
swap_link() { if mv --version >/dev/null 2>&1; then mv -Tf "$1" "$2"; else mv -fh "$1" "$2"; fi; }
CUR="$(readlink "$HOME_DIR/current")"
PREV="$(ls -1dt "$HOME_DIR"/releases/*/ | sed 's:/$::' | grep -vxF "$CUR" | head -1 || true)"
[[ -n "$PREV" ]] || { echo "no earlier release to roll back to"; exit 1; }
ln -sfn "$PREV" "$HOME_DIR/current.new" && swap_link "$HOME_DIR/current.new" "$HOME_DIR/current"
cp "$PREV/deploy/app.cjs" "$HOME_DIR/app/app.cjs"
mkdir -p "$HOME_DIR/app/tmp" && touch "$HOME_DIR/app/tmp/restart.txt"
echo "current -> $(basename "$PREV") (was $(basename "$CUR")). Open the site once to start it."
