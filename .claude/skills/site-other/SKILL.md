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

## When a host repeats

Handled the same host twice → create `site-<name>` from `templates/site-skill/` (`blocker-fix` §3).
