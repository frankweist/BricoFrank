# fix-utf.ps1 — normaliza a UTF-8 y sustituye tildes/€ por escapes Unicode
$ErrorActionPreference='Stop'
Set-Location 'C:\gestor-reparaciones\apps\web'

# 1) Normaliza a UTF-8 (sin BOM)
$utf8 = New-Object System.Text.UTF8Encoding($false)
Get-ChildItem -Recurse -File -Include *.ts,*.tsx,*.css,*.html | ForEach-Object{
  $t = [System.IO.File]::ReadAllText($_.FullName)
  [System.IO.File]::WriteAllText($_.FullName, $t, $utf8)
}

# 2) Reemplazos seguros (sin tildes literales en el script)
$map = @{
  'Reparaci\u00F3n'       = 'Reparaci\u00F3n'      # noop por si ya estaba bien
  'Reparaci\u00C3\u00B3n' = 'Reparaci\u00F3n'      # Reparación mojibake
  'Tel\u00E9fono'         = 'Tel\u00E9fono'
  'Tel\u00C3\u00A9fono'   = 'Tel\u00E9fono'
  'Categor\u00EDa'        = 'Categor\u00EDa'
  'Categor\u00C3\u00ADa'  = 'Categor\u00EDa'
  'Da\u00F1o'             = 'Da\u00F1o'
  'Da\u00C3\u00B1o'       = 'Da\u00F1o'
  'N\u00BA'               = 'N\u00BA'
  'N\u00C2\u00BA'         = 'N\u00BA'
  '\u20AC\/h'             = '\u20AC/h'             # por si ya estaba
  '\u00E2\u201A\u00AC\/h' = '\u20AC/h'             # €/h mojibake
  '\u20AC'               = '\u20AC'
  '\u00E2\u201A\u00AC'   = '\u20AC'               # € mojibake
}

$targets = Get-ChildItem -Recurse -File -Include *.ts,*.tsx,*.css,*.html
foreach($f in $targets){
  $txt = Get-Content $f.FullName -Raw
  foreach($k in $map.Keys){
    $from = $k
    $to   = $map[$k]
    $txt = $txt -replace $from, $to
  }
  Set-Content $f.FullName $txt -Encoding utf8
}

Write-Host 'OK: normalizado y reemplazado.'
