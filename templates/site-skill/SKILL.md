---
name: site-TEMPLATE
description: How to apply on <Site> (<hosts>) with BrightStar Bid Bot — what the bot does in Generate + Apply, flow, submit, and known blockers with fixes. Use when an apply tab is on <hosts>, the batch paused on a <Site> row, or the queue filter is <Site>.
---

<!-- Copy this folder to .claude/skills/site-<name>/, set name: site-<name>, replace every <…>,
     and add the host to the routing table in site-other. -->

# site-<name>

**Hosts:** `<host patterns>` · **Adapter:** `<id in ats/adapters.js>` or none
**Batch (Generate + Apply):** <bot submits itself | bot fills then pauses → Claude finishes>
**Submit:** <per profile; any product limits>
**Login:** <none | account in the Chrome profile>

## Flow
1. <how the bot / Claude reaches the form>
2. <steps, and what to check on each>
3. <confirmation that proves submission> → if Claude submitted: row **Mark applied ✓** → Start

## Known blockers
| Symptom | Class | Fix | Added |
|---------|-------|-----|-------|
| | | | |

## Notes
- <quirks, selectors, timing>
