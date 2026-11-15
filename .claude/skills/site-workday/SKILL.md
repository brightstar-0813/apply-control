---
name: site-workday
description: How to apply on Workday career sites (*.myworkdayjobs.com, *.workdayjobs.com) with BrightStar Bid Bot — per-tenant accounts, multi-step wizard, workday-engine field policy, bot submits in Generate + Apply. Use when an apply tab is on a Workday host, the queue filter is Workday, or a Workday row pauses.
---

# site-workday

**Hosts:** `*.myworkdayjobs.com`, `*.workdayjobs.com` · **Adapter:** `workday` (stepBudget 16)
**Batch (Generate + Apply):** bot walks the wizard and **submits** (adapter allows it). Sensitive
fields follow `content/workday-engine.js` (ALLOW / REQUIRE_USER / BLOCK) — never invented; a
REQUIRE_USER field pauses the batch.
**Panel:** the in-page panel's own "Allow auto submit" (`workdayAllowSubmit`) defaults off — that's
for manual panel runs, not the batch.
**Login:** a separate account **per tenant**.

## Flow
1. Job page → Apply → prefer **Apply Manually** over "Autofill with resume".
2. Sign in / create account for the tenant (email verification = H).
3. My Information → My Experience (resume) → Application Questions → Voluntary Disclosures →
   Self Identify → Review → Submit.
4. Each step: fill → resolve REQUIRE_USER (profile / Q&A / ask) → Save and Continue.
5. Confirmation: "Application Submitted". If Claude submitted: **Mark applied ✓** → Start.

## Known blockers
| Symptom | Class | Fix | Added |
|---------|-------|-----|-------|
| Create account + email verification | H | User verifies (Gmail connector only if user agrees) | 2026-11-13 |
| Date / phone format rejected | D | `autofill-workday-format.js`; fix there if repeatable | 2026-11-13 |
| Save and Continue loops | D | Snapshot red error text; fill the flagged field | 2026-11-13 |
