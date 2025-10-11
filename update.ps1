param([string]$m = "chore: update")
$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot

# 0) Comprobación repo
git rev-parse --show-toplevel *> $null

# 1) Main al día
git switch main
git fetch origin
git pull --rebase origin main

git add -A
$pending = git diff --cached --name-only
if ($pending) { git commit -m $m }
git push origin main

# 2) Asegurar gh-pages existe
git fetch origin

$branchExists = git show-ref --verify --quiet refs/heads/gh-pages
$remoteBranchExists = git show-ref --verify --quiet refs/remotes/origin/gh-pages

if ($remoteBranchExists -eq 0 -and $branchExists -ne 0) {
    # Si el remoto existe pero local no, crear la rama tracking
    git branch --track gh-pages origin/gh-pages 2>$null
}
elseif ($remoteBranchExists -ne 0 -and $branchExists -ne 0) {
    # Si no existe ni remoto ni local, crear gh-pages orphan
    git switch --orphan gh-pages
    New-Item -ItemType File -Path ".keep" -Force | Out-Null
    git add .keep
    git commit -m "init gh-pages"
    git switch main
}

# 3) Worktree
git worktree prune
$wt = Join-Path $PSScriptRoot "..\_pages"
if (Test-Path $wt) { Remove-Item $wt -Recurse -Force }
git worktree add $wt gh-pages

# 4) Build
if (-not (Test-Path "node_modules")) { npm ci }
npm run build

# 5) Publicar

# Validar si carpeta $wt es repo git válido
$insideWorkTree = $false
try {
    $insideWorkTree = git -C $wt rev-parse --is-inside-work-tree 2>$null
} catch {
    $insideWorkTree = $false
}

if ($insideWorkTree) {
    Remove-Item "$wt\*" -Recurse -Force -ErrorAction SilentlyContinue
    Copy-Item .\dist\* $wt -Recurse -Force
    Copy-Item "$wt\index.html" "$wt\404.html" -Force
    New-Item -ItemType File -Path "$wt\.nojekyll" -Force | Out-Null

    git -C $wt add -A
    git -C $wt commit -m ("deploy: {0:yyyyMMddHHmmss}" -f (Get-Date)) 2>$null
    git -C $wt push origin gh-pages

    Write-Host "OK: main actualizado y gh-pages desplegado."
}
else {
    Write-Error "Error: La carpeta $wt no es un repositorio git válido. No se puede publicar."
    exit 1
}
