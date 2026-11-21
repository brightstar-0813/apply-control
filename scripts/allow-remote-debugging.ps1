# Clicks "Allow" on Chrome's "Allow remote debugging?" prompt (user standing OK, 2026-11-21).
# Start it in the background, then make the chrome-devtools call that triggers the prompt.
# Only ever presses a button named "Allow" inside a Chrome window that also shows the
# "remote debugging" prompt text. Needs an attached desktop session (RDP connected / console).
#
#   powershell -File scripts\allow-remote-debugging.ps1 [-TimeoutSec 60]
# Output: "clicked" (exit 0) or "not-found" (exit 1).
param([int]$TimeoutSec = 60)

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

$auto = [System.Windows.Automation.AutomationElement]
$tree = [System.Windows.Automation.TreeScope]
$nameProp = $auto::NameProperty
$typeProp = $auto::ControlTypeProperty
$button = [System.Windows.Automation.ControlType]::Button

$allowCond = New-Object System.Windows.Automation.AndCondition(
    (New-Object System.Windows.Automation.PropertyCondition($typeProp, $button)),
    (New-Object System.Windows.Automation.PropertyCondition($nameProp, 'Allow')))

function Find-AllowButton {
    $chromePids = @(Get-Process chrome -ErrorAction SilentlyContinue | ForEach-Object { $_.Id })
    if (-not $chromePids.Count) { return $null }
    $windows = $auto::RootElement.FindAll($tree::Children, [System.Windows.Automation.Condition]::TrueCondition)
    foreach ($win in $windows) {
        try {
            if ($chromePids -notcontains $win.Current.ProcessId) { continue }
            $buttons = $win.FindAll($tree::Descendants, $allowCond)
            foreach ($btn in $buttons) {
                # Walk up from the button; the prompt text must be in the same dialog.
                $walker = [System.Windows.Automation.TreeWalker]::ControlViewWalker
                $node = $btn
                for ($i = 0; $i -lt 6 -and $node; $i++) {
                    $node = $walker.GetParent($node)
                    if (-not $node) { break }
                    $texts = $node.FindAll($tree::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
                    if ($texts.Count -gt 60) { break }   # left the dialog, into the whole window
                    $hit = $false
                    foreach ($t in $texts) { if ($t.Current.Name -match 'remote debugging') { $hit = $true; break } }
                    if (-not $hit -and $node.Current.Name -match 'remote debugging') { $hit = $true }
                    if ($hit) { return $btn }
                }
            }
        } catch { }
    }
    return $null
}

$deadline = (Get-Date).AddSeconds($TimeoutSec)
while ((Get-Date) -lt $deadline) {
    $btn = Find-AllowButton
    if ($btn) {
        try {
            $btn.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke()
            'clicked'
            exit 0
        } catch {
            "invoke-failed: $($_.Exception.Message)"
        }
    }
    Start-Sleep -Milliseconds 700
}
'not-found'
exit 1
