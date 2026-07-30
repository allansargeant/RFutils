#!/usr/bin/env bash
# Assemble the embedded RFutils app for the desktop bundle:
#   - build RFutils (shared + server + web)
#   - esbuild the server into a single ESM file
#   - download a self-contained official Node runtime
#   - lay it all out mirroring packages/{server,web}/dist so the server's
#     import.meta.url-relative paths (templates, web UI) resolve unchanged
#
# Produces src-tauri/node and src-tauri/rfutils-app/ (both git-ignored; they
# ship inside the .app / Release). Run before `npm run tauri build`.
set -euo pipefail

NODE_VERSION="v22.23.1"          # official, links only system frameworks
ARCH="darwin-arm64"

HERE="$(cd "$(dirname "$0")/.." && pwd)"     # launcher/
REPO="$(cd "$HERE/.." && pwd)"               # RFutils repo root
TAURI="$HERE/src-tauri"
APP="$TAURI/rfutils-app"

echo "==> building RFutils"
( cd "$REPO" && npm install && npm run build )

echo "==> esbuilding server -> single ESM bundle"
BANNER='import{createRequire as __cr}from "module";const require=__cr(import.meta.url);import{fileURLToPath as __f}from "url";import{dirname as __d}from "path";const __filename=__f(import.meta.url);const __dirname=__d(__filename);'
mkdir -p "$APP/packages/web/dist"
( cd "$REPO" && npx --yes esbuild@0.24.0 packages/server/src/index.ts \
    --bundle --platform=node --format=esm --target=node18 \
    --banner:js="$BANNER" \
    --outfile="$APP/packages/server/dist/index.mjs" )

# The .shw templates are NOT copied: gen-templates.mjs inlines them into
# templates.generated.ts at build time, so showGenerator reads no files and the
# bundle needs none. (This used to copy them from packages/server/src/pmse —
# a path that stopped existing when the parsers moved to packages/shared.)
echo "==> copying built web UI"
cp -R "$REPO"/packages/web/dist/. "$APP/packages/web/dist/"

echo "==> fetching self-contained Node $NODE_VERSION"
TARBALL="node-$NODE_VERSION-$ARCH"
curl -sL "https://nodejs.org/dist/$NODE_VERSION/$TARBALL.tar.gz" -o "$TAURI/node.tar.gz"
tar xzf "$TAURI/node.tar.gz" -C "$TAURI"
cp "$TAURI/$TARBALL/bin/node" "$TAURI/node"
chmod +x "$TAURI/node"
rm -rf "$TAURI/$TARBALL" "$TAURI/node.tar.gz"

echo "prepared: $TAURI/node + $APP (server bundle, templates, web UI)"
