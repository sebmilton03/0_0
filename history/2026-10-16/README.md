# 0_0 v1, as of 16 Oct 2026

This folder is a keepsake of 0_0 just before the v2 rebuild. It holds notes and pictures only.
The code itself is the git tag **`v1-2026-10-16`** ("0_0 v1 before the v2 rebuild"). To look at it:

```
git checkout v1-2026-10-16     # look around
git checkout main              # come back
```

The old apps are not copied here as runnable code on purpose. A copy would run on the same site, read
and write the same storage, and could overwrite real data.

## The apps

| App | Where | What it does |
|---|---|---|
| **Start screen** | `index.html` | One line per app, so most days you open it, read the line, and close it. When every app is quiet it says chillin, then hecka chillin, then mega chillin bruh. Has Back up everything and Restore for all apps at once. |
| **Money** | `money/` (`money.js`) | How many hours to work this week, and whether you're ahead or behind. Next month's bills are paid by the checks that land this month, so the weeks behind those checks are the stretch (4 weeks, or 6 twice a year). Check-ins: hours and pocket balance on Sunday, the stub on payday. Pocket money gets its own number and a per-day amount. |
| **Valley** | `valley/` (`engine.js` + `valley.js`) | Once a month, on Dam Day (the 1st), the income account splits into jars: Bills to this month's target, Gas and Misc to their caps, the Personal refill, the Vault. The leftover goes to the loan or the Roth first, then 75% investing and 25% fun. Path runs the split forward for years. It looks like a game on purpose. |
| **Study** | `study/` | 20 hours a week, starting fresh every Monday. A long purple line fills as you study. The timer survives the phone sleeping. The To-do tab is a nested list ("Final study" → "Chapter 4" → "problems 1–20"). |
| **+1** | `plusone/` | Push-ups: one number a day that grows by one. Tap adds 1, hold and slide adds many. Each slide is a set and your best set is kept. What you don't finish carries to the next day. |
| **+1 trackers** | `plusone/` (second script) | Work in progress, committed today as "+1 trackers (work in progress)". It's a library of presets (Sun: a 5-minute sunrise timer, Push-ups, Meditate, Stretch) kept under its own storage key, so push-up data is never touched. |

The old copy of +1 at `/-1/` (outside this repo) shares the push-up data.

## Tests on this day

Both test pages were run headless in Chrome on 16 Oct 2026, against the tagged code:

| Page | Result |
|---|---|
| `money/test.html` | **All 84 checks pass** |
| `valley/test.html` | **All 94 checks pass** |

Study and +1 have no test page.

## Screenshots

Phone size (390×844, saved at 2× as 780×1688), each app loaded with **made-up sample data**: rent
$900, a $1,185 check for 68 hours, a pretend car loan, a pretend Chem final, and day 30 of push-ups.
None of these numbers are real.

| | |
|---|---|
| `1-start.png` | Start screen |
| `2-money.png` | Money home |
| `3-valley.png` | Valley home |
| `4-study.png` | Study, Hours tab |
| `5-plusone.png` | +1, day 30 |

How they were made: a local server on `localhost` (a different site from the live app, so nothing real
could be read or touched) and a throwaway headless Chrome profile. Each app was filled through its
own setup functions, then photographed.
