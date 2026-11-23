---
name: site-greenhouse
description: How to apply on Greenhouse (boards.greenhouse.io, job-boards.greenhouse.io, *.greenhouse.io, embedded Greenhouse iframes) with BrightStar Bid Bot — bot submits in Generate + Apply, custom questions, EEO, email security code. Use when an apply tab is on greenhouse.io, the queue filter is Greenhouse, or a Greenhouse row pauses.
---

# site-greenhouse

**Hosts:** `*.greenhouse.io` (+ employer pages embedding the Greenhouse iframe)
**Adapter:** `greenhouse` (stepBudget 18, `emailOtp`)
**Batch (Generate + Apply):** bot fills, uploads, **submits**, handles the security code, marks Applied.
**Login:** none.

## Flow
1. Bot opens the job → Apply → one long form (often in an iframe — snapshot the frame).
2. Name/email/phone/LinkedIn, resume + cover letter, custom questions (Q&A bank), EEO per profile.
3. Submit → maybe "enter the security code we emailed you". Bot reads it from an open
   **Outlook web** tab (Lewis has one). For a Gmail mailbox Claude may read it via the Gmail connector (ask first).
4. Confirmation: "Thank you for applying".

## Known blockers
| Symptom | Class | Fix | Added |
|---------|-------|-----|-------|
| Security code, no mailbox tab | H/A | Open the person's mailbox tab (or Gmail connector); fill; resubmit | 2026-11-13 |
| Custom "Years of X" / "Why us" | A | Q&A bank; free text only from resume facts | 2026-11-13 |
| Employer page embeds Greenhouse in an iframe (e.g. mongodb.com/careers/jobs/<id>); bot classes it "Other" and stops at Submit | N | Finish in the iframe. **Re-snapshot right before Submit and use that uid**: a stale uid clicked a footer link and navigated away (form lost). After a back/reload, DevTools may not see the iframe; load the page fresh (`job-boards.greenhouse.io/<co>/jobs/<id>` redirects back) and fill by hand | 2026-11-16 |
| Long-answer **textarea** (custom question) shows a value after `fill` but Submit says "This field is required" | D | `fill` did not register with the React textarea. Click it, Ctrl+A, Delete, then `type_text`; check `textarea.value.length` (FormativGroup #75, 2026-11-16) | 2026-11-16 |
| Disability options "No, I do not have a disability **and have not had one in the past**" | D (bot bug) | Bot picked "Yes, I have a disability…". Always check the EEO block before Submit; fix by hand | 2026-11-16 |
| Location autocomplete rejects typed text | D | Type, wait for listbox, pick the option | 2026-11-13 |
| Phone **Country** picker shows "+355" (Albania), number "070 37052182"; Submit → "Phone number is too long" | D (bot bug, fixed 0fa243c) | Pick "United States +1" (type "United States", choose from **this** box's listbox `react-select-<id>-listbox`, the page keeps other menus' options in the DOM); phone = 10 digits `7037052182`. Bot no longer blind-Enters a non-matching option and fills national digits next to a dial-code picker | 2026-11-16 |
| Bot pauses "Required answer is missing: country country off phone": the phone **Country** react-select is left empty (Certum Legal) | D (bot bug, open) | Click the Country combobox, then click the "United States +1" option by snapshot uid. Other menus' options stay in the DOM, so a text search hits the wrong list. Then Submit | 2026-11-18 |
| SkipTheDrive listing → bot "Reached Submit (Search)" | N | The search box is not the form: follow "Apply for this position" (often `job-boards.greenhouse.io/<co>/jobs/<id>`), check location there (SkipTheDrive "remote" can be Canada-only) | 2026-11-16 |
| Hand-off row (Himalayas → `job-boards.greenhouse.io/<co>/jobs/<id>`): no in-page panel on the tab; react-select dropdowns don't open from scripted mousedown / ArrowDown | D | Real `click` on the combobox uid, then pick the option by script from **`react-select-<input id>-listbox`** (mouse events on the `[role=option]`). Batch several click + pick pairs in one turn. Hispanic = No reveals a **race** dropdown (re-snapshot for its uid). Phone Country: click, `type_text` "United States", pick "United States +1" from `react-select-country-listbox` | 2026-11-19 |
| Security code when finishing by hand | A | Outlook list row "Security code for your application to <Company>" shows the 8-character code in the preview → click the first code box, `type_text` the code → Submit application again → `/confirmation` "Thank you for applying." | 2026-11-19 |
| Embedded boards (`job-boards.greenhouse.io/embed/job_app?for=<co>`, Monks #119, Komodo #172): bot fills basics and pauses on Country / Location / custom selects / consent | A | Country: click the combobox, `type_text` "United States", then **click the exact option "United States +1"** (Enter picked "+355" Albania). Location: type the city, click "Falls Church, Virginia, United States". Other selects: click the combobox (scripted focus/mousedown doesn't open them), then click the `[role=option]` by text; options can end with a period ("No."). `fill` **appends** to a text input that already has a value → focus, Ctrl+A, Backspace, `type_text`. Salary with per-region ranges → low end of the person's region (VA = "All Other US Locations"). The `captcha:true` flag here is Greenhouse's invisible reCAPTCHA Enterprise anchor, not a challenge (the 256×60 anchor frame is the badge). **Submit click does nothing → the Brightstar panel is covering the button**: collapse it (›) first (Unison #173) | 2026-11-22 |
| **Submit application** click does nothing (no error, no code, URL unchanged) on a hand-off tab that has the in-page panel | D | The Brightstar panel floats over the button and takes the click (screenshot shows it). Collapse the panel with its "×" (Collapse to tab), then click Submit → `/confirmation` (FormativGroup, Lewis #75) | 2026-11-19 |
| FormativGroup (`formativgroup`): Government Cloud hands-on, implementation-partner text, name on the Salesforce certifications, Preferred First Name | A | Lewis: Government Cloud **Yes** (user Q20), partner text = client-side in-house roles, cert name = legal name, salary = low end of the posted range. Req ids: `boards-api.greenhouse.io/v1/boards/formativgroup/jobs`. Check Outlook first: Lewis applied to other FormativGroup titles 10/8 and 10/20 | 2026-11-19 |
| Nava PBC (`navapbc`): government / residency / on-call questions | A | Answers in `profiles/avash-chapagain.md` (Nava block); salary = low end of the posted range | 2026-11-19 |
