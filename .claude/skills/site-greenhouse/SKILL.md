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
