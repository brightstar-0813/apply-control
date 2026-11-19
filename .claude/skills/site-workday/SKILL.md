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
| Republic `republic.wd5` (6 steps, no Self Identify page): Voluntary Disclosures needs race, gender, veteran + T&C checkbox; My Experience needs only the resume | — | Gender / race / veteran: exact values from `profiles/<id>.md` (never "Prefer Not to Self-Identify" — user, 2026-11-18); unknown → ask | 2026-11-18 |
| Penn State `psu.wd1`: Application Questions list **restricted states** for remote work (full-time: AL, AK, AR, ID, IA, KS, LA, ME, MA, **MI**, MS, MT, NE, NV, NM, ND, OK, OR, RI, SD, UT, VT, WY) | N | Check the person's state before starting: Lewis (Michigan) → skip PSU rows; Avash (Virginia) was fine. Also: panel Autofill on psu.wd1 My Information jumps to Candidate Home → fill by hand (How Did You Hear: click the box, type "Other Job Site" + Enter) | 2026-11-18 |
| Existing tenant account, bot ATS password rejected (Leidos `leidos.wd5`): Create Account just redirects to `/login`; Sign In says "wrong email address or password or your account might be locked" | W | No ask needed (user 2026-11-19): **Forgot your password?** → email → Outlook "Reset your password for your candidate account" (the list preview shows the full `…/passwordreset/<token>/` URL) → open `/en-US/<site>/passwordreset/<token>/` in the apply tab → panel Autofill fills both boxes → Submit (scripted click on the sibling `click_filter`) → sign in with panel Autofill | 2026-11-19 |
| Panel Autofill after sign-in keeps running in the background (16 steps): it left the form for the job search and clicked the pager "next" as a wizard Next; the tab kept jumping to `/External` until the run ended | D | Pager fixed in bot 1576f21. Still: after a sign-in Autofill, wait until `generation_status` stops changing ("Could not advance…") before touching the form, then fill by hand; don't click Autofill on My Information | 2026-11-19 |
| Leidos `leidos.wd5` (6 steps): wants **7 years of work history** (6 jobs from the master resume, dates MM/YYYY: focus the Month / Year input and `document.execCommand('insertText')` each separately), Education (school + Field of Study = type + Enter, then click the exact option), 13 government / clearance questions, "position requires U.S. citizenship", Voluntary Disclosures (Gender / race / veteran) | — | Answers in `profiles/avash-chapagain.md` (Leidos block). Dropdowns: click the button, then mouse events on the option in the **single visible** listbox; never loop over all dropdowns with Escape (lists stay open and a wrong value gets picked). Reload = back to step 1, saved steps stay. Done = Candidate Home "Submitted <date>" | 2026-11-19 |
| Workday page renders blank / spinner for 20–40 s (or stays blank after sign-in) in an unfocused work window | A | Wait, then re-open the `/apply` URL; use `textContent` reads; clicks that fail with "did not become interactive" → scripted mouse events on the control (footer buttons: the sibling `[data-automation-id=click_filter]`) | 2026-11-19 |
