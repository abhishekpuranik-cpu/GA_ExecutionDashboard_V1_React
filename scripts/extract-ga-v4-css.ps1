$html = [IO.File]::ReadAllText('c:\Users\HP\Downloads\GA_Dashboard_v4.html')
$s = $html.IndexOf('<style>') + 7
$e = $html.IndexOf('</style>')
$css = $html.Substring($s, $e - $s)
$css = $css -replace '(?m)^\*,\*::before,\*::after\{[^}]+\}\r?\n?', ''
$css = $css -replace 'html,body\{[^}]+\}', '.ga-dash-v4{font-family:''DM Sans'',system-ui,sans-serif;background:var(--canvas);color:var(--t1);font-size:14px;line-height:1.5;-webkit-font-smoothing:antialiased}'
$hdr = @'
/* GA_Dashboard_v4.html — design tokens + components.
   Aggressive global * reset removed; portfolio shell uses .ga-dash-v4 for base type + canvas. */

'@
$out = Join-Path $PSScriptRoot '..\src\gaDashboardV4.css'
[IO.File]::WriteAllText($out, $hdr + $css)
Write-Host "Wrote" $out "length" ($hdr + $css).Length
