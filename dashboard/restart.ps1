<#
  Restart Mission Control cleanly (task + restart loop + node). ASCII only.
  powershell -NoProfile -ExecutionPolicy Bypass -File C:\apply-control\dashboard\restart.ps1
#>
Stop-ScheduledTask -TaskName BidBotMissionControl -ErrorAction SilentlyContinue
Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" | Where-Object { $_.CommandLine -like '*dashboard\start.ps1*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like '*dashboard*server.js*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
Start-Sleep -Seconds 1
Start-ScheduledTask -TaskName BidBotMissionControl
for ($i = 0; $i -lt 15; $i++) {
  Start-Sleep -Seconds 1
  try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 http://127.0.0.1:8787/api/me | Out-Null; Write-Host 'Mission Control is up.'; exit 0 } catch {}
}
Write-Host 'Mission Control did not come up; see %LOCALAPPDATA%\bidbot-dashboard\server.log'
exit 1
