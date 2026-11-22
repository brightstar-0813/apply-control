<#
  Register the RDP session watcher (scripts\session-watch.ps1) to start when this Windows user
  logs on. Run once, as the same user as Chrome:

    Alerts only (what Claude installed, 2026-11-22):
      powershell -NoProfile -ExecutionPolicy Bypass -File C:\apply-control\scripts\install-session-watch.ps1

    With console fallback (USER decision only - runs elevated and lets the watcher move a
    disconnected session to the console with tscon; the session is then unlocked on the server /
    hypervisor console). Run from an elevated PowerShell, then create the opt-in file:
      powershell -NoProfile -ExecutionPolicy Bypass -File C:\apply-control\scripts\install-session-watch.ps1 -ConsoleFallback
      New-Item -ItemType File C:\apply-control\runs\.allow-console-fallback
    Turn the fallback off again: delete runs\.allow-console-fallback (or re-run without -ConsoleFallback).

  Check:  Get-ScheduledTask BidBotSessionWatch | Select-Object State
          Get-Content C:\apply-control\runs\.session-watch.log -Tail 10
          Get-Content C:\apply-control\runs\.session-state.json
  Remove: Unregister-ScheduledTask -TaskName BidBotSessionWatch -Confirm:$false
#>
param([switch]$ConsoleFallback)

$script = Join-Path $PSScriptRoot 'session-watch.ps1'
$argList = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$script`""
if ($ConsoleFallback) { $argList += ' -ConsoleFallback' }
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $argList
$trigger = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel $(if ($ConsoleFallback) { 'Highest' } else { 'Limited' })
Register-ScheduledTask -TaskName 'BidBotSessionWatch' -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description 'Logs RDP disconnects for the Bid Bot control workspace and alerts Mission Control (optional console fallback)' -Force | Out-Null
Start-ScheduledTask -TaskName 'BidBotSessionWatch'
Start-Sleep -Seconds 3
Get-ScheduledTask -TaskName 'BidBotSessionWatch' | Select-Object TaskName, State
