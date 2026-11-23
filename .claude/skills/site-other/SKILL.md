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
