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
| Location autocomplete rejects typed text | D | Type, wait for listbox, pick the option | 2026-11-13 |
