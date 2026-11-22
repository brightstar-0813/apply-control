# apply-run — parallel mode (Avash + Lewis together)

Read only when the user re-enables parallel runs (`/bid both`).

## Parallel mode — Avash + Lewis together (user, 2026-11-18; not field-tested yet)

> **ON HOLD (user, 2026-11-22): run Avash and Lewis one after the other.** Don't start `/bid both`
> or two batches at once until the user re-enables it. Risks found 2026-11-22: every ChatGPT prompt
> calls `focusTabForInput` (`chrome.windows.update(focused:true)` — the composer only accepts input
> in the focused tab), so two generating profiles fight over the one foreground window; one RDP
> session / one Chrome process freezes both at once; the Apps Script web app has no `LockService`.

One Claude session, both bots running. Each profile's bot generates and auto-submits by itself;
Claude alternates between them and finishes paused rows. Start with `/bid both <source> [cap]` or
when the user says "both" / "together".

1. **Preflight each profile in turn** (§1, §2): bind, settings from its own `profiles/<id>.md`, load,
   queue review. Each queue gets its own "go" (rule 4); one may start while the other waits.
2. **Keep a binding table** in working notes and in both run logs: person → bot page id, `sw-N`,
   work-window id, ChatGPT tab id. Rebuild it after any MCP restart or extension reload.
3. **Profile check before every action on a page** (rule 1): the page id must be in that person's
   table, or be listed by that profile's bot page (`chrome.tabs.query({})` from the bot page,
   read-only, lists only that profile's tabs). Not sure → don't click; re-bind (`browser-connect`).
   On apply forms also check the name / email already on the form matches the person.
4. **Loop:** poll Avash, poll Lewis (bot page `#status` or SW read), 30–60 s per round.
   - Both running → status line only, no other tools.
   - One paused → finish that row (site skill, answers from **that person's** profile file),
     Mark applied, close that row's tabs (rule 12), `#batchStart`, then poll the other before
     taking the next row.
   - Both paused → oldest pause first. A row waiting on a user answer or a CAPTCHA → ask, leave the
     tab open, and move to the other profile's row instead of waiting.
5. **Never mix persons:** answers, resume / cover letter folder, Outlook tab, ATS account and the
   Q&A bank are per person. Load the other person's profile file again when switching if unsure.
6. **Tag everything with the person:** `cli.js status "Avash #24 … | Lewis #31 …"`, questions
   `Q<n> (Lewis #31): …`, log lines go to that person's `runs/<date>-<id>.md`.
7. **Bot code changes / `reload_extension`:** only when **both** batches are between rows (both
   paused or idle); then reload both profiles, reload both ChatGPT tabs, re-bind both.
8. **ChatGPT:** each profile's ChatGPT tab stays the active tab of its own window; each profile
   gets its own separate work window for hand-work. Rate-limit / "too many requests" in either
   profile → pause **one** batch (Lewis first) and continue with the other; tell the user.
9. **Stop / Pause** from the dashboard applies to Claude as a whole. The bots keep going until
   their own Pause/Stop is clicked — on Stop, report both bots' states in the final message.
10. Stop conditions (§3.4) are counted per profile; one profile stopping doesn't stop the other.


## Binding two profiles (from browser-connect)

- Open both bot windows with `chrome.exe --profile-directory="Profile N" "chrome-extension://…/popup.html?ctx=window"`
  (never `new_page`: it lands in the last-focused profile). Verify `#profileSelect` on each.
- Two bot pages and two bot `sw-N` are expected; match each worker to its profile by reading
  `active_person_id` / the queue from it, or by start time after reloading one profile at a time.
- A tab belongs to the profile whose bot page lists it in `chrome.tabs.query({})` (read-only).
  Use that before acting on any apply / Outlook / ChatGPT tab; both profiles can have the same site open.
- Open hand-work tabs from that profile's own bot page (`chrome.windows.create`), not `new_page`.


