param([string]$m = "chore: update")
$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot

# Rutas worktree
$root = git rev-parse --show-toplevel
$oldWorktreePath = Join-Path $root "gh-pages"
$wt = Join-Path $root "_pages"

# 0) Comprobar repo raíz
git rev-parse --show-toplevel *> $null

# 1) Actualizar main con stash si hay cambios
git switch main
git fetch origin

$unstaged = git status --porcelain
if ($unstaged) {
    git stash push -m "stash before pull"
}

git pull --rebase origin main

if ($unstaged) {
    git stash pop
}

git add -A
$pending = git diff --cached --name-only
if ($pending) { git commit -m $m }
git push origin main

# 2) Limpiar worktree antiguo gh-pages (forzar limpieza)
if ($null -ne $oldWorktreePath -and (Test-Path $oldWorktreePath)) {
    Write-Host "Eliminando worktree antiguo en $oldWorktreePath"
    git worktree remove --force $oldWorktreePath
    Remove-Item $oldWorktreePath -Recurse -Force
}

# 3) Limpiar carpeta _pages
if ($null -ne $wt -and (Test-Path $wt)) {
    Remove-Item $wt -Recurse -Force
}

# 4) Crear nuevo worktree
git worktree add $wt gh-pages

# Esperar creación carpeta
Start-Sleep -Seconds 1

if (-not (Test-Path $wt)) {
    Write-Error "Error: Carpeta $wt no existe tras crear worktree"
    exit 1
}

if (-not (git -C $wt rev-parse --is-inside-work-tree 2>$null)) {
    Write-Error "Error: $wt no es un repositorio git válido"
    exit 1
}

# 5) Build
if (-not (Test-Path "node_modules")) { npm ci }
npm run build

# 6) Copiar y publicar
Remove-Item "$wt\*" -Recurse -Force -ErrorAction SilentlyContinue
Copy-Item .\dist\* $wt -Recurse -Force
Copy-Item "$wt\index.html" "$wt\404.html" -Force
New-Item -ItemType File -Path "$wt\.nojekyll" -Force | Out-Null

git -C $wt add -A
try {
    git -C $wt commit -m ("deploy: {0:yyyyMMddHHmmss}" -f (Get-Date)) 2>$null
} catch {
    # sin cambios para commit, ignorar error
}
git -C $wt push origin gh-pages

Write-Host "OK: main actualizado y gh-pages desplegado."
