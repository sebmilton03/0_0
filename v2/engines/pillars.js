// Where I am: six pillars, each a soft word, and the one next thing that needs you.
// Pure: it takes v2's own state and the time, and returns words. Nothing here writes anything,
// and nothing here reads the old apps.

import { weekOf, daysBetween, damDay, weekday, addDays } from './sebdate.js';

export const PILLARS = {
  home:   { name: 'Home',   question: 'Did the weekly reset happen?', good: 'tidy', needs: 'reset day', rest: 'resting',
            feed: 'One tap a week, when the reset’s done.', why: 'A reset room is one less thing in your head.' },
  money:  { name: 'Money',  question: 'Is there breathing room this month?', good: 'steady', needs: 'heads up', rest: 'not set',
            feed: 'Paychecks and Dam Day, in Money.', why: 'Money stops deciding your days.' },
  food:   { name: 'Food',   question: 'Is meal prep done this week?', good: 'fed', needs: 'prep day', rest: 'resting',
            feed: 'One tap a week, when prep’s done.', why: 'Fed days are easier days.' },
  school: { name: 'School', question: 'Are classes and study on track?', good: 'on path', needs: 'catching up', rest: 'not set',
            feed: 'The study timer, in Study.', why: 'School is the road to OSU.' },
  sleep:  { name: 'Sleep',  question: 'Did I sleep enough?', good: 'rested', needs: 'not yet', rest: 'not yet',
            feed: 'One tap each morning: rested, okay or tired.', why: 'Rested days make pulls weaker and study easier.' },
  people: { name: 'People', question: 'Spent real time with someone this week?', good: 'connected', needs: 'reach out', rest: 'this week',
            feed: 'One tap on Sunday.', why: 'Your people are part of the plan, not a break from it.' },
};
export const ORDER = ['home', 'money', 'food', 'school', 'sleep', 'people'];
export const SLEEP = ['rested', 'okay', 'tired'];
const NEXT_ORDER = ['sleep', 'money', 'home', 'food', 'people', 'school'];

const ticked = (s, k, from, to) => ((s.ticks || {})[k] || []).some(d => d >= from && d <= to);
const checkin = (s, k, from, to) => ((s.checkins || {})[k] || []).filter(c => c.date >= from && c.date <= to).pop() || null;

/**
 * s:     v2 state ({ places, ticks, checkins, sleep, settings, money?, study? })
 * today: 'YYYY-MM-DD', hour: 0-23
 * extra: what places worked out for today: { money: { ready, room, damDone }, study: { target, days } }.
 * Returns { pillars: [{ key, name, word, needs, quiet, urgent, detail, question }], next, chillin, allGood }.
 */
export function where(s, today, hour, extra = {}) {
  const words = (s.settings && s.settings.words) || {};
  const week = weekOf(today), sunday = weekday(today) === 6;
  const out = [];
  for (const key of ORDER) {
    if (!(s.places || []).includes(key)) continue;
    const P = PILLARS[key], w = { ...P, ...(words[key] || {}) };
    let word = w.good, needs = false, detail = '', quiet = false, urgent = false;
    if (key === 'home' || key === 'food') {
      needs = !ticked(s, key, week.start, week.end);
      word = needs ? w.needs : w.good;
      detail = needs ? 'Not yet this week.' : 'Done this week.';
    } else if (key === 'sleep') {
      const how = (s.sleep || {})[today];
      if (how) { word = (words.sleep && words.sleep[how]) || how; detail = 'You said ' + how + ' this morning.'; }
      else { word = w.needs; needs = hour < 14; quiet = !needs; detail = 'One tap: rested, okay or tired.'; }
    } else if (key === 'people') {
      const c = checkin(s, 'people', week.start, week.end);
      if (c && c.answer === 'yes') { word = w.good; detail = 'Real time with someone this week.'; }
      else if (c) { word = 'quiet week'; quiet = true; detail = 'A quiet week. They happen.'; }
      else if (sunday) { word = w.needs; needs = true; detail = 'One tap: did you spend real time with someone this week?'; }
      else { word = w.rest; quiet = true; detail = 'Sunday asks once. Tap now if it already happened.'; }
    } else if (key === 'money') {
      const m = extra.money || s.money;
      if (!m || !m.ready) { word = w.rest; quiet = true; detail = 'Set up Money and this word becomes real.'; }
      else {
        const [y, mo] = today.split('-').map(Number), dam = damDay(y, mo), left = daysBetween(today, dam);
        const closed = (m.damDone || []).includes(today.slice(0, 7));
        urgent = left === 0 && !closed;
        needs = urgent || (m.room != null && m.room < 0);
        word = needs ? w.needs : w.good;
        detail = closed ? 'Dam Day is done for this month.' : urgent ? 'Dam Day: time to split.' :
          (m.room != null ? (m.room >= 0 ? Math.round(m.room) + ' hours of breathing room. ' : Math.round(-m.room) + ' hours short this month. ') : '') +
          'Dam Day in ' + left + (left === 1 ? ' day.' : ' days.');
      }
    } else if (key === 'school') {
      const st = extra.study || s.study;
      if (!st || !st.target) { word = w.rest; quiet = true; detail = 'Set a weekly target in Study and this word becomes real.'; }
      else {
        const mins = week.days.reduce((t, d) => t + ((st.days || {})[d] || 0), 0), goal = st.target * 60;
        const elapsed = daysBetween(week.start, today) + 1, pace = goal * elapsed / 7;
        word = mins >= goal || mins >= pace * 0.8 ? w.good : w.needs;
        detail = (mins / 60).toFixed(1).replace(/\.0$/, '') + ' of ' + st.target + ' hours this week.';
      }
    }
    out.push({ key, name: w.name, word, needs, quiet, urgent, detail, question: w.question });
  }
  // Dam Day itself comes before everything; otherwise the gentle order. School never nags.
  const next = out.find(p => p.urgent) || NEXT_ORDER.map(k => out.find(p => p.key === k && p.needs)).find(Boolean) || null;
  return { pillars: out, next, chillin: !next, allGood: out.length > 0 && out.every(p => !p.needs && !p.quiet) };
}

/** The one next thing, in plain words. */
export function nextLine(p) {
  if (!p) return null;
  if (p.key === 'sleep') return { title: 'How did you sleep?', sub: 'One tap. That’s all.' };
  if (p.key === 'home') return { title: 'The weekly reset', sub: 'Tick it when it’s done. Five minutes counts.' };
  if (p.key === 'food') return { title: 'Meal prep', sub: 'Tick it when it’s done.' };
  if (p.key === 'people') return { title: 'Real time with someone this week?', sub: 'One tap. Either answer is fine.' };
  return { title: p.name + ' · ' + p.word, sub: p.detail };
}

/** The last 7 days of one pillar, oldest first, for the soft view in its sheet. Each day: 0 none, 1-3 how it went. */
export function lastWeek(s, key, today) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(today, i - 6);
    let v = 0;
    if (key === 'sleep') v = { rested: 3, okay: 2, tired: 1 }[(s.sleep || {})[d]] || 0;
    else if (key === 'home' || key === 'food') v = ((s.ticks || {})[key] || []).includes(d) ? 3 : 0;
    else if (key === 'people') { const c = ((s.checkins || {}).people || []).find(x => x.date === d); v = c ? (c.answer === 'yes' ? 3 : 1) : 0; }
    else if (key === 'school') v = Math.min(3, Math.ceil((((s.study || {}).days || {})[d] || 0) / 60));
    return { date: d, v };
  });
}
