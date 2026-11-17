<#
  Register Mission Control to start automatically when this Windows user logs on
  (it must run as the same user as Chrome / Claude Code). Run once:
    powershell -NoProfile -ExecutionPolicy Bypass -File C:\apply-control\dashboard\install-task.ps1
  Remove: Unregister-ScheduledTask -TaskName BidBotMissionControl -Confirm:$false
#>
$start = Join-Path $PSScriptRoot 'start.ps1'
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$start`""
$trigger = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName 'BidBotMissionControl' -Action $action -Trigger $trigger -Settings $settings -Description 'BrightStar Bid Bot Mission Control dashboard (localhost:8787)' -Force | Out-Null
Start-ScheduledTask -TaskName 'BidBotMissionControl'
Write-Host 'Registered and started task BidBotMissionControl.'
