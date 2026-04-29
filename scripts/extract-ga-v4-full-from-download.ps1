$htmlPath = 'c:\Users\HP\Downloads\GA_Dashboard_v4 (1).html'
$base = Split-Path $PSScriptRoot -Parent
$gd = Join-Path $base 'src\gaDashboardV4'
if (-not (Test-Path $gd)) { New-Item -ItemType Directory -Path $gd -Force | Out-Null }
$cssOut = Join-Path $gd 'gaDashboardV4Full.css'
$jsOut  = Join-Path $gd 'gaDashboardV4RawScript.js'
if (-not (Test-Path $htmlPath)) { throw "Not found: $htmlPath" }
$html = [IO.File]::ReadAllText($htmlPath)
$m = [regex]::Match($html, '<style>([\s\S]*?)</style>')
if (-not $m.Success) { throw 'no style' }
$hdr = @'
/* Extracted from GA_Dashboard_v4 (1).html — do not edit for design parity */

'@
[IO.File]::WriteAllText($cssOut, $hdr + $m.Groups[1].Value.Trim())
$scriptMatches = [regex]::Matches($html, '<script>([\s\S]*?)</script>')
$biggest = ''
foreach ($x in $scriptMatches) {
  $g = $x.Groups[1].Value
  if ($g.Length -gt $biggest.Length) { $biggest = $g }
}
if (-not $biggest -or $biggest.Length -lt 100) { throw 'no inline script body found' }
[IO.File]::WriteAllText($jsOut, $biggest.Trim())
Write-Host "Wrote" $cssOut
Write-Host "Wrote" $jsOut
