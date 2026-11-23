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
| anything else | this skill (+ `hosts.md` section if listed below) | pauses |

(When `blocker-fix` creates a new `site-*` skill, add its host here.)

## Hosts with notes in `hosts.md`

UKG / UltiPro (`recruiting.ultipro.com`) · UKG careers (`apply.ukg.com`) · JazzHR (`*.applytojob.com`) ·
BambooHR · Rippling (`ats.rippling.com`) · Jobvite · CareerPlug · Dayforce · Oracle Cloud HCM
(`*.oraclecloud.com`) · ADP Workforce Now · Zoho Recruit · SuccessFactors · arc.dev · SkipTheDrive · arbeitnow

**Read only your host's section:** `Grep "^## " hosts.md` → line numbers → `Read` with offset/limit.
Never load the whole file. Add new single-sighting notes there as a `## Name (host)` section.

## Generic flow (paused row on an unknown host)

1. Panel present? (`[data-brightstar-autofill-panel]`; manifest covers icims, taleo,
   successfactors, bamboohr, smartrecruiters, jobvite, ultipro.) Run `bot-operate` script C to see
   empty required fields; otherwise fill by hand (`take_snapshot` + `fill` / `click` / `upload_file`).
2. Find the apply entry (Apply / Apply now / I'm interested); prefer guest apply.
3. Contact from the bot person, resume (+ cover letter) from the row folder, questions from
   profile / Q&A bank / user, EEO = exact values per profile (never Decline / Prefer not to say; unknown → ask).
4. Submit only if the profile allows → confirmation (`bot-operate` script D) → row **Mark applied ✓** → Start.

## When a host repeats

Handled the same host twice → create `site-<name>` from `templates/site-skill/` (`blocker-fix` §3).

## ADP Workforce Now recruiting (`myjobs.adp.com` → `recruiting.adp.com/srccar`) — added 2026-11-23
Email → 6-digit code (Outlook "Here's your verification code from ADP") → privacy dialog **Agree** → wizard.
Next = round blue arrow `.appGo` (scripted mousedown/mouseup/click). Dojo dropdowns = `table[id^=uniqName]`:
click it, then the item inside `<id>_menu`. An **"Errors Found"** dialog (`.dojoxDialogCloserIcon`) swallows
typing until closed; `fill` works on text boxes once it is closed. Preliminary questions appear one at a time
(click the LAST Yes/No). The application form needs at least the current employer, education and the
e-signature (name + Accept). Done = "Thank you! We have all the information we need … Req <n>". (SCA #60, Avash)

### ADP Workforce Now careers (`workforcenow.adp.com/mascsr/.../recruitment.html`) — added 2026-11-23
Different from `recruiting.adp.com`. Built In "APPLY" (`?handler=ApplyRedirect`) lands here. **Apply** →
first/last/email/mobile → Continue → pick the **email** radio → Send → 6-digit code from Outlook → Verify.
Steps: Personal Information → Resume (+ Attachments = cover letter) → Questions → Voluntary Self-ID → Review →
Self-Attest & Submit. Pitfalls: choosing **Country** (combobox: type "United States", click the option)
**clears Address/City/Zip/County** — refill after, then State button → "VA - Virginia". Desired salary needs
the **currency** button → "United States Dollar ( USD )" or Next fails. Cert questions are multi-select (reopen
the combobox per pick; unlisted certs → "Other Salesforce certification"). Self-ID may be prefilled from an
earlier ADP profile — verify, never tick "I decline". Final step: e-sign checkbox **and** typed full name.
Done = "Thank You! We have received your application." (Tripoint #75, Avash)
