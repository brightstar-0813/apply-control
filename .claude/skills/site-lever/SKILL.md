---
name: site-lever
description: How to apply on Lever (jobs.lever.co, *.lever.co) with BrightStar Bid Bot — single-page form, resume parse, custom cards, bot submits in Generate + Apply. Use when an apply tab is on lever.co or a Lever row pauses.
---

# site-lever

**Hosts:** `*.lever.co` · **Adapter:** `lever` (stepBudget 14)
**Batch (Generate + Apply):** bot fills and **submits**. **Login:** none.

## Flow
1. Job → **Apply for this job** → one-page form.
2. Resume upload first (Lever parses it and may overwrite name/email — re-check), then fill;
   "Additional information" can take a short note.
3. Custom cards + EEO → Submit (hCaptcha may appear → H).
4. Confirmation: "Application submitted!". If Claude submitted: **Mark applied ✓** → Start.

## Known blockers
| Symptom | Class | Fix | Added |
|---------|-------|-----|-------|
| hCaptcha on Submit | H | User solves | 2026-11-13 |
