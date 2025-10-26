# ============================
#  🚀 Script de actualización y despliegue BricoFrank (auto-pull)
#  Ubicación: C:\BricoFrank\apps\web
# ============================

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "🔧 Iniciando proceso de actualización…" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan

# --- Paso 1: Verificar carpeta ---
if (-not (Test-Path "package.json")) {
    Write-Host "❌ No se encontró package.json. Ejecuta este script dentro de C:\BricoFrank\apps\web" -ForegroundColor Red
    exit
}

# --- Paso 2: Compilar proyecto ---
Write-Host "⚙️ Compilando proyecto con PNPM…" -ForegroundColor Cyan
pnpm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error durante la compilación." -ForegroundColor Red
    exit
}
Write-Host "✅ Compilación completada." -ForegroundColor Green

# --- Paso 3: Datos del repo ---
$remote = (git remote get-url origin)
$branch = (git rev-parse --abbrev-ref HEAD)
Write-Host "📦 Repositorio remoto: $remote" -ForegroundColor Yellow
Write-Host "🌿 Rama actual: $branch" -ForegroundColor Yellow

# --- Paso 4: Auto pull --rebase ---
Write-Host "🔄 Verificando cambios remotos..." -ForegroundColor Cyan
git fetch origin $branch
$localHash = git rev-parse $branch
$remoteHash = git rev-parse origin/$branch

if ($localHash -ne $remoteHash) {
    Write-Host "📥 Cambios detectados en el remoto. Ejecutando pull --rebase..." -ForegroundColor Yellow
    git pull origin $branch --rebase
    if ($LASTEXITCODE -ne 0) {
        Write-Host "⚠️ Error al aplicar rebase. Revisa conflictos manualmente." -ForegroundColor Red
        exit
    }
    Write-Host "✅ Rebase completado correctamente." -ForegroundColor Green
} else {
    Write-Host "👌 No hay cambios remotos pendientes." -ForegroundColor Green
}

# --- Paso 5: Commit y push ---
git add .
$commitMsg = "update $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
git commit -m $commitMsg
git push origin $branch

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error al hacer push. Revisa conexión o credenciales." -ForegroundColor Red
    exit
}
Write-Host "✅ Cambios subidos correctamente a GitHub." -ForegroundColor Green

# --- Paso 6: Mostrar información final ---
$time = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "🌐 Despliegue completado con éxito" -ForegroundColor Green
Write-Host "🕒 Fecha: $time" -ForegroundColor Yellow

if ($remote -match "frankweist/BricoFrank") {
    Write-Host "🔗 URL: https://frankweist.github.io/BricoFrank/" -ForegroundColor Cyan
} elseif ($remote -match "frankweist/gestor-reparaciones") {
    Write-Host "🔗 URL: https://frankweist.github.io/gestor-reparaciones/" -ForegroundColor Cyan
} else {
    Write-Host "🔗 URL: (no detectada automáticamente)" -ForegroundColor Yellow
}
Write-Host "======================================" -ForegroundColor Cyan
