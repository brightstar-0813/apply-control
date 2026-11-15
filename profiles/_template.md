# Profile: <bot profile id, e.g. dmario-lewis>

Copy to `profiles/<bot-profile-id>.md`. Person data (name, contact, location, work
authorization, sponsorship, EEO, track, sheet tab, master resume) is **not** stored here —
it comes from the bot (`C:\brightstar-bid-bot\profiles.js` built-ins, or the custom copy in
that Chrome profile). The agent reads it live at bind time. No passwords or tokens here.

| Session setting | Value |
|-----------------|-------|
| Bot profile id | see `profiles/index.md` |
| Chrome profile (name in Chrome's profile menu) | |
| AI engine | ChatGPT / Claude |
| Jobs source | Google Sheet / CSV |
| Jobs sheet URL | |
| Capture tab | e.g. `US-SF-Jobs` |
| Default source filter | Dice / Greenhouse / … / All |
| Queue pre-approved? | no (ask each run) / yes for filter X |
| Allow auto submit | off / on |
| Batch mode | Generate / Generate + Apply |
| Max applications per session | 25 |
| Sites signed in on this profile | dice, indeed, … (never LinkedIn) |

## Notes
- Sites to skip:
- Overrides vs the bot profile (only if the user said so):
