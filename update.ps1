param([string]$m = "chore: update")
$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot

# --- 1. Sincronizando y subiendo la rama 'main' ---
Write-Host "--- 1. Sincronizando y subiendo la rama 'main'..." -ForegroundColor Green

git switch main
git fetch origin
git pull --rebase origin main

git add -A
$mainStatus = git diff --cached --name-only
if ($mainStatus) {
    git commit -m $m
    Write-Host "Commit creado en main: '$m'" -ForegroundColor Yellow
} else {
    Write-Host "No hay cambios para commitear en main. Saltando commit." -ForegroundColor Yellow
}
git push origin main

Write-Host ""
Write-Host "========================================================" -ForegroundColor Green
Write-Host "OK: La rama 'main' ha sido actualizada y subida a GitHub." -ForegroundColor Green
Write-Host "El despliegue a 'gh-pages' se iniciará ahora con GitHub Actions." -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green