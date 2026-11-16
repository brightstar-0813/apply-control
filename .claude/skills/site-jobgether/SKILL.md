---
name: site-jobgether
description: How to apply via Jobgether (jobgether.com) with BrightStar Bid Bot — aggregator whose APPLY link goes straight to the employer's ATS (Paylocity, Breezy, Workday, Greenhouse, …); the bot opens that URL directly (never clicks APPLY, never signs up) and submits only where an adapter exists. Many listings are LATAM/India-remote. Use when an apply tab is on jobgether.com, the queue filter is Other with Jobgether rows, or a Jobgether row pauses.
---

# site-jobgether

**Hosts:** `*.jobgether.com` · **Adapter:** `jobgether` (stepBudget 18) · filter: **Other** (`#filterEtc`)
**Batch (Generate + Apply):** bot reads the job page's external **APPLY** href and opens the
employer ATS directly ("Apply: Jobgether → <host>…"). Adapter ATS (Workday, Greenhouse, Lever,
Ashby) → bot submits. Anything else (Paylocity, Breezy, custom) → bot fills, then pause → Claude.
**Login:** none needed — APPLY is a plain link. Only Jobgether's own AUTO APPLY needs an account.
**Never** create a Jobgether account (no sign-up, no "Continue with Google/LinkedIn").

## Review before Start (most Jobgether rows are not US roles)
- Read each JD's location line: "100% Remote from **LATAM**", "Remote – **India**" (US shift on IST),
  "remote from LATAM" → remove for US-based people. Check before building files.
- Same company + same requisition number in several rows (e.g. In All Media 2151/2152/2155) →
  keep one.
- Non-engineering titles (Product Manager, QA/AQA) → remove for SF developer tracks.

## Flow
1. Bot builds files → "Jobgether auto-apply: row N" → "Apply: Jobgether → <employer host>…".
2. Employer form: upload + fill. Paused → finish per `site-other` (or that host's skill), Submit only
   if the profile allows, confirm the thank-you page, **Mark applied ✓**, Start.

## Known blockers
| Symptom | Class | Fix | Added |
|---------|-------|-----|-------|
| Employer link lands on `apply.workable.com/<co>/?not_found=true` (job closed; page is the company board) | J | Bot fix 60c99cb (2026-11-16): URL check → inactive-job skip. Before it, the bot "filled" the board and paused 3×; Skip does nothing on an apply-step pause, Start until attempts (3) run out |
| Bot clicked footer "AI CV Review" → sign-in page | D (bot bug) | Fixed 2026-11-15: footer/nav links and "CV/resume review" labels are never form steps | 2026-11-15 |
| "Submit was clicked…" on the job page / "report this job" radios in the panel | D (bot bug) | The hidden report-job modal was taken for a form. Fixed: on `/offer/` pages the only step is APPLY. If seen again: Stop at once | 2026-11-15 |
| "Create your Jobgether account" modal filled with name/email/**password** | D (bot bug) | Clicking APPLY while signed out opens a sign-up wall. Fixed: bot no longer clicks APPLY, it opens the href. If seen: Stop, clear the password field (it is inside an `auth.jobgether.com` iframe — use `fill`), close without Sign up | 2026-11-15 |
| Employer form answers invented (e.g. "$40/hour" rate) or cover-letter field contains `<WritingBlock …>` markup | B | Don't submit; fix answers from profile/Q&A or ask; clear junk text | 2026-11-15 |
| Audio/video intro required (Vocaroo etc.) | H | User only — skip or ask | 2026-11-15 |
