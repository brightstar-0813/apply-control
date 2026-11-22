---
name: bot-operate
description: Map of the BrightStar Bid Bot UI (popup / app window, Batch mode, queue, filters, Allow auto submit, row Mark applied, settings, in-page Autofill panel) with element ids, what each control does, which settings are per Chrome profile, and how to read bot state safely. Use whenever Claude needs to click, read or reason about the bot's controls — loading jobs, filtering, choosing Generate vs Generate + Apply, Start/Pause/Stop, per-row Apply/Files/Mark applied, toggles, active person, AI engine.
---

# bot-operate

Operate the bot through its UI like the user: find by id → `click` / `fill` → read `#status`.
Ids are from `C:\brightstar-bid-bot\popup.html`; if one is missing, grep `popup.html` and update
this file. Background (Q&A bank internals, sheet / Apps Script, Slack messages, history) →
`reference.md` in this folder, read only when needed.

**Scope of settings:** stored in that Chrome profile's extension storage, shared by all bot
persons in that profile, **not** shared with other Chrome profiles. Set per `profiles/<id>.md`.

## Token budget — read cheap, snapshot only to act

A `take_snapshot` of the bot window or an apply form is 5–30k tokens; a screenshot ~1.5k. The
scripts below return < 1k. Rules:
- **Polling / "what's the state?"** → script A or B only. Never snapshot to poll.
- **Apply form** → script C first; snapshot only the moment you need uids to click/fill, and
  don't re-snapshot after every field (re-snapshot after uploads / step changes only).
- **Confirmation check** → script D, not a screenshot.
- **Screenshots** only for a CAPTCHA alert (`Q<n>`) or when layout itself is the question.
- `list_pages` once per bind / after tab changes, not every poll.

Scripts live in `C:\apply-control\scripts\cdp\` — call them with `evaluate_script`
`sourcePath` (no code in the call) and `waitForStableDom: false`. All read-only.

| | File | Run on | Returns |
|---|------|--------|---------|
| **A** | `bot-state.js` | bot page | `#status`, now-working, batch state, mode, submit, filter, counts by status, applied, rows needing attention (~400 tokens). Also works on the SW (`serviceWorkerId`; DOM fields come back empty) |
| **B** | `queue-pending.js` | bot page | next 15 pending rows: `row \| company \| title \| host` (queue review) |
| **C** | `form-summary.js` | apply tab | url, title, empty required fields, panel text, CAPTCHA present?, visible buttons |
| **D** | `confirm-check.js` | apply tab | `confirmed` + the matched thank-you / received sentence |

Need something else? Write a small read-only script returning just those fields; save it there
if it'll be reused.
## Bid tab — jobs queue

Status bar: `#status` (bottom). Read it (script A) after every action.

| Control | Id / name | Notes |
|---------|-----------|-------|
| Allow batch process | `#allowBatchYes #allowBatchNo` | Must be **Yes** to see the queue |
| Load from | CSV / Google Sheet buttons | |
| Jobs sheet URL | textbox "Jobs sheet URL" + **Save URL** (`#saveJobsSheetUrlBtn`) | From profile file |
| Capture tab | textbox "Capture tab" | e.g. `US-SF-Jobs` |
| Load from sheet | `#loadSheetJobsBtn` | Ingests jobs → queue. Never starts. Sheet errors → `reference.md` |
| CSV | `#csvFile #csvRefresh #csvPinFile` | Upload = **fresh queue** (old statuses dropped). `upload_file` only reads files under the MCP `--workspace` roots → copy the CSV to `C:\apply-control\.uploads\` (git-ignored). If `#status` doesn't show "Parsing CSV…", dispatch `change` on `#csvFile`. Source: `C:\brightstar-sf-job-capture\download\jobs_latest.csv` (all boards) |
| Source filter | `#filterBuiltin #filterHimalayas #filterGreenhouse #filterDice #filterJobright #filterWorkday #filterEtc`("Other") `#filterAll` (`#filterLinkedIn` — never, rule 11) | By job **link host**. Hint `#sourceSubmitHint` says what Start will do |
| Counters | QUEUE / DONE / APPLIED / PENDING / SKIPPED / ERROR | Script A `by` gives the same numbers |
| Output folder | `#outputDir` | Defaults to person sheet tab |
| **Batch mode** | `#batchModeGenerate` "Generate" / `#batchModeApply` "Generate + Apply" (storage `batch_run_mode`) | **Generate** = build files only. **Generate + Apply** = build N → apply N → build N+1, any filter. **LinkedIn rows never applied.** Policy: `batch-apply-policy.js` |

**Before clicking a source filter:** read `all_us_jobs` and `job_queue` lengths (read-only). A
filter click rebuilds the queue from `all_us_jobs`; if `all_us_jobs` is empty, stop and ask.

## Queue controls

| Control | Id | Meaning |
|---------|----|---------|
| Start | `#batchStart` | Runs pending rows per Batch mode; also resumes a paused batch / retries a paused apply |
| Pause / Skip / Stop | `#batchPause #batchSkip #batchStop` | Skip = current row |
| Sync with sheet | `#syncSheet` | Reconcile queue with sheet Ready/Applied |
| Save JSON | `#forceSaveChatgpt` | AI JSON on page but not harvested |
| Retry errors | `#retryErrors` | Re-queues error rows **and starts the batch** |
| Clear queue / Reset | `#clearJobs #reset` | **Ask the user first** — destructive |
| Queue list | `#queueList`, `#queueSearch`, `#queueNowWorking` | Row actions: open link, Files, Remove (pending only), Retry (error), **Mark applied ✓**, **Apply**. From the page: row's `aria-label` "Remove" / "Mark applied" button; confirm dialog `[role=alertdialog]` — check it names the right job |
| Mark skipped ⏭ | row button | Sheet `Skipped — <reason>`; Start never reopens it. Opens a native `window.prompt` → answer with `dialogAction: "<reason>"` (short: closed / hybrid/on-site / non-US / duplicate of applied row N / needs review). Find the row by `.queue-item` whose **first line** is the row number (any-line match hits ATS scores) |
| Mark applied ✓ | row button | Sheet Applied + queue `applied`. Only after a confirmed submission by hand. On `done` rows and on not-yet-applied **duplicate** skips |
| Apply (row) | row button | Manual apply assist (opens job + panel). Non-hosted rows get marked Applied on the sheet when opened — don't use it just to "check" a row |

Row statuses: `pending`, `running`, `done`, `skipped`, `error` (+ `applied`, `applyAttempted`,
`applyAttempts` (max 2 per batch), `inactive`, `error` text).

## Apply assist

| Control | Id | Notes |
|---------|----|-------|
| Autofill enabled | `#autofillEnabledToggle` | |
| Allow auto submit | `#allowSubmitToggle` (storage `allowSubmitOnAssist`) | Only per profile file / user (rule 3) |
| API Custom Q&A | `#openaiQaToggle` | AI answers leftover questions |
| Autofill / Auto Apply / Custom Q&A | buttons | Act on the active tab |
| Q&A bank | `#qaOpenEditorBtn`, learn mode `#qaLearnToggle` | Editor rows win over scraped/AI rows; internals → `reference.md` |
| Clean junk Q&A | `#qaPruneJunkBtn` → confirm **Clean** in `[role=alertdialog]` | |

Batch submit = Batch mode + `ats/adapters.js` (adapter sites submit; others fill and pause).
External Indeed is never auto-submitted.

## Other sections

- Manual bid: `#toggleManualPanel`, `#jobTitle #companyName #jdLink`.
- Indeed grab: `#indeedGrabApply`, `#indeedGrabOnly`.
- Person: `#profileSelect`; inline editor `#inlineProfileSelect #inlineRoleTrackSelect`, `#inlineProfileSave`.
- AI engine: `#aiProviderChatgpt #aiProviderClaude #aiProviderClaudeApi #aiProviderOpenai`.
- Settings tab: `#spreadsheetUrl #sheetsWebAppUrl #sheetTabName`, pacing `#chatgptJobGapSec #chatgptHardPauseHits`, Slack.
- In-page Autofill panel: `[data-brightstar-autofill-panel]` on supported hosts — fills from
  profile + Q&A bank, uploads the row's PDFs, lists unanswered required questions (script C reads it).

## Where behaviour lives (for blocker-fix)

batch loop, sheet, `mark_queue_job_applied` → `background.js`; batch apply policy →
`batch-apply-policy.js`; apply orchestration → `autofill-runner.js`; DOM fill →
`content/autofill.js`; panel → `content/autofill-panel.js`; submit policy → `ats/adapters.js`;
Workday policy → `content/workday-engine.js`; Indeed hosted/external → `indeed.js`; source
filter → `csv.js`; popup → `popup.html` / `popup.js` / `popup.css`; Slack text → `slack.js`.
