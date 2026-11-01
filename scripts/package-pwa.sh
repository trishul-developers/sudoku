#!/usr/bin/env bash
# Produce a PWA ZIP with index.html at the ZIP root (not under www/).
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
VERSION="$(node -p 'require("./package.json").version')"
if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo 'package.json must contain a stable SemVer version' >&2
  exit 1
fi
mkdir -p dist
rm -f "dist/sudoku-pwa-v${VERSION}.zip"
(
  cd www
  find . -type f | LC_ALL=C sort | zip -q -X "../dist/sudoku-pwa-v${VERSION}.zip" -@
)
unzip -tqq "dist/sudoku-pwa-v${VERSION}.zip"
echo "Created dist/sudoku-pwa-v${VERSION}.zip"
