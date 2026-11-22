---
name: browser-connect
description: Attach Chrome DevTools MCP to the user's running Chrome, open and bind the Chrome profile the user named (Avash default, Lewis), find the BrightStar Bid Bot window and service worker, make sure that profile runs the current bot build, reload it after code changes, and recover from disconnects. Use at the start of every apply session, when the user says "use profile X", after editing bot code, or when chrome-devtools tools fail, time out, or show the wrong tabs.
---

# browser-connect

The MCP server runs with `--autoConnect --categoryExtensions` (`.mcp.json`, pinned
`chrome-devtools-mcp@1.13.0`). It attaches to the user's **already running** stable Chrome.
Since 2026-11-18 `.mcp.json` starts it with `node` from a **global install**
(`npm i -g chrome-devtools-mcp@1.13.0`, ~3 s), not `npx` (npx resolution hit Claude Code's 30 s
MCP connect timeout in dashboard runs → "chrome-devtools CONNECT_TIMEOUT", no browser tools).
Every **new** MCP process (each headless dashboard run) triggers Chrome's "Allow remote
debugging?" prompt again; it is **clicked automatically** by the always-on watcher task
`BidBotAllowRemoteDebugging` (user, 2026-11-22: "always click it whenever it appears") — see Connect.

## Facts on this machine

- Chrome 157. Remote debugging enabled (`chrome://inspect/#remote-debugging`); port 9222.
- Bot = unpacked `C:\brightstar-bid-bot`, extension id **`jkhoiaahamddiojkmhhpnnjnkdjiiigj`**
  (id comes from the folder path, so it's the same in every profile).
- Installed in **Lewis (`Profile 1`)** and **Avash (`Profile 2`)**; not in Carlos (`Default`) or
  Tools (`Profile 3`). Re-check: read `extensions.settings` in
  `%LOCALAPPDATA%\Google\Chrome\User Data\<dir>\Secure Preferences` for a path containing `brightstar`.
- Other extensions' service workers also appear in `list_pages` — use the `sw-N` whose URL has the bot id.

## Connect

1. On a new connection Chrome shows **"Allow remote debugging?"**. It is clicked without anyone
   asking (user, 2026-11-21 / 11-22: "always click Allow whenever it appears" — never a `Q<n>`):
   - **Always-on watcher**: logon task `BidBotAllowRemoteDebugging` runs
     `scripts\allow-remote-debugging.ps1 -Watch` in the user's session (scan every 1.5 s, one
     instance, clicks logged to `runs\.allow-remote-debugging.log`). Installed with
     `scripts\install-allow-task.ps1`. Tested 2026-11-22: a brand-new MCP process got
     `list_pages` back in 4.6 s. So normally just call `list_pages`.
   - The script (UI Automation) presses only a button named "Allow" in a Chrome dialog whose
     text contains "remote debugging". It covers this prompt only, no other Chrome dialog.
2. Timeout "waiting for the browser connection" = dialog pending, i.e. the watcher is not doing
   its job. Check, in this order, then retry (max two):
   - task running? `Get-ScheduledTask BidBotAllowRemoteDebugging` → not Running →
     `Start-ScheduledTask BidBotAllowRemoteDebugging` (missing → run `install-allow-task.ps1`);
   - log tail (`runs\.allow-remote-debugging.log`): `invoke-failed` / `error:` lines;
   - one shot by hand: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\allow-remote-debugging.ps1 -TimeoutSec 60`
     in the background, then `list_pages` (prints `clicked` / `not-found`);
   - `qwinsta`: the watcher lives in the user's logon session; no session (logged off / rebooted
     without logon) → nothing can click → ask the user (`Q<n>`) to log on.
3. After the MCP server restarts, page ids and `sw-N` change and the old snapshot is gone —
   `list_pages` + `take_snapshot` again before any `click`/`fill`.

## Bind the profile (every session)

0. Only profiles marked **Enabled** in `profiles/index.md` (Avash = default, Lewis). No person
   named → Avash. Anyone else → tell the user and stop. Never read pages from other profiles.
1. Person → bot profile id (`profiles/index.md`) → `profiles/<id>.md` session settings. Missing
   → create from `profiles/_template.md`, ask the user only for session settings.
2. Open the profile window if needed (dir from `profiles/index.md`):
   ```powershell
   & "C:\Program Files\Google\Chrome\Application\chrome.exe" --profile-directory="Profile 2"
   ```
   It hands off to the running Chrome (same debug connection). Prefer having only the target
   profile's windows open — CDP sees every open profile and `new_page` lands in the last-focused one.
3. Find the bot page in `list_pages`: `chrome-extension://jkhoiaahamddiojkmhhpnnjnkdjiiigj/popup.html?ctx=window`
   (or `?ctx=panel` = side panel). None → `new_page` that `?ctx=window` URL (then verify the
   person, step 4). Several → snapshot each, match the person; still ambiguous → ask.
4. Verify the person on the bot page (read-only):
   ```js
   () => ({ person: document.querySelector('#profileSelect')?.value,
            track: document.querySelector('#inlineRoleTrackSelect')?.value,
            hasBatchMode: Boolean(document.querySelector('#batchModeApply')) })
   ```
   - `#profileSelect` is authoritative (`active_person_id` in storage stays unset until the
     person is changed once). Wrong person → pick the right one in `#profileSelect`.
   - Custom "Save as mine" copies (`custom_profiles` in SW storage) win over built-ins; add new
     ids to `profiles/index.md`. Never dump resumes / contact data into chat or files.
   - Run the **build probe** (Reload section). `hasBatchMode` only proves the popup files are new
     (they load from disk), not the service worker. Old worker → **Reload**.
5. Log page id, `sw-N`, person id in the run log.
6. Work on tabs the bot opens itself (AI tab, apply tabs) — they're in the bound profile.

### Two profiles bound at once (parallel mode, apply-run §3c)

- Open both bot windows with `chrome.exe --profile-directory="Profile N" "chrome-extension://…/popup.html?ctx=window"`
  (never `new_page`: it lands in the last-focused profile). Verify `#profileSelect` on each.
- Two bot pages and two bot `sw-N` are expected; match each worker to its profile by reading
  `active_person_id` / the queue from it, or by start time after reloading one profile at a time.
- A tab belongs to the profile whose bot page lists it in `chrome.tabs.query({})` (read-only).
  Use that before acting on any apply / Outlook / ChatGPT tab; both profiles can have the same site open.
- Open hand-work tabs from that profile's own bot page (`chrome.windows.create`), not `new_page`.

## Reload after bot code changes

- Each Chrome profile runs its **own instance** of the extension. Popup/content files are read
  from disk, so a profile's popup shows new UI immediately — but its **service worker keeps the
  old `background.js` until reloaded**. `reload_extension` (bot id) with Lewis + Avash both open
  restarted both workers (2026-11-14). Always verify per profile, never assume.
- **Build probe** (from that profile's bot page, no state change): new code answers
  `chrome.runtime.sendMessage({ type: "mark_queue_job_applied" })` with `{ ok:false, error:"Missing CSV row." }`;
  an old worker never answers (use a 3 s timeout). Still old → `reload_extension` again or ask the
  user to click Reload on `chrome://extensions` in that profile.
- `reload_extension` resolves the extension in CDP's *current* browser context. If the user
  opened another profile (no bot there) it fails with **"Extension … not found"**. Then reload
  each enabled profile from its own bot page instead (same as its Reload button), after checking
  the person:
  `() => { if (document.querySelector('#profileSelect')?.value !== '<id>') return 'wrong'; setTimeout(() => chrome.runtime.reload(), 100); return 'ok'; }`
- Re-open the bot window **inside a given profile** (no guessing where `new_page` lands):
  `chrome.exe --profile-directory="Profile 2" "chrome-extension://jkhoiaahamddiojkmhhpnnjnkdjiiigj/popup.html?ctx=window"`.
- Old `sw-N` rows can linger after a reload; a dead one times out on `evaluate_script`. Fresh
  workers: `() => new Date(performance.timeOrigin).toISOString()` shows a start time of just now.
- Reload closes the bot window/side panel and restarts the SW (new `sw-N`). Re-open with
  `new_page …/popup.html?ctx=window`, re-snapshot, re-bind. Storage/settings survive.
- Check `list_console_messages` (types error/warn) on the new bot page.

## Service worker (read-only)

`evaluate_script` with `serviceWorkerId` (omit `pageId`), e.g.
`async () => chrome.storage.local.get(["batch_state","generation_status","batch_run_mode"])`.
Never write storage or send state-changing messages (CLAUDE.md rule 2).

## Recovery

| Symptom | Do |
|---------|----|
| Timeout waiting for browser connection | Allow dialog pending = watcher task `BidBotAllowRemoteDebugging` not running — see Connect §2 |
| "No snapshot found for page N" | MCP restarted / page reloaded → `take_snapshot` first |
| Generation stuck on "blank ChatGPT chat ready — sending resume" after an extension reload | The AI tab still runs the old (orphaned) content script → reload that ChatGPT tab; the bot continues. **Always reload the AI tab right after reloading the extension** (2026-11-16) |
| Generation stalls at "sending resume" / "poll timed out (harvest too slow)", `evaluate_script` on the ChatGPT tab times out | **The ChatGPT tab is not the active tab of its window** (a work tab opened with `chrome.exe --profile-directory … <url>` or activated with `select_page bringToFront` took its place → Chrome throttles it). Keep hand-work tabs in a **separate window**: from the bot page `chrome.windows.create({tabId, focused:false})`, then `chrome.tabs.update(<chatgpt tab>, {active:true})`. If it is already frozen: `chrome.tabs.reload(<chatgpt tab id>)` from the bot page, the row continues (2026-11-18) |
| `#retryErrors` at a pause | It re-queues the error rows **and starts the batch** (state running) — not a passive re-queue (2026-11-18) |
| ChatGPT prompts hang (send spinner, `chatgpt.com/c/local-chatgpt:…` URL, statuses stuck for minutes), then every CDP call times out | **The RDP session is disconnected** (`qwinsta` → Administrator `Disc`): Chrome's windows aren't drawn and get throttled. Check `qwinsta` first when generation crawls. Don't call `chrome.windows.update` (minimize / focus) in that state (Chrome's browser process stopped responding, 2026-11-19). Alert the user (`Q<n>`): reconnect RDP and leave it connected, or OK `tscon <id> /dest:console`. After a Chrome restart: the batch resumes by itself, rows hit by the freeze show error "No current window" → **Retry errors** at a pause; old tabs are gone (Workday drafts survive up to the last Save and Continue) | 
| CDP "403" right after a Chrome restart | No profile window is open yet → `chrome.exe --profile-directory="Profile N" "chrome-extension://…/popup.html?ctx=window"`, then `list_pages` |
| Bot window closed mid-batch | Batch keeps running in the SW; reopen with chrome.exe --profile-directory="Profile N" "chrome-extension://…/popup.html?ctx=window" and re-bind |
| Bot page gone | Extension reloaded or window closed → `new_page …?ctx=window`, re-bind |
| SW not listed | Asleep — opening the bot page wakes it |
| Wrong person / wrong profile's tabs | Re-run bind; never guess |
| Extension tools missing | `--categoryExtensions` not active → restart the Claude Code session |

## Fallback: dedicated profile

Drop `--autoConnect`, add `--userDataDir=C:\apply-control\chrome-profiles\<name>`; the server
launches its own Chrome. `install_extension` `C:\brightstar-bid-bot`; the user signs in once per site.
