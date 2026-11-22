# apply-control

Control workspace for running job-application sessions with the **BrightStar Bid Bot** Chrome
extension (source: `C:\brightstar-bid-bot`) through the **Chrome DevTools MCP** server. Claude
operates the bot like the user — its popup/window UI and the in-page Autofill panel — inside the
user's own Chrome profile. When something blocks an application, Claude fixes it (answer, Q&A
bank, bot code, or skill) and records what it learned.

## Start here

| Need | Skill |
|------|-------|
| Attach to Chrome, bind the profile, reload the extension | `browser-connect` |
| Popup controls, cheap state reads (scripts A–D) | `bot-operate` |
| Run an apply session end to end | `apply-run` |
| `/bid <person> <source> [cap]`, `/<person>-<source>-bid [cap]` (avash/lewis × dice, greenhouse, workday, builtin, himalayas, jobright, other, all) | `bid` |
| Avash + Lewis in parallel — **on hold (user): run them one after the other** | `apply-run/parallel.md` |
| Something blocked an application | `blocker-fix` |
| Status, questions, user messages, Pause/Stop/approvals (primary channel) | `mission-control` |
| Slack channel (mirror + fallback) | `slack-chat` |
| Site-specific behaviour | `site-<name>` (dice, indeed, greenhouse, workday, lever, ashby, jobgether, jobright, himalayas, builtin, paylocity, other) |
| A site has no skill yet | copy `templates/site-skill/` (see `blocker-fix`) |

Person data comes from the bot (`profiles.js` or the custom copy in that Chrome profile);
`profiles/index.md` maps people → bot profile ids; `profiles/<id>.md` holds session settings and
EEO values. Session logs go in `runs/`.

## Token economy

Browser output is the main cost. Poll and inspect with `bot-operate` scripts A–D
(`scripts/cdp/*.js` via `evaluate_script` `sourcePath`, < 1k tokens)
instead of `take_snapshot` (5–30k) or screenshots; snapshot only when you need uids to act.
Screenshots only for CAPTCHA alerts. Pace polls to the work (2–3 min while generating). Read
reference files (`hosts.md`, `recovery.md`, `reference.md`, `parallel.md`) only the section you need.

## Hard rules

1. **Act only in the profile the user named**; bind it first (`browser-connect`); ambiguous → ask.
   **Enabled: Avash (`Profile 2`, default) and Lewis (`Profile 1`) only.** Never open, read or touch
   other profiles (Carlos, …). Enabling one = the user says so + `profiles/index.md` updated.
   **Exception — Tools (`Profile 3`), read-only:** only its Slack tab (bot alerts, "Applied ✅", the
   user's replies = user instructions; `slack-chat`). Never type, send or touch other tabs there.
   Claude posts to Slack only via `scripts/slack-post.ps1` (webhook in env `BIDBOT_SLACK_WEBHOOK`).
   **Whenever Claude stops working, its final message ends with a specific question** (the Stop
   hook posts it to Slack while `runs/.slack-live` exists).
2. **Operate like the user.** Use the bot's own controls. Never write `chrome.storage` or fake bot
   messages; `evaluate_script` on the service worker / bot page is **read-only**.
3. **Submit and Batch mode come from the profile file / user**, never Claude's judgment. Set
   Batch mode (Generate / Generate + Apply) and Allow auto submit exactly as `profiles/<id>.md` or
   the user says. Never loosen `ats/adapters.js` or `batch-apply-policy.js` to pass a blocker.
   **Mark applied** only after seeing a real confirmation page.
4. **Never Start a batch on an unreviewed queue.** After Load from sheet / CSV, show the counts and
   wait for the user's go (unless the profile file pre-approves the filter).
5. **Never invent answers** (work authorization, sponsorship, salary, demographics, years of
   experience, clearances). Use the profile, the Q&A bank, or ask (`Q<n>`) — also for any unclear
   question or one with no good-fit option.
   **Standard answers (all profiles):** start date = immediately (today); salary = lowest value of
   the posted range, else $150,000/year (≈ $72/h, $12,500/mo); applied/worked here before = No; how
   did you hear = any option; SMS consent = No (Avash: Yes); employed by a client/partner,
   non-compete / non-solicitation, relatives employed there = No.
   **EEO / self-ID:** the person's real value (gender, race / ethnicity, Hispanic, veteran,
   disability, any other) from `profiles/<id>.md` or the bot profile. **Never** "Decline", "Prefer
   not to say", "I don't wish to answer", "Choose not to disclose" or similar. Unknown / no fitting
   option → ask, then save the answer in `profiles/<id>.md` (and the site skill if site-specific).
6. **Only CAPTCHA (and anything unclear or impossible) goes to the user:** alert on the dashboard at
   once (`Q<n>` + screenshot), leave the tab open, continue with other rows. Never bypass bot
   protection. Also human-only: MFA/OTP Claude can't read, identity verification, payment.
   Login walls, sign-ups, email verification links / codes and password resets (via the Outlook
   link) → Claude handles them itself:
   - **Employer ATS sign-up walls:** create the account without asking, with the profile email and
     the bot's per-person ATS password (`password` / `DEFAULT_ATS_PASSWORD`), entered by the panel's
     **Autofill** — Claude never types, reads, logs or posts the password.
   - **Mailbox:** Claude may read the person's own **Outlook tab** (Avash, Lewis) for verification
     links / codes and to check "already applied?" before an account wall. Never send, reply,
     delete or move mail.
   - Chrome's **"Allow remote debugging?"** prompt is clicked by logon task
     `BidBotAllowRemoteDebugging`; never ask the user to click it.
   Never fill made-up profile data to get past a form. AI-written answers to open questions (why
   this role, describe your experience) are fine if they rest on the real profile / resume; backbone
   facts (identity, contact, work history, education, certifications, authorization, clearances,
   years of X, EEO) are never invented.
7. **Credentials never go in files** (skills, profiles, runs, commits). Logins live in the Chrome
   profile. A password needed mid-run → ask, use once, don't record.
8. **Pace it.** Respect the bot's cooldowns; stop on rate-limit signals. Default cap in the profile file.
9. **Bot code changes** follow `C:\brightstar-bid-bot\.cursor\skills\brightstar-auto-apply\SKILL.md`,
   then `npm run check && npm test` there, then `reload_extension` (between rows, never mid-generation).
   **Keep improving** autofill (option matching, labels, answers, Q&A bank) and the skills from
   each form; keep the bot's main functions intact (batch loop, generation, sheet, submit policy) —
   changes outside autofill / skills need the user's OK first.
   **Commit + push yourself** for non-critical changes once checks pass (bot: `develop`; this repo:
   `main`; rebase on the remote first). Critical / behaviour-changing → ask (`Q<n>`), push after OK.
10. **Every blocker leaves a trace:** a run-log line and, if reusable, an edit to the matching
    `site-*` skill (or a new one).
11. **Never apply through LinkedIn.** Never select the LinkedIn filter, open or fill LinkedIn job /
    Easy Apply pages, or Mark applied a LinkedIn row. Offer to remove LinkedIn rows at queue review.
    A flow that lands on `linkedin.com` → stop and skip that row.
12. **Close finished apply tabs.** Row done (confirmation + Mark applied) or skipped (closed job,
    already applied) → `close_page` its apply tab and every tab it opened. Keep open: bot window,
    ChatGPT, Outlook, dashboard, tabs waiting on the user (CAPTCHA, open `Q<n>`), and **error /
    unfinished rows' tabs** (note them — row, company, blocker — in the run log and on the dashboard).

## What applies to which profile

- **Bot code**: one folder, `C:\brightstar-bid-bot`, loaded in Lewis and Avash → each gets it once
  the extension is **reloaded in that profile**.
- **Bot settings** (sheet URL, filter, Batch mode, Allow auto submit, …): per Chrome profile,
  shared by all bot persons in it. Set from `profiles/<id>.md`.
- **Skills / rules here**: generic, limited by rule 1 to the enabled profiles.

## Paths

- Bot repo: `C:\brightstar-bid-bot` (popup `popup.html`, SW `background.js`, policy `ats/adapters.js`,
  DOM fill `content/autofill.js`)
- Bot output: `%USERPROFILE%\Downloads\<sheet-tab or Applications-Name>\[N] - [Company] - [Title]\`
