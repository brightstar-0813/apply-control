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

## When a host repeats

Handled the same host twice → create `site-<name>` from `templates/site-skill/` (`blocker-fix` §3).
