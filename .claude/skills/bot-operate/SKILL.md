---
name: bot-operate
description: Map of the BrightStar Bid Bot UI (popup / app window, Batch mode, queue, filters, Allow auto submit, row Mark applied, settings, in-page Autofill panel) with element ids, what each control does, which settings are per Chrome profile, and how to read bot state safely. Use whenever Claude needs to click, read or reason about the bot's controls — loading jobs, filtering, choosing Generate vs Generate + Apply, Start/Pause/Stop, per-row Apply/Files/Mark applied, toggles, active person, AI engine.
---

# bot-operate

Operate the bot through its UI like the user: `take_snapshot` → find by accessible name/id →
`click` / `fill` → read `#status`. Ids are from `C:\brightstar-bid-bot\popup.html`; if one is
missing, grep `popup.html` and update this file.

**Scope of settings:** everything below is stored in that Chrome profile's extension storage.
It's shared by all bot persons in that Chrome profile and **not** shared with other Chrome
profiles. Set it per profile from `profiles/<id>.md`.

Status bar: `#status` (bottom). Read it after every action.

## Bid tab — jobs queue

| Control | Id / name | Notes |
|---------|-----------|-------|
| Allow batch process | chips "Yes"/"No" (`#allowBatchYes #allowBatchNo`) | Must be **Yes** to see the queue |
| Load from | CSV / Google Sheet buttons | |
| Jobs sheet URL | textbox "Jobs sheet URL" + **Save URL** (`#saveJobsSheetUrlBtn`) | From profile file |
| Capture tab | textbox "Capture tab" | e.g. `US-SF-Jobs` |
| Load from sheet | `#loadSheetJobsBtn` | Ingests jobs → queue. Never starts |
| CSV | `#csvFile #csvRefresh #csvPinFile` | Upload = **fresh queue** (old statuses dropped). `upload_file` only reads files under the MCP `--workspace` roots → copy the CSV to `C:\apply-control\.uploads\` (git-ignored). If `#status` doesn't show "Parsing CSV…", dispatch `change` on `#csvFile`. Sources: `C:\brightstar-sf-job-capture\download\jobs_latest.csv` (all boards) — the sheet capture tab may have no Dice jobs |
| Sheet calls | Apps Script web app (**shared** with brightstar-sf-job-capture — same deployment) | Both repos must keep an identical merged `apps-script/Code.gs` (all actions: append, appendWarehouse, replaceWarehouse, listRows, listLinks, listCaptureJobs, markApplied). If one side drifts, the other side's deploy drops actions. Check live actions: POST `{action:"bogus"}` → the error lists them. Error "missing listCaptureJobs" → user must redeploy the merged `apps-script/Code.gs` (Deploy → Manage deployments → Edit → New version). "Checking Google Sheet…" stuck > 2 min → requests have no timeout; reload the bot (queue survives) |
| Source filter | `#filterBuiltin #filterHimalayas #filterGreenhouse #filterDice #filterJobright #filterWorkday #filterEtc`("Other") `#filterAll` (`#filterLinkedIn` exists — never use it, rule 11) | By job **link host**. Hint `#sourceSubmitHint` says what Start will do |
| Counters | QUEUE / DONE / APPLIED / PENDING / SKIPPED / ERROR | Baseline before, compare after |
| Output folder | `#outputDir` | Defaults to person sheet tab |
| **Batch mode** | chips `#batchModeGenerate` "Generate" / `#batchModeApply` "Generate + Apply" (storage `batch_run_mode`), right above Start | **Generate** = build files only, never applies (any source, Dice too). **Generate + Apply** = build job N → apply job N → build N+1, on any filter incl. All. **LinkedIn rows are never applied.** Unset = old behaviour (Dice/Greenhouse filter apply, others generate). Policy: `batch-apply-policy.js` |

## Queue controls

| Control | Id | Meaning |
|---------|----|---------|
| Start | `#batchStart` | Runs pending rows per Batch mode; also resumes a paused batch and retries a paused apply |
| Pause / Skip / Stop | `#batchPause #batchSkip #batchStop` | Skip = current row |
| Sync with sheet | `#syncSheet` | Reconcile queue with sheet Ready/Applied |
| Save JSON | `#forceSaveChatgpt` | AI JSON on page but not harvested |
| Retry errors | `#retryErrors` | |
| Clear queue / Reset | `#clearJobs #reset` | **Ask the user first** — destructive |
| Queue list | `#queueList`, `#queueSearch`, `#queueNowWorking` | Row actions: open link, Files, Remove (pending only), Retry (error), **Mark applied ✓** (done & not applied), **Apply** |
| (row buttons disabled after Stop/Pause) | — | Old builds kept Remove / Mark applied disabled until a reload (fixed 2026-11-15). If seen: reload the bot page. Clicking from the page: find the row in `#queueList`, its `aria-label` "Remove" / "Mark applied" button; confirm dialog is `[role=alertdialog]` — check it names the right job first |
| Mark applied ✓ | row button | `mark_queue_job_applied` → sheet Applied + queue `applied`. Use only after a confirmed submission done by hand (Claude/user) |
| Apply (row) | row button | Manual apply assist for that row (opens job + panel). Non-hosted rows get marked Applied on the sheet when opened — don't use it just to "check" a row |

**Before clicking a source filter:** read `all_us_jobs` and `job_queue` lengths (SW/page, read-only).
A filter click rebuilds the queue from `all_us_jobs` and saves it. On 2026-11-15 Avash had
`all_us_jobs = []` with 211 queued rows → the Dice click wiped the queue. popup.js now guards this
(seeds the master list from the queue), but still check first; if `all_us_jobs` is empty, stop and ask.

Row statuses: `pending`, `running`, `done`, `skipped`, `error` (+ `applied`, `applyAttempted`,
`applyAttempts` (max 2 per batch), `inactive`, `error` text).

## Apply assist

| Control | Id | Notes |
|---------|----|-------|
| Autofill enabled | `#autofillEnabledToggle` | |
| Allow auto submit | `#allowSubmitToggle` (storage `allowSubmitOnAssist`) | Panel / manual Apply submit. Only per profile file / user (CLAUDE.md rule 3) |
| API Custom Q&A | `#openaiQaToggle` | AI answers leftover questions |
| Autofill / Auto Apply / Custom Q&A | buttons | Act on the active tab |
| Q&A bank | `#qaOpenEditorBtn`, learn mode `#qaLearnToggle` | Learn mode saves answers typed on forms |

Batch submit itself is decided by Batch mode + `ats/adapters.js` (sites with an adapter submit;
others fill and pause). External Indeed is never auto-submitted.

## Other sections

- Manual bid: `#toggleManualPanel`, `#jobTitle #companyName #jdLink`.
- Indeed grab: `#indeedGrabApply`, `#indeedGrabOnly`.
- Person: `#profileSelect`; inline editor `#inlineProfileSelect #inlineRoleTrackSelect`, `#inlineProfileSave`.
- AI engine: `#aiProviderChatgpt #aiProviderClaude #aiProviderClaudeApi #aiProviderOpenai`.
- Settings tab: `#spreadsheetUrl #sheetsWebAppUrl #sheetTabName`, pacing `#chatgptJobGapSec #chatgptHardPauseHits`, Slack.

## In-page Autofill panel (ATS tabs)

`[data-brightstar-autofill-panel]` on supported hosts: fills from profile + Q&A bank, uploads
the row's PDFs, lists unanswered required questions. Answer them from profile / Q&A / user.

## Reading state (read-only, service worker)

```js
async () => {
  const d = await chrome.storage.local.get(["job_queue","batch_state","generation_status","batch_run_mode","allowSubmitOnAssist","job_channel_filter"]);
  const q = d.job_queue || []; const by = {};
  for (const j of q) by[j.status] = (by[j.status]||0)+1;
  return { batch_state: d.batch_state, status: d.generation_status, mode: d.batch_run_mode,
    submit: d.allowSubmitOnAssist, filter: d.job_channel_filter, by, applied: q.filter(j=>j.applied).length,
    attention: q.filter(j => j.status==="error" || (j.status==="done" && !j.applied && j.error))
      .map(j => ({ row: j.csvRow, company: j.company, err: j.error, link: j.jdLink })) };
}
```

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
    "… - Bid Bot - Slack"). Read-only: `take_snapshot` of that tab only — never type or click send.
  - Text built by `buildSlackJobStatusText` in `slack.js`; hand-off boards = `isHandoffBoard`
    in `batch-apply-policy.js`. Empty webhook → nothing sent, silently.
- Webhook URLs are secrets: enter them in the bot UI only, never in files or the run log.

## Where behaviour lives (for blocker-fix)

batch loop, sheet, `mark_queue_job_applied` → `background.js`; batch apply policy →
`batch-apply-policy.js`; apply orchestration → `autofill-runner.js`; DOM fill →
`content/autofill.js`; panel → `content/autofill-panel.js`; submit policy → `ats/adapters.js`;
Workday policy → `content/workday-engine.js`; Indeed hosted/external → `indeed.js`; source
filter → `csv.js`; popup → `popup.html` / `popup.js` / `popup.css`.
