# RECOVER.ps1 — fija scripts, UTF-8, Tailwind v4, limpia caché y levanta dev
$ErrorActionPreference='Stop'
Set-Location 'C:\gestor-reparaciones\apps\web'

# 1) Scripts package.json correctos
$pkg = Get-Content package.json -Raw | ConvertFrom-Json
$pkg.scripts = @{
  dev     = "vite"
  build   = "vite build"
  preview = "vite preview"
  deploy  = "gh-pages -d dist -r https://github.com/frankweist/BricoFrank.git"
}
$pkg | ConvertTo-Json -Depth 100 | Set-Content package.json -Encoding utf8

# 2) PostCSS (Tailwind v4)
@'
import tailwindcss from '@tailwindcss/postcss'
import autoprefixer from 'autoprefixer'
export default { plugins: [tailwindcss(), autoprefixer()] }
'@ | Set-Content postcss.config.js -Encoding utf8

# 3) styles.css con @import v4 (sin tildes literales problemáticas)
@'
@import "tailwindcss";
.btn{ @apply inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-neutral-200/70 dark:border-neutral-800 active:scale-[.99]; }
.btn-primary{ @apply bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200; }
.btn-ghost{ @apply hover:bg-neutral-100 dark:hover:bg-neutral-900; }
.card{ @apply bg-white dark:bg-neutral-900 border border-neutral-200/70 dark:border-neutral-800 rounded-2xl shadow; }
.card-body{ @apply p-4 sm:p-6; }
.input{ @apply w-full rounded-lg border border-neutral-200/70 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-3 py-2 outline-none focus:ring-2 focus:ring-neutral-400/40; }
.tab{ @apply px-3 py-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-900; }
.tab-active{ @apply bg-neutral-100 dark:bg-neutral-900 font-medium; }
'@ | Set-Content src\styles.css -Encoding utf8

# 4) Regraba todo a UTF-8 (sin BOM)
$utf8 = New-Object System.Text.UTF8Encoding($false)
Get-ChildItem -Recurse -File -Include *.ts,*.tsx,*.css,*.html | ForEach-Object {
  $t = [System.IO.File]::ReadAllText($_.FullName)
  [System.IO.File]::WriteAllText($_.FullName, $t, $utf8)
}

# 5) Reemplazos seguros de textos en TSX (tildes, €) mediante escapes
$map = @{
  'Reparación'    = 'Reparaci\u00F3n'
  'Teléfono'      = 'Tel\u00E9fono'
  'Categoría'     = 'Categor\u00EDa'
  'Daño'          = 'Da\u00F1o'
  'Nº'            = 'N\u00BA'
  '€/h'           = '\u20AC/h'
  ' €'            = ' \u20AC'
}
Get-ChildItem -Recurse -File -Include *.tsx | ForEach-Object {
  $txt = Get-Content $_.FullName -Raw
  foreach($k in $map.Keys){ $txt = $txt -replace [regex]::Escape($k), $map[$k] }
  Set-Content $_.FullName $txt -Encoding utf8
}

# 6) Dependencias mínimas
npm i -D @tailwindcss/postcss autoprefixer
npm i dexie dexie-react-hooks uuid lucide-react

# 7) Limpia caché Vite y build
Remove-Item -Recurse -Force .\node_modules\.vite -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .\dist -ErrorAction SilentlyContinue

# 8) Arranca dev
npm run dev
