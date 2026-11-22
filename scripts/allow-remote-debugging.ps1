# Clicks "Allow" on Chrome's "Allow remote debugging?" prompt (user standing OK, 2026-11-21;
# "always, whenever it appears", 2026-11-22).
# Only ever presses a button named "Allow" inside a Chrome window whose same dialog also shows
# the "remote debugging" prompt text. Needs the user's desktop session (same user as Chrome).
#
#   One shot (start in the background, then make the chrome-devtools call):
#     powershell -File scripts\allow-remote-debugging.ps1 [-TimeoutSec 60]
#     Output: "clicked" (exit 0) or "not-found" (exit 1).
#   Always on (what the BidBotAllowRemoteDebugging logon task runs, see install-allow-task.ps1):
#     powershell -File scripts\allow-remote-debugging.ps1 -Watch
#     Runs until killed; one instance at a time; each click is logged to runs\.allow-remote-debugging.log
param(
    [int]$TimeoutSec = 60,
    [switch]$Watch,
    [int]$IntervalMs = 0
)

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

$auto = [System.Windows.Automation.AutomationElement]
$tree = [System.Windows.Automation.TreeScope]
$nameProp = $auto::NameProperty
$typeProp = $auto::ControlTypeProperty
$button = [System.Windows.Automation.ControlType]::Button
$trueCond = [System.Windows.Automation.Condition]::TrueCondition

$allowCond = New-Object System.Windows.Automation.AndCondition(
    (New-Object System.Windows.Automation.PropertyCondition($typeProp, $button)),
    (New-Object System.Windows.Automation.PropertyCondition($nameProp, 'Allow')))

function Find-AllowButton {
    $chromePids = @(Get-Process chrome -ErrorAction SilentlyContinue | ForEach-Object { $_.Id })
    if (-not $chromePids.Count) { return $null }
    $windows = $auto::RootElement.FindAll($tree::Children, $trueCond)
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
                    $texts = $node.FindAll($tree::Descendants, $trueCond)
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

function Invoke-AllowButton {
    $btn = Find-AllowButton
    if (-not $btn) { return $null }
    try {
        $btn.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke()
        return 'clicked'
    } catch {
        return "invoke-failed: $($_.Exception.Message)"
    }
}

if ($Watch) {
    if ($IntervalMs -le 0) { $IntervalMs = 1500 }
    $created = $false
    $mutex = New-Object System.Threading.Mutex($true, 'Local\BidBotAllowRemoteDebugging', [ref]$created)
    if (-not $created) { 'already running'; exit 0 }
    $log = Join-Path (Split-Path $PSScriptRoot -Parent) 'runs\.allow-remote-debugging.log'
    function Write-WatchLog([string]$text) {
        try { Add-Content -LiteralPath $log -Value ("{0}  {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $text) -Encoding utf8 } catch { }
    }
    Write-WatchLog "watch started (pid $PID)"
    $lastError = ''
    try {
        while ($true) {
            try {
                $result = Invoke-AllowButton
                if ($result) {
                    Write-WatchLog $result
                    if ($result -eq 'clicked') { Start-Sleep -Milliseconds 800 }
                }
            } catch {
                $msg = $_.Exception.Message
                if ($msg -ne $lastError) { Write-WatchLog "error: $msg"; $lastError = $msg }
            }
            Start-Sleep -Milliseconds $IntervalMs
        }
    } finally {
        $mutex.ReleaseMutex()
    }
}

if ($IntervalMs -le 0) { $IntervalMs = 700 }
$deadline = (Get-Date).AddSeconds($TimeoutSec)
while ((Get-Date) -lt $deadline) {
    $result = Invoke-AllowButton
    if ($result -eq 'clicked') { 'clicked'; exit 0 }
    if ($result) { $result }
    Start-Sleep -Milliseconds $IntervalMs
}
'not-found'
exit 1
