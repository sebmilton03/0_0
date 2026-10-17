// Study: a weekly target that fits the real week (12 hours now, 20 once a shift frees up),
// a timer that runs off a timestamp, blocks pulled from the calendar, and a list that nests.
// Pure: state in, numbers and words out.

import { weekOf, daysBetween } from './sebdate.js';
import { blocksOn, dayHours } from './week.js';

export const FITS_NOW = 12;          // what fits with four shifts (the honest week); a suggestion, never a rule
export const MAX_SESSION = 8 * 60;   // a timer left running over 8 hours is treated as a mistake and capped

export const S = s => s.study || { target: 0, days: {}, running: null, tasks: [] };

/** Minutes studied this week (Monday to Sunday), and the hours of study blocks planned in Day. */
export function week(s, date) {
  const st = S(s), w = weekOf(date);
  const mins = w.days.reduce((t, d) => t + ((st.days || {})[d] || 0), 0);
  const blocks = w.days.flatMap(d => blocksOn(s, d).filter(b => b.kind === 'study').map(b => ({ ...b, date: d, done: !!((s.cues || {})[d] || {})['b:' + b.id], past: d < date })));
  const planned = blocks.reduce((t, b) => t + b.hours, 0);
  const target = +st.target || 0;
  // The day with the most free hours left this week, to suggest a block.
  const left = w.days.filter(d => d >= date).map(d => ({ d, free: dayHours(s, d).free })).sort((a, b) => b.free - a.free)[0] || null;
  // Not on the calendar: what's left after the time already studied and the blocks still ahead.
  const ahead = blocks.filter(b => !b.done && !b.past).reduce((t, b) => t + b.hours, 0);
  return { mins, hours: mins / 60, target, planned, blocks, unplanned: Math.max(0, target - mins / 60 - ahead), openDay: left && left.free >= 3 ? left.d : null,
    done: target > 0 && mins >= target * 60, daysLeft: daysBetween(date, w.end) + 1 };
}

/** Minutes on a running timer, capped. */
export function runningMins(st, nowMs) {
  if (!st.running) return 0;
  return Math.min(MAX_SESSION, Math.max(0, Math.round((nowMs - st.running) / 60000)));
}

/* ---------- The list: a thing can hold things, as deep as it goes ---------- */
export const children = (tasks, id) => tasks.filter(t => (t.parent || null) === (id || null));
export function counts(tasks, id) {
  const kids = children(tasks, id);
  if (!kids.length) return null;
  const leaves = []; const walk = p => { const k = children(tasks, p); if (!k.length) leaves.push(tasks.find(t => t.id === p)); else k.forEach(c => walk(c.id)); };
  kids.forEach(c => walk(c.id));
  return { done: leaves.filter(t => t && t.done).length, of: leaves.length };
}
/** A parent is done when everything inside it is. */
export function isDone(tasks, t) { const c = counts(tasks, t.id); return c ? c.done === c.of : !!t.done; }
/** Class carries down: a thing without a class takes its parent's. */
export function classOf(tasks, t) { let x = t; while (x && !x.cls && x.parent) x = tasks.find(y => y.id === x.parent); return (x && x.cls) || ''; }
export const descendants = (tasks, id) => children(tasks, id).flatMap(c => [c.id, ...descendants(tasks, c.id)]);
/** Overdue goes amber, never red. Returns 'overdue' | 'today' | 'soon' | ''. */
export function dueState(t, date) {
  if (!t.due || t.done) return '';
  const d = daysBetween(date, t.due);
  return d < 0 ? 'overdue' : d === 0 ? 'today' : d <= 3 ? 'soon' : '';
}
