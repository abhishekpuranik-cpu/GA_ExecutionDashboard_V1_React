$src = 'C:\Users\HP\OneDrive\Projects\API\Cursor\GA_ExecutionDashboard_V1_React'
$dst = 'C:\Users\HP\OneDrive\Projects\API\Cursor\GA_Cashflow_V1_React'
if (Test-Path -LiteralPath $dst) {
  Remove-Item -LiteralPath $dst -Recurse -Force
}
$null = New-Item -ItemType Directory -Path $dst -Force
robocopy $src $dst /E /XD node_modules .git dist /NFL /NDL /NJH /NJS /nc /ns /np
$code = $LASTEXITCODE
if ($code -ge 8) { exit $code }
exit 0
