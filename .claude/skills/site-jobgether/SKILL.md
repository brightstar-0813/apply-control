---
name: site-jobgether
description: How to apply via Jobgether (jobgether.com) with BrightStar Bid Bot — aggregator whose APPLY redirects to an employer ATS (Workday, Greenhouse, …); the bot follows the redirect and submits there in Generate + Apply. Use when an apply tab is on jobgether.com or a Jobgether row pauses.
---

# site-jobgether

**Hosts:** `*.jobgether.com` · **Adapter:** `jobgether` (stepBudget 18); employer redirect via `isEmployerAtsHost`
**Batch (Generate + Apply):** bot clicks APPLY, switches to the employer ATS adapter, **submits** if that ATS allows.
**Login:** may need a Jobgether account.

## Flow
1. Job page → APPLY → Jobgether form or redirect to the employer ATS.
2. On redirect: that host's skill (`site-workday`, `site-greenhouse`, …).
3. If Claude submitted: **Mark applied ✓** → Start.

## Known blockers
| Symptom | Class | Fix | Added |
|---------|-------|-----|-------|
| | | | |
