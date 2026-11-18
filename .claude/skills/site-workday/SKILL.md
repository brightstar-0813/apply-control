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
| New account → "An email has been sent to you. Please verify your account." (IRC theirc.wd1) | W | Outlook: "Verify your candidate account" — the activate URL is **plain text** in the body (no `<a>`), regex it out and open it in the Workday tab → "Account Activated" → Sign In with panel Autofill | 2026-11-16 |
| After sign-in, `/job/.../apply/applyManually` URLs bounce to the job list / Candidate Home | D | Use the search: `<site>?q=<JR id>` → open the posting → Apply → Apply Manually | 2026-11-16 |
| Multiselect "How Did You Hear" opens a **sub-list** after the first pick (e.g. Social and Online Postings → Glassdoor/Indeed/…) | A | Click the category, then the leaf option by snapshot uid; the first leaf shows `selected` = focus only, check the "1 item selected, X" description | 2026-11-16 |
| Race options are numbered ("4 - Asian (United States of America)") | A | Match by substring, not `^Asian` (a miss left "Native Hawaiian…" selected) | 2026-11-16 |
| Disability CC-305 checkboxes ignore click / label click | A | Focus the input and press Space (same as T&C) | 2026-11-16 |
| Sign In modal closes when the panel (or the bot window) is clicked, so Autofill fills nothing (Republic `republic.wd5`) | A | Job → **Apply → Apply Manually** shows Create Account/Sign In **on the page** (no modal); click the page's "Sign In" link there, or submit Create Account for an existing account → redirects to full-page `/login` → panel Autofill → Sign In works | 2026-11-17 |
| Dropdown option won't select (type + Enter does nothing, options not in snapshot) | A | Open the listbox, then dispatch pointerover/pointerdown/mousedown/pointerup/mouseup/click on the `[role=option]` with the exact text; verify the button's aria-label | 2026-11-17 |
| Panel Autofill on the full-page Create Account opens a **Sign In modal on top** (it presses the header Sign In) | A | Close the modal; the page's Create Account form is filled → click its **Create Account** → "An email has been sent" → Outlook "Verify your candidate account" (activate URL = plain text in the reading pane, the list preview truncates it with "…") → open it in the Workday tab → "Account Activated" → panel Autofill signs in (Republic, Lewis) | 2026-11-18 |
| After that sign-in the panel's Workday run keeps going on its own: it presses **Save and Continue** on later steps while you are still filling (steps 2→3→4 advanced by themselves) | D (open) | After each step check `progressBarActiveStep`; go **Back** and verify date / salary / uploads on the step it skipped; the Review page lists everything. Type into a field only right after focusing it by script | 2026-11-18 |
| Workday tab not the active tab of its window → `innerText` is empty and steps don't render | A | Activate it (`chrome.tabs.update(id,{active:true})` from the bot page, in a window that is **not** the ChatGPT window); use `textContent` for reads | 2026-11-18 |
| Republic `republic.wd5` (6 steps, no Self Identify page): Voluntary Disclosures needs race, gender, veteran + T&C checkbox; My Experience needs only the resume | — | Unknown gender/race → "Prefer Not to Self-Identify"; veteran from the profile | 2026-11-18 |
| Penn State `psu.wd1`: Application Questions list **restricted states** for remote work (full-time: AL, AK, AR, ID, IA, KS, LA, ME, MA, **MI**, MS, MT, NE, NV, NM, ND, OK, OR, RI, SD, UT, VT, WY) | N | Check the person's state before starting: Lewis (Michigan) → skip PSU rows; Avash (Virginia) was fine. Also: panel Autofill on psu.wd1 My Information jumps to Candidate Home → fill by hand (How Did You Hear: click the box, type "Other Job Site" + Enter) | 2026-11-18 |
