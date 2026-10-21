param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $taskRoot
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js 22.12 or newer is required.' }
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Start Docker Desktop first.' }
if (-not (Test-Path -LiteralPath (Join-Path $taskRoot 'node_modules/tsx'))) {
  & npm.cmd install --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
}
& npm.cmd run db:up
if ($LASTEXITCODE -ne 0) { throw 'Database did not start. Check Docker Desktop and port 33371.' }
if (-not (Test-Path -LiteralPath (Join-Path $taskRoot 'frontend/dist/index.html'))) {
  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) { throw 'Build failed.' }
}
$taskHealth = $null
try { $taskHealth = Invoke-RestMethod 'http://127.0.0.1:5271/api/workbench/health' -TimeoutSec 3 } catch {}
if ($taskHealth -and $taskHealth.service -ne 'jingneng-quote-workbench') { throw 'Port 5271 is used by a different application.' }
if (-not $taskHealth) {
  if (Get-NetTCPConnection -LocalPort 5271 -State Listen -ErrorAction SilentlyContinue) { throw 'Port 5271 is occupied. No process was stopped.' }
  $taskProcess = Start-Process -FilePath (Get-Command node).Source -ArgumentList @('--import','tsx','backend/src/server.ts') -WorkingDirectory $taskRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $taskRoot '.local/workbench/server.log') -RedirectStandardError (Join-Path $taskRoot '.local/workbench/server-error.log') -PassThru
  Set-Content -LiteralPath (Join-Path $taskRoot '.local/workbench/server.pid') -Value $taskProcess.Id -Encoding ascii
  for ($taskAttempt = 0; $taskAttempt -lt 30; $taskAttempt++) {
    Start-Sleep -Milliseconds 500
    try { $taskHealth = Invoke-RestMethod 'http://127.0.0.1:5271/api/workbench/health' -TimeoutSec 2; break } catch {}
  }
  if (-not $taskHealth) { throw 'Server did not start. Check .local/workbench/server-error.log.' }
}
Write-Output 'Ready: http://127.0.0.1:5271/quotes'
if (-not $NoBrowser) { Start-Process 'http://127.0.0.1:5271/quotes' }
