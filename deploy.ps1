# Uso desde la raíz del repo: .\deploy.ps1
Get-Content .env | Where-Object { $_ -match '^\s*[^#\s].*=' } | ForEach-Object {
  $k,$v = $_ -split '=',2; Set-Item -Path "Env:$($k.Trim())" -Value $v.Trim()
}
$big = Get-ChildItem web -Recurse -File | Where-Object { $_.Length -gt 24MB }
if ($big) { $big | ForEach-Object { Write-Host "Mayor a 25 MiB: $($_.FullName)" -ForegroundColor Red }; exit 1 }
npx wrangler deploy
