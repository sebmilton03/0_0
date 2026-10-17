# 0_0 v2

The calm app, rebuilt from the design source (kept outside this public repo). Plain JavaScript,
ES modules, no build step, no dependencies. Live at `/0_0/v2/` next to the old apps, which it never
touches (it copies their saved data once, quietly, and reads it only when you tap "bring in").

## How it fits together

| Layer | Files | What it does |
|---|---|---|
| Places (screens) | `places/home.js` `day.js` `money.js` `grow.js` `study.js` · `tide.js` `long.js` | Read the state, write events. Never own data. |
| Shell | `app.js`, `ui.js`, `peace.css` | Clock and sky, the bottom bar, sheets, settings, breathe, taps. `peace.css` is calm.html's look. |
| Engines (pure math) | `engines/*.js` | sebdate, sky, pillars, week, money (on `../valley/engine.js`, unchanged), steps, study, tide, long. |
| State | `state.js` | One small reducer per kind of event. |
| History | `core/log.js` `store.js` `backup.js` | Append-only log in IndexedDB; state is a replay; month checkpoints; backups merge by id. |

Nothing is ever changed or deleted in the log: an edit is a new event, undo hides one. Ephemeral things
(breathe, the low-tide basics, the pull) are never written. Your real numbers and words reach the app
only on the phone (setup, bring-in, or a backup file), never through this repo.

## Trying it

- `?at=21:00` pretends it's that time today; `?on=2026-10-31` pretends it's that date. Previews never move your real "last opened".
- Tests: `node v2/tests/run-headless.mjs` from the repo (runs Money, Valley and v2 in headless Chrome), or open `/v2/tests/test.html` on a local server.
