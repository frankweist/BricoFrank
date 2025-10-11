param([string]$m = "chore: update")
$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot

$root = git rev-parse --show-toplevel
$oldWorktreePath = Join-Path $root "gh-pages"
$wt = Join-Path $root "_pages"

<<<<<<< Updated upstream
git switch main
git fetch origin
git pull --rebase origin main

=======
# 1) Main: actualizar y subir
git switch main
git fetch origin
git pull --rebase origin main
>>>>>>> Stashed changes
git add -A
if (git diff --cached --name-only) {
    git commit -m $m
}
git push origin main

<<<<<<< Updated upstream
if (Test-Path $oldWorktreePath) {
    git worktree remove --force $oldWorktreePath
    Remove-Item $oldWorktreePath -Recurse -Force
}

if (Test-Path $wt) {
    Remove-Item $wt -Recurse -Force
}

git worktree add $wt gh-pages

Start-Sleep -Seconds 1

if (-not (Test-Path $wt)) {
    Write-Error "Error: Carpeta $wt no existe tras crear worktree"
    exit 1
}

if (-not (git -C $wt rev-parse --is-inside-work-tree 2>$null)) {
    Write-Error "Error: $wt no es un repositorio git válido"
    exit 1
=======
# 2) Asegurar worktree gh-pages
$wt = Join-Path (Get-Location) "..\_pages"
git worktree prune
if (-not (Test-Path (Join-Path $wt ".git"))) {
  if (Test-Path $wt) { Remove-Item $wt -Recurse -Force }
  git worktree add $wt gh-pages
>>>>>>> Stashed changes
}

if (-not (Test-Path "node_modules")) { npm ci }
npm run build

<<<<<<< Updated upstream
Remove-Item "$wt\*" -Recurse -Force -ErrorAction SilentlyContinue
=======
# 4) Publicar sin borrar .git
Get-ChildItem $wt -Force | Where-Object Name -ne '.git' | Remove-Item -Recurse -Force
>>>>>>> Stashed changes
Copy-Item .\dist\* $wt -Recurse -Force
Copy-Item "$wt\index.html" "$wt\404.html" -Force
New-Item -ItemType File -Path "$wt\.nojekyll" -Force | Out-Null

<<<<<<< Updated upstream
=======
# 5) Commit y push desde el worktree
>>>>>>> Stashed changes
git -C $wt add -A
try {
    git -C $wt commit -m ("deploy: {0:yyyyMMddHHmmss}" -f (Get-Date)) 2>$null
} catch {}

git -C $wt push origin gh-pages

Write-Host "OK: main actualizado y gh-pages desplegado."
