// The long view: letters to future you, your sky, and the year as a quilt. Slow and unscored.
// Pure: state and dates in, shapes out.

import { daysInMonth, ymd } from './sebdate.js';

/** Can a sealed letter open today? A date reached, a stop reached, or the tide out. */
export function canOpen(s, l, today) {
  if (l.opened) return false;
  const o = l.opens || {};
  if (o.kind === 'date') return !!o.value && today >= o.value;
  if (o.kind === 'stop') return !!(s.road || []).find(x => x.id === o.value && x.reached);
  if (o.kind === 'tide') return !!(s.tide && s.tide.on);
  return false;
}
export const sealed = s => (s.letters || []).filter(l => !l.opened);
export const ready = (s, today) => (s.letters || []).filter(l => canOpen(s, l, today));
export function opensWords(s, l) {
  const o = l.opens || {};
  if (o.kind === 'date') return 'opens ' + o.value;
  if (o.kind === 'stop') { const x = (s.road || []).find(r => r.id === o.value); return 'opens when ' + (x ? x.text.charAt(0).toLowerCase() + x.text.slice(1) : 'a stop') + ' is reached'; }
  if (o.kind === 'tide') return 'opens on a rough day';
  return 'sealed';
}

/* ---------- Your sky: every habit kept and every stop reached becomes a star ---------- */
// A small seeded hash, so a star always sits in the same place.
function hash(str) { let h = 2166136261; for (const c of String(str)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; }
export function starsOf(s) {
  const lit = [
    ...Object.values(s.habits || {}).filter(h => h.status === 'kept').map(h => ({ id: h.id, label: h.steps[h.steps.length - 1].text, sub: 'kept', at: h.keptOn || '' })),
    ...(s.road || []).filter(x => x.reached).map(x => ({ id: x.id, label: x.text, sub: x.reached.slice(0, 7), at: x.reached })),
    ...(s.money && (s.money.damDone || []).length ? [{ id: 'dam1', label: 'first Dam Day', sub: s.money.damDone[0], at: s.money.damDone[0] + '-31' }] : []),
  ].sort((a, b) => (a.at < b.at ? -1 : 1));
  const faint = (s.road || []).filter(x => !x.reached).map(x => ({ id: x.id, label: x.text }));
  // Lit stars spread over the upper sky, faint ones lower down: the future is below the horizon line.
  const place = (x, i, n, y0, y1) => ({ ...x, x: 40 + hash(x.id) * 266, y: y0 + ((i + 0.5) / Math.max(1, n)) * (y1 - y0) + (hash(x.id + 'y') - 0.5) * 30 });
  return { lit: lit.map((x, i) => place(x, i, lit.length, 40, 300)), faint: faint.map((x, i) => place(x, i, faint.length, 330, 460)) };
}

/* ---------- The year as a quilt: a square a day, coloured by how it felt ---------- */
export const FEEL_COLOR = { easy: '#7fd1a8', steady: '#8fb8ff', deep: '#b9a8ff', heavy: '#ffd59a' };
export function quilt(s, year, today) {
  return Array.from({ length: 12 }, (_, m) => Array.from({ length: daysInMonth(year, m + 1) }, (_, d) => {
    const date = ymd(year, m + 1, d + 1), day = (s.days || {})[date] || {};
    return { date, feel: day.feel || null, grateful: day.grateful || null, future: date > today, today: date === today };
  }));
}
