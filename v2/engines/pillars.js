// Where I am: five pillars, each a soft word, and the one next thing that needs you.
// Pure: it takes the state, what the live v1 apps last said, and the time, and returns words.
// Nothing here writes anything.

import { weekOf, daysBetween } from './sebdate.js';

export const PILLARS = {
  home:   { name: 'Home',   question: 'Did the weekly reset happen?', good: 'tidy',    needs: 'reset day', feed: 'One tap a week, when the reset’s done.' },
  money:  { name: 'Money',  question: 'Is there breathing room this month?', good: 'steady', needs: 'heads up', feed: 'Reads Valley and Money for now.' },
  food:   { name: 'Food',   question: 'Is meal prep done this week?', good: 'fed',     needs: 'prep day',  feed: 'One tap a week, when prep’s done.' },
  school: { name: 'School', question: 'Are classes and study on track?', good: 'on path', needs: 'catching up', feed: 'Reads the Study timer for now.' },
  sleep:  { name: 'Sleep',  question: 'Did I sleep enough?', good: 'rested', needs: 'not yet', feed: 'One tap each morning.' },
};
export const ORDER = ['home', 'money', 'food', 'school', 'sleep'];
export const SLEEP = ['rested', 'okay', 'tired'];
const NEXT_ORDER = ['sleep', 'money', 'home', 'food', 'school'];

/**
 * s:     the v2 state ({ places, ticks, sleep, settings })
 * v1:    { valleyLine, valleyState, studyState } read from the live apps, any may be null
 * today: 'YYYY-MM-DD', hour: 0-23
 * Returns { pillars: [{ key, name, word, needs, detail, question }], next, chillin }.
 */
export function where(s, v1, today, hour) {
  const words = (s.settings && s.settings.words) || {};
  const week = weekOf(today);
  const thisWeek = k => ((s.ticks || {})[k] || []).some(d => d >= week.start && d <= week.end);
  const out = [];
  for (const key of ORDER) {
    if (!(s.places || []).includes(key)) continue;
    const P = PILLARS[key], w = { ...P, ...(words[key] || {}) };
    let word = w.good, needs = false, detail = '', quiet = false, urgent = false;
    if (key === 'home' || key === 'food') {
      needs = !thisWeek(key);
      word = needs ? w.needs : w.good;
      detail = needs ? 'Not yet this week.' : 'Done this week.';
    } else if (key === 'sleep') {
      const how = (s.sleep || {})[today];
      if (how) { word = (words.sleep && words.sleep[how]) || how; detail = 'You said ' + how + ' this morning.'; }
      else { word = w.needs; needs = hour < 14; quiet = !needs; detail = 'One tap: rested, okay or tired.'; }
    } else if (key === 'money') {
      const vl = v1 && v1.valleyLine;
      if (!vl || !vl.split) { word = 'not set'; quiet = true; detail = 'Set up Valley in the old app, and it shows here.'; }
      else {
        const left = daysBetween(today, vl.split);
        needs = left <= 0 || vl.kind === 'check';
        if (left <= 0) urgent = true;
        word = needs ? w.needs : w.good;
        detail = (left <= 0 ? 'Dam Day: time to split.' : (vl.kind === 'check' ? vl.note + '. ' : 'On track. ') + 'Dam Day in ' + left + (left === 1 ? ' day.' : ' days.'));
      }
    } else if (key === 'school') {
      const st = v1 && v1.studyState;
      if (!st || !st.target) { word = 'not set'; quiet = true; detail = 'Set a weekly target in Study, and it shows here.'; }
      else {
        const mins = week.days.reduce((t, d) => t + ((st.days || {})[d] || 0), 0), goal = st.target * 60;
        const elapsed = daysBetween(week.start, today) + 1, pace = goal * elapsed / 7;
        const ok = mins >= goal || mins >= pace * 0.8;
        word = ok ? w.good : w.needs;
        detail = (mins / 60).toFixed(1).replace(/\.0$/, '') + ' of ' + st.target + ' hours this week.';
      }
    }
    out.push({ key, name: w.name, word, needs, quiet, urgent, detail, question: w.question });
  }
  // Dam Day itself comes before everything; otherwise the gentle order.
  const next = out.find(p => p.urgent) || NEXT_ORDER.map(k => out.find(p => p.key === k && p.needs)).find(Boolean) || null;
  return { pillars: out, next, chillin: !next };
}

/** The line for the one next thing, in plain words. */
export function nextLine(p) {
  if (!p) return null;
  if (p.key === 'sleep') return { title: 'How did you sleep?', sub: 'One tap. That’s all.' };
  if (p.key === 'home') return { title: 'The weekly reset', sub: 'Tick it when it’s done. Five minutes counts.' };
  if (p.key === 'food') return { title: 'Meal prep', sub: 'Tick it when it’s done.' };
  if (p.key === 'money') return { title: 'Money: ' + p.word, sub: p.detail };
  return { title: p.name + ': ' + p.word, sub: p.detail };
}
