# Normaliza textos rotos "CategorÃ­a" -> "Categoría", etc. y asegura UTF-8
$ErrorActionPreference='Stop'
Set-Location 'C:\gestor-reparaciones\apps\web'

$files = Get-ChildItem -Recurse -File -Include *.tsx,*.ts,*.css,*.html

$map = [ordered]@{
  'TelÃ©fono'='Teléfono'
  'CategorÃ­a'='Categoría'
  'DaÃ±o'='Daño'
  'NÃºmero'='Número'
  'NÂº'='Nº'
  'AÃ±adir'='Añadir'
  'Ã“rdenes'='Órdenes'
  'ReparaciÃ³n'='Reparación'
  'MÃ³viles'='Móviles'
  'BaterÃ­as'='Baterías'
  'OpciÃ³n'='Opción'
  'CÃ³digo'='Código'
  'TelÃ©fono'='Teléfono'
  'SeÃ±al'='Señal'
  'Piezas Ã¢â‚¬Â¬'='Piezas'
  'Tarifa Ã¢â‚¬Â¬/h'='Tarifa €/h'
  '€'='€' # limpia restos
}

$replaced=0
foreach($f in $files){
  $txt = Get-Content $f.FullName -Raw -Encoding utf8
  $orig=$txt
  foreach($k in $map.Keys){ $txt = $txt -replace [regex]::Escape($k), $map[$k] }
  if($txt -ne $orig){
    $replaced++
    Set-Content $f.FullName $txt -Encoding utf8
  }
}

# Asegura charset en index.html
$idx = Join-Path (Get-Location) 'index.html'
if(Test-Path $idx){
  $html = Get-Content $idx -Raw -Encoding utf8
  if($html -notmatch '<meta\s+charset="UTF-8"'){
    $html = $html -replace '(<head[^>]*>)', '$1' + "`n    <meta charset=`"UTF-8`" />"
    Set-Content $idx $html -Encoding utf8
  }
}

Write-Host "Archivos corregidos: $replaced"
