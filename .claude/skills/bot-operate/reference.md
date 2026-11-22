# bot-operate — reference (read when needed, not every session)

## Sheet calls (Apps Script)

Apps Script web app is **shared** with brightstar-sf-job-capture (same deployment). Both repos must
keep an identical merged `apps-script/Code.gs` (all actions: append, appendWarehouse,
replaceWarehouse, listRows, listLinks, listCaptureJobs, markApplied). If one side drifts, the other
side's deploy drops actions. Check live actions: POST `{action:"bogus"}` → the error lists them.
Error "missing listCaptureJobs" → user must redeploy the merged `apps-script/Code.gs` (Deploy →
Manage deployments → Edit → New version). "Checking Google Sheet…" stuck > 2 min → requests have no
timeout; reload the bot (queue survives).

## Q&A bank behaviour (since bot `af07f98`)

- Every save goes through `isBankableQa` (`autofill-junk.js`). Page chrome, trackers, cookie and consent toggles, report-job options, work-history rows, placeholders, markup, option ids, URLs, a bare "Please specify", and a Yes/No answer to a "which/what" question are all dropped. Rows typed in the editor (`source: user-editor`) are trusted and never overwritten.
- Reuse goes through `findQaMatches`, which returns ranked candidates (threshold 0.82; Yes/No answers need ≥0.9 similarity). The runner takes the first candidate that fits.
- Pay questions never use the bank; they use the standard pay rule. Contact and sensitive fields come only from the profile.
- If the bank fills up with junk again: preview read-only first (import `autofill-junk.js` on the bot page and run `isBankableQa` over the `brightstar_qa`/`qa_bank` rows). Then add the new junk pattern plus a test to `tests/qa-bank-gate.test.js`, reload, and click Clean junk.
- To make an answer reliably reusable, add it in **Open editor**; editor rows win over scraped and AI rows.

## Tracking sheet and Slack

- **Sheet** (Settings tab: `#spreadsheetUrl`, Apps Script `#sheetsWebAppUrl`, person tab
  `#sheetTabName`): build → row **Ready** (Bid mode `Auto bid`); bot submit or **Mark applied** →
  same row (upsert by job link) **Applied M/D/YYYY h:mm**. A sheet failure never fails the job —
  the row error says "sheet mark failed"; fix config, then Mark applied again. A link already
  **Applied** on the sheet is skipped (dedupe = job link).
- **Slack** (`slack_webhook_url`, Settings → Show pacing & Slack → Incoming Webhook URL + **Test**;
  set in Lewis + Avash, one shared channel, person named in each message):
  - **Applied ✅** — every submit (bot) and every **Mark applied** (by hand), with site + sheet result.
  - **Needs hand-off 🖐️** — batch paused on a no-adapter board (Jobright, Builtin,
    Himalayas, Other, Indeed external), with unanswered questions. Left unfinished and retried →
    **Job skipped ⏭️** "Not applied — moved on".
  - **Job error — retrying ⚠️ / Job failed ❌** — real failures on adapter sites and generation.
  - Batch paused / failed / ChatGPT rate limit, required field unanswered (adapter sites),
    duplicate skips, batch complete summary.
  - **Verify in Slack:** the channel is open in the **Tools** profile (`Profile 3`, Slack tab titled
    "… - Bid Bot - Slack"). Read-only: read that tab only — never type or click send.
  - **Two-way with the user:** Claude posts via `scripts/slack-post.ps1` and reads the user's
    replies there — see `slack-chat`.
  - Text built by `buildSlackJobStatusText` in `slack.js`; hand-off boards = `isHandoffBoard`
    in `batch-apply-policy.js`. Empty webhook → nothing sent, silently.
- Webhook URLs are secrets: enter them in the bot UI only, never in files or the run log.

## History notes

- Row buttons disabled after Stop/Pause: old builds kept Remove / Mark applied disabled until a
  reload (fixed 2026-11-15). If seen: reload the bot page.
- 2026-11-15: Avash had `all_us_jobs = []` with 211 queued rows → a Dice filter click wiped the
  queue. popup.js now seeds the master list from the queue, but still check before filter clicks.
