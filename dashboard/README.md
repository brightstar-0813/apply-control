# Mission Control

Web dashboard and remote control for the Claude agent that runs BrightStar Bid Bot sessions.
Open it from any browser (phone, laptop) with a password. Free: Node built-ins only, no npm
packages, Tailscale Funnel for HTTPS access, and headless runs use this PC's Claude Code login.

## What it does

| Tab | |
|---|---|
| **Live** | Agent state (working / waiting / paused / idle), its status line, the latest screenshot it took, every action as it happens, and Start/wake buttons for a headless run (`/bid avash dice`, …) |
| **Bots** | A card for each open bot window (Avash, Lewis): counters, status, queue (rows you can act on first, 50 shown), and the bot's controls: Load from sheet, Start/Pause/Skip/Stop, source filter (never LinkedIn), Batch mode, auto submit, autofill, person, and row Apply / Mark applied / Remove. They run through `dashboard-bridge.js` in the bot window, which clicks the bot's own buttons. The bridge only accepts requests made locally on the server, never through the public link |
| **Inbox** | The agent's `Q<n>` questions as cards with one-tap answers, plus a chat. Messages reach the agent after its next action, or wake it if it's idle |
| **Approve** | Actions held by an approval gate (default: `git push`). Approve or Deny |
| **Runs** | `runs/*.md` session logs |
| **Settings** | Gates, headless runner, alerts on this device, password |
| Header | **Pause** (hold the agent's next action) · **Stop** (agent ends its turn; a headless run is killed) |

## How it works

```
browser ──HTTPS──► Tailscale Funnel ──► 127.0.0.1:8787  server.js (SQLite in %LOCALAPPDATA%\bidbot-dashboard)
                                              ▲   │
       Claude Code hooks (hook.js) ───────────┘   └── messages / pause / approvals back into the agent
       transcript tail (read-only) → agent text + latest screenshot
       runner (claude -p --resume) → headless runs when the agent is idle
```

- `hook.js` handles every hook event in `.claude/settings.json`. If the server is down it does
  nothing (fails open), so the agent works as before.
- The dashboard never drives Chrome or the bot. It only talks to the agent (CLAUDE.md rules 1 and 2).
- Secrets: the password is stored as a scrypt hash, and the hook token and data live in
  `%LOCALAPPDATA%\bidbot-dashboard`, outside the repo. Password/OTP/token values and webhooks
  are redacted before they're stored.

## Setup (once)

1. **Server**: `powershell -NoProfile -ExecutionPolicy Bypass -File dashboard\install-task.ps1`
   (starts it now and at every logon of this Windows user).
2. **Password**: on this server, run `node dashboard/cli.js setup-code`, open http://localhost:8787,
   enter the code and choose a password (10+ characters). Remote setup is refused.
3. **Remote access (free)**: Tailscale is installed. Sign in once (`tailscale up`, open the link),
   then `"C:\Program Files\Tailscale\tailscale.exe" funnel --bg 8787`. The first time, the command
   prints a link to enable Funnel for your tailnet: open it and click Enable.
   The URL is `https://bidbot.<tailnet>.ts.net`. Nothing needs installing on the phone or laptop:
   open the URL and sign in with the password.
4. **Phone**: add the page to the Home Screen (iPhone: Share → Add to Home Screen; Android: menu →
   Install app), then Settings → *Enable alerts on this device*.

## Operate

- Logs: `%LOCALAPPDATA%\bidbot-dashboard\server.log`
- Restart: `powershell -NoProfile -ExecutionPolicy Bypass -File dashboard\restart.ps1`
- Forgot password: delete `passwordHash` from `%LOCALAPPDATA%\bidbot-dashboard\config.json`,
  restart, then do setup step 2 again.
- Stop public access: `tailscale funnel --bg off`
- Tests: `cd dashboard && npm test`
- Agent-side usage: `.claude/skills/mission-control/SKILL.md`

## Security notes

- Funnel makes the URL reachable from the internet; only the password protects it. Pick a long
  one. Throttling: 5 failed logins per IP → 15 min lock; 30 failed/hour overall → 15 min lock for
  everyone. Every login (and failed attempt) appears in the activity feed.
- Cookies are HttpOnly, SameSite=Strict and Secure over HTTPS, and last 30 days. Changing the
  password signs out every device.
- Headless runs use `--permission-mode auto` (Settings → runner). The gates and Pause/Stop apply
  to them the same way.
