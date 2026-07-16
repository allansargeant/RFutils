#!/usr/bin/env bash
# Build the local RFutils so the launcher has a server to spawn.
# (RFutils is a Node app; nothing is bundled into the launcher — it runs your
# local build via the paths in src-tauri/launcher.toml.)
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"      # launcher/
REPO="$(cd "$HERE/.." && pwd)"                # repo root

( cd "$REPO" && npm install && npm run build )
echo "RFutils built — dist at packages/server/dist/index.js"
echo "If RFutils is not at $REPO, edit src-tauri/launcher.toml paths."
