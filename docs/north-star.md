# 0_0 — north star

Read this at the start of every session. Short on purpose.

**What it is.** A confidence instrument, not a budgeting app. Seb opens it, sees he's fine, puts the
phone down and plays guitar. It answers one question: *will the checks landing this month fund next
month?* It answers in hours, because hours are what he controls. It also shows pocket money, the
only spending he actually decides about.

**The math.**
- A month is funded by the checks that land in the month before it. The work behind those checks is
  the **window**: whole pay periods, Mon–Sun, 4 weeks most months and 6 weeks twice a year.
- hours left = (month total − what the window has earned) ÷ $/hr. Per week = hours left ÷ weeks
  left in the window.
- A check that's in counts as paid. A week without one counts as logged hours × $/hr.
- $/hr = net ÷ hours over the last 3 checks. Never typed in.
- Everything is worked out fresh from saved events. No plan is stored, and there's no schedule to
  fall behind on.

**Three home states.**
1. **Something's due.** A finished week, a check that landed, or a stale pocket balance. It
   doesn't guess; logging is the reveal.
2. **Busy.** The numbers and the way back. Behind pace is amber. Red only when it's out of reach
   (> 50 hrs/week).
3. **Chillin.** Needs a fresh log, on pace, nothing unknown, and pocket at or above its daily
   budget. The face is `-_-`, dimmed, with no button.

**Rules.**
1. Optimize for the session ending. When he's fine, show less.
2. Busy is a to-do list with the way out drawn, never an alarm.
3. Cut inputs. Manual entry stays manual, because typing it *is* checking it. No bank sync. Nothing
   pre-filled.
4. Must survive being ignored: no streaks, no guilt. Skipped weeks get filled in by their check.
5. Nothing new gets built until the thing before it has survived one real cycle (a month).
   Modules stay frozen at `money` + `plusone` (+1 is its own repo) until Seb says otherwise.
6. New ideas go in `docs/parked.md`, not the code.
7. Colour: green = good, amber = tight/behind, red = out of reach. Nothing else gets colour.
8. No personal numbers in the code. The repo is public, and setup collects everything on the phone.
9. One file per module (`money.js`) until it physically hurts. `test.html` must stay all green.

**Where things are.** The full briefing, Seb's own words and the decisions are in `../0_0-handoff/`
(local only, not in the repo). The live app is https://sebmilton03.github.io/0_0/ and +1 is at
https://sebmilton03.github.io/-1/. They share a site, so storage keys and cache names must never
collide.
