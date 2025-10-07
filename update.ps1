param([string]$m = "chore: update")

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

# 0) Asegurar repo y rama
git rev-parse --show-toplevel *> $null
git switch main
git fetch origin
git pull --rebase origin main

# 1) Commit + push en main
git add -A
$pending = git diff --cached --name-only
if ($pending) { git commit -m $m }
git push origin main

# 2) Asegurar worktree gh-pages en ..\_pages
git worktree prune
$wt = Join-Path $PSScriptRoot "..\_pages"
if (-not (Test-Path (Join-Path $wt ".git"))) {
  if (Test-Path $wt) { Remove-Item $wt -Recurse -Force }
  git worktree add $wt gh-pages
}

# 3) Build
if (-not (Test-Path "node_modules")) { npm ci }
npm run build

# 4) Publicar artefactos en gh-pages (root)
Remove-Item "$wt\*" -Recurse -Force -ErrorAction SilentlyContinue
Copy-Item .\dist\* $wt -Recurse -Force
Copy-Item "$wt\index.html" "$wt\404.html" -Force
New-Item -ItemType File -Path "$wt\.nojekyll" -Force | Out-Null

# 5) Commit + push en gh-pages
git -C $wt add -A
git -C $wt commit -m "deploy: $(Get-Date -Format 'yyyyMMddHHmmss')" 2>$null
git -C $wt push origin gh-pages

Write-Host "OK: main actualizado y gh-pages desplegado."
