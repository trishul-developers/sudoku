#!/usr/bin/env bash
# Bootstrap a brand-new trishul-developers/sudoku GitHub repo from this source.
# Requires an authenticated GitHub CLI user with permission to create org repos.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
visibility="${1:-}"
if [[ "$visibility" != public && "$visibility" != private ]]; then
  echo 'Usage: bash scripts/publish-repo.sh public|private' >&2
  exit 2
fi
command -v git >/dev/null || { echo 'git is required' >&2; exit 1; }
command -v gh >/dev/null || { echo 'GitHub CLI (gh) is required' >&2; exit 1; }
gh auth status >/dev/null
if gh repo view trishul-developers/sudoku >/dev/null 2>&1; then
  echo 'The target repository already exists; refusing to overwrite it.' >&2
  exit 1
fi
if [[ ! -d .git ]]; then git init -b main; fi
git add -A
if ! git diff --cached --quiet; then
  git commit -m 'Initial Sudoku PWA and Android release pipeline'
fi
git branch -M main
gh repo create trishul-developers/sudoku "--${visibility}" --source=. --remote=origin --push
printf 'Published https://github.com/trishul-developers/sudoku\n'
