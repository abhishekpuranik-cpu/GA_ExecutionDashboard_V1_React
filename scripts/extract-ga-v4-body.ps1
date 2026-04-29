$htmlPath = 'c:\Users\HP\Downloads\GA_Dashboard_v4 (1).html'
$base = Split-Path $PSScriptRoot -Parent
$gd = Join-Path $base 'src\gaDashboardV4'
$out = Join-Path $gd 'GADashboardV4Body.html'
if (-not (Test-Path $htmlPath)) { throw "Not found: $htmlPath" }
$html = [IO.File]::ReadAllText($htmlPath)
$start = $html.IndexOf('<body>')
$end = $html.IndexOf('<script>')
if ($start -lt 0 -or $end -lt 0) { throw 'body/script markers' }
$body = $html.Substring($start + 6, $end - $start - 6).Trim()
[IO.File]::WriteAllText($out, $body)
Write-Host "Wrote" $out "len" $body.Length
