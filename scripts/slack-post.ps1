<#
  Post a message from Claude to the Bid Bot Slack channel (incoming webhook).
  The webhook URL is a secret: it lives only in the user env var BIDBOT_SLACK_WEBHOOK,
  never in this repo. Usage:
    powershell -NoProfile -File scripts/slack-post.ps1 -Text "Q1 (Avash #24): ..."
    powershell -NoProfile -File scripts/slack-post.ps1 -File <path-to-utf8-text>
#>
param(
  [string]$Text,
  [string]$File
)
$ErrorActionPreference = 'Stop'

$url = $env:BIDBOT_SLACK_WEBHOOK
if (-not $url) { $url = [Environment]::GetEnvironmentVariable('BIDBOT_SLACK_WEBHOOK', 'User') }
if (-not $url) { Write-Error 'BIDBOT_SLACK_WEBHOOK is not set (user env var). Ask the user for the webhook URL.'; exit 2 }

if ($File) { $Text = [IO.File]::ReadAllText((Resolve-Path $File), [Text.Encoding]::UTF8) }
if (-not $Text) { Write-Error 'Nothing to send: pass -Text or -File.'; exit 2 }

# Keep this file ASCII: Windows PowerShell 5.1 misreads BOM-less UTF-8. Em dash = [char]0x2014.
$body = @{ text = ":robot_face: *Claude* $([char]0x2014) $Text" } | ConvertTo-Json -Compress
$bytes = [Text.Encoding]::UTF8.GetBytes($body)
$resp = Invoke-WebRequest -Uri $url -Method Post -ContentType 'application/json; charset=utf-8' -Body $bytes -UseBasicParsing
if ($resp.StatusCode -eq 200) { 'sent' } else { Write-Error "Slack returned $($resp.StatusCode): $($resp.Content)"; exit 1 }
