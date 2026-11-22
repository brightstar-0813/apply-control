<#
  Register the always-on watcher that clicks "Allow" on Chrome's "Allow remote debugging?"
  prompt (scripts\allow-remote-debugging.ps1 -Watch). It starts when this Windows user logs on
  and must run as the same user as Chrome. Run once:
    powershell -NoProfile -ExecutionPolicy Bypass -File C:\apply-control\scripts\install-allow-task.ps1
  Check:  Get-ScheduledTask BidBotAllowRemoteDebugging | Select-Object State
          Get-Content C:\apply-control\runs\.allow-remote-debugging.log -Tail 5
  Remove: Unregister-ScheduledTask -TaskName BidBotAllowRemoteDebugging -Confirm:$false
#>
$script = Join-Path $PSScriptRoot 'allow-remote-debugging.ps1'
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$script`" -Watch"
$trigger = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName 'BidBotAllowRemoteDebugging' -Action $action -Trigger $trigger -Settings $settings -Description 'Clicks Allow on Chrome''s "Allow remote debugging?" prompt for the Bid Bot control workspace' -Force | Out-Null
Start-ScheduledTask -TaskName 'BidBotAllowRemoteDebugging'
Start-Sleep -Seconds 3
Get-ScheduledTask -TaskName 'BidBotAllowRemoteDebugging' | Select-Object TaskName, State
