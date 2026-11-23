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
2. **EEO:** gender, race, veteran, disability (exact values from `profiles/<id>.md`; never "I choose not to self-identify" — unknown → ask the user).
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
| Bot pauses "Required or invalid answer needs review: countryunited states" | B | Country's inner `<input required>` is empty while the select shows "United States" → `input:invalid` false hit. Ignore it; the real gaps are below | 2026-11-18 |
| Batch autofill leaves step 1 wrong (Lewis #9): applied before = **Yes**, work-history dates as month names ("April"), home address + own phone in every employer block, AI "Reason for Leaving", GPA / Graduation Date full of text; State, start date, salary type, SMS, worked-before empty | B (open) | Fix by hand before Next: dates `MM/YYYY` + employer city/state from the resume PDF (`pdftotext -layout`), clear employer Address 1 / ZIP / phone / reason (not enforced), GPA empty, graduation `MM/YYYY` | 2026-11-18 |
| 5-step variant (Phoenix Oversight / PhoenixTeam #67, Avash 2026-11-23): Information → Additional Questions → EEO → Optional Identity → Review. Bot reaches step 3 then "could not advance" (cookie banner over Next → click its **Close**). Step 1 again had own phone + home city/ZIP in every employer block, empty Address Line 1, degree "Other" | B | Employer city: the native value setter **does not persist** here → focus + select + `type_text` + Tab per field (cities from the master resume; phone/ZIP blank). Review page "Edit" controls are `div.button` → click to jump back to a step. Graduation date: leave blank when the resume has years only | 2026-11-23 |
| Next Step just scrolls to the top with no visible error | N | Look for **red text** (computed colour) — e.g. "Sorry, it looks like you've already applied for this job." under Email (= repeat → Mark skipped) or "Must be 40 characters or fewer" on an employer Address 1 that Paylocity auto-filled after the City was set (clear it). (Commence #161, Avash) | 2026-11-23 |

## Script helpers (2026-11-18)
`fill` / `fill_form` append to existing text and time out on this form. What works:
- Text inputs: native value setter + `input` + `change` + `blur` (ids like `workHistory.companyPhone.0`,
  `txt-workHistory-startDate-0`, `public-candidate-work-history-address-0-city`). Exception: **Available to
  Start** (`info.dateAvailableToStart`) needs real typing (click → `type_text` `11/18/2026` + Tab).
- Native-looking dropdowns are `div[role=combobox]#<id>` (`info.haveYouAppliedWithUsBefore`, `info.smsOptedIn`,
  `info.desiredSalaryType`, `info.haveYouWorkedWithUsBefore`, `educationHistory.degreeId.0`,
  `acknowledgements.eeoGender` …): click the div, then `.click()` the `li[role=option]` **inside the same
  wrapper** (old menus stay in the DOM), click the div again if still open.
- State: focus `#public-site-address-us-state`, ArrowDown, click `[role=listitem][title="MI"]` in
  `#public-site-address-us-state-dropdown-list-container`.
- Address Line 1 shows "Address is required" until a suggestion is picked: retype it and click the matching option.
- Success page: `/Recruiting/Jobs/Success/<id>` "Your application has been received!".
