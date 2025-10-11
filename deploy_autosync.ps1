# Ejemplo de uso:
# powershell -ExecutionPolicy Bypass -File .\deploy_autosync.ps1 `
#   -SupabaseUrl "https://dzazapfzfuonyuvslhgk.supabase.co" `
#   -AnonKey "PEGA_AQUI_TU_ANON"

param(
  [Parameter(Mandatory=$true)][string]$SupabaseUrl,
  [Parameter(Mandatory=$true)][string]$AnonKey,
  [string]$CommitMsg = "chore: autosync + deploy"
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

function Info($m){ Write-Host "[i] $m" -ForegroundColor Cyan }
function Ok($m){ Write-Host "[ok] $m" -ForegroundColor Green }
function Fail($m){ Write-Error $m; exit 1 }

# 0) Comprobaciones básicas
if (-not (Test-Path ".git")) { Fail "No es un repo git: $PWD" }
git rev-parse --is-inside-work-tree *> $null

# 1) .env.local con VITE_* (y asegurar que no se sube)
Info "Escribiendo .env.local"
@"
VITE_SUPABASE_URL=$SupabaseUrl
VITE_SUPABASE_ANON_KEY=$AnonKey
"@ | Set-Content -Encoding UTF8 .\.env.local

if (-not (Select-String -Path ".gitignore" -Pattern "^\s*\.env\.local\s*$" -Quiet)) {
  Add-Content ".gitignore" ".env.local"
  Ok "Añadido .env.local a .gitignore"
}

# 2) Verificar que existe el autosync y el cliente de supabase
$auto = "src\sync\autosync.ts"
$sb   = "src\data\supabase.ts"
if (-not (Test-Path $auto)) { Fail "Falta $auto" }
if (-not (Test-Path $sb))   { Fail "Falta $sb" }

# 3) Asegurar import de autosync en main.tsx
$main = "src\main.tsx"
if (-not (Test-Path $main)) { Fail "Falta $main" }
$m = Get-Content -Raw -Encoding UTF8 $main
if ($m -notmatch "import\s+['""]\./sync/autosync['""]") {
  $m = $m -replace "(\s*import\s+['""]\.\/styles\.css['""]\s*;)", "`$1`r`nimport './sync/autosync'"
  $m | Set-Content -Encoding UTF8 $main
  Ok "Añadido import './sync/autosync' a main.tsx"
}

# 4) Base correcta en vite.config.ts
$vite = "vite.config.ts"
if (-not (Test-Path $vite)) { Fail "Falta $vite" }
$v = Get-Content -Raw -Encoding UTF8 $vite
if ($v -notmatch "base:\s*'\/BricoFrank\/'") {
  $v = $v -replace "base:\s*'.*?'", "base: '/BricoFrank/'"
  $v | Set-Content -Encoding UTF8 $vite
  Ok "Ajustada base en vite.config.ts a /BricoFrank/"
}

# 5) Instalar deps si faltan y compilar
if (-not (Test-Path "node_modules")) {
  Info "Instalando dependencias…"
  npm ci
}
Info "Compilando build…"
npm run build

# 6) Commit y push en main con cambios (si los hay)
git add -A
$pending = git diff --cached --name-only
if ($pending) {
  git commit -m $CommitMsg
  git push origin main
  Ok "Subidos cambios a main"
}else{
  Info "Sin cambios en main"
}

# 7) Desplegar a gh-pages con worktree ..\_pages
Info "Preparando worktree gh-pages…"
git fetch origin
git worktree prune
$wt = Join-Path $PSScriptRoot "..\_pages"
if (Test-Path $wt) { Remove-Item $wt -Recurse -Force }
git worktree add -B gh-pages $wt origin/gh-pages

# 8) Publicar artefactos
Get-ChildItem $wt -Force | Where-Object { $_.Name -ne '.git' } | Remove-Item -Recurse -Force
Copy-Item .\dist\* $wt -Recurse -Force
Copy-Item "$wt\index.html" "$wt\404.html" -Force
New-Item -ItemType File -Path "$wt\.nojekyll" -Force | Out-Null

# 9) Commit + push gh-pages
git -C $wt add -A
git -C $wt commit -m ("deploy: {0}" -f (Get-Date -Format 'yyyyMMddHHmmss')) 2>$null
git -C $wt push origin gh-pages
Ok "Desplegado a gh-pages"

# 10) Mostrar URL con cache-buster
$ts = Get-Date -Format "yyyyMMddHHmmss"
$URL = "https://frankweist.github.io/BricoFrank/?v=$ts"
Ok "Abre: $URL"
