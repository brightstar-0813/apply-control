---
name: site-builtin
description: How to handle Built In (builtin.com and city sites) jobs with BrightStar Bid Bot — job board with no adapter; in Generate + Apply the bot opens the listing and pauses, Claude clicks through to the employer ATS and finishes. Use when a row or tab is on builtin.com, the queue filter is Builtin, or the batch paused on a Builtin row.
---

# site-builtin

**Hosts:** `*.builtin.com` · **Adapter:** none (filter `#filterBuiltin`)
**Batch (Generate + Apply):** bot opens the listing and pauses → Claude finishes. **Login:** optional.

## Flow
1. Paused row → job tab. Read the location ("Hiring Remotely in <State>") and the eligibility lines
   (US citizen, Public Trust, clearance) against the bot profile.
2. **Apply** (`?handler=ApplyRedirect`) sends signed-out users to `?applyRequired=true`, a bottom bar
   asking for First/Last/Email + **Continue**. That creates a Built In profile, so treat it as a login wall
   (rule 6): don't submit it without the user's OK.
3. Instead, find the role on the **employer's own careers page** (company name / "Company website"
   on the listing → their Careers / Employment page → the ATS link). Example: USAC →
   `usac.edu/usac/employment` → `usac.bamboohr.com/careers/260`.
4. Continue with the target host's skill (or `site-other`), using the row folder's files. **Mark applied ✓** → Start.
5. Not found on the employer's site → leave the listing tab open, note it, and move on
   (Start twice uses up the row's 3 apply attempts; **Skip** while paused does not).

## Known blockers
| Symptom | Class | Fix | Added |
|---------|-------|-----|-------|
| Apply → "applyRequired" name/email bar | H | Employer careers page instead; Built In sign-up only with the user's OK | 2026-11-15 |
| Logged out, but the person has a Built In account (Avash does) | A | **Log In** → email → **magic link** ("One-time login link to Built In" in the person's mailbox; no password). Open `accounts.builtin.com/token/<t>` in the same tab, then Apply redirects straight to the employer ATS | 2026-11-15 |
| SAIC listing not found by searching SAIC's careers site | A | Logged-in Apply went to SAIC Oracle HCM `eihu.fa.us8.oraclecloud.com/.../job/2619048` (see site-other: Oracle HCM) | 2026-11-15 |
| Bot: "No Next/Submit button detected" on the listing | expected | No adapter. Do the flow above | 2026-11-15 |
| Listing company is a brand of a larger employer (Spectrum San Diego = SAIC) | A | Search the parent's careers site; SAIC's search didn't turn it up → skipped | 2026-11-15 |
