// What v2 remembers, rebuilt from the log. One small function per kind of event.
// Undo is never handled here: the log hides the event and replay simply skips it.

import { EMPTY as EMPTY_MONEY } from './engines/money.js';
const M = s => s.money || EMPTY_MONEY;
const TD = s => s.tide || { on: false, from: null, history: [] };
const ST = s => s.study || { target: 0, days: {}, running: null, tasks: [] };
const under = (tasks, id) => tasks.filter(t => t.parent === id).flatMap(c => [c.id, ...under(tasks, c.id)]);
const burner = hs => Object.fromEntries(Object.entries(hs || {}).map(([k, h]) => [k, h.status === 'focus' ? { ...h, status: 'backburner' } : h]));

export const APP = {
  init: { settings: {}, places: [], tabs: [], ticks: {}, checkins: {}, sleep: {}, days: {}, sayings: [], archived: null,
    blocks: {}, once: [], skips: [], cues: {}, parked: [], habits: {}, road: [], months: {}, person: null, milestones: [], letters: [] },
  reducers: {
    // { name, wake, windDown, payday, place: { lat, lon, label }, words }
    settings: (s, d) => ({ ...s, settings: { ...s.settings, ...d } }),
    'place.add': (s, d) => (s.places.includes(d.key) ? s : { ...s, places: [...s.places, d.key] }),
    'place.remove': (s, d) => ({ ...s, places: s.places.filter(k => k !== d.key) }),
    // The bottom bar: day, money, grow, study join it one at a time.
    'tab.add': (s, d) => (s.tabs.includes(d.key) ? s : { ...s, tabs: [...s.tabs, d.key] }),
    'tab.remove': (s, d) => ({ ...s, tabs: s.tabs.filter(k => k !== d.key) }),
    // A weekly tick (home reset, meal prep) on a date.
    tick: (s, d) => ({ ...s, ticks: { ...s.ticks, [d.pillar]: [...(s.ticks[d.pillar] || []), d.date] } }),
    // An answer to a weekly question (People: 'yes' or 'no').
    checkin: (s, d) => ({ ...s, checkins: { ...s.checkins, [d.pillar]: [...(s.checkins[d.pillar] || []), { date: d.date, answer: d.answer }] } }),
    sleep: (s, d) => ({ ...s, sleep: { ...s.sleep, [d.date]: d.how } }),
    gratitude: (s, d) => ({ ...s, days: { ...s.days, [d.date]: { ...s.days[d.date], grateful: d.text } } }),
    'day.done': (s, d) => ({ ...s, days: { ...s.days, [d.date]: { ...s.days[d.date], done: true } } }),
    // Your own sayings, brought in from your file or typed. { text, kind: 'mantra' | 'advice' | 'saying' }
    'saying.add': (s, d, e) => (s.sayings.some(x => x.text === d.text) ? s : { ...s, sayings: [...s.sayings, { id: e.id, text: d.text, kind: d.kind || 'saying' }] }),
    // Day: your blocks. Weekly: { id, kind, label, days: [0-6], from: 'HH:MM', to: 'HH:MM' }. A change is a new block.set.
    'block.set': (s, d) => ({ ...s, blocks: { ...s.blocks, [d.id]: d } }),
    'block.remove': (s, d) => { const b = { ...s.blocks }; delete b[d.id]; return { ...s, blocks: b, once: s.once.filter(x => x.id !== d.id) }; },
    // Just this week: { id, kind, label, date, from, to }. And dropping one day of a weekly block: { id, date }.
    'block.once': (s, d) => ({ ...s, once: [...s.once.filter(x => x.id !== d.id), d] }),
    'block.skip': (s, d) => ({ ...s, skips: [...s.skips, { id: d.id, date: d.date }] }),
    // A line in today's chain, ticked or unticked: { date, item, done }.
    cue: (s, d) => ({ ...s, cues: { ...s.cues, [d.date]: { ...s.cues[d.date], [d.item]: !!d.done } } }),
    // Park it: { text, until: 'sunday' | 'monday' | 'free' | 'damday' | 'YYYY-MM-DD', on: date }. Done: { id }.
    park: (s, d, e) => ({ ...s, parked: [...s.parked, { id: e.id, text: d.text, until: d.until, on: d.on }] }),
    'park.done': (s, d) => ({ ...s, parked: s.parked.map(p => (p.id === d.id ? { ...p, done: true } : p)) }),
    // Money. Shapes match Valley's engine so it runs unchanged (see engines/money.js).
    'money.import': (s, d, e) => ({ ...s, money: { ...EMPTY_MONEY, ...M(s), ...d, imported: e.at } }),
    'pocket.set': (s, d) => { const m = M(s); return { ...s, money: { ...m, jars: { ...m.jars, [d.key]: { ...m.jars[d.key], ...d.set } } } }; },
    'bill.set': (s, d) => { const m = M(s), bills = m.bills.filter(b => b.id !== d.id); const i = m.bills.findIndex(b => b.id === d.id);
      bills.splice(i < 0 ? bills.length : i, 0, { id: d.id, name: d.name, amounts: d.amounts, loan: !!d.loan, bareMin: !!d.bareMin, day: d.day || null }); return { ...s, money: { ...m, bills } }; },
    'bill.remove': (s, d) => { const m = M(s); return { ...s, money: { ...m, bills: m.bills.filter(b => b.id !== d.id) } }; },
    'loan.set': (s, d) => ({ ...s, money: { ...M(s), loan: d.loan } }),
    'extra.set': (s, d) => { const m = M(s); return { ...s, money: { ...m, extra: { ...m.extra, ...d } } }; },
    'income.set': (s, d) => { const m = M(s); return { ...s, money: { ...m, income: { ...m.income, ...d } } }; },
    'pay.set': (s, d) => ({ ...s, money: { ...M(s), pay: d } }),
    paycheck: (s, d, e) => { const m = M(s); return { ...s, money: { ...m, paychecks: [...m.paychecks, { id: e.id, date: d.date, net: +d.net, hours: +d.hours }] } }; },
    balance: (s, d) => { const m = M(s); return { ...s, money: { ...m, balances: [...m.balances, { date: d.date, jar: d.jar, value: +d.value }] } }; },
    // Dam Day: each transfer you make, then the close (with what each pocket now holds).
    'dam.move': (s, d) => { const m = M(s); return { ...s, money: { ...m, moves: { ...m.moves, [d.month]: { ...(m.moves[d.month] || {}), [d.key]: +d.amount } } } }; },
    'dam.done': (s, d) => { const m = M(s); return { ...s, money: { ...m, damDone: [...m.damDone, d.month], ious: m.ious.map(x => ({ ...x, paid: true })),
      balances: [...m.balances, ...Object.entries(d.after || {}).map(([jar, value]) => ({ date: d.date, jar, value: +value }))] } }; },
    spent: (s, d) => { const m = M(s); return { ...s, money: { ...m, spent: [...m.spent, { date: d.date, amount: +d.amount, note: d.note || '' }] } }; },
    borrow: (s, d) => { const m = M(s); return { ...s, money: { ...m, ious: [...m.ious, { date: d.date, from: d.from, amount: +d.amount }] } }; },
    // Grow. A habit: { id, name, cue: 'morning' | 'wind', why, steps: [{ text, n }], status: 'focus' | 'backburner' | 'kept', date }.
    // Only one focus at a time: making one the focus moves the old focus to the back burner.
    'habit.add': (s, d) => ({ ...s, habits: { ...(d.status === 'focus' ? burner(s.habits) : s.habits),
      [d.id]: { id: d.id, name: d.name, cue: d.cue || 'wind', why: d.why || '', steps: d.steps, status: d.status || 'backburner', step: 0, stepFrom: d.date } } }),
    'habit.status': (s, d) => { const h = s.habits[d.id]; if (!h) return s;
      return { ...s, habits: { ...(d.status === 'focus' ? burner(s.habits) : s.habits), [d.id]: { ...h, status: d.status, ...(d.status === 'focus' && d.date ? { stepFrom: h.stepFrom || d.date } : {}) } } }; },
    // "I reached it": the next step starts today. After the last step, the habit is kept.
    'habit.reached': (s, d) => { const h = s.habits[d.id]; if (!h) return s; const last = h.step >= h.steps.length - 1;
      return { ...s, habits: { ...s.habits, [d.id]: last ? { ...h, status: 'kept', keptOn: d.date } : { ...h, step: h.step + 1, stepFrom: d.date } } }; },
    // Goals as a road: stops you reach, in order. { id, text } then { id, date } when reached.
    'stop.add': (s, d) => ({ ...s, road: [...s.road.filter(x => x.id !== d.id), { id: d.id, text: d.text }] }),
    'stop.reached': (s, d) => ({ ...s, road: s.road.map(x => (x.id === d.id ? { ...x, reached: d.date } : x)) }),
    'stop.remove': (s, d) => ({ ...s, road: s.road.filter(x => x.id !== d.id) }),
    // Study. Minutes per day, a timer that runs off a timestamp, and a list that nests.
    'study.target': (s, d) => ({ ...s, study: { ...ST(s), target: +d.hours } }),
    'study.start': (s, d) => ({ ...s, study: { ...ST(s), running: d.at } }),
    'study.stop': (s, d) => { const st = ST(s); return { ...s, study: { ...st, running: null, days: { ...st.days, [d.date]: Math.max(0, (st.days[d.date] || 0) + (+d.mins || 0)) } } }; },
    'study.add': (s, d) => { const st = ST(s); return { ...s, study: { ...st, days: { ...st.days, [d.date]: Math.max(0, (st.days[d.date] || 0) + (+d.mins || 0)) } } }; },
    'study.import': (s, d) => { const st = ST(s), days = { ...st.days };
      for (const [k, v] of Object.entries(d.days || {})) days[k] = Math.max(days[k] || 0, +v || 0);
      const have = new Set(st.tasks.map(t => t.id));
      return { ...s, study: { ...st, days, imported: true, tasks: [...st.tasks, ...(d.tasks || []).filter(t => !have.has(t.id))] } }; },
    'task.add': (s, d) => { const st = ST(s); return { ...s, study: { ...st, tasks: [...st.tasks, { id: d.id, title: d.title, cls: d.cls || '', due: d.due || '', doOn: d.doOn || '', pri: d.pri || '', parent: d.parent || null, done: false }] } }; },
    'task.edit': (s, d) => { const st = ST(s); return { ...s, study: { ...st, tasks: st.tasks.map(t => (t.id === d.id ? { ...t, ...d.set } : t)) } }; },
    // Ticking a thing ticks everything inside it.
    'task.done': (s, d) => { const st = ST(s), ids = new Set([d.id, ...under(st.tasks, d.id)]);
      return { ...s, study: { ...st, tasks: st.tasks.map(t => (ids.has(t.id) ? { ...t, done: !!d.done } : t)) } }; },
    'task.remove': (s, d) => { const st = ST(s), ids = new Set([d.id, ...under(st.tasks, d.id)]); return { ...s, study: { ...st, tasks: st.tasks.filter(t => !ids.has(t.id)) } }; },
    // Low tide. It never decides for you: you start it, or say yes when it asks once.
    'tide.on': (s, d) => ({ ...s, tide: { ...TD(s), on: true, from: d.date } }),
    'tide.off': (s, d) => { const t = TD(s); return { ...s, tide: { ...t, on: false, from: null, welcomed: null, history: [...(t.history || []), { from: t.from, to: d.date }] } }; },
    'tide.asked': (s, d) => ({ ...s, tide: { ...TD(s), asked: d.date } }),
    'tide.welcomed': (s, d) => ({ ...s, tide: { ...TD(s), welcomed: d.date } }),
    // Your person, chosen on a good day: { name, phone }. Stays on this phone.
    person: (s, d) => ({ ...s, person: d.name || d.phone ? { name: d.name || '', phone: d.phone || '' } : null }),
    // The month close: { month, name }.
    'month.close': (s, d) => ({ ...s, months: { ...s.months, [d.month]: { name: d.name || '', closed: true } } }),
    // How a day felt, for the year quilt: 'easy' | 'steady' | 'deep' | 'heavy'.
    'day.feel': (s, d) => ({ ...s, days: { ...s.days, [d.date]: { ...s.days[d.date], feel: d.feel } } }),
    // Milestones get a moment: { id, title, facts: [[big, small]], date }. Seen once.
    milestone: (s, d) => ({ ...s, milestones: [...s.milestones.filter(x => x.id !== d.id), { id: d.id, title: d.title, facts: d.facts || [], date: d.date, letter: d.letter || null }] }),
    'milestone.seen': (s, d) => ({ ...s, milestones: s.milestones.map(x => (x.id === d.id ? { ...x, seen: true } : x)) }),
    // Letters to future you, sealed until { kind: 'date' | 'stop' | 'tide', value }.
    'letter.add': (s, d, e) => ({ ...s, letters: [...s.letters, { id: d.id, title: d.title, text: d.text, opens: d.opens, written: e.at.slice(0, 10) }] }),
    'letter.open': (s, d) => ({ ...s, letters: s.letters.map(x => (x.id === d.id ? { ...x, opened: d.date } : x)) }),
    // A copy of what the v1 apps had saved, taken once, quietly. Kept so nothing is lost; places bring in what they need.
    'v1-archive': (s, d, e) => ({ ...s, archived: { at: e.at, id: e.id, keys: Object.keys(d.keys || {}) } }),
  },
  summarize: s => ({ places: s.places.length, days: Object.keys(s.days).length, sleep: Object.keys(s.sleep).length }),
};

/** The keys the v1 apps keep in this site's storage. Read once, for the archive; never again. */
export const V1_KEYS = ['0_0-money-v1', '0_0-valley-v1', '0_0-study-v1', 'plus-one-v1', 'plus-one-trackers-v1',
  '0_0-line-valley', '0_0-line-study', 'plus-one-line'];

/**
 * Read a sayings file (markdown: '## Heading' then '- line' items). Returns [{ text, kind }].
 * Sections named like "Build note" are skipped. Runs on the phone; the file never enters the repo.
 */
export function parseSayings(md) {
  const out = []; let kind = 'saying', skip = false;
  for (const raw of String(md).split(/\r?\n/)) {
    const line = raw.trim(), h = /^#{1,6}\s+(.*)$/.exec(line);
    if (h) { const t = h[1].toLowerCase(); skip = /note|build/.test(t); kind = /mantra/.test(t) ? 'mantra' : /advice/.test(t) ? 'advice' : 'saying'; continue; }
    const li = /^[-*]\s+(.+)$/.exec(line);
    if (li && !skip) out.push({ text: li[1].trim(), kind });
  }
  return out;
}
