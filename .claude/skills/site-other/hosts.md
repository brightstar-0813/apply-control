# site-other — host notes

Single sightings; promote to a `site-<name>` skill when a host repeats (`blocker-fix` §3).
**Read only the section for your host:** `Grep "^## " hosts.md` for line numbers, then `Read` that range.

## UKG / UltiPro (`recruiting.ultipro.com`)
`recruiting.ultipro.com/<tenant>/JobBoard/…/OpportunityDetail`: **Apply now** → `signin-us.ultipro.com`
(Auth0 log in / **Sign up**: email + password + Continue). The panel's Autofill fills **0**: `detectPageBlocker()` flags
any non-Workday password field as "sign-in form" before the credential fill runs. Until that is fixed (needs the
user's OK, since it touches account creation), skip the row and log it. (Frontier Energy, 2026-11-18)

## UKG careers (`apply.ukg.com`)
`apply.ukg.com/careers/apply?pid=<id>` (UKG #205, 2026-11-16). One page, no account.
Panel Autofill **puts the email into the Phone field** and leaves Email flagged: click the field's "Clear"
button, click the field, `type_text` (plain `fill` appends). A **Data Privacy Agreement** modal appears →
"I Agree" (leave job-recommendation emails unchecked). Comboboxes (Country code, Country, State, Yes/No
questions): click, `type_text` the option, then click the `[role=option]` inside the input's
`aria-controls` list. **Start date: "Today" is rejected** ("cannot be in the past", UKG's clock runs a day
ahead) → pick tomorrow. Two "I Accept" consents. Done = `/apply/success` "Thank you for your application".

## JazzHR (`*.applytojob.com`)
`<co>.applytojob.com/apply/<id>/<slug>`; board at `<co>.applytojob.com/apply`. One-page form, the in-page panel
detects it. Resume via "Attach resume". Yes/No answers are checkbox pairs. Required **X (Twitter)** field, many
required essay boxes, **SUBMIT APPLICATION** is a link. **Every form ends in a reCAPTCHA v2 checkbox** (human-only).
The bot fills the form and pauses "A CAPTCHA is on the page"; its own apply tab is closed when the batch moves on.
Routine (2026-11-18):
1. Read the bot's tab (ids `resumator-<field>-value`, questionnaire checkboxes `resumator-checkbox-<qid>-1|2`
   = No|Yes); check the **Cover Letter textarea** — it can hold another row's letter (stale-letter bug) — and that
   the row's own letter isn't cut mid-sentence.
2. Open the same URL (without utm) in the **work window**, set the text inputs by script (native setter +
   input/change), unhide `#resumator-resume-value` → `upload_file` → dispatch `change`, tick the Yes/No boxes the
   resume supports, EEO = exact values from `profiles/<id>.md` (never "Decline to answer"; unknown → ask).
3. Ask the user (`Q<n>`) to tick "I'm not a robot" + SUBMIT APPLICATION; Start twice to move the batch on.
4. On "Q<n> done" verify the confirmation text in that tab, then **Mark applied**.
Prison Fellowship (2026-11-18) also requires typing the full legal name to certify and that you have read their
**Statement of Faith** — a personal attestation: ask the user, never sign it.

## BambooHR (`*.bamboohr.com`)
`<co>.bamboohr.com/careers/<id>`: **Apply for This Job** shows a one-page form.
Custom "*" questions are often required (years-of-X, Trailblazer URL). Custom selects: click the button, then the
`[role=option]`. Match the education option exactly ("College - Bachelor of Science", not the first "Bachelor").
The essay textarea ignores `fill`, so click it and `type_text`. Ends with a visible **"I'm not a robot" reCAPTCHA**,
which is human-only. The Submit button sits in the dark footer bar. (USAC, 2026-11-15)

## Rippling (`ats.rippling.com`)
`ats.rippling.com/<co>/jobs/<id>` → **Apply now** → one page (`…/apply?step=application`). Bot fills most and stops
at "step limit".
- Upload the resume first: it parses name, email, phone, company, location. Re-snapshot after each upload (uids change).
- Dropdowns have no options in the a11y tree: click the combobox, ArrowDown and read `aria-activedescendant` until the
  right option is highlighted, then Enter. Hispanic/Latino listbox uses `[role=option]`.
- **Location must be picked from its Google Places suggestion list** ("Falls Church, VA, USA").
- Rating questions: Strong No / No / Yes / Strong Yes radios. Required custom essay → only from the master resume's facts.
  SMS radio; cover letter on the "Drop or select" button.
- **Apply is gated by an invisible Cloudflare Turnstile (`#turnstile-container`)**: a CDP click sends no submit request
  (only `cdn-cgi/challenge-platform` pings) → human-only; leave the filled tab and ask the user to click Apply. If the
  user closes the tab, Start reopens the row and the bot refills it (essay / cover letter / location need redoing).
(Offprem Technology 2026-11-15, e.Republic 2026-11-16.) EBizCharge (via SkipTheDrive) → see SkipTheDrive.

## Jobvite (`jobs.jobvite.com`)
`jobs.jobvite.com/<co>/job/<id>/apply` (Council Advisors #76, 2026-11-16): **Add Resume** opens an "Attachment Options"
dialog → `upload_file` on its ` File` button; same for **Add Cover Letter**; First / Last / Email; **Send Application**
→ `…/applyConfirmation` "Application Sent!". No account, no CAPTCHA seen. The panel shows *Allow auto submit* checked
here — fill by hand rather than panel Autofill if you need to review first.

## CareerPlug (`*.careerplug.com`)
`<co>.careerplug.com/jobs/<id>/apps/new`: one page, no account. Name / email / phone, SMS opt-in radio (rule 5),
Address / City / States combobox (fill "Virginia") / ZIP, Resume + Cover Letter "Upload File" buttons (`upload_file`
works), Recent Job Title / Employer (from the master resume, Avash = Senior Salesforce Specialist / Attain Partners).
**Submit Application** may open a reCAPTCHA v2 image challenge → user (rule 6) — but 2026-11-19 (Lewis) it went
straight to the thank-you page, so always try Submit before asking. Done = "Thank You, <name>! We have received your
information…" at `…/apps/<n>`. Tenant host is `ensisinfo-inc.careerplug.com` (`ensisinfo.` lands on CareerPlug's own
sign-in). Board has several pages: `fetch('/jobs?page=n')` from the tab and match the title to get `/jobs/<id>`.

## Dayforce (`jobs.dayforcehcm.com`)
`jobs.dayforcehcm.com/<co>/candidateportal/jobs/<id>/apply`: use **Apply without an Account**. The SMS dialog defaults
to "do not consent", so just Save. Reject cookies; if the Cookie Preference Center opens, Save it.
Flow: Candidate Info → Questionnaire (1..n pages) → Submit (acknowledgement checkbox + Submit). Invisible reCAPTCHA but
submitting worked.
- **Import Resume** parses name, email, phone, city and *all* employment rows. Each resume row opens as an edit form;
  they close on their own once you save personal info.
- Personal info: Confirm Email, LinkedIn, address, zip, then the antd selects (Preferred Contact, Country, State, How
  did you hear) and **Update Personal Information**. Country and State are searchable: focus, type, Enter. "How did you
  hear" isn't searchable: arrow to the option (ArrowUp wraps to the last one; "himalayas.app" is listed).
- Cover letter: the hidden `#jobPostingApplication_files_coverLetter` needs a style tweak before `upload_file`.
- Questionnaire text inputs sometimes ignore `fill`: focus by id, `type_text`, check the value length.
- Done: `/apply/success` "Congratulations… confirmation number …". References optional. (Parking Management Co, 2026-11-15)

## Oracle Cloud HCM (`*.fa.*.oraclecloud.com`)
`…/hcmUI/CandidateExperience/.../job/<id>` (e.g. SAIC): APPLY NOW → email + terms (click the label text; the checkbox
ignores clicks) → **6-digit code by email** ("Confirm your identity" from "<Co> Careers"; type it into digit box 1) →
one long page.
- **Inactivity timeout:** "Are You Still With Us?" signs you out after a few idle minutes → Search Jobs. Don't stop to
  ask mid-form: collect questions first, or expect to log back in (new code). The draft is kept.
- Import the resume first (contact, work history, education). Then delete wrong / extra rows (only the past 5 years of
  work; no certificates in education). Education needs Degree radio, Major (type + gridcell), Graduated, and a **full**
  date (month + year).
- Dropdowns are grids: click the combobox, then the `gridcell`. Address Line 1 is a lookup: type the street, pick the
  full "…, CITY, STATE, ZIP" cell.
- SAIC questions: gov employment status, work authorization, ex-SAIC, salary band, relocate, active clearance, veteran
  status, e-signature Full Name. Done = redirect to `my-profile` with "Application Received". (SAIC, 2026-11-15)

## ADP Workforce Now (`workforcenow.adp.com`)
`workforcenow.adp.com/mascsr/default/mdf/recruitment/recruitment.html?cid=…&jobId=…` (MyComputerCareer, Silotech
2026-11-15; Lewis 2026-11-18): **Apply** → name / email / mobile → **Continue** → "Get your verification code": pick the
**email** radio → code from `SecurityServices_NoReply@adp.com` ("Here's your verification code from ADP"; open the
**newest** one — threads group codes and the old code stays on top of the search for a while) → Verify. Each new apply
tab asks for its **own** code.
- Steps: Personal Information → Resume → Questions → Voluntary Self-ID → Review → Self-Attest & Submit. Later
  applications reuse the profile (address, Self-ID) — still check it.
- Board link can be a **closed copy** ("We are no longer accepting applications") → open **Current Openings** on the same
  `cid` and take the live `jobId`. The page only renders once its tab is in front (`select_page bringToFront`).
- **Continue** is an invisible-reCAPTCHA `sdf-button`: if nothing happens, reload the job URL, focus `#guestFirstName`
  by script, `type_text` each field with Tab, then Enter.
- The `click` tool fails on most ADP controls ("did not become interactive"): focus inputs by id from a script
  (`PersonalAddress_country`, `…_address_line1`, `…_city`, `…_postalCode`, `question_<n>`, `desiredSalaryId`) and
  `type_text`; radios are `sdf-radio-button#questionYes_<n>` / `#questionNo_<n>` → click the inner shadow `input`;
  State and currency are `sdf-select-simple` → click its shadow trigger, then `.click()` the `sdf-select-item`.
- Country combobox may be empty; choosing it **clears the address**. Then type Address Line 1 (Google Places),
  ArrowDown + Enter on the "…Falls Church, VA, USA" suggestion. SMS opt-in checkbox: focus + Space.
- Resume / attachments: unhide both `input[type=file]` via style, re-snapshot, `upload_file` (resume, then cover letter).
- **Sticky Previous / Finish later / Next bar overlaps fields**: scroll the target into the middle before clicking.
  Near the page bottom a click can land on **Finish later** (drops unsaved answers → My Applications → "Saved for Later"
  → Complete Your Application): open such dropdowns by **focus + Enter**, pick by snapshot uid, Escape before the next.
  Answers are stored only on **Next**.
- Multi-select questions: the menu closes after each pick; **click the combobox with the click tool** before each option
  (a script `click()` doesn't reopen it). Picked = "Remove <option>" buttons.
- Desired salary needs **currency USD** too. Self-attest: checkbox (focus + Space) **and** "Please type your full name".
- Done = "Thank You! We have received your application" or "Application Submitted!". Optional **WOTC** questionnaire → skip.

## Zoho Recruit (`*.zohorecruit.com`)
`<tenant>.zohorecruit.com/jobs/Careers/<id>` (VG & Partners via Himalayas 2026-11-16 → "I'm ready to apply"
interstitial → new tab). Job page → **I'm interested** → one-page form, no account (ignore "Easy Apply" sign-in). Panel
did not load; fill by hand: name, email, mobile (+1 preset), street, ZIP/City/State autocomplete comboboxes (type, then
Escape the menu), Country text, LinkedIn; Resume = `upload_file` on the "Resume" Browse block (some tenants hide the
`input[type=file]` — unhide via style). Salary may differ from Himalayas (use Zoho's posted range). **Image CAPTCHA
before Submit Application** → human-only: fill everything else, leave the tab open, ask.
blackfinconsult (2026-11-17): **Skill Set is required** — "Search and add skills", type "Salesforce", click the chip;
most jobs have Next → an "Assessment" step after the CAPTCHA. Job ids + titles are in the careers page's hidden `input`
JSON (`Posting_Title`, `id`); salary only on the job page.
xnrsolutions (2026-11-23, Avash #87): ZIP / City / State comboboxes and Skill Set lose focus with `click`+`type_text` (text goes nowhere) → use `fill` on the inner textbox; Skill Set: `fill` "Salesforce" then scripted mousedown/mouseup/click on the `li` "Salesforce" (chip appears). Required here: name, email, mobile, Country, Skill Set, **LinkedIn**, CAPTCHA. Resume input `rec-form_<id>_file` is hidden → unhide via style, then `upload_file`.

## SuccessFactors (`career8.successfactors.com`, e.g. NTT DATA `careers-inc.nttdata.com`)
(2026-11-19) Job page **Apply now → Apply Now** → `careers?company=<id>` shows **Create an Account** with a "Please sign
in" link (Sign In dialog). Panel **Autofill** fills the dialog; click the dialog's **Sign In** by script (snapshot uid
goes stale). "Invalid email address or password" = older account → **Forgot your password?** → Outlook "<Co> Password
Reset" (reset `<a>` is in the reading pane) → open in the apply tab → panel Autofill fills both boxes → Submit → back to
the job → Apply Now → sign in.
The application is **one page**, prefilled from the candidate profile — including the **old resume / cover letter**:
replace them (Resume "Edit document", Cover Letter "Delete document" → OK → "Attach a Cover Letter"; each opens
"Upload from Device" = `upload_file` on that button). Yes/No + source dropdowns: click the combobox's sibling `button`,
then mouse events on the `[role=option]` text. Date field takes `fill` "MM/DD/YYYY". Gender may come back empty →
exact value. NTT DATA asks **travel willingness + %** (Avash: Yes, 25 — profile file). **Apply** → next page is blank;
confirm in **View Profile → Jobs Applied (n)** (row "Under Review", today). The panel's run stops at Submit.

## arc.dev (`arc.dev`)
Job board, no adapter; the bot pauses on the listing ("No Next/Submit"). "Apply now" → `/remote-jobs/j/redirect/<id>`
→ employer / original board, or an **arc sign-up wall** (never sign up on a job board; linkedin.com → rule 11, skip).
The page source carries `"requiredCountries":["ES"]` (ISO codes) — pre-check pending arc.dev rows with
`fetch(<listing url>)` from the bot page and Remove rows without `US`. "Remote restrictions apply" hides the country:
read the JD or find the same title on the employer ATS (e.g. `boards-api.greenhouse.io/v1/boards/<co>/jobs`). US + ATS
found → apply there; else Mark skipped with the country. (Nubestic, Komodo Health 2026-11-16/18)

## SkipTheDrive (`skipthedrive.com`)
Aggregator, no adapter. The bot pauses with "Reached Submit (Search)" (reads the site search button as Submit). The
employer link is the **"Apply for this position"** anchor: open that host and continue with its skill. EBizCharge
(→ `ats.rippling.com/ebizcharge`) asks emergency contact, supervisor contact, reason for leaving, 3 references → not in
any profile → Mark skipped "needs references + emergency contact" (user 2026-11-15; same for Lewis 2026-11-19).

## arbeitnow (`arbeitnow.com`, `arbeitnow.co.uk`)
European board behind a Cloudflare "Just a moment…" page (bot: "No application form found"). The URL slug carries the
city (`…-london-220230`); UK / German employers → Mark skipped "non-US (<city>)". (2026-11-19)
