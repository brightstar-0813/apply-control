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
4. Show the user; flag obvious misfits (wrong track, non-US, duplicates) and offer to remove them.
5. **New CSV / sheet load:** check pending rows have no `jobDir` from an older CSV (row numbers
   get reused; fixed in the bot 2026-11-15, still verify) and that Autofill is still on.
6. **Wait for "go"** unless the profile pre-approves. Cap = profile value (default 25); for a
   first run on a profile/build, start with 3 and watch each one.

## 3. Run — Batch mode "Generate + Apply"

1. `#batchStart`. Poll `#status` / `#queueNowWorking` every 30–60 s (or the SW read in
   `bot-operate`), update `cli.js status`, and act on any `[Mission Control]` messages (check the
   Slack tab only as fallback, `slack-chat`).
   Don't spam tools while ChatGPT is generating.
2. Per row the bot builds files, then opens the job and autofills:
   - **Adapter site** (Dice, Greenhouse, Workday, Lever, Ashby, Jobgether, hosted Indeed):
     bot submits, marks Applied, closes the tab, cools down, next row. Spot-check the first few.
   - **No adapter / blocker** → `#status` "Row N: … Batch paused". Then:
     1. `select_page` the apply tab; load the site skill by host (routing table in `site-other`).
     2. Finish the form (aggregators: click through to the employer ATS); answers from
        profile / Q&A bank / user — never invented.
     3. Submit (profile allows) → confirm the thank-you / "application received" page.
     4. Row **Mark applied ✓** → `#batchStart` to resume.
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

## 4. Verify

- Applied = confirmation seen on the page **and** the row is Applied (sheet `Applied M/D/YYYY`).
- Optional: Gmail connector — confirmation emails in the session window (ask first).
- Built rows have `jd.txt`, `*_Resume.pdf`, `*_Cover Letter.pdf` in the output folder.

## 5. Close

Run log: counters before/after, a row table for anything not cleanly applied, skill/code
changes, open items. Tell the user in a few lines.
