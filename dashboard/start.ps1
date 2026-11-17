<#
  Run Mission Control and restart it if it crashes. Logs: %LOCALAPPDATA%\bidbot-dashboard\server.log
  Usage: powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File C:\apply-control\dashboard\start.ps1
  ASCII only (Windows PowerShell 5.1).
#>
$ErrorActionPreference = 'Continue'
$dir = $PSScriptRoot
$data = Join-Path $env:LOCALAPPDATA 'bidbot-dashboard'
New-Item -ItemType Directory -Force $data | Out-Null
$log = Join-Path $data 'server.log'
$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { $node = 'C:\Program Files\nodejs\node.exe' }

# Already running? (port 8787 answers) -> exit quietly
try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 http://127.0.0.1:8787/api/me | Out-Null; exit 0 } catch {}

while ($true) {
  if ((Test-Path $log) -and (Get-Item $log).Length -gt 5MB) { Move-Item -Force $log "$log.1" }
  Add-Content -Path $log -Value ("[{0}] starting server" -f (Get-Date -Format s))
  & cmd.exe /c "`"$node`" `"$(Join-Path $dir 'server.js')`" >> `"$log`" 2>&1"
  Add-Content -Path $log -Value ("[{0}] server exited ({1}); restarting in 5 s" -f (Get-Date -Format s), $LASTEXITCODE)
  Start-Sleep -Seconds 5
}
