# Requires an authenticated GitHub CLI and Git, plus organization permission.
param([Parameter(Mandatory = $true)][ValidateSet('public', 'private')][string]$Visibility)
$ErrorActionPreference = 'Stop'
Set-Location (Resolve-Path (Join-Path $PSScriptRoot '..'))
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { throw 'Install and authenticate GitHub CLI (gh auth login).' }
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'Install Git.' }
& gh auth status
if ($LASTEXITCODE -ne 0) { throw 'GitHub CLI is not authenticated.' }
& gh repo view trishul-developers/sudoku *> $null
if ($LASTEXITCODE -eq 0) { throw 'Target repository already exists. Refusing to overwrite it.' }
if (-not (Test-Path .git)) {
    & git init -b main
    if ($LASTEXITCODE -ne 0) { throw 'Git initialization failed.' }
}
& git add -A
if ($LASTEXITCODE -ne 0) { throw 'git add failed.' }
$changed = & git diff --cached --name-only
if ($LASTEXITCODE -ne 0) { throw 'git diff failed.' }
if ($changed) {
    & git commit -m 'Initial Sudoku PWA and Android release pipeline'
    if ($LASTEXITCODE -ne 0) { throw 'Commit failed. Configure git user.name and user.email.' }
}
& git branch -M main
if ($LASTEXITCODE -ne 0) { throw 'Branch setup failed.' }
& gh repo create trishul-developers/sudoku ("--" + $Visibility) --source=. --remote=origin --push
if ($LASTEXITCODE -ne 0) { throw 'Repo create/push failed. Check organization repository-creation permissions.' }
Write-Output 'Published https://github.com/trishul-developers/sudoku'
