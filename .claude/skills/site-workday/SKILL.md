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
2. Sign in / create account for the tenant via `slack-chat` → Account walls (Chrome-suggested
   password; email verification = H, asked in Slack).
3. My Information → My Experience (resume) → Application Questions → Voluntary Disclosures →
   Self Identify → Review → Submit.
4. Each step: fill → resolve REQUIRE_USER (profile / Q&A / ask) → Save and Continue.
5. Confirmation: "Application Submitted". If Claude submitted: **Mark applied ✓** → Start.

## Known blockers
| Symptom | Class | Fix | Added |
|---------|-------|-----|-------|
| Accenture (`accenture.wd103`) Sign In is a modal ("Sign in with Google" / "Sign in with email"); clicking the in-page panel resets it, so panel Autofill never sees the email/password fields | W | Existing account: ask the user to sign in, then continue; or fix the panel so its clicks do not blur the modal (#103) | 2026-11-16 |
| Existing account, bot ATS password rejected (Cencora `myhrabc.wd5`) | W | "Forgot your password?" needs a **terminal** OK (a Slack OK was blocked by the permission check) | 2026-11-16 |
| Create account + email verification | A/H | Slack "Q create" → Claude signs up with Chrome-suggested password; user clicks the verification link (Gmail connector only if user agrees) | 2026-11-15 |
| Date / phone format rejected | D | `autofill-workday-format.js`; fix there if repeatable | 2026-11-13 |
| Save and Continue loops | D | Snapshot red error text; fill the flagged field | 2026-11-13 |
| Create Account for a tenant | A | Password from the user (never written to files). Verify link "Verify your candidate account" from Workday lands in the person's mailbox; Avash's Outlook shows **pinned mail first**, so search the subject. Open the `…/activate/<token>` link in the apply tab → "Account Activated" → Sign In | 2026-11-15 |
| Panel Autofill keeps clicking Save and Continue while "How Did You Hear" / State are empty | D | Cancel the panel; set the dropdowns by hand: click the button, `type_text` the option + Enter (e.g. "Virginia", "Job Board") | 2026-11-15 |
| My Experience resume "Select files" won't take `upload_file` | A | Unhide `input[type=file]` (`data-automation-id=file-upload-input-ref`) via style, re-snapshot, upload to the "Choose Files" button | 2026-11-15 |
| Date spinbuttons (MM/DD/YYYY) ignore click | A | Focus the Month input via script, `type_text` "MMDDYYYY" | 2026-11-15 |
| T&C consent checkbox ignores click | A | Focus it via script, press Space | 2026-11-15 |
| Done | — | Redirects to Candidate Home: "My Applications … Application Received" (Republic Services, 2026-11-15) | 2026-11-15 |
