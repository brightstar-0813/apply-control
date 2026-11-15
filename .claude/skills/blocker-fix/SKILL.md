---
name: blocker-fix
description: Diagnose and fix anything that stops an application during a BrightStar Bid Bot session — batch paused on a row, unanswered required fields, upload failures, wizard steps the bot can't advance, sites without an adapter, bot errors, login/CAPTCHA walls — finish the application, then make it not recur (Q&A bank, bot code change with tests + reload, or a site-* skill update / new site skill) and log it. Use whenever the bot pauses, a row errors, an apply tab is stuck, or a site has no skill yet.
---

# blocker-fix

Goal: get this application through **and** make the next one not need help.

## 1. Classify (snapshot + console + status first)

Gather: apply-tab `take_snapshot`, `list_console_messages` (error/warn) on that tab, bot
`#status`, the row's error text. Then:

| Class | Examples | Who fixes |
|-------|----------|-----------|
| **H — human only** | CAPTCHA, MFA/OTP not in reach, login wall, ID verification, payment, legal attestations | User. Stop, leave the tab open, say exactly what and where, wait |
| **A — answer** | Required question unanswered, no matching dropdown option | Claude from profile / Q&A bank; unknown → ask once, then save to the Q&A bank |
| **D — DOM/flow** | Field not filled, Next not found, upload missing, wizard loop, step budget hit | Claude finishes by hand now; fix bot code if it repeats |
| **N — no adapter** | Batch paused on Builtin / Himalayas / Jobright / employer page by design (never LinkedIn) | Claude finishes per site skill → Mark applied → Start |
| **P — policy** | Stopped before Submit by design (external Indeed, submit off) | Follow the profile submit setting; never change policy code |
| **J — job state** | Closed/expired, already applied, redirect elsewhere | Skip / let the second attempt exhaust it; log |
| **B — bot error** | SW exception, AI JSON not harvested, download / sheet failure | Save JSON / Retry errors / reload; fix code if it repeats |

## 2. Unblock now

- **A**: answer in the Autofill panel or the field. Truthful values only (CLAUDE.md rule 5). If
  the user gave the answer, add it to the Q&A bank (`#qaOpenEditorBtn`; Learn mode also captures
  typed answers).
- **D / N**: finish by hand — `fill`, `click`, `upload_file` with the row's PDFs from
  `%USERPROFILE%\Downloads\<output folder>\[N] - [Company] - [Title]\`. Submit only if the profile
  allows; confirm the thank-you page; row **Mark applied ✓**; `#batchStart`.
- **H**: tell the user; poll lightly; resume when they say done.

## 3. Fix for next time

Pick the cheapest durable fix:

1. **Q&A bank** — a recurring question with a fixed truthful answer.
2. **Site skill** — `.claude/skills/site-<name>/SKILL.md`: add a **Known blockers** row
   (symptom · class · fix · date) or refine **Flow**. Long detail → that skill's `references/`.
3. **New site** — host with no skill: copy `templates/site-skill/` → `.claude/skills/site-<name>/`,
   fill it from what you just did, add the host to the routing table in `site-other`, tell the user.
4. **Cross-site lesson** → `bot-operate` / `apply-run`, not a site skill.
5. **Bot code** — repeatable D/B, or a site worth an adapter:
   - Follow `C:\brightstar-bid-bot\.cursor\skills\brightstar-auto-apply\SKILL.md` (layers,
     invariants). Host quirks + submit policy → `ats/adapters.js` (+ `manifest.json` matches);
     DOM → `content/autofill.js`; batch apply rules → `batch-apply-policy.js`; Workday →
     `content/workday-engine.js`. Never loosen submit policy just to get past a blocker.
   - Put logic in a pure module where possible and add `tests/*.test.js`.
   - Files are CRLF; patch with exact-match edits (Edit tool or a Node script that asserts each
     match count is 1 and keeps line endings). Check `git diff --stat` stays small.
   - `npm run check && npm test` in `C:\brightstar-bid-bot`. Known baseline failure:
     `tests/chatgpt-sentinel.test.js` (uses `require` in ESM) — anything else failing is yours.
   - Reload in **each enabled profile** (`browser-connect` → Reload), re-bind, check console,
     retry the row.
   - Don't commit unless the user asks; list changed files in the run log.

## 4. Log

Run log row: `| row | company | site | result | blocker (class) | fix |`, plus one
"Skill/code changes" bullet per edited file.
