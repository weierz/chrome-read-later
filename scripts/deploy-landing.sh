#!/usr/bin/env bash
# Publishes the landing page to dmit (readlater.weierz.com, behind Cloudflare).
# The page runs the real popup, so the popup, shared modules, and icons ship
# with it. Each upload is a new release; `current` switches only once the
# upload is complete, and older releases stay for rollback.
set -euo pipefail

cd "$(dirname "$0")/.."
test -s index.html

release="$(date -u +%Y%m%dT%H%M%SZ)-$(git rev-parse --short HEAD)-$$"
root=/var/www/readlater.weierz.com

ssh -o BatchMode=yes dmit mkdir -p "$root/releases/$release"
rsync -az --chmod=Du=rwx,Dgo=rx,Fu=rw,Fgo=r -e 'ssh -o BatchMode=yes' \
  --exclude '*.test.mjs' --exclude '.DS_Store' --exclude '*.d.ts' \
  index.html landing popup modules icons \
  "dmit:$root/releases/$release/"

ssh -o BatchMode=yes dmit bash -s -- "$root" "$release" <<'REMOTE'
set -euo pipefail
root=$1
release=$2
test -s "$root/releases/$release/index.html"
ln -s "releases/$release" "$root/current-$release"
mv -Tf "$root/current-$release" "$root/current"
REMOTE

printf 'Published %s to dmit (%s/current)\n' "$release" "$root"
