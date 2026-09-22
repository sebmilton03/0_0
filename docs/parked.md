# Parked

Ideas that are good, designed, and **not being built yet**. This file is where new ideas go
instead of into the code.

**The gate:** nothing here gets built until the thing before it has survived one real cycle of
use. A cycle is a month for money, a day for +1.

Rough order, most valuable first.

---

## Added 2026-09-21, while building v1

### Built 2026-09-22 (after the first days of use)
- The start screen with Money and +1 (was #10, the shell). One line each.
- Tap a week to plan it (the start of #3). **Parked:** planning weeks in the *next* stretch, and
  time off beyond it.
- Next check estimate, as one line.

### Built 2026-09-23 (evening)
- **Study**: 20 hrs a week, fresh each Monday, the long purple squiggle, start/done, add time by hand.
  Seb picked the squiggle over the column and asked for purple — noted that per-app colour is the
  thing that breaks around app four; revisit if the suite starts shouting.
- Start screen now has three apps, so chillin can reach "mega chillin bruh".
- **Still to build from this round:** nested to-dos in Study (below), per-module chillin for +1,
  and the Money week planner (set each day's shift).

### Built: nested to-dos (2026-09-23)
Shipped as the To-do tab in Study, as described below. Still parked from that round: per-module
chillin for +1, and the Money week planner (set each day's shift).

### R. Nested to-dos (Seb, 2026-09-23) — built
A thing can hold things: "Final study" → "Chapter 4" → "practice problems", as deep as it goes. A
parent shows its children's progress (3 of 8) and is done when they are. Tap to open a level, swipe
to tick off, add a child from inside a parent. Class, due date, do-it-on date and priority live on
any level, and children inherit the class.

### Built 2026-09-23 (later)
- +1: bubbles removed (Seb didn't like them), and you can fix a day's best set from the history.
- Start screen: "Back up everything" and "Restore" in one file, covering both apps.

### Built 2026-09-23
- Log a shift: this week counts down, with a bar. A week of shifts counts as logged; a weekly
  total replaces them. (Was I.)
- Clouds over chillin: fluff peeks, swipe up to part them. (Was K.)
- Tap any week: its hours, where they came from, when you logged them. (Was L.)
- +1 hold and slide, sets saved, "Best set" with a history of your best set each day. (Were H, M.)
- Chillin stacks on the start screen: "You're hecka chillin" when both apps are quiet. (Was N.)

### F. Buckets for extra money
Seb wants to see extra money and choose buckets for it (reserves, #2). At $22.67/hr, a normal week is
~33 hrs. His recent weeks average ~33, so there's no surplus yet. At 38.5 hrs/wk it'd be ~$500/month.
**Decide after Oct 31**, once a real month shows whether there's money to divide.

### H. +1: hold and slide to count (Seb, 2026-09-22)
Tap still adds 1. Hold, and the button turns **amber** (amber = a gesture is live) with bubbles
fizzing at the sides. Slide up to count up (one buzz per rep, bigger slide = faster), slide down to
take off, and let go to save. A big "+12" shows in the middle. It fixes tapping 30 times and losing
count. +1 is past its one-day cycle, so this can be built whenever.

### I. Money: "add a shift" mid-week
Optional: after a shift, type its hours (6.5) and this week's number counts down. On Sunday the
printout total replaces the shift adds. Skipping it changes nothing.

### J. Training: +1 grown into a full module (vision: mockups/0_0-training-vision.png)
Goal + plan + why one tap away. Home shows only today's session. A "how do you feel" check-in bends
the week (Beat → rest, the session moves), like a short week in Money. The only tracking is a test
every 4 weeks. Never: calories, badges, points, streak scores, or a diary. Needs Money to survive
October first. Open questions: gym or home, the real goal, how many days a week fit around work and school.

### K. Clouds over chillin (Seb, 2026-09-22), next build
Chillin shouldn't feel locked. Cover the numbers with clouds, with a little fluff peeking at the
bottom as the only hint. Swipe up and the clouds part and drift away, revealing the normal screen
(numbers, Log). They come back next time you open it. Quiet, not hidden.

### L. "Last updated" when you tap a week, next build
Tap any week box and it shows what's there and when you logged it ("38 hrs · logged Sun Sep 27").
Not on Home. Events need a `logged` date from now on; older ones just say "logged".

### M. +1: best set, from the input itself
Once hold-and-slide exists, each release is one set (quick taps in a row count as one set too).
Save sets per day, and "best set" falls out for free: one line, "Best set: 22 (Sep 30)". Nothing
extra to type. This is screen 7 of the Training vision starting small.

### N. Chillin that stacks across the suite
On the start screen, when every app is quiet: 1 = "You're chillin", 2 = "You're hecka chillin", 3 =
"You're mega chillin bruh". It's a state, not a score or streak, and only when every module agrees.

### O. Training, the real starting shape (Seb's answers)
No gym: home and the track. Goal: overall health, feeling good, looking good, natural flexible
strength. Skills later: splits, handstand, backflip, 2 plates (needs a barbell, so a gym or rack
later). **The #1 goal is consistency.** Rhythm, like cleaning: daily = +1 push-ups through the day,
weekly = one session, monthly = the deep clean (a long run, like 5 miles). This replaces the 3-days-a-
week plan in the vision image.
- Same hold-and-slide input, a different picture per activity: a button that fills for reps, a track
  loop that fills for laps or distance.

### P. "Grows with you" (if 0_0 is ever for other people)
It starts almost bare and grows as someone shows up consistently. Features arrive when the person
is ready for them, never as points or badges. This is Seb's own build rule ("nothing new until the
last thing survived a real cycle") turned into the product. Never lock anything someone needs
(export, their data).

### Q. The roadmap Seb laid out (2026-09-23)
In his priority order: bare minimums (work and money, done) → school (20 hrs/wk, counter like +1) →
cleaning → sleep (maybe #1, e.g. an hour of wind-down) → exercise → food (recipe and meal-plan deck) →
outside time (once a week, with a deck of places, reviews and directions).
- **Three shapes, not seven apps:** Money (hard totals) · Habits (a target on a daily, weekly or
  monthly clock with a counter: school, exercise, sleep, outside) · Decks (things to shuffle
  through: meals, places).
- School: each week starts fresh at 20. **No carry-over**, unlike money, because missed study
  hours piling up is how a habit gets abandoned.
- Cleaning: already a working habit, so don't build it unless it breaks.
- Sleep: track what's controllable (wind-down start), not hours slept. Try Pixel Bedtime mode
  first, which needs no code.
- Outside places: Google Maps saved lists already do places, reviews and directions. The app's part
  is "outside this week?" plus maybe "pick one for me".
- One module a month at most. This is a roadmap, not a build list.

### G. +1's own parked list (from its IDEAS.md)
History calendar · rest-day forest · friends syncing and comparing · custom exercise name ·
slide-to-count. See `Pushup Tracker/IDEAS.md` for detail.

### A. Make pocket raids visible
Pocket only gets topped up at month end, so a mid-month *increase* in the pocket balance means
money was moved in from another card (gas, groceries). Right now that makes pocket look healthier
and can show chillin while gas is short, which is the exact habit that "messes up the math." When
a balance goes up mid-month, ask once, "Moved from another card?", and show it. About 20 lines.
**First candidate after v1 survives October.**

### B. The third check has a job
Two months a year get three checks (Mar and Aug 2027). With month-by-month windows, that third
check is real surplus, roughly one check. It's the natural first money for reserves (#2) and time
off (#3). A week off inside a 6-week window comes out of the extra check (other weeks ~28 → ~33
hrs). The same week in a 4-week window pushes other weeks ~42 → ~56. Lithuania: Jul 12 – Aug 22,
2027 is a 6-week window. Every September week is in a 4-week window.

### C. Smoothed mode (the "38.5 a week" option)
v1 runs month by month: about 42 hrs/wk in 2-check months, about 28 in 3-check months. The
alternative is a steady ~38.5 every week, where 2-check month-ends draw ~$230 from a buffer that
the third checks refill. That only works if the buffer exists and the app shows it, so it arrives
with reserves.

### D. More `-_-`
The face closes its eyes when chillin. Seb likes it and wants it "at points." Where else it
belongs should come from use, not from a list.

### E. A second income source
The data already holds a list of sources (`sources: [...]`). Gig (1099) money has no tax withheld
and burns gas, so it can't count 1:1 with Domino's net. Add it when there's a real second source.

---

### 1. Shortfall names its source
When the hours number becomes unreachable, say what covers the gap, in order: **Misc cushion →
Car repairs → Emergency last.** *"You're $430 short. That's Misc cushion — it's there for this."*
Turns a bad month from panic into a decision he already made months ago. Works in reverse too:
surplus fills the lowest reserve.

### 2. Reserves as a picture
A perfect-world view of where every dollar is assigned, rearrangeable when life happens. Named:
**Car repairs · Misc cushion · Time off · Emergency** (last, locked). They live inside one savings
account, so they're labels and labels drift — he types the savings total, the app shows total vs.
allocated vs. unassigned, drift visible rather than silent.

### 3. Time off, planned ahead
Same formula, fewer days in the denominator. Block out a week and the other weeks absorb it. The
valuable part is showing the cost *before* committing: *"Take Oct 25–31 off → your other weeks go
from 38 to 50 hrs."* At his margin a full week often isn't free, and the honest answer is that it
comes from a reserve. Cheap to build — the formula already does it.

### 4. History that changes a decision
"You've averaged 36 hrs/week over six months" tells him what a realistic month looks like.
"You've logged 47 shifts" is a scoreboard. Only build the first kind.

### 5. Shifts as the unit
Alongside hours: *"31 hrs left · about 5 shifts."* Shifts are what he picks up and drops.

### 6. Month-end: receipt + transfer checklist
What happened, then a checklist he ticks off while inside Alliant, then next month pre-filled.
**Build only after he's done a month-end by hand and wants it.** He got a transfer wrong from
memory once in the simulated run — that's the evidence to wait for.

### 7. Where pocket money went
After two months he'll want to know whether it's lots of small things or one big thing. No
categories, no receipts — maybe just letting him tag a few spends. Wait until he asks; the shape
should come from the real question.

### 8. Plans → hours a week
A future-dated cost divides into a monthly figure and shows up as hours. **Lithuania, Sep 2027,
$1,000 + a week off ≈ $1,690 ≈ $74/month ≈ 2 hrs a week, starting now.** A $60 concert next Friday
is 3 hours this week. Small enough to say yes to, but he *saw* it.

*This is why the event shape `{ id, start, end, type, label, ref }` goes into `money` now even
though nothing uses it — a future-dated cost is the same shape as a bill, so this becomes a
feature rather than a rewrite.*

### 9. Calendar as the spine
Blocks are categories; money, tasks and workouts pin onto them. Tapping the Work block starts the
shift. Work is tracked because it pays; everything else is *planned*, not tracked — manual time
logging is the most-abandoned category of personal app there is, and a screen that shames him for
gaps is a screen he stops opening.

### 10. The shell and Today
One dumb shell: a list, a router, a Today screen with **exactly one line per module.** The moment a
module takes two lines, Today becomes a dashboard and stops being readable. No shared state
manager, no plugin system — a platform designed before the second real module exists is always
wrong. Target ~40 lines.

### 11. Other modules
**Training** (+1 folds in here as a feature, not its own module) · **To-do** · **School** (credits,
transfer timeline, study hours) · **Food and recipes** (a *library*, not a tracker — different
shape entirely, and the one module that touches nothing else).

---

## Deliberately dead

Not parked — decided against. See `03-decisions-and-rejections.md` for reasons.

Priority-ranked expense fill · allocation waterfall · mark-a-bill-paid · accounts screen ·
two-paycheck view · wishlist · shift timer as a dependency · automatic bank sync · streaks,
badges, points · per-module accent colours · cross-module gamification · a daily hours target.
