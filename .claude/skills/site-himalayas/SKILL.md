---
name: site-himalayas
description: How to handle Himalayas (himalayas.app) remote jobs with BrightStar Bid Bot — job board with no adapter; in Generate + Apply the bot opens the listing and pauses, Claude clicks through to the employer application and finishes. Use when a row or tab is on himalayas.app, the queue filter is Himalayas, or the batch paused on a Himalayas row.
---

# site-himalayas

**Hosts:** `himalayas.app` · **Adapter:** none (filter `#filterHimalayas`)
**Batch (Generate + Apply):** bot opens the listing and pauses → Claude finishes. **Login:** usually none.

## Flow
1. Paused row → job tab. Check the **Location requirements** box first: "United States only" is OK;
   LATAM, ARG or India listings → skip at queue review.
2. **Apply now** (a button, not a link) → modal "Don't let your application get lost…" → **I'm ready to apply**
   (an `<a href="https://himalayas.app/apply/<id>">`; never "Generate cover letter with AI") → the employer ATS opens in a new tab.
3. Continue with the target host's skill (or `site-other`). Use the row folder's files
   (`Downloads/<out>/<N>_…/Chapagain_Resume.pdf`, `…Cover Letter.pdf`).
4. **Mark applied ✓** → Start.

## Known blockers
| Symptom | Class | Fix | Added |
|---------|-------|-----|-------|
| Bot status "Reached Submit (Save). Stopped so you can review" on the listing | D (classifier) | It mistakes the listing's job **Save** button for Submit. Ignore it and click through as above | 2026-11-15 |
| Bot wandered to `himalayas.app/plus/job-application-tracker` ("Reached Submit (… Applied)", a tracker card read as Submit) | D (classifier) | Go back to the row's job link and click through by hand | 2026-11-15 |
| **I'm ready to apply** opened no tab (or opened one late, so there were two) | expected | Navigate the listing tab to the `himalayas.app/apply/<id>` href; close any duplicate tab | 2026-11-15 |
| A hand-finished form left open (waiting on the user) was closed when the bot started the next row | expected | Finish or submit a row before Start; otherwise re-open it later from the `himalayas.app/apply/<id>` link | 2026-11-15 |
| In-page panel shows a stale job title on the employer form | D | Don't trust the panel's Autofill for uploads; fill by hand with the row folder's files | 2026-11-15 |
