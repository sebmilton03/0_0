// Low tide, coming back in, welcome back, and the month close.
// Pure: state and dates in, true and kind words out. The basics (ate something, some water, rest)
// never reach here: they're never saved.

import { daysBetween, addDays } from './sebdate.js';
import { blocksOn } from './week.js';

/** Is the tide out? { on, from } plus the last finished low tide, if any. */
export function tideOf(s) {
  const t = s.tide || { on: false, history: [] };
  return { on: !!t.on, from: t.from || null, last: (t.history || []).slice(-1)[0] || null, welcomed: t.welcomed || null, asked: t.asked || null };
}

/** After a low tide: how long it was out, and the shifts that were planned in it (you say how many you missed). */
export function whileOut(s, from, to) {
  const days = Math.max(1, daysBetween(from, to));
  const shifts = Array.from({ length: days }, (_, i) => blocksOn(s, addDays(from, i)).filter(b => b.kind === 'work')).flat();
  return { days, planned: shifts.length, shiftHours: shifts.length ? shifts.reduce((t, b) => t + b.hours, 0) / shifts.length : 8 };
}
/** Missed shifts against the real breathing room: still covered, or short and the vault carries it. */
export function missedWords(n, shiftHours, roomHours) {
  if (!n) return 'No shifts missed.';
  const left = roomHours == null ? null : roomHours - n * shiftHours, sh = n === 1 ? '1 shift' : n + ' shifts';
  if (left == null) return sh + ' missed. That’s okay.';
  return left >= 0 ? `${sh} missed. Still covered, ${Math.round(left)} hours to spare.` : `${sh} missed. ${Math.round(-left)} hours short; the vault carries it.`;
}

/** Three quiet days in a row: no events at all. Might be good days, so the app only asks. */
export const QUIET_DAYS = 3;
export const AWAY_DAYS = 5;
export function shouldAsk(s, lastActive, today) {
  const t = tideOf(s);
  if (t.on || !lastActive) return false;
  if (t.asked && daysBetween(t.asked, today) < 14) return false;   // asked once; not again for two weeks
  return daysBetween(lastActive, today) >= QUIET_DAYS;
}

/* ---------- The month close ---------- */
/** Four facts about a month, none of them scores. */
export function monthFacts(s, month) {
  const inMonth = d => d.slice(0, 7) === month;
  const m = s.money || {}, paid = (m.paychecks || []).filter(c => inMonth(c.date));
  const hours = paid.reduce((t, c) => t + (+c.hours || 0), 0);
  const loanMoved = ((m.moves || {})[month] || {}).loan || 0;
  const habitDays = Object.entries(s.cues || {}).filter(([d, it]) => inMonth(d) && Object.keys(it).some(k => k.startsWith('h:') && it[k])).length;
  const grateful = Object.entries(s.days || {}).filter(([d, x]) => inMonth(d) && x.grateful).length;
  return { hours, loanMoved, habitDays, grateful };
}
export const named = s => Object.entries(s.months || {}).filter(([, x]) => x.name).sort((a, b) => (a[0] < b[0] ? 1 : -1));
