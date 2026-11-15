---
name: site-jobright
description: How to handle Jobright (jobright.ai) jobs with BrightStar Bid Bot — aggregator with no adapter; in Generate + Apply the bot opens the listing and pauses, Claude clicks through to the employer ATS and finishes. Use when a row or tab is on jobright.ai, the queue filter is Jobright, or the batch paused on a Jobright row.
---

# site-jobright

**Hosts:** `*.jobright.ai` · **Adapter:** none (filter `#filterJobright`)
**Batch (Generate + Apply):** bot opens the listing and pauses → Claude finishes.
**Login:** a Jobright account may be needed to see Apply.

## Flow
1. Paused row → job tab → **Apply** → employer page / ATS.
2. Continue with the target host's skill (or `site-other`).
3. **Mark applied ✓** → Start.

## Known blockers
| Symptom | Class | Fix | Added |
|---------|-------|-----|-------|
| | | | |
