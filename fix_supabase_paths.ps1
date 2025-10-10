$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

# 1) Cliente único en src/data/supabase.ts
$new = @'
import { createClient } from "@supabase/supabase-js"

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
)
'@
$path = "src/data/supabase.ts"
$new | Set-Content $path -Encoding UTF8

# 2) Eliminar duplicado (si existe)
$dup = "src/sync/supabase.ts"
if (Test-Path $dup) { Remove-Item $dup -Force }

# 3) Reescribir imports a la ruta única
$patterns = @(
  @{ rx = 'from\s+["'']\.\/supabase["'']';                 rep = 'from "./data/supabase"' },
  @{ rx = 'from\s+["'']\.\.\/supabase["'']';               rep = 'from "../data/supabase"' },
  @{ rx = 'from\s+["'']\.\.\/\.\.\/supabase["'']';         rep = 'from "../../data/supabase"' },
  @{ rx = 'from\s+["'']\.\/sync\/supabase["'']';           rep = 'from "./data/supabase"' },
  @{ rx = 'from\s+["'']\.\.\/sync\/supabase["'']';         rep = 'from "../data/supabase"' },
  @{ rx = 'from\s+["'']\.\.\/\.\.\/sync\/supabase["'']';   rep = 'from "../../data/supabase"' }
)

Get-ChildItem -Recurse -File -Include *.ts,*.tsx -Path "src" | ForEach-Object {
  $t = Get-Content $_.FullName -Raw
  $orig = $t
  foreach ($p in $patterns) { $t = [regex]::Replace($t, $p.rx, $p.rep) }
  if ($t -ne $orig) { $t | Set-Content $_.FullName -Encoding UTF8 }
}

Write-Host "OK: cliente único en src/data/supabase.ts y rutas actualizadas."
Write-Host "Ahora: npm run build && npm run deploy (o tu update.ps1)"
