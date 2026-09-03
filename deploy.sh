#!/usr/bin/env bash
# Jitsi Talk — deploy the static wrapper to the talk.denizsincar.ru webroot.
# Usage:  ~/jitsi_talk/deploy.sh     (run from the repo checkout)
set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST="${DEST:-/var/www/html/talk}"

# First deploy needs root to create the dir under /var/www; afterwards the dir
# is owned by us and plain rsync is enough (works for a cron/CI run too).
if [[ -d "$DEST" && -w "$DEST" ]]; then
  : # already writable
else
  sudo install -d -o "$(id -un)" "$DEST"
fi

rsync -a --delete \
  --exclude='.git' \
  --exclude='deploy.sh' \
  "$SRC"/ "$DEST"/

echo "Deployed $SRC -> $DEST"
