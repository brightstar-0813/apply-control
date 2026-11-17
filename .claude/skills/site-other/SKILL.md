---
name: site-other
description: Host → site-skill routing table for BrightStar Bid Bot apply tabs, plus the generic playbook for any job site or employer ATS without a dedicated skill (iCIMS, Taleo, SuccessFactors, BambooHR, SmartRecruiters, Jobvite, UltiPro, custom careers pages). Use when the batch paused on a row whose host doesn't match another site skill, or to pick the right site skill.
---

# site-other

## Routing table (host → skill)

| Host pattern | Skill | Bot in Generate + Apply |
|--------------|-------|-------------------------|
| `dice.com` | site-dice | submits |
| `indeed.com`, `smartapply.indeed.com` | site-indeed | hosted submits · external pauses |
| `greenhouse.io` | site-greenhouse | submits |
| `myworkdayjobs.com`, `workdayjobs.com` | site-workday | submits |
| `lever.co` | site-lever | submits |
| `ashbyhq.com` | site-ashby | submits |
| `jobgether.com` | site-jobgether | submits on employer ATS |
| `linkedin.com` | — **never apply** (CLAUDE.md rule 11) | not applied |
| `jobright.ai` | site-jobright | pauses |
| `himalayas.app` | site-himalayas | pauses |
| `builtin.com` | site-builtin | pauses |
| `recruiting.paylocity.com` | site-paylocity | pauses (hand finish) |
| anything else | this skill | pauses |

(When `blocker-fix` creates a new `site-*` skill, add its host here.)

## Generic flow (paused row on an unknown host)

1. Panel present? (`[data-brightstar-autofill-panel]`; manifest covers icims, taleo,
   successfactors, bamboohr, smartrecruiters, jobvite, ultipro.) Otherwise fill by hand with
   `take_snapshot` + `fill` / `click` / `upload_file`.
2. Find the apply entry (Apply / Apply now / I'm interested); prefer guest apply.
3. Contact from the bot person, resume (+ cover letter) from the row folder, questions from
   profile / Q&A bank / user, EEO per profile.
4. Submit only if the profile allows → confirmation page → row **Mark applied ✓** → Start.

## Host notes (single sightings; promote to a site skill on repeat)

- **BambooHR** (`<co>.bamboohr.com/careers/<id>`): **Apply for This Job** shows a one-page form.
  Custom "*" questions are often required (years-of-X, Trailblazer URL). Custom selects: click the button, then the
  `[role=option]`. Match the education option exactly ("College - Bachelor of Science", not the first "Bachelor").
  The essay textarea ignores `fill`, so click it and `type_text`. Ends with a visible **"I'm not a robot" reCAPTCHA**,
  which is human-only. The Submit button sits in the dark footer bar. (USAC, 2026-11-15)
- **Rippling** (`ats.rippling.com/<co>/jobs/<id>`): **Apply now** opens a one-page form (`…/apply?step=application`).
  Uploading the resume parses it into name, email, phone, company and location, so upload it first. Re-snapshot after
  each upload, because uids change. Dropdowns have no options in the a11y tree: click the combobox, then use ArrowDown and
  read `aria-activedescendant` until the right option is highlighted, then Enter. Location is a Google Places box:
  type "City, ST" and pick the suggestion. Rating questions use Strong No / No / Yes / Strong Yes radios.
  **An invisible Cloudflare Turnstile is on the page (`#turnstile-container`):** a CDP click on **Apply** sends nothing
  (no POST, no error), so it's human-only. Ask the user to click Apply. (Offprem Technology, 2026-11-15)
- **Jobvite** (`jobs.jobvite.com/<co>/job/<id>/apply`): short form (Council Advisors #76, 2026-11-16): **Add Resume** opens an "Attachment Options" dialog → `upload_file` on its ` File` button; same for **Add Cover Letter**; First / Last / Email; **Send Application** → `…/applyConfirmation` "Application Sent!". No account, no CAPTCHA seen. The in-page panel shows *Allow auto submit* checked here — fill by hand rather than panel Autofill if you need to review first.
- **CareerPlug** (`<co>.careerplug.com/jobs/<id>/apps/new`): one page, no account. Name / email / phone, SMS opt-in radio (rule 5), Address / City / States combobox (fill "Virginia") / ZIP, Resume + Cover Letter "Upload File" buttons (upload_file works), Recent Job Title / Employer (from the master resume, Avash = Senior Salesforce Specialist / Attain Partners). **Submit Application** opens a reCAPTCHA v2 image challenge → user (rule 6). Done = "Thank You, <name>! We have received your information…" at `…/apps/<n>` (Ensisinfo #74, 2026-11-16).
- **Dayforce** (`jobs.dayforcehcm.com/<co>/candidateportal/jobs/<id>/apply`): use **Apply without an Account**. The SMS dialog
  defaults to "do not consent", so just Save. Reject cookies; if the Cookie Preference Center opens, Save it.
  The flow is Candidate Info → Questionnaire (1..n pages) → Submit (acknowledgement checkbox + Submit). It has an
  invisible reCAPTCHA but submitting worked.
  - **Import Resume** (upload to that button) parses name, email, phone, city and *all* employment rows. Each
    resume row opens as an edit form; they close on their own once you save personal info.
  - Personal info: Confirm Email, LinkedIn, address, zip, then the antd selects (Preferred Contact, Country, State,
    How did you hear) and **Update Personal Information**. Country and State are searchable: focus the input,
    type, then Enter. "How did you hear" isn't searchable: arrow to the option (ArrowUp wraps to the last one;
    "himalayas.app" is listed).
  - Cover letter: the hidden `#jobPostingApplication_files_coverLetter` needs a style tweak before `upload_file`.
  - Questionnaire text inputs sometimes ignore `fill`: focus the input by id, `type_text`, then check the value length.
  - Done page: `/apply/success` "Congratulations… confirmation number …". References are optional. (Parking Management Co, 2026-11-15)

- **Oracle Cloud HCM** (`*.fa.*.oraclecloud.com/hcmUI/CandidateExperience/.../job/<id>`, e.g. SAIC): APPLY NOW → email
  + terms (click the label text; the checkbox ignores clicks) → **6-digit code by email** ("Confirm your identity" from
  "<Co> Careers"; type it into digit box 1) → one long page.
  - **Inactivity timeout:** "Are You Still With Us?" signs you out after a few idle minutes, and you land on Search Jobs.
    Don't stop to ask the user mid-form: collect questions first, or expect to log back in (new code). The draft is kept.
  - Import the resume first: it fills contact info, work history and education. Then delete wrong or extra rows (only
    the past 5 years of work; no certificates in education). Education needs Degree radio, Major (type + gridcell),
    Graduated, and a **full** date (month + year).
  - Dropdowns are grids: click the combobox, then the `gridcell`. Address Line 1 is a lookup: type the street, pick the
    full "…, CITY, STATE, ZIP" cell.
  - SAIC questions: gov employment status, work authorization, ex-SAIC, salary band, relocate, active clearance,
    veteran status, e-signature Full Name. Done = redirect to `my-profile` with "Application Received".
    (SAIC, 2026-11-15)

- **ADP Workforce Now** (`workforcenow.adp.com/mascsr/default/mdf/recruitment/recruitment.html?cid=…&jobId=…`), seen twice
  (MyComputerCareer, Silotech, 2026-11-15): **Apply** → name / email / mobile → **Continue** → "Get your verification code":
  pick the **email** radio → code from `SecurityServices_NoReply@adp.com` ("Here's your verification code from ADP"; open the
  newest one, the preview may hide the code) → Verify.
  - Steps: Personal Information → Resume → Questions → Voluntary Self-ID → Review → Self-Attest & Submit.
  - Personal info: Country combobox may be empty; choosing it **clears the address**. Then type Address Line 1 (Google Places),
    ArrowDown + Enter on the "…Falls Church, VA, USA" suggestion → city/state/zip/county fill. SMS opt-in checkbox: focus + Space.
  - Resume/attachments: unhide both `input[type=file]` via style, re-snapshot, `upload_file` (resume, then cover letter).
  - **The sticky Previous / Finish later / Next bar overlaps fields**: scroll the target into the middle before clicking or you
    hit Previous (answers survive). Near the page bottom the field can't scroll clear of the bar and a click lands on
    **Finish later** (drops unsaved answers, back to My Applications → "Saved for Later" → Complete Your Application):
    open such dropdowns by **focus + Enter** instead, pick the option by snapshot uid, press Escape before the next one.
    Answers are stored only on **Next**.
  - Each new apply tab asks for its **own** email code, even with another ADP tab signed in. Outlook search
    `SecurityServices_NoReply@adp.com` and open the **newest time** (threads group codes; the old code stays on top of the
    "verification code" search for a while). Later applications reuse the profile (address, Self-ID) — still check it.
  - Multi-select questions (e.g. "Which Salesforce certification(s)"): the menu closes after each pick; **click the
    combobox with the click tool** before each option (a script `click()` doesn't reopen it). Picked = "Remove <option>" buttons.
  - Questions: radios + text; desired salary needs **currency USD** too. Self-attest: checkbox (focus + Space) **and** a
    "Please type your full name" box before Submit.
  - Done = "Thank You! We have received your application" or "Application Submitted!". An optional **WOTC** tax-credit
    questionnaire may follow; skip it.
- **Zoho Recruit** (`<tenant>.zohorecruit.com/jobs/Careers/<id>`, seen 2026-11-16 VG & Partners via Himalayas
  → "I'm ready to apply" interstitial → new tab). Job page → **I'm interested** → one-page form, no account
  needed (ignore "Easy Apply" sign-in). The bot panel did not load there; fill by hand: name, email, mobile
  (+1 preset), street, ZIP/City/State are autocomplete comboboxes (type the value, then Escape the menu),
  Country text, LinkedIn; Resume = `upload_file` on the "Resume" Browse block. Salary on Zoho may differ from
  Himalayas (use Zoho's posted range). **Image CAPTCHA before Submit Application** → human-only: fill everything
  else, leave the tab open, ask in Slack.

- **Rippling** (`ats.rippling.com/<tenant>/jobs/<id>/apply`, seen 2026-11-16 e.Republic). One page; bot
  fills most and stops at "step limit". Finish by hand: required custom essay (write it only from the
  master resume's facts), Hispanic/Latino listbox (`[role=option]`), SMS radio, cover-letter upload on the
  "Drop or select" button, and **Location must be picked from its suggestion list** ("Falls Church, VA, USA").
  **Apply is gated by Cloudflare Turnstile**: our click sends no submit request (only `cdn-cgi/challenge-
  platform` pings) → human-only; leave the filled tab and ask the user to click Apply. If the user closes
  the tab, Start reopens the row and the bot refills it (essay/cover letter/location need redoing).

- **arc.dev** (`arc.dev/remote-jobs/j/<slug>`, seen 2026-11-16 Nubestic, Komodo Health). Job board; "Apply now" →
  `/redirect/<key>` → **arc sign-up wall** (never sign up on a job board). Bot pauses with "No Next/Submit button".
  "Remote restrictions apply" hides the country: read the JD text (Nubestic = "100% remoto desde España") or find the
  same title on the employer ATS (Komodo: `boards-api.greenhouse.io/v1/boards/<co>/jobs` → location India). US + ATS
  found → apply there; else Mark skipped with the country.

- **UKG careers** (`apply.ukg.com/careers/apply?pid=<id>`, seen 2026-11-16 UKG #205). One page, no account.
  Panel Autofill **puts the email into the Phone field** and leaves Email flagged: click the field's "Clear"
  button, click the field, `type_text` (plain `fill` appends). A **Data Privacy Agreement** modal appears →
  "I Agree" (leave job-recommendation emails unchecked). Comboboxes (Country code, Country, State, Yes/No
  questions): click, `type_text` the option, then click the `[role=option]` inside the input's
  `aria-controls` list. **Start date: "Today" is rejected** ("cannot be in the past", UKG's clock runs a day
  ahead) → pick tomorrow. Two "I Accept" consents. Done = `/apply/success` "Thank you for your application".

## When a host repeats

Handled the same host twice → create `site-<name>` from `templates/site-skill/` (`blocker-fix` §3).
