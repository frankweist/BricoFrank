param([string]$m = "chore: update")
$ErrorActionPreference = "Stop" # Detiene el script ante cualquier error fatal
Set-Location -LiteralPath $PSScriptRoot

$root = git rev-parse --show-toplevel
$oldWorktreePath = Join-Path $root "gh-pages" # Carpeta antigua, si existiera
$wt = Join-Path $root "_pages" # Worktree de gh-pages

# --- 1. Sincronizar y subir la rama main ---
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

# --- 2. Asegurar el Worktree 'gh-pages' ---
Write-Host "--- 2. Configurando worktree 'gh-pages' ($wt)..." -ForegroundColor Green

# Limpiar worktrees obsoletos que ya no tienen carpeta
git worktree prune 2>$null

# Eliminar worktree antiguo si está usando el nombre obsoleto
if (Test-Path $oldWorktreePath) {
    Write-Host "Eliminando worktree con nombre antiguo: $oldWorktreePath" -ForegroundColor Cyan
    git worktree remove --force $oldWorktreePath 2>$null
    Remove-Item $oldWorktreePath -Recurse -Force
}

# Comprobar si el worktree actual es válido y existe
$isValidWorktree = $false

if (git worktree list -s | Select-String -Pattern "$wt" -SimpleMatch) {
    $isValidWorktree = $true
}

if ($isValidWorktree) {
    Write-Host "Worktree existente detectado. Actualizando rama 'gh-pages'." -ForegroundColor Cyan
    git -C $wt checkout gh-pages
    git -C $wt pull origin gh-pages
} else {
    # Si la carpeta existe pero no es un worktree válido, la borramos
    if (Test-Path $wt) { Remove-Item $wt -Recurse -Force }
    Write-Host "Creando nuevo worktree en $wt..." -ForegroundColor Cyan
    git worktree add $wt gh-pages

    # Validación adicional tras crear
    if (-not (Test-Path $wt) -or -not (git -C $wt rev-parse --is-inside-work-tree 2>$null)) {
        Write-Error "Error: La carpeta $wt no existe o no es un repositorio git válido."
        exit 1
    }
}

# --- 3. Construir la aplicación ---
Write-Host "--- 3. Instalando dependencias y construyendo la aplicación..." -ForegroundColor Green

if (-not (Test-Path "node_modules")) {
    Write-Host "Ejecutando npm ci..." -ForegroundColor Cyan
    npm ci
}
npm run build

# Validar que la compilación haya generado archivos
if (-not (Test-Path ".\dist")) {
    Write-Error "Error: La carpeta 'dist' no existe. ¿Falló 'npm run build'?"
    exit 1
}

# --- 4. Publicar en el worktree 'gh-pages' ---
Write-Host "--- 4. Copiando archivos a $wt..." -ForegroundColor Green

# Limpiar worktree sin borrar la carpeta .git
Get-ChildItem $wt -Force | Where-Object Name -ne '.git' | Remove-Item -Recurse -Force

# Copiar archivos generados
Copy-Item .\dist\* $wt -Recurse -Force

# Configuración específica de GitHub Pages
Copy-Item "$wt\index.html" "$wt\404.html" -Force # Copiar index.html a 404.html para rutas SPA
New-Item -ItemType File -Path "$wt\.nojekyll" -Force | Out-Null # Evita que Jekyll procese el contenido

# --- 5. Commit y Push de 'gh-pages' ---
Write-Host "--- 5. Commiteando y subiendo 'gh-pages'..." -ForegroundColor Green

git -C $wt add -A
$wtStatus = git -C $wt diff --cached --name-only

if ($wtStatus) {
    # Crea un commit con timestamp
    git -C $wt commit -m ("deploy: {0:yyyyMMddHHmmss}" -f (Get-Date))
    Write-Host "Commit creado en gh-pages." -ForegroundColor Yellow
} else {
    Write-Host "No hay cambios generados por la construcción. Saltando commit." -ForegroundColor Yellow
}

git -C $wt push origin gh-pages

# --- Finalizado ---
Write-Host ""
Write-Host "========================================================" -ForegroundColor Green
Write-Host "OK: La rama 'main' ha sido actualizada y el despliegue" -ForegroundColor Green
Write-Host "en 'gh-pages' ha finalizado con éxito." -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green