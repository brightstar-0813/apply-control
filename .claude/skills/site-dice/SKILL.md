---
name: site-dice
description: How to apply on Dice (dice.com) with BrightStar Bid Bot — Easy Apply wizard the bot submits by itself in Generate + Apply (and on the Dice filter by default). Use when an apply tab is on dice.com, the queue filter is Dice, or a Dice row errors/pauses.
---

# site-dice

**Hosts:** `*.dice.com` · **Adapter:** `dice` (stepBudget 12)
**Batch (Generate + Apply):** bot opens the Easy Apply wizard, fills, uploads, **submits**, marks Applied.
**Submit:** auto in batch. **Login:** Dice account in the Chrome profile.

## Flow
1. After files are built the bot opens the Dice wizard (`/job-applications/<id>`).
2. Contact (Dice profile) → resume (row `*_Resume.pdf`) → cover letter (row PDF; bot refuses to
   apply without a real cover PDF) → screener questions → Review → Submit.
3. Confirmation: "Your application is on its way" / already-applied banner → bot closes tab.
4. Blockers pause the batch (first attempt) — finish by hand, **Mark applied ✓**, Start.

## Known blockers
| Symptom | Class | Fix | Added |
|---------|-------|-----|-------|
| "Apply on company site" (external) | N | Follow to the employer ATS; use that host's skill; Mark applied | 2026-11-13 |
| Sign-in page instead of wizard | H | User signs in to Dice in this profile; Start | 2026-11-13 |
| Job no longer available | J | Bot marks inactive/skipped | 2026-11-13 |
| "Cover letter missing — regenerate cover" | B | Rebuild the row (cover PDF), then apply | 2026-11-14 |

## Validated 2026-11-15 (Avash, 2/2 submitted, no hand-off)
- Status trail: `generating row N` → resume JSON (may re-prompt for JD-skill bullets / ATS
  project-bank retry) → `Downloading …_Resume.pdf` → cover letter → `Appending row to Google Sheet`
  → `Done row N` → `Dice auto-apply` → upload → `clicking Next` → `Dice (2/12)` re-upload →
  `submitting (Submit)` → `Cooling down` (~41 s) → next row.
- ~3.5–5.5 min per job with a reasoning ChatGPT model; poll ~every 2 min, not faster.
- Verify with the sheet tab (`listRows` → `Applied M/D/YYYY h:mm`, Bid mode `Auto bid`) and the
  row folder (jd.txt + resume + cover). To cap a run, click **Stop** during the cooldown after
  the last wanted row is `applied`.
- Dice jobs come from the CSV (`jobs_latest.csv`); the sheet capture tab may have none.

## Notes
- Watch the first 2–3 Dice submits of a session to confirm they really land.
