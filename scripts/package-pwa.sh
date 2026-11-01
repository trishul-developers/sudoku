#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
VERSION="$(node -p 'require("./package.json").version')"
mkdir -p dist
(
  cd www
  find . -type f | LC_ALL=C sort | zip -q -X "../dist/sudoku-pwa-v${VERSION}.zip" -@
)
unzip -tqq "dist/sudoku-pwa-v${VERSION}.zip"
printf 'Created dist/sudoku-pwa-v%s.zip\n' "$VERSION"
