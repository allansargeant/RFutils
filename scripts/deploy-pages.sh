#!/usr/bin/env bash
#
# Build the browser-only version of RFutils and publish it to the gh-pages
# branch, which GitHub Pages serves at https://stoatworks-labs.com/RFutils/.
#
# What gets published is the static build: conversion, coordination and the
# inventory all run in the visitor's browser (no file is uploaded anywhere).
# Monitor and Deployment are absent — LAN discovery and programming receivers
# need the local server, and a page can't open those sockets.
#
# Deliberately does NOT use GitHub Actions: the org's Actions quota has run out
# before, and when it does, workflows fail in about three seconds in a way that
# looks like an outage rather than a quota. Building here costs no minutes.
#
# One-time setup on GitHub:
#   Settings -> Pages -> Source: "Deploy from a branch" -> gh-pages / (root)
#
# Usage:
#   scripts/deploy-pages.sh            # build and publish
#   scripts/deploy-pages.sh --dry-run  # build, show what would be published
set -euo pipefail

cd "$(dirname "$0")/.."

DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

BRANCH=gh-pages
REMOTE=origin
OUT=packages/web/dist-static

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "error: not a git repository" >&2
  exit 1
fi

if ! git remote get-url "$REMOTE" >/dev/null 2>&1; then
  echo "error: no '$REMOTE' remote" >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "warning: working tree is dirty — publishing the built output anyway," >&2
  echo "         but the source commit won't match what goes live." >&2
fi

SOURCE_REF="$(git rev-parse --short HEAD)"

echo "==> Building the static (browser-only) app"
rm -rf "$OUT"
npm run build:static

if [[ ! -f "$OUT/index.html" ]]; then
  echo "error: $OUT/index.html missing — build produced nothing to publish" >&2
  exit 1
fi

# GitHub Pages runs Jekyll by default, which silently drops paths beginning with
# an underscore. Vite doesn't emit any today, but one dependency change is all
# it would take, and the failure looks like a broken deploy rather than a filter.
touch "$OUT/.nojekyll"

echo "==> Publishing $(find "$OUT" -type f | wc -l | tr -d ' ') files to $BRANCH"

if $DRY_RUN; then
  echo "--dry-run: would publish the contents of $OUT/ to $REMOTE/$BRANCH"
  find "$OUT" -maxdepth 2 -type f | sed 's|^|    |'
  exit 0
fi

WORKTREE="$(mktemp -d)"
cleanup() { git worktree remove --force "$WORKTREE" 2>/dev/null || true; }
trap cleanup EXIT

# A detached worktree keeps the publish completely off the current branch: no
# stashing, no checkout, and an interrupted run can't leave the source tree
# holding built output.
if git show-ref --verify --quiet "refs/remotes/$REMOTE/$BRANCH"; then
  git worktree add --force "$WORKTREE" -B "$BRANCH" "$REMOTE/$BRANCH" >/dev/null
else
  git worktree add --force --detach "$WORKTREE" >/dev/null
  git -C "$WORKTREE" checkout --orphan "$BRANCH" >/dev/null 2>&1
  git -C "$WORKTREE" rm -rf . >/dev/null 2>&1 || true
fi

find "$WORKTREE" -mindepth 1 -maxdepth 1 -not -name .git -exec rm -rf {} +
cp -R "$OUT"/. "$WORKTREE"/

git -C "$WORKTREE" add -A
if git -C "$WORKTREE" diff --cached --quiet; then
  echo "==> No change since the last deploy. Nothing to push."
  exit 0
fi

git -C "$WORKTREE" commit -q -m "Deploy RFutils web app from ${SOURCE_REF}"
git -C "$WORKTREE" push -q "$REMOTE" "$BRANCH"

echo "==> Published. Live shortly at https://stoatworks-labs.com/RFutils/"
