---
name: site-paylocity
description: How to finish an application on Paylocity (recruiting.paylocity.com) by hand for BrightStar Bid Bot — 4-step form, hidden file inputs, custom State/Country selects, EEO, acknowledgement. No bot adapter (hand-off). Use when an apply tab or a Jobgether redirect lands on recruiting.paylocity.com.
---

# site-paylocity

**Hosts:** `recruiting.paylocity.com/Recruiting/Jobs/Apply/<id>` · **Adapter:** none → Claude finishes.
**Login:** none.

## Flow (4 steps)
1. **Information:** upload resume first (keep "Fill out application with my resume" ticked — it pre-fills
   all work history), cover letter, name/email/mobile/home phone, address, start date, salary type + range,
   "applied before" / "worked before" / SMS. Education entry (School Name required).
2. **EEO:** gender, race, veteran, disability (profile; else "I choose not to self-identify").
3. **Optional identity questions:** leave blank unless the profile has them.
4. **Review:** "Authorized to work in the US?" (profile) → acknowledgement checkbox → **Submit**.

## Quirks
- File buttons don't take `upload_file`: make `input[type=file]` (`#btn-resume`, `#btn-coverLetter`) visible
  with a small script, re-snapshot, upload, then dispatch `change`.
- **State / Country** are custom selects: typing filters badly ("No Results Found"). Clear the box,
  press ArrowDown to open the **full** list, then click the abbreviation (e.g. `VA`). Verify via snapshot
  label "State VA". Country is pre-set to United States (shown as the value, not a placeholder).
- Native dropdowns (applied before, SMS, salary type Hourly/Yearly, degree, school type) work with click → option.
- Cookie banner can intercept clicks → click its **Close** (not "Accept All").
- Work-history County/ZIP show as required but are not enforced.

## Standard answers
Use CLAUDE.md rule 5 (start immediately, lowest posted salary else $150k/yr, applied/worked before = No,
SMS = No, any "how did you hear").

## Known blockers
| Symptom | Class | Fix | Added |
|---------|-------|-----|-------|
| State won't select | D | Full-list method above | 2026-11-15 |
