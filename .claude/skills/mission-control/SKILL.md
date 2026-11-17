---
name: mission-control
description: The user's web dashboard for watching and steering Claude during Bid Bot sessions (Mission Control, http://localhost:8787, remote via Tailscale Funnel) — post status, ask Q<n> questions, wait for the user's dashboard messages, and obey Pause / Stop / approval gates. Use at session start, at every apply-run poll, whenever you need a user answer, when a tool call is denied "from the Mission Control dashboard", when a message starts with "[Mission Control]", or when the user mentions the dashboard.
---

# mission-control

The user's primary channel (user decision 2026-11-17). Slack stays as a mirror and fallback
(`slack-chat`). Code: `dashboard/` (see `dashboard/README.md`).

## What happens automatically (hooks in `.claude/settings.json`)

- Every tool call, your messages (from the transcript) and your latest screenshot appear in the
  dashboard. Values for password/OTP/token fields and webhooks are redacted, but still never
  put secrets in tool inputs or messages.
- **User messages reach you as `[Mission Control] …` context** after your next tool call, or keep
  you working when you try to stop. Treat them exactly like terminal messages (CLAUDE.md, `slack-chat`
  "Act on replies": "Q3 Yes", "skip #24", "cap 10", "stop", …).
- **Pause**: your next tool call is held until the user resumes. Don't work around it.
- **Stop**: tools are denied with "STOP pressed …" → end your turn right away with a short status
  and a `Q<n>` question. Don't retry.
- **Approval gates** (Settings → gates, default: `git push`): the call waits for Approve / Deny.
  Denied → don't retry the same action; ask what to do instead.
- Your final message's `Q<n>: …` (with `Reply "Q<n> option"` options) becomes a card with
  one-tap answers.
- **Headless runs** (phase 4): when the user writes while you're idle, the dashboard resumes the
  last session with `claude -p --resume` and the messages as the prompt. Nobody is at the
  terminal then: ask questions in the final message, never wait for terminal input.

## Bot controls in the dashboard (Bots tab, 2026-11-17)

The bot window in each enabled profile runs `dashboard-bridge.js` (bot repo). From the dashboard the user
can Load from sheet, Start/Pause/Skip/Stop, set filter, Batch mode, auto submit and autofill, switch
person (Avash/Lewis only), and press row Apply / Mark applied / Remove. The bridge clicks the bot's own
controls; nothing else changes. These clicks show in the feed as `You → <person>: …` and count as the
user's decisions (rule 3/4): don't undo them, and re-read bot state before your next bot action.
The bridge needs the bot window open (`popup.html?ctx=window`); closing it takes that bot offline.

## What you do

```
node dashboard/cli.js status "Avash · Dice · #24 Acme (Greenhouse) - filling custom questions"
node dashboard/cli.js say "Q3 (Avash #24): hybrid in Austin? Options: Yes / No. Reply \"Q3 Yes\"."
node dashboard/cli.js wait --timeout 600     # blocks until the user sends a dashboard message
node dashboard/cli.js state                  # paused? open questions? pending approvals?
```

These `cli.js` calls always pass the hook, even while paused.

- **Status**: at session start, at each new row, and on every blocker. One line: person · source ·
  row/company/site · what you're doing. This is what the user sees first on the phone.
- **Questions**: use `say` with a `Q<n>` mid-run (the card appears at once); `slack-chat` still
  applies for numbering and wording. Don't also post the same question to Slack by hand. The Stop
  hook mirrors your final message there while `runs/.slack-live` exists.
- **Waiting for an answer**: run `cli.js wait` (Bash/PowerShell, `run_in_background` or a Monitor)
  instead of polling the Slack tab every 60 s. Keep working on rows that don't depend on the answer.
  Check the Slack tab only as a fallback (e.g. dashboard down: `cli.js` prints "not reachable").
- **Screenshots**: take one when the page state matters for a question ("which option fits?"), so
  the user sees what you see.

## If the dashboard is down

Hooks fail open, so you work as before. `cli.js` says "not reachable" → start it with
`powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File dashboard/start.ps1`
(or `Start-ScheduledTask BidBotMissionControl`), and fall back to `slack-chat` meanwhile.
Never change the password, gates or runner settings yourself; those are the user's.
