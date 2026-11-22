# browser-connect — recovery details

Read the row for your symptom only.

## Recovery

| Symptom | Do |
|---------|----|
| Timeout waiting for browser connection | Allow dialog pending = watcher task `BidBotAllowRemoteDebugging` not running — see Connect §2 |
| "No snapshot found for page N" | MCP restarted / page reloaded → `take_snapshot` first |
| Generation stuck on "blank ChatGPT chat ready — sending resume" after an extension reload | The AI tab still runs the old (orphaned) content script → reload that ChatGPT tab; the bot continues. **Always reload the AI tab right after reloading the extension** (2026-11-16) |
| Generation stalls at "sending resume" / "poll timed out (harvest too slow)", `evaluate_script` on the ChatGPT tab times out | **The ChatGPT tab is not the active tab of its window** (a work tab opened with `chrome.exe --profile-directory … <url>` or activated with `select_page bringToFront` took its place → Chrome throttles it). Keep hand-work tabs in a **separate window**: from the bot page `chrome.windows.create({tabId, focused:false})`, then `chrome.tabs.update(<chatgpt tab>, {active:true})`. If it is already frozen: `chrome.tabs.reload(<chatgpt tab id>)` from the bot page, the row continues (2026-11-18) |
| `#retryErrors` at a pause | It re-queues the error rows **and starts the batch** (state running) — not a passive re-queue (2026-11-18) |
| ChatGPT prompts hang (send spinner, `chatgpt.com/c/local-chatgpt:…` URL, statuses stuck for minutes), then every CDP call times out | **The RDP session is disconnected** (`qwinsta` → Administrator `Disc`): Chrome's windows aren't drawn and get throttled. Check first: `runs\.session-state.json` (written every 15 s by the logon task `BidBotSessionWatch` = `scripts\session-watch.ps1`; history in `runs\.session-watch.log`, and it already posts disconnect / reconnect to the dashboard) or `qwinsta`. Don't call `chrome.windows.update` (minimize / focus) in that state (Chrome's browser process stopped responding, 2026-11-19). The batch survives: queue rows keep their status and the running row continues once the session is drawn again (11-21 row 96), so don't Stop / restart it. Ask the user (`Q<n>`) to reconnect RDP and leave it connected. **Console fallback** (`tscon <id> /dest:console`, keeps the session drawn) is the user's decision only: they install the watcher with `install-session-watch.ps1 -ConsoleFallback` (elevated) and create `runs\.allow-console-fallback`; Claude never creates that file or runs tscon. After a Chrome restart: the batch resumes by itself, rows hit by the freeze show error "No current window" → **Retry errors** at a pause; old tabs are gone (Workday drafts survive up to the last Save and Continue) | 
| CDP "403" right after a Chrome restart | No profile window is open yet → `chrome.exe --profile-directory="Profile N" "chrome-extension://…/popup.html?ctx=window"`, then `list_pages` |
| Bot window closed mid-batch | Batch keeps running in the SW; reopen with chrome.exe --profile-directory="Profile N" "chrome-extension://…/popup.html?ctx=window" and re-bind |
| Bot page gone | Extension reloaded or window closed → `new_page …?ctx=window`, re-bind |
| SW not listed | Asleep — opening the bot page wakes it |
| Wrong person / wrong profile's tabs | Re-run bind; never guess |
| Extension tools missing | `--categoryExtensions` not active → restart the Claude Code session |

## Fallback: dedicated profile

Drop `--autoConnect`, add `--userDataDir=C:\apply-control\chrome-profiles\<name>`; the server
launches its own Chrome. `install_extension` `C:\brightstar-bid-bot`; the user signs in once per site.
