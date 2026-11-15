# Run logs

One file per session: `runs/YYYY-MM-DD-<profile>.md`. Written by `apply-run`, read by `blocker-fix`.

```markdown
# 2026-11-13 lewis-sf
Filter: Dice · Queue: 86 pending → approved 25 · Submit: on (Dice)

| Row | Company | Site | Result | Blocker | Fix |
|-----|---------|------|--------|---------|-----|
| 12  | Acme    | dice | applied | — | — |
| 14  | Foo     | greenhouse | paused | required "Years of Apex" | Q&A bank + site-greenhouse |

## Skill/code changes this run
- site-greenhouse: added "Years of X" pattern
## Open items for the user
- Row 20 needs sign-in on Workday tenant foo.wd5
```
