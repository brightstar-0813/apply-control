---
name: site-builtin
description: How to handle Built In (builtin.com and city sites) jobs with BrightStar Bid Bot — job board with no adapter; in Generate + Apply the bot opens the listing and pauses, Claude clicks through to the employer ATS and finishes. Use when a row or tab is on builtin.com, the queue filter is Builtin, or the batch paused on a Builtin row.
---

# site-builtin

**Hosts:** `*.builtin.com` · **Adapter:** none (filter `#filterBuiltin`)
**Batch (Generate + Apply):** bot opens the listing and pauses → Claude finishes. **Login:** optional.

## Flow
1. Paused row → job tab → **Apply** → employer ATS (often Greenhouse / Lever / Ashby / Workday).
2. Continue with the target host's skill (or `site-other`).
3. **Mark applied ✓** → Start.

## Known blockers
| Symptom | Class | Fix | Added |
|---------|-------|-----|-------|
| | | | |
