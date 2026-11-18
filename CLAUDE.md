# apply-control

Control workspace for running job-application sessions with the **BrightStar Bid Bot**
Chrome extension (source: `C:\brightstar-bid-bot`) through the **Chrome DevTools MCP** server.

Claude operates the bot the way the user does — clicking its popup/window UI and the
in-page Autofill panel — inside the user's own Chrome profile. When something blocks an
application, Claude fixes it (answer, Q&A bank, bot code, or skill) and records what it
learned so the next run goes further.

## Start here

| Need | Skill |
|------|-------|
| Attach to Chrome, bind the right profile, reload the extension | `browser-connect` |
| Know which popup control does what / read bot state | `bot-operate` |
| Run an apply session end to end | `apply-run` |
| One-command start: `/bid <person> <source> [cap]` or `/<person>-<source>-bid [cap]` (avash/lewis × dice, greenhouse, workday, builtin, himalayas, jobright, other, all) | `bid` |
| Something blocked an application | `blocker-fix` |
| Status, questions, user messages, Pause/Stop/approvals via the web dashboard (primary channel) | `mission-control` |
| Ask the user / take their answers via the Slack channel (mirror + fallback) | `slack-chat` |
| Site-specific behaviour | `site-<name>` (dice, indeed, greenhouse, workday, lever, ashby, jobgether, jobright, himalayas, builtin, other) |
| A site has no skill yet | copy `templates/site-skill/` (see `blocker-fix`) |

Person data comes from the bot (built-in `profiles.js` or the custom copy in that Chrome profile); `profiles/index.md` maps people → bot profile ids, and `profiles/<id>.md` holds only session settings. Session logs go in `runs/`.

## Hard rules

1. **Act only in the profile the user named.** Bind it first (`browser-connect`). If more
   than one profile's bot window is open and it's ambiguous, ask.
   **Enabled profiles: Avash (`Profile 2`, the default when none is named) and Lewis
   (`Profile 1`) only.** Don't open, read, or touch pages in any other Chrome profile
   (Carlos, Tools, …) even though the debug connection can see them. Enabling another
   profile means the user says so and `profiles/index.md` is updated.
   **Exception — Tools (`Profile 3`), read-only:** only to read the Slack channel in its Slack tab
   (bot alerts, "Applied ✅", and the user's replies to Claude, which count as user instructions;
   see `slack-chat`). Never type, click send, or touch other tabs there. Claude posts to that
   channel only through `scripts/slack-post.ps1` (webhook in user env var `BIDBOT_SLACK_WEBHOOK`).
   **Whenever Claude stops working, its final message ends with a specific question**; the Stop
   hook posts it to Slack while `runs/.slack-live` exists (`slack-chat`).
2. **Operate like the user, not around the bot.** Use the bot's own controls. Do not write
   `chrome.storage` directly or fake bot messages to change state; service-worker
   `evaluate_script` is for **read-only** diagnostics.
3. **Submit and Batch mode come from the profile file / user**, never from Claude's judgment.
   Set **Batch mode** (Generate / Generate + Apply) and **Allow auto submit** exactly as
   `profiles/<id>.md` or the user says for this session. Never loosen `ats/adapters.js`
   submit policy or `batch-apply-policy.js` to get past a blocker. Only click **Mark applied**
   after seeing a real confirmation page.
4. **Never Start a batch on an unreviewed queue.** After Load from sheet / CSV, show the
   counts and wait for the user's go (unless the profile file pre-approves the filter).
5. **Never invent answers** (work authorization, sponsorship, salary, demographics,
   years of experience, clearances). Use the profile, the Q&A bank, or ask — in Slack by default
   (`slack-chat`), including any form question that is unclear or has no good-fit option.
   **Standard answers (user-approved, all profiles):** start date = immediately (today);
   salary = lowest value of the posted range, else $150,000/year (≈ $72/h, $12,500/mo);
   applied/worked here before = No; how did you hear = any option; SMS consent = No (Avash: Yes);
   employed by a client/partner of the company, non-compete / non-solicitation agreement,
   relatives employed there = No (user, 2026-11-18).
   **EEO / self-identification (user, 2026-11-18, all profiles):** answer with the person's real
   value (gender, race / ethnicity, Hispanic, veteran, disability, and any other self-ID question)
   from `profiles/<id>.md` or the bot profile. **Never pick "Decline", "Prefer not to say",
   "I don't wish to answer", "Choose not to disclose"** or similar. Value unknown or no option
   fits → ask (`Q<n>`), then save the answer in `profiles/<id>.md` (and the site skill if the
   wording is site-specific) before going on.
   Details in each `profiles/<id>.md`.
6. **Human-only blockers stop and ask:** CAPTCHA, MFA/OTP you can't read, login walls,
   identity verification, payment. Leave the tab open. Never bypass bot protection.
   **Account sign-up walls on employer ATS** (user decision 2026-11-16, replaces 11-15): create the
   account **without asking**, with the person's profile email and the bot's per-person **ATS
   password** (bot profile `password`, default `DEFAULT_ATS_PASSWORD` in `profiles.js`), entered
   by the in-page panel's **Autofill** — Claude never types, reads, logs, or posts the password.
   **Mailbox (user, 2026-11-16, terminal, standing):** Claude may read the person's own **Outlook tab**
   (Avash, Lewis) to find and click verification links / codes, and to check "already applied?" for
   a company before an account wall. Never send, reply, delete, or move mail. See `slack-chat`.
7. **Credentials never go in files** — not in skills, profiles, runs, or commits. Logins live
   in the Chrome profile. If a password is needed mid-run, ask; use it once; don't record it.
8. **Pace it.** Respect the bot's cooldowns; stop on rate-limit signals. Default cap is in
   the profile file.
9. **Bot code changes** follow `C:\brightstar-bid-bot\.cursor\skills\brightstar-auto-apply\SKILL.md`
   (layering + safety invariants), then `npm run check && npm test` in that repo, then
   `reload_extension` (between rows, never mid-generation).
   **Continuous improvement (user, 2026-11-16):** while applying, keep improving autofill
   (option matching, labels, answers, Q&A bank) and the skills from what each form teaches.
   Keep the bot's main functions intact (batch loop, generation, sheet, submit policy); changes
   outside autofill / skills need a Slack OK first.
   **Commit + push yourself** for non-critical changes once `npm run check && npm test` pass
   (bot: branch `develop`; this repo: `main`; rebase on the remote first). Critical or
   behaviour-changing ones → ask in Slack (`Q<n>`) and push after the OK.
10. **Every blocker leaves a trace:** a line in the run log and, if it's reusable knowledge,
    an edit to the matching `site-*` skill (or a new one).
11. **Never apply through LinkedIn** (user decision 2026-11-14). Never select the LinkedIn
    filter, never open or fill LinkedIn job / Easy Apply pages, never Mark applied a LinkedIn row.
    At queue review, offer to remove LinkedIn rows before Start. If any apply flow lands on
    `linkedin.com`, stop that row and skip it. The bot itself never batch-applies LinkedIn rows.

## What applies to which profile

- **Bot code** (incl. Batch mode, Mark applied): one folder, `C:\brightstar-bid-bot`, loaded in
  Lewis and Avash → both get it once the extension is **reloaded in that profile**.
- **Bot settings** (sheet URL, filter, Batch mode, Allow auto submit, …): stored per Chrome
  profile, shared by all bot persons inside it. Set each profile from its `profiles/<id>.md`.
- **Skills / rules in this workspace**: generic for every profile; limited by rule 1 to the
  enabled profiles.

## Paths

- Bot repo: `C:\brightstar-bid-bot` (popup: `popup.html`, SW: `background.js`,
  policy: `ats/adapters.js`, DOM fill: `content/autofill.js`)
- Bot output: `%USERPROFILE%\Downloads\<sheet-tab or Applications-Name>\[N] - [Company] - [Title]\`
