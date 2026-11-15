---
name: bid
description: One-command start of a BrightStar Bid Bot apply session for a person and a source filter — `/bid <person> <source> [cap]` (e.g. `/bid avash dice`, `/bid lewis all 10`). The `/<person>-<source>-bid` shortcuts (avash-dice-bid, lewis-all-bid, …) all land here. Runs apply-run with that person and filter pre-set.
---

# bid

Arguments: `<person> <source> [cap] [extra notes]`. Example: `avash dice 10`.

| Person arg | Bot profile | Chrome profile |
|------------|-------------|----------------|
| `avash` (default) | avash-chapagain | `Profile 2` |
| `lewis` | dmario-lewis | `Profile 1` |

Any other person → stop and say they aren't enabled (CLAUDE.md rule 1).

| Source arg | Filter button | Site skill |
|------------|---------------|------------|
| `dice` | `#filterDice` | site-dice |
| `greenhouse` | `#filterGreenhouse` | site-greenhouse |
| `workday` | `#filterWorkday` | site-workday |
| `builtin` | `#filterBuiltin` | site-builtin |
| `himalayas` | `#filterHimalayas` | site-himalayas |
| `jobright` | `#filterJobright` | site-jobright |
| `other` | `#filterEtc` | site-other / site-jobgether |
| `all` (default) | `#filterAll` | per row (routing table in site-other) |
| `linkedin` | — | **refuse** (rule 11) |

Cap: the number given, else the profile file's "Max applications per session".

## Steps

1. Load **apply-run** and follow it with these inputs. The source arg overrides the profile's default filter
   for this session only; don't write it into the profile file.
2. Preflight as apply-run §1 (`browser-connect` → bind the profile → bot settings from `profiles/<id>.md`).
   Batch mode and Allow auto submit always come from the profile file, never from this command.
3. Before clicking the filter, do the `all_us_jobs` / `job_queue` length check from bot-operate. **Load from sheet**, then click the filter.
4. Show the queue review (counts, first rows, misfits, LinkedIn rows to remove) and **wait for the user's go**
   (rule 4), unless the profile file pre-approves the queue.
5. Start → run loop per apply-run §3, capped at the cap. Run log `runs/<date>-<id>.md`
   gets a header line `/bid <person> <source> <cap>`.
