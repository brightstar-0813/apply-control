---
name: browser-connect
description: Attach Chrome DevTools MCP to the user's running Chrome, open and bind the Chrome profile the user named (Avash default, Lewis), find the BrightStar Bid Bot window and service worker, make sure that profile runs the current bot build, reload it after code changes, and recover from disconnects. Use at the start of every apply session, when the user says "use profile X", after editing bot code, or when chrome-devtools tools fail, time out, or show the wrong tabs.
---

# browser-connect

The MCP server (`.mcp.json`, global `chrome-devtools-mcp@1.13.0` started with `node`, flags
`--autoConnect --categoryExtensions`) attaches to the user's **already running** Chrome.

## Facts on this machine

- Chrome 157, remote debugging on (port 9222).
- Bot = unpacked `C:\brightstar-bid-bot`, extension id **`jkhoiaahamddiojkmhhpnnjnkdjiiigj`** (same in every profile).
- Installed in **Lewis (`Profile 1`)** and **Avash (`Profile 2`)** only. Re-check: `extensions.settings` in
  `%LOCALAPPDATA%\Google\Chrome\User Data\<dir>\Secure Preferences` for a path containing `brightstar`.
- Other extensions' service workers appear in `list_pages` — use the `sw-N` whose URL has the bot id.

## Connect

1. Each new MCP process makes Chrome ask **"Allow remote debugging?"** — clicked automatically by
   logon task `BidBotAllowRemoteDebugging` (`scripts\allow-remote-debugging.ps1 -Watch`, log
   `runs\.allow-remote-debugging.log`). Never ask the user. Normally just call `list_pages`.
2. Timeout "waiting for the browser connection" = watcher not working. Check, then retry (max two):
   `Get-ScheduledTask BidBotAllowRemoteDebugging` → not Running → `Start-ScheduledTask …`
   (missing → `scripts\install-allow-task.ps1`); log tail for `invoke-failed` / `error:`; one shot:
   `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\allow-remote-debugging.ps1 -TimeoutSec 60`
   in the background, then `list_pages`; `qwinsta` — no user session → ask the user (`Q<n>`) to log on.
3. After an MCP restart, page ids and `sw-N` change — `list_pages` again before any `click`/`fill`.

## Bind the profile (every session)

0. Only profiles **Enabled** in `profiles/index.md` (Avash default, Lewis). Anyone else → tell the user, stop.
1. Person → bot profile id (`profiles/index.md`) → `profiles/<id>.md`. Missing → create from
   `profiles/_template.md`, ask only for session settings.
2. Open the profile window if needed:
   `& "C:\Program Files\Google\Chrome\Application\chrome.exe" --profile-directory="Profile 2" "chrome-extension://jkhoiaahamddiojkmhhpnnjnkdjiiigj/popup.html?ctx=window"`
   (hands off to the running Chrome). Never `new_page` to open a profile window — it lands in the
   last-focused profile.
3. Bot page in `list_pages`: `…/popup.html?ctx=window` (or `?ctx=panel`). Several → check each with
   the step-4 script, match the person; still ambiguous → ask.
4. Verify the person (read-only, no snapshot needed):
   ```js
   () => ({ person: document.querySelector('#profileSelect')?.value,
            track: document.querySelector('#inlineRoleTrackSelect')?.value,
            hasBatchMode: Boolean(document.querySelector('#batchModeApply')) })
   ```
   `#profileSelect` is authoritative. Wrong person → pick the right one there. Custom "Save as
   mine" copies win over built-ins; add new ids to `profiles/index.md`. Never dump resumes /
   contact data into chat or files. Then run the **build probe** (below) — `hasBatchMode` only
   proves the popup files are new, not the service worker.
5. Log page id, `sw-N`, person id in the run log.
6. Work on tabs the bot opens itself (AI tab, apply tabs) — they're in the bound profile. Keep
   hand-work tabs in a **separate window** so the ChatGPT tab stays active in its own window.

Two profiles at once (parallel mode, on hold) → `apply-run/parallel.md`.

## Reload after bot code changes

- Each profile runs its own extension instance; popup/content files load from disk, but the
  **service worker keeps the old `background.js` until reloaded**. `reload_extension` (bot id) —
  verify per profile, never assume.
- **Build probe** (bot page, no state change): new code answers
  `chrome.runtime.sendMessage({ type: "mark_queue_job_applied" })` with `{ ok:false, error:"Missing CSV row." }`;
  an old worker never answers (3 s timeout). Still old → reload again or ask the user to click Reload on `chrome://extensions`.
- "Extension … not found" (CDP context is another profile) → reload from each enabled profile's bot page:
  `() => { if (document.querySelector('#profileSelect')?.value !== '<id>') return 'wrong'; setTimeout(() => chrome.runtime.reload(), 100); return 'ok'; }`
- Reload closes the bot window and restarts the SW (new `sw-N`); reopen with the step-2 command,
  re-bind. Storage/settings survive. Dead old `sw-N` rows time out; fresh ones:
  `() => new Date(performance.timeOrigin).toISOString()`.
- **Always reload the ChatGPT tab right after reloading the extension** (orphaned content script).
- Check `list_console_messages` (error/warn) on the new bot page.

## Service worker (read-only)

`evaluate_script` with `serviceWorkerId` (omit `pageId`). Never write storage or send
state-changing messages (CLAUDE.md rule 2). State reads → `bot-operate` script A.

## Recovery — symptom index (details in `recovery.md`, read only the matching row)

| Symptom | Quick fix |
|---------|-----------|
| Timeout waiting for browser connection | Watcher task — Connect §2 |
| "No snapshot found for page N" | MCP restarted / page reloaded → `take_snapshot` first |
| Stuck "blank ChatGPT chat ready — sending resume" after extension reload | Reload the ChatGPT tab |
| Generation stalls / "harvest too slow" / ChatGPT tab times out | ChatGPT tab not active in its window → `recovery.md` |
| ChatGPT hangs, then every CDP call times out | RDP disconnected (`qwinsta` / `runs\.session-state.json`) → `recovery.md`; ask user to reconnect, don't Stop the batch |
| `#retryErrors` at a pause | It also **starts** the batch |
| CDP "403" after Chrome restart / bot window or page gone | Reopen with the step-2 chrome.exe command, re-bind |
| SW not listed | Asleep — opening the bot page wakes it |
| Wrong person / wrong profile's tabs | Re-run bind; never guess |
| Extension tools missing | `--categoryExtensions` not active → restart the Claude Code session |
| Need an isolated Chrome | Dedicated-profile fallback → `recovery.md` |
