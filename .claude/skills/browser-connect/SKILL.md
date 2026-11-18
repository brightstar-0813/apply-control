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
debugging?" prompt again; ask the user to click Allow at the start of the run.

## Facts on this machine

- Chrome 157. Remote debugging enabled (`chrome://inspect/#remote-debugging`); port 9222.
- Bot = unpacked `C:\brightstar-bid-bot`, extension id **`jkhoiaahamddiojkmhhpnnjnkdjiiigj`**
  (id comes from the folder path, so it's the same in every profile).
- Installed in **Lewis (`Profile 1`)** and **Avash (`Profile 2`)**; not in Carlos (`Default`) or
  Tools (`Profile 3`). Re-check: read `extensions.settings` in
  `%LOCALAPPDATA%\Google\Chrome\User Data\<dir>\Secure Preferences` for a path containing `brightstar`.
- Other extensions' service workers also appear in `list_pages` — use the `sw-N` whose URL has the bot id.

## Connect

1. Call any chrome-devtools tool (e.g. `list_pages`). On a new connection Chrome shows
   **"Allow remote debugging?"** — the user must click **Allow** (there is no way around it on
   the default profile dir). Tell the user *before* the call so they're watching.
2. Timeout "waiting for the browser connection" = dialog pending. `DevToolsActivePort` in the
   User Data dir + a `node.exe` connection on 9222 confirm it. Ask the user to look in every
   Chrome window (incl. minimized / RDP console). Max two retries, then wait for the user.
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
| Timeout waiting for browser connection | Allow dialog pending — see Connect §2 |
| "No snapshot found for page N" | MCP restarted / page reloaded → `take_snapshot` first |
| Generation stuck on "blank ChatGPT chat ready — sending resume" after an extension reload | The AI tab still runs the old (orphaned) content script → reload that ChatGPT tab; the bot continues. **Always reload the AI tab right after reloading the extension** (2026-11-16) |
| Generation stalls at "sending resume" / "poll timed out (harvest too slow)", `evaluate_script` on the ChatGPT tab times out | **The ChatGPT tab is not the active tab of its window** (a work tab opened with `chrome.exe --profile-directory … <url>` or activated with `select_page bringToFront` took its place → Chrome throttles it). Keep hand-work tabs in a **separate window**: from the bot page `chrome.windows.create({tabId, focused:false})`, then `chrome.tabs.update(<chatgpt tab>, {active:true})`. If it is already frozen: `chrome.tabs.reload(<chatgpt tab id>)` from the bot page, the row continues (2026-11-18) |
| `#retryErrors` at a pause | It re-queues the error rows **and starts the batch** (state running) — not a passive re-queue (2026-11-18) |
| Bot window closed mid-batch | Batch keeps running in the SW; reopen with chrome.exe --profile-directory="Profile N" "chrome-extension://…/popup.html?ctx=window" and re-bind |
| Bot page gone | Extension reloaded or window closed → `new_page …?ctx=window`, re-bind |
| SW not listed | Asleep — opening the bot page wakes it |
| Wrong person / wrong profile's tabs | Re-run bind; never guess |
| Extension tools missing | `--categoryExtensions` not active → restart the Claude Code session |

## Fallback: dedicated profile

Drop `--autoConnect`, add `--userDataDir=C:\apply-control\chrome-profiles\<name>`; the server
launches its own Chrome. `install_extension` `C:\brightstar-bid-bot`; the user signs in once per site.
