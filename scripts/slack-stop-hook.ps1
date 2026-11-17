<#
  Claude Code Stop hook: when a Slack-live session is on (flag file runs/.slack-live exists),
  post Claude's last message (which ends in a specific Q<n> question) to the Bid Bot Slack
  channel, so the user can answer there. No flag -> do nothing.
  ASCII only (Windows PowerShell 5.1).
#>
$ErrorActionPreference = 'SilentlyContinue'
$root = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $root 'runs\.slack-live'))) { exit 0 }
# Mission Control up -> it sends a short "Claude needs you" ping with the dashboard link instead
# (user 2026-11-17: Slack only for things that need the user). This full post is the fallback.
try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 -Uri 'http://127.0.0.1:8787/api/me' | Out-Null; exit 0 } catch {}

# Hook input is UTF-8 JSON; the console default (OEM codepage) garbled en dashes in Slack.
$raw = (New-Object IO.StreamReader([Console]::OpenStandardInput(), (New-Object Text.UTF8Encoding($false)))).ReadToEnd()
$in = $null
try { $in = $raw | ConvertFrom-Json } catch {}

$msg = $null
if ($in -and $in.last_assistant_message) { $msg = [string]$in.last_assistant_message }
if (-not $msg -and $in -and $in.transcript_path -and (Test-Path $in.transcript_path)) {
  $lines = Get-Content -LiteralPath $in.transcript_path -Encoding UTF8 -Tail 200
  for ($i = $lines.Count - 1; $i -ge 0 -and -not $msg; $i--) {
    try { $o = $lines[$i] | ConvertFrom-Json } catch { continue }
    if ($o.type -ne 'assistant' -or -not $o.message) { continue }
    $texts = @($o.message.content | Where-Object { $_.type -eq 'text' } | ForEach-Object { $_.text })
    if ($texts.Count) { $msg = ($texts -join "`n") }
  }
}
if (-not $msg) { $msg = '(no final message found)' }

# Slack-friendly: keep the end (the question lives there), cap length.
$max = 2500
if ($msg.Length -gt $max) { $msg = '...' + $msg.Substring($msg.Length - $max) }

$text = ":octagonal_sign: *Stopped, waiting for you.*`n$msg"
$tmp = [IO.Path]::GetTempFileName()
[IO.File]::WriteAllText($tmp, $text, (New-Object Text.UTF8Encoding($false)))
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'slack-post.ps1') -File $tmp | Write-Host
Remove-Item $tmp -Force
exit 0
