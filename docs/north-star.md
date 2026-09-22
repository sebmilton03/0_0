# 0_0 — north star

Read this at the start of every session. Short on purpose.

**The idea.** The bank already does the budgeting. Bills come out automatically. Food and gas have
their own cards with caps, and anything over goes to pocket or savings. So only two things need
watching: **hours → paychecks**, and **pocket money**. Check-ins keep both accurate.

**What 0_0 is.** A few tiny apps behind one icon. The start screen shows one line per app. Most
days that line is the answer and you close it. Today it's Money, Study and +1. Nothing new joins until the
last thing has survived a real month of use.

**Money in one line:** how many hours to work this week, and whether you're ahead or behind.
- Next month's bills get paid by the checks that land this month. The weeks behind those checks are
  the stretch: 4 weeks, or 6 twice a year. The pay lag lives in the math, never on the screen.
- This week = hours still needed ÷ weeks left. After a short week, the rest go up a little. There's
  no schedule to fall behind on.
- Tap a week to plan it (weeks to come) or see what's logged and when (weeks done).
- Log shifts mid-week if you like, and this week counts down. A weekly total replaces them.
- Paydays: the same card every time, with two numbers off the stub (take-home and hours). $/hr is
  the average of the last 3 checks.

**Study.** 20 hours a week, starting fresh every Monday. Nothing carries over, because a habit isn't
a bill. One long purple line (about 5,000px, so ten minutes visibly moves it) fills as you study.
Start runs off a timestamp, so it survives the phone sleeping; over 8 hours is treated as a mistake
and capped. Forgot to start? Add minutes by hand. Quiet when the week's done.

**+1.** One number a day that grows by one. Tap adds 1. Hold and slide adds or takes off many (amber
means a gesture is live). Each slide is a set, and your best set is kept with its history.

**Check-ins.** Sunday: hours and pocket balance. Payday: the stub. That's all. Nothing is
pre-filled, because typing it is checking it. No bank sync.

**Quiet by default.**
- Chillin needs a fresh check-in, being on track, and pocket OK. Then the numbers go under clouds
  (swipe up to part them), and the face becomes `-_-`. On the start screen, chillin stacks when
  every app is quiet: chillin → hecka chillin → mega chillin bruh.
- If it needs no action, it isn't on screen. Gaps under $100 stay silent. Anything shown can be
  dismissed.
- No comparisons, streaks, scores or extra lines "for trust." Being right is what builds trust.
- Colour: green = good, amber = behind or tight, red = out of reach. Nothing else.

**Build rules.**
- Simple beats clever. If a screen needs explaining, the screen is wrong. The pay lag taught us that.
- One file per app until it hurts: `money/money.js`, `study/index.html`, `plusone/index.html`. `money/test.html` stays
  all green.
- New ideas go in `docs/parked.md`, not the code.
- No personal numbers in the code. The repo is public, so setup collects them on the phone.
- Commit and push only when Seb says.

**Where things are.** The live app is https://sebmilton03.github.io/0_0/ (start screen). Money is at
`money/` and +1 at `plusone/`. The old copy of +1 at `/-1/` shares the same data. The full history
is in `../0_0-handoff/` (local only).
