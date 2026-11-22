---
name: apply-run
description: Run a job-application session with BrightStar Bid Bot for an enabled Chrome profile (Avash default, Lewis) — preflight, set Batch mode and submit per the profile file, load jobs from the sheet, get queue approval, Start, then drive the build → apply loop (bot submits on adapter sites, Claude finishes paused rows and clicks Mark applied), verify, and write the run log. Use when the user says "apply", "go", "run the bot", "start bidding", "work on <person>", or asks Claude to process the jobs queue.
---

# apply-run

## 0. Inputs

- Person → bot profile id (`profiles/index.md`) → `profiles/<id>.md` (session settings).
  No person named → Avash. Person data comes from the bot, never from these files.
- Session overrides from the user: filter, cap, submit, batch mode.
- Log as you go in `runs/YYYY-MM-DD-<id>.md` (format: `runs/README.md`).

Talk to the user through **Mission Control** first (`mission-control`): post a `cli.js status` line at
start and at each row, ask with `cli.js say "Q<n> …"`, wait with `cli.js wait`; their dashboard messages
arrive as `[Mission Control]` context. Slack (`slack-chat`) stays as mirror/fallback: create
`runs/.slack-live` at start (delete it at Close); every stop ends with a specific Q<n> question, which
the Stop hooks relay to both. Terminal messages still work too.

## 1. Preflight (stop and ask on any failure)

1. `browser-connect` → bound bot page, right person, current build (`#batchModeApply` exists).
2. Match the bot to the profile file, clicking like the user would:
   Allow batch process = Yes · Load from = Google Sheet · Jobs sheet URL + **Save URL** ·
   Capture tab · source filter · **Batch mode** · **Allow auto submit** · Autofill on · AI engine.
   Never turn submit on unless the profile file / user says so.
3. `?` fields in the profile file → ask the user once, then write the answer into the file.
4. AI tab: the bot opens one if missing; a login page → ask the user.
5. Baseline counters (QUEUE / DONE / APPLIED / PENDING / SKIPPED / ERROR).

## 2. Load and review

1. **Load from sheet** (`#loadSheetJobsBtn`) — the user's primary source; wait for `#status` to settle.
   Fallback only (keep it working): CSV upload of `jobs_latest.csv` via `.uploads/` when the capture
   tab lacks the wanted source (e.g. no Dice rows). Ask before switching a profile to CSV.
2. Read per-source counts and the first ~10 pending rows (company / title / source).
3. **LinkedIn rows** (`linkedin.com` links, "LI" in the counts): never applied (CLAUDE.md rule 11).
   Offer to remove them with the row trash before Start so no generation time is spent on them.
4. **Pre-check dry run (bot 2026-11-22):** from the bot page (read-only, nothing changes):
   `() => chrome.runtime.sendMessage({ type: "precheck_queue", dryRun: true })` → rows the bot will
   skip at Start (closed / non-US / state residency vs the person's state / required relocation),
   plus `groups` (self-submit vs hand-off counts). Include it in the queue review. At **Start** the
   bot marks those rows skipped (reason in the row, `precheck_log` in storage; nothing deleted) and
   also skips, row by row, same-requisition / same-employer-and-title reposts of applied or built rows.
   A wrong skip → `precheck_restore` with `csvRow` is a state change: only on the user's say-so.
5. Show the user; flag obvious misfits (wrong track, non-US, duplicates) and offer to remove them.
6. **New CSV / sheet load:** check pending rows have no `jobDir` from an older CSV (row numbers
   get reused; fixed in the bot 2026-11-15, still verify) and that Autofill is still on.
   (Hydration still points reposts at another row's folder by company + title — e.g. 11-22 rows
   218/254 → row 47's folder. The bot's reuse step ignores those; only own-row folders are reused.)
7. **Wait for "go"** unless the profile pre-approves. Cap = profile value (default 25); for a
   first run on a profile/build, start with 3 and watch each one.

## 3. Run — Batch mode "Generate + Apply"

1. `#batchStart`. Poll `#status` / `#queueNowWorking` every 30–60 s (or the SW read in
   `bot-operate`), update `cli.js status`, and act on any `[Mission Control]` messages (check the
   Slack tab only as fallback, `slack-chat`).
   Don't spam tools while ChatGPT is generating.
   **Order (bot 2026-11-22):** built rows first, then new builds, each by site tier — Workday,
   Greenhouse, Lever, Ashby, Dice, hosted Indeed / Jobgether, and the hand-off group (Builtin,
   Himalayas, Jobright, other employer pages) last. So the bot clears self-submit rows alone and the
   hand-off pauses come together at the end. Old order: storage `batch_priority_order = "queue"`
   (user decision only).
   **Screening questions go to Codex only** (no GPT-tab fallback); the GPT tab is for resumes and
   cover letters. A Codex failure retries once on a new thread, then the row pauses as "required
   field unanswered".
2. Per row the bot builds files, then opens the job and autofills:
   - **Adapter site** (Dice, Greenhouse, Workday, Lever, Ashby, Jobgether, hosted Indeed):
     bot submits, marks Applied, closes the tab, cools down, next row. Spot-check the first few.
   - **No adapter / blocker** → `#status` "Row N: … Batch paused". Then:
     1. `select_page` the apply tab; load the site skill by host (routing table in `site-other`).
     2. Finish the form (aggregators: click through to the employer ATS); answers from
        profile / Q&A bank / user — never invented.
     3. Submit (profile allows) → confirm the thank-you / "application received" page.
     4. Row **Mark applied ✓**.
     5. **Close the row's tabs** (rule 12): the apply tab plus any listing / ATS / verification
        tabs it opened (`close_page`). Never the bot window, ChatGPT, Outlook or dashboard tabs.
        Same after a skip (closed job, already applied, misfit). Stays open: a tab waiting on the
        user (CAPTCHA, open `Q<n>`) and any **error / unfinished row's tab** — leave it as it is
        for the user to review or continue, and note it in the run log + dashboard.
     6. `#batchStart` to resume.
   - **Can't finish** (CAPTCHA, login, MFA, closed job) → `blocker-fix`. To move on without
     applying: `#batchStart` again (second attempt exhausts the row) or `#batchSkip`.
   - **External Indeed**: bot fills, never submits; finish on the employer site if allowed, then Mark applied.
3. Every blocker → `blocker-fix` (fix now, then fix for next time, then log).
   **Repeats (2026-11-17):** a fresh Load from sheet can bring back rows applied in earlier runs (#191 = #27, #216 = #44,
   #257 = #205). At each pause, grep `runs/*.md` for the company and search the person's Outlook
   ("Thank you for applying", "received your application") before applying; same title already applied → Mark skipped
   "already applied <date>". While paused, also remove pending repeats / non-US rows (Remove is disabled while running).
   **Skip only at a pause**: `#batchSkip` during generation leaves the ChatGPT chat on the skipped job and the next row's
   cover letter can fail (#266).
4. Stop and tell the user on: cap reached, rate-limit / CAPTCHA storms, the same failure 3× on one site.

## 3b. Run — Batch mode "Generate"

The bot only builds files. If the user wants applications anyway, use each done row's **Apply**
(note: non-hosted rows are marked Applied when opened), run the Autofill panel, submit only if allowed.

**Generate ahead, apply later (user OK 2026-11-22):** run the whole queue in **Generate** (e.g.
overnight; pre-check and duplicate skips run here too), then switch to **Generate + Apply** and
Start: the bot's backlog applies every `done` row from its saved folder (no new ChatGPT build),
self-submit sites first, hand-offs last. A row whose files already exist in its own folder is
marked `done` instead of rebuilt.

## 3c. Parallel mode — Avash + Lewis together (user, 2026-11-18; not field-tested yet)

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

## 4. Verify

- Applied = confirmation seen on the page **and** the row is Applied (sheet `Applied M/D/YYYY`).
- Optional: Gmail connector — confirmation emails in the session window (ask first).
- Built rows have `jd.txt`, `*_Resume.pdf`, `*_Cover Letter.pdf` in the output folder.

## 5. Close

Run log: counters before/after, a row table for anything not cleanly applied, skill/code
changes, open items. Tell the user in a few lines.
