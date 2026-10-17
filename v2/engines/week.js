// The week, honestly: your blocks (work, class, study, reset, gym…), the week in hours,
// today's chain of cues, whether you're at work right now, and thoughts parked for later.
// Pure: state and dates in, plain numbers and words out. Nothing here writes anything.

import { weekOf, weekday, addDays, damDay, daysBetween } from './sebdate.js';

// What a block can be, with its colour from the calm palette. Sleep, meals and free are worked out.
export const KINDS = {
  work:  { name: 'work',  color: '#ffb37a' },
  class: { name: 'class + travel', color: '#8fb8ff' },
  study: { name: 'study', color: '#b9a8ff' },
  reset: { name: 'Monday reset', color: '#9fe6b8' },
  gym:   { name: 'gym',   color: '#ffd59a' },
  other: { name: 'other', color: '#c8c2ff' },
};
export const AUTO = { sleep: { name: 'sleep', color: '#3b3f6e' }, meals: { name: 'meals, getting ready', color: '#5a5f86' }, free: { name: 'free', color: '#fff1d6' } };
export const STACK = ['sleep', 'work', 'class', 'study', 'reset', 'gym', 'other', 'meals', 'free'];

const mins = t => { const [h, m] = String(t || '0:0').split(':').map(Number); return h * 60 + (m || 0); };
const len = b => Math.max(0, mins(b.to) - mins(b.from)) / 60;

/** Every block on a date, in time order: weekly blocks on that weekday, plus one-offs, minus skips. */
export function blocksOn(s, date) {
  const wd = weekday(date), skips = new Set((s.skips || []).filter(k => k.date === date).map(k => k.id));
  const weekly = Object.values(s.blocks || {}).filter(b => (b.days || []).includes(wd) && !skips.has(b.id) && (!b.from_ || date >= b.from_));
  const once = (s.once || []).filter(b => b.date === date);
  return [...weekly, ...once].map(b => ({ ...b, hours: len(b) })).sort((a, b) => mins(a.from) - mins(b.from));
}

/** Hours in bed, from wind-down to morning (8½ by default). */
export function sleepHours(set = {}) {
  const wind = mins(set.windDown || '22:30'), wake = mins(set.wake || '07:00');
  return ((wake - wind + 1440) % 1440) / 60;
}

/** One day in hours: { sleep, work, class, study, reset, gym, other, meals, free }. */
export function dayHours(s, date) {
  const set = s.settings || {}, h = Object.fromEntries(STACK.map(k => [k, 0]));
  h.sleep = sleepHours(set);
  h.meals = set.meals != null ? +set.meals : 1.5;
  for (const b of blocksOn(s, date)) h[KINDS[b.kind] ? b.kind : 'other'] += b.hours;
  h.free = Math.max(0, 24 - STACK.filter(k => k !== 'free').reduce((t, k) => t + h[k], 0));
  return h;
}

/** The week in hours, Monday to Sunday, with totals. */
export function weekHours(s, date) {
  const w = weekOf(date), days = w.days.map(d => ({ date: d, ...dayHours(s, d) }));
  const total = k => days.reduce((t, d) => t + d[k], 0);
  return { start: w.start, end: w.end, days, work: total('work'), study: total('study'), free: total('free'), class: total('class') };
}

/** How the week feels, in a word. */
export function weekFeel(wk) {
  if (wk.free < 8) return 'A full week.';
  if (wk.free > 30) return 'An open week.';
  return 'A steady week.';
}

/** The block you're in right now (work only), or null. */
export function atWork(s, date, now) {
  const m = now.getHours() * 60 + now.getMinutes();
  const b = blocksOn(s, date).find(x => x.kind === 'work' && mins(x.from) <= m && m < mins(x.to));
  return b ? { ...b, done: (m - mins(b.from)) / (mins(b.to) - mins(b.from)), left: (mins(b.to) - m) / 60 } : null;
}

const done = (s, date, item) => !!(((s.cues || {})[date] || {})[item]);
const ampm = t => { const m = mins(t), h = Math.floor(m / 60), mm = m % 60; return (h % 12 || 12) + (mm ? ':' + String(mm).padStart(2, '0') : ''); };
export const span = b => ampm(b.from) + ' to ' + ampm(b.to);

/**
 * Today as a chain of cues, in order: the morning, each block, then wind down.
 * Each cue: { key, title, dot, right, lines: [{ item, text, done }] }. Empty cues are left out.
 */
export function cues(s, date, focus = null, morningHabits = []) {
  const set = s.settings || {}, out = [];
  // Habit lines use 'h:<id>', the same item Grow ticks, so ticking either place counts once.
  const morning = [...morningHabits.map(h => ({ item: 'h:' + h.id, text: h.text, done: done(s, date, 'h:' + h.id) })),
    ...(set.morning || []).map((t, i) => ({ item: 'm' + i, text: t, done: done(s, date, 'm' + i) }))];
  if (morning.length) out.push({ key: 'morning', title: 'Morning', dot: '#9fe6b8', lines: morning });
  for (const b of blocksOn(s, date)) {
    const item = 'b:' + b.id;
    out.push({ key: item, title: b.label || KINDS[b.kind]?.name || 'block', dot: (KINDS[b.kind] || KINDS.other).color,
      right: b.kind === 'work' ? fmtHours(b.hours) + ' hr' : '', lines: [{ item, text: span(b) + (b.kind === 'work' ? '' : ''), done: done(s, date, item) }] });
  }
  const evening = (set.evening || []).map((t, i) => ({ item: 'e' + i, text: t, done: done(s, date, 'e' + i) }));
  if (focus) evening.unshift({ item: 'h:' + focus.id, text: focus.text, done: done(s, date, 'h:' + focus.id) });
  if (evening.length) out.push({ key: 'wind', title: focus ? 'Wind down · your focus habit' : 'Wind down', dot: '#ffb3dc', right: focus ? focus.right || '' : '', lines: evening });
  return out;
}
export const fmtHours = h => { const r = Math.round(h * 2) / 2; return Math.trunc(r) + (r % 1 ? '½' : ''); };

/** "Tomorrow starts with good morning ✎, then work at 10." or null. */
export function tomorrowLine(s, date) {
  const t = addDays(date, 1), set = s.settings || {}, parts = [];
  if ((set.morning || [])[0]) parts.push(set.morning[0]);
  const b = blocksOn(s, t)[0];
  if (b) parts.push((b.label || KINDS[b.kind]?.name) + ' at ' + ampm(b.from));
  return parts.length ? parts : null;
}

/* ---------- Park it: a thought waits for the right day ---------- */
export const WAITS = { sunday: 'Sunday', monday: 'Monday reset', free: 'free day', damday: 'Dam Day' };
/** The date a parked thought comes back, from the day it was parked. */
export function waitsUntil(until, parkedOn, set = {}) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(until)) return until;
  const after = d => (d > parkedOn ? d : null);
  if (until === 'sunday') return addDays(parkedOn, ((6 - weekday(parkedOn)) + 7) % 7 || 7);
  if (until === 'monday') return addDays(parkedOn, ((7 - weekday(parkedOn)) % 7) || 7);
  if (until === 'free') { const f = set.freeDay != null ? +set.freeDay : 1; return addDays(parkedOn, ((f - weekday(parkedOn) + 7) % 7) || 7); }
  if (until === 'damday') { const [y, m] = parkedOn.split('-').map(Number), d = damDay(y, m); return after(d) || d; }
  return addDays(parkedOn, 1);
}
/** Parked thoughts still waiting, each with the date it comes back; and the ones due by `date`. */
export function parked(s, date) {
  const all = (s.parked || []).filter(p => !p.done).map(p => ({ ...p, back: waitsUntil(p.until, p.on, s.settings) }));
  return { waiting: all.filter(p => p.back > date).sort((a, b) => (a.back < b.back ? -1 : 1)), due: all.filter(p => p.back <= date) };
}
export const backWords = (p, date) => {
  const d = daysBetween(date, p.back);
  return WAITS[p.until] || (d === 1 ? 'tomorrow' : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][weekday(p.back)] + ' ' + p.back.slice(5).replace('-', '/'));
};
