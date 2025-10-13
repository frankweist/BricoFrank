<#
  🚀 Deploy automático BricoFrank (auto-fix worktree)
#>

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "=== 🚀 INICIANDO DEPLOY BRICOFRANK ===" -ForegroundColor Cyan

# 1️⃣ Rama main
git switch main
git pull origin main

# 2️⃣ Compilar app
npm run build

# 3️⃣ Asegurar worktree
$wt = "..\_pages"
git worktree prune
if (-not (Test-Path $wt) -or -not (Test-Path "$wt\.git")) {
  Write-Host "⚙️ Worktree inválido o ausente. Recreando..."
  if (Test-Path $wt) { Remove-Item $wt -Recurse -Force }
  if (Test-Path ".git\worktrees\_pages") { Remove-Item ".git\worktrees\_pages" -Recurse -Force }
  git fetch origin gh-pages
  git worktree add -B gh-pages $wt origin/gh-pages
}

# 4️⃣ Copiar build
Write-Host "📦 Copiando build..."
Remove-Item "$wt\*" -Recurse -Force -ErrorAction SilentlyContinue
Copy-Item ".\dist\*" $wt -Recurse -Force
Copy-Item "$wt\index.html" "$wt\404.html" -Force
New-Item -ItemType File -Path "$wt\.nojekyll" -Force | Out-Null

# 5️⃣ Commit + push
Write-Host "⬆️ Subiendo a gh-pages..."
git -C $wt add -A
$changes = git -C $wt status --porcelain
if ($changes) {
  git -C $wt commit -m ("deploy: {0}" -f (Get-Date -Format 'yyyyMMddHHmmss'))
  git -C $wt push origin gh-pages
} else {
  Write-Host "✅ Sin cambios nuevos que subir."
}

Write-Host "✅ DEPLOY COMPLETADO" -ForegroundColor Green
Write-Host "🌐 URL: https://frankweist.github.io/BricoFrank/"
