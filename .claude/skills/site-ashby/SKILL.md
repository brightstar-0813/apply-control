---
name: site-ashby
description: How to apply on Ashby (jobs.ashbyhq.com, *.ashbyhq.com) with BrightStar Bid Bot — single-page React form, yes/no button questions, resume autofill, bot submits in Generate + Apply. Use when an apply tab is on ashbyhq.com or an Ashby row pauses.
---

# site-ashby

**Hosts:** `*.ashbyhq.com` · **Adapter:** `ashby` (stepBudget 14)
**Batch (Generate + Apply):** bot fills and **submits**. **Login:** none.

## Flow
1. Job → **Application** tab → form.
2. Optional "Autofill from resume" — upload, then verify; panel fills the rest.
3. Yes/No questions are buttons, not radios — click by label.
4. Submit → "Thanks for applying". If Claude submitted: **Mark applied ✓** → Start.

## Known blockers
| Symptom | Class | Fix | Added |
|---------|-------|-----|-------|
| Yes/No buttons not set | D | Click by accessible name; fix in `content/autofill.js` if repeatable | 2026-11-13 |
