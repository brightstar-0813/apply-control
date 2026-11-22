<#
  RDP session watcher for Bid Bot runs (2026-11-22).

  Why: when the RDP client disconnects, the Windows session keeps running but nothing is drawn,
  Chrome throttles its windows, and ChatGPT generation in the bot stalls (row 96 on 11-21 sat
  ~1 h on "sending cover letter prompt"). The batch itself survives — queue rows keep their
  status and the row resumes once the session is drawn again — so the goal is to notice fast,
  tell the user, and optionally keep the session drawn.

  What it does (one instance per session, scan every -IntervalSec):
    - reads this session's state (Active / Disc / Conn) from `query session`;
    - logs every change to runs\.session-watch.log and the current state to runs\.session-state.json
      (Claude / the dashboard can read it instead of running qwinsta);
    - on disconnect / reconnect posts a dashboard status line + inbox note (dashboard\cli.js);
    - OPTIONAL console fallback: with -ConsoleFallback AND the opt-in file
      runs\.allow-console-fallback present, after -FallbackDelaySec of continuous disconnect it
      runs `tscon <this session> /dest:console` (a documented Windows command) so the session is
      drawn on the machine's console instead of nowhere. Requires the task to run elevated
      (install-session-watch.ps1 -ConsoleFallback does that). Security trade-off: the session is
      then unlocked on the server / hypervisor console until the next RDP logon takes it back.
      Only the user turns this on; Claude never creates the opt-in file.

  Run:   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\session-watch.ps1 [-Once]
  Task:  scripts\install-session-watch.ps1 [-ConsoleFallback]
#>
param(
    [int]$IntervalSec = 15,
    [switch]$Once,
    [switch]$ConsoleFallback,
    [int]$FallbackDelaySec = 60,
    [switch]$NoDashboard
)

$root = Split-Path $PSScriptRoot -Parent
$runs = Join-Path $root 'runs'
$log = Join-Path $runs '.session-watch.log'
$stateFile = Join-Path $runs '.session-state.json'
$optIn = Join-Path $runs '.allow-console-fallback'
$cli = Join-Path $root 'dashboard\cli.js'
$sessionId = (Get-Process -Id $PID).SessionId

function Write-WatchLog([string]$text) {
    try { Add-Content -LiteralPath $log -Value ("{0}  {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $text) -Encoding utf8 } catch { }
}

function Get-SessionState {
    # `query session <id>` prints one line for that session: name, user, id, state, ...
    $out = & query session $sessionId 2>$null
    foreach ($line in @($out)) {
        if ($line -match "\s$sessionId\s+(Active|Disc|Conn|Listen|Down|Idle)\b") { return $Matches[1] }
    }
    return 'Unknown'
}

function Send-Dashboard([string]$kind, [string]$text) {
    if ($NoDashboard) { return }
    try { & node $cli $kind $text 2>$null | Out-Null } catch { }
}

function Save-State([string]$state, [datetime]$since, [string]$note) {
    $obj = [ordered]@{
        sessionId = $sessionId
        state     = $state
        since     = $since.ToString('o')
        checkedAt = (Get-Date).ToString('o')
        consoleFallback = [bool]($ConsoleFallback -and (Test-Path -LiteralPath $optIn))
        note      = $note
    }
    try { ($obj | ConvertTo-Json -Compress) | Set-Content -LiteralPath $stateFile -Encoding utf8 } catch { }
}

if ($Once) {
    $s = Get-SessionState
    Save-State $s (Get-Date) 'one-shot check'
    "session $sessionId : $s"
    exit 0
}

$created = $false
$mutex = New-Object System.Threading.Mutex($true, "Local\BidBotSessionWatch", [ref]$created)
if (-not $created) { 'already running'; exit 0 }

$last = Get-SessionState
$since = Get-Date
$fallbackTried = $false
Write-WatchLog "watch started (pid $PID, session $sessionId, state $last, consoleFallback=$([bool]$ConsoleFallback))"
Save-State $last $since 'watch started'
if ($last -eq 'Disc') {
    Send-Dashboard 'status' "RDP session is disconnected (watch started) - ChatGPT generation stalls until it is drawn again"
}

try {
    while ($true) {
        Start-Sleep -Seconds $IntervalSec
        $now = Get-SessionState
        if ($now -ne $last) {
            $dur = [int]((Get-Date) - $since).TotalSeconds
            Write-WatchLog "state $last -> $now (after ${dur}s)"
            if ($now -eq 'Disc') {
                Send-Dashboard 'status' "RDP session disconnected - ChatGPT generation will stall until it is drawn again"
                Send-Dashboard 'say' ("RDP session {0} disconnected at {1}. The bot keeps its queue; generation stalls until you reconnect RDP{2}." -f $sessionId, (Get-Date -Format 'HH:mm'), $(if ($ConsoleFallback -and (Test-Path -LiteralPath $optIn)) { ' (console fallback will move it to the console in ' + $FallbackDelaySec + ' s)' } else { '' }))
            } elseif ($last -eq 'Disc') {
                Send-Dashboard 'status' "RDP session back ($now) after ${dur}s - bot generation resumes"
            }
            $last = $now
            $since = Get-Date
            $fallbackTried = $false
            Save-State $now $since 'state change'
        } else {
            Save-State $now $since ''
        }

        if ($now -eq 'Disc' -and $ConsoleFallback -and -not $fallbackTried -and (Test-Path -LiteralPath $optIn)) {
            if (((Get-Date) - $since).TotalSeconds -ge $FallbackDelaySec) {
                $fallbackTried = $true
                $res = & tscon $sessionId /dest:console 2>&1
                $code = $LASTEXITCODE
                Write-WatchLog ("console fallback: tscon $sessionId /dest:console -> exit {0} {1}" -f $code, ($res | Out-String).Trim())
                if ($code -eq 0) {
                    Send-Dashboard 'status' "RDP session moved to the console (tscon) - bot keeps running"
                } else {
                    Send-Dashboard 'say' "Console fallback failed (tscon exit $code). Reconnect RDP to unblock generation."
                }
            }
        }
    }
} finally {
    $mutex.ReleaseMutex()
}
