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

## Notes
- Watch the first 2–3 Dice submits of a session to confirm they really land.
