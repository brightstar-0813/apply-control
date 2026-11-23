---
name: site-indeed
description: How to apply on Indeed (indeed.com, smartapply.indeed.com) with BrightStar Bid Bot — hosted "Apply on Indeed" the bot can submit vs external company links it never submits, Grab & auto-apply, rate-limit care. Use when an apply tab is on indeed.com, the user wants Indeed grab, or an Indeed row pauses.
---

# site-indeed

**Hosts:** `*.indeed.com`, `smartapply.indeed.com` · **Adapter:** `indeed` · hosted/external: `indeed.js`
**Batch (Generate + Apply):** hosted rows → bot submits. External rows (board "Indeed external")
→ bot fills with submit **withheld** and pauses → Claude finishes on the employer ATS if the profile allows.
**Login:** Indeed account in the Chrome profile.

## Flow
1. Rows from the sheet, or the user selects a job in Indeed search and Claude clicks
   **Grab & auto-apply** (`#indeedGrabApply`) / **Grab to queue only** (`#indeedGrabOnly`).
2. Hosted (SmartApply): contact → resume → screener questions → review → Submit.
   Confirmation: "Your application has been submitted".
3. External ("Apply on company site"): follow to the employer site → that host's skill →
   submit only if the profile allows → **Mark applied ✓** → Start.

## Known blockers
| Symptom | Class | Fix | Added |
|---------|-------|-----|-------|
| Cloudflare / "verify you are human" | H | User solves; slow down for the rest of the session | 2026-11-13 |
| Required screener with no Q&A match | A | Answer truthfully / ask; save to Q&A bank | 2026-11-13 |
| External link | P/N | Bot never submits; Claude finishes on employer ATS if allowed | 2026-11-14 |
| SmartApply opens straight at **Review** with the resume Indeed stored from an earlier application; "Edit resume" / "Add supporting documents" in the review preview frame don't respond and `/form/resume-selection-module/...` redirects back to review | P | The stored file is still the person's real resume → submit with it (log it). Confirmation = "has been submitted!" on `/form/post-apply` (C.A.S.E. #149, Avash) | 2026-11-23 |

## Notes
- Keep Indeed volume low and slow — rapid activity triggers anti-automation.
