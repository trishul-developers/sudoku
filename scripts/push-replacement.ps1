#Requires -Version 7.0
# Commit the supplied Gemini-authored app as an isolated review branch.
[CmdletBinding()]
param(
  [string]$Repository = 'trishul-developers/sudoku',
  [string]$Branch = 'feat/gemini-material3-replacement'
)
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
foreach ($program in @('git', 'gh')) {
  if (-not (Get-Command $program -ErrorAction SilentlyContinue)) {
    throw "$program is required"
  }
}
$working = Join-Path ([IO.Path]::GetTempPath()) ('pure-sudoku-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $working | Out-Null
try {
  git clone "https://github.com/$Repository.git" $working
  if ($LASTEXITCODE -ne 0) { throw 'git clone failed' }
  Push-Location $working
  try {
    git switch -c $Branch
    if ($LASTEXITCODE -ne 0) { throw 'Cannot create review branch' }
    # Remove prior implementation; preserve the repository's original MIT license.
    $tracked = @(git ls-files)
    foreach ($rel in $tracked) {
      if ($rel -ne 'LICENSE') {
        git rm -q -f -- $rel
        if ($LASTEXITCODE -ne 0) { throw "Failed to remove $rel" }
      }
    }
    foreach ($entry in @('android', 'www', 'scripts', 'tests', '.github', 'README.md', 'package.json', '.gitignore')) {
      Copy-Item -Path (Join-Path $root $entry) -Destination $working -Force -Recurse
    }
    git add -A
    git diff --cached --stat
    git commit -m 'feat: replace Sudoku with Gemini Material 3 implementation'
    if ($LASTEXITCODE -ne 0) { throw 'git commit failed' }
    git push -u origin $Branch
    if ($LASTEXITCODE -ne 0) { throw 'git push failed' }
    gh pr create -R $Repository -B main -H $Branch --title 'Replace Sudoku with Gemini Material 3 app' --body 'Replace the prior web and native implementations with the user-supplied Gemini Sudoku app. Preserve app ID and signing. Restore installable PWA and signed APK/AAB workflows; target API 36. Please verify CI and device behavior before merge/release.'
    if ($LASTEXITCODE -ne 0) { throw 'Branch pushed, but pull request creation failed.' }
  } finally {
    Pop-Location
  }
} finally {
  Remove-Item $working -Recurse -Force -ErrorAction SilentlyContinue
}
