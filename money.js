// 0_0 — money.
// Two numbers: the hours you still need to work to fund next month, and your pocket money.
// Nothing is planned ahead and nothing is remembered: every open works it out fresh from what
// you've logged, so there's no schedule to fall behind on.
'use strict';

const KEY = '0_0-money-v1';  // +1 lives on the same site (sebmilton03.github.io), so keys must not collide
const MAX_WEEK = 50;         // more hours a week than this is out of reach: red, and say so
const RATE_CHECKS = 3;       // $/hr is the average of your latest checks, so a raise shows up fast

/* ---------- Dates ----------
   Days are whole numbers (days since 1970), same as +1. Nothing uses clock times, so daylight
   saving can't shift a date. */
const DAY = 864e5;
const dayOf = s => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / DAY;
const isoOf = d => new Date(d * DAY).toISOString().slice(0, 10);
function partsOf(d) {
  const x = new Date(d * DAY);
  return { y: x.getUTCFullYear(), m: x.getUTCMonth(), date: x.getUTCDate(), wd: x.getUTCDay() };
}
const monthStart = (y, m) => Date.UTC(y, m, 1) / DAY;
const monthEnd = (y, m) => Date.UTC(y, m + 1, 1) / DAY - 1;
function today() {
  const n = new Date();
  return Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()) / DAY;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const short = s => s.slice(0, 3);
const fmtDay = d => { const p = partsOf(d); return short(WEEKDAYS[p.wd]) + ' ' + short(MONTHS[p.m]) + ' ' + p.date; };  // Mon Oct 12
const fmtLong = d => { const p = partsOf(d); return WEEKDAYS[p.wd] + ', ' + short(MONTHS[p.m]) + ' ' + p.date; };   // Monday, Oct 12
function fmtRange(a, b) {                                                                                           // Oct 5 – 11
  const pa = partsOf(a), pb = partsOf(b);
  return short(MONTHS[pa.m]) + ' ' + pa.date + ' – ' + (pa.m === pb.m ? '' : short(MONTHS[pb.m]) + ' ') + pb.date;
}
const money = n => (n < -0.5 ? '−$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US');
const cents = n => (n < 0 ? '−$' : '$') + Math.abs(n).toFixed(2);
const plural = (n, word) => n + ' ' + word + (n === 1 ? '' : 's');

/* ---------- Pay schedule ----------
   One pay stub fixes the whole schedule: a check every `every` days (7 or 14), each paying for
   the period that ended `lag` days before it. Paid Aug 31 for Aug 10–23 → every 14, lag 8. */
function stubToSource(payIso, startIso, endIso) {
  if (!payIso || !startIso || !endIso) return { error: 'Fill in all three dates off the stub.' };
  const pay = dayOf(payIso), start = dayOf(startIso), end = dayOf(endIso);
  const every = end - start + 1, lag = pay - end;
  if (every !== 7 && every !== 14) return { error: 'The pay period should be 1 or 2 weeks long (it’s ' + every + ' days).' };
  if (lag < 0 || lag > 14) return { error: 'The pay date should be 0–14 days after the period ends.' };
  return { id: 'job', name: 'Job', payDate: payIso, every, lag };
}

function schedule(src) {
  const anchor = dayOf(src.payDate), every = src.every, lag = src.lag;
  const first = anchor - lag - every + 1;   // start of the period the stub paid for
  const period = k => { const start = first + k * every, end = start + every - 1; return { start, end, pay: end + lag }; };
  return {
    every, lag,
    periodAt: t => period(Math.floor((t - first) / every)),
    weekAt: t => { const start = first + Math.floor((t - first) / 7) * 7; return { start, end: start + 6 }; },
    nextPay: t => anchor + (Math.floor((t - anchor) / every) + 1) * every,
    paidIn(y, m) {   // every period whose check lands in month m of year y
      const out = [];
      for (let k = Math.ceil((monthStart(y, m) - anchor) / every); anchor + k * every <= monthEnd(y, m); k++) out.push(period(k));
      return out;
    },
  };
}

/* ---------- Windows ----------
   A month is funded by the checks that land in the month before it, so what counts is the work
   behind those checks: 4 weeks most months, 6 weeks twice a year when three checks land. */
function windowFor(sch, y, m) {
  const periods = sch.paidIn(y, m);
  const start = periods[0].start, end = periods[periods.length - 1].end;
  const weeks = [];
  for (let d = start; d <= end; d += 7) weeks.push({ start: d, end: d + 6 });
  const f = new Date(Date.UTC(y, m + 1, 1));
  return { funds: f.getUTCMonth(), periods, start, end, weeks };
}
function windowAt(sch, t) {
  const p = partsOf(sch.periodAt(t).pay);
  return windowFor(sch, p.y, p.m);
}

/* ---------- Saved data ----------
   Settings plus one list of events. Every event has the same shape,
   { id, type, start, end, label, ref, value }, so a calendar later is a view, not a rewrite.
     hours:  a week of work, value = hours (null = "don't know, the check will fill it in")
     check:  a paycheck, value = net pay, plus `hours` off the stub; start/end = the period it paid
     pocket: the pocket card balance on a day */
function load() {
  try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; }
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
}
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const eventsOf = (s, type) => s.events.filter(e => e.type === type).sort((a, b) => dayOf(a.start) - dayOf(b.start));
function lookup(s) {
  const hours = new Map(), checks = new Map();
  for (const e of s.events) {
    if (e.type === 'hours') hours.set(dayOf(e.start), e);
    if (e.type === 'check') checks.set(dayOf(e.start), e);
  }
  const pockets = eventsOf(s, 'pocket');
  return { hours, checks, pocket: pockets[pockets.length - 1] || null };
}
function recentChecks(s) { return eventsOf(s, 'check').filter(c => c.hours > 0).slice(-RATE_CHECKS); }
function hourlyRate(s) {
  const cs = recentChecks(s), hrs = cs.reduce((t, c) => t + c.hours, 0);
  return hrs ? cs.reduce((t, c) => t + c.value, 0) / hrs : null;
}
const monthTotal = s => s.bills.reduce((t, b) => t + (+b.amount || 0), 0) + (+s.pocket || 0);

/* ---------- The math ----------
   hours left = (what next month costs − what this window has earned) ÷ your $/hr
   per week   = hours left ÷ weeks left in the window
   A check that's in counts as paid. Weeks without one count as logged hours × $/hr. */
function tally(w, look, rate, target, ref) {
  const t = { paid: 0, logged: 0, done: 0, total: w.weeks.length, unknown: [], waitingOn: [], target };
  for (const p of w.periods) {
    const weeks = w.weeks.filter(x => x.start >= p.start && x.end <= p.end);
    const check = look.checks.get(p.start);
    if (check) { t.paid += check.value; t.done += weeks.length; continue; }
    for (const wk of weeks) {
      if (wk.end >= ref) continue;   // not finished yet
      t.done++;
      const h = look.hours.get(wk.start);
      if (h && h.value != null) t.logged += h.value * rate;
      else if (h) { t.unknown.push(wk); if (!t.waitingOn.includes(p.pay)) t.waitingOn.push(p.pay); }
    }
  }
  t.known = t.paid + t.logged;
  t.pace = target * t.done / t.total;
  t.ahead = t.known - t.pace;
  t.covered = t.known >= target;
  t.toGo = Math.max(0, target - t.known);
  t.weeksLeft = t.total - t.done;
  t.hoursLeft = t.toGo / rate;
  t.perWeek = t.weeksLeft ? t.hoursLeft / t.weeksLeft : 0;
  t.lastPay = w.periods[w.periods.length - 1].pay;
  t.estimate = w.periods.some(p => !look.checks.get(p.start));
  return t;
}

// Everything the home screen needs, as of today.
function getStatus(s, now = today()) {
  const sch = schedule(s.sources[0]);
  const look = lookup(s);
  const rate = hourlyRate(s);
  const target = monthTotal(s);

  // Log a week on its last day (after a Sunday shift) and it counts from then.
  const cur = sch.weekAt(now);
  const ref = cur.end === now && look.hours.has(cur.start) ? now + 1 : now;
  const rp = partsOf(ref);

  // This month's checks fund next month. Once all the work behind them is done, that month is
  // "locked in" and stays on screen until it starts. The window you can still move is the next one.
  const thisMonth = windowFor(sch, rp.y, rp.m);
  const lockedWin = thisMonth.end < ref ? thisMonth : null;
  const activeWin = lockedWin ? windowAt(sch, ref) : thisMonth;

  // What's due: checks that have landed, finished weeks no check covers yet, a fresh pocket balance.
  const due = { checks: [], weeks: [], pocket: false };
  for (const w of lockedWin ? [lockedWin, activeWin] : [activeWin]) {
    for (const p of w.periods) {
      const has = look.checks.has(p.start), landed = p.pay <= now;
      if (landed && !has) due.checks.push(p);
      if (has || landed) continue;
      for (const wk of w.weeks) {
        if (wk.start >= p.start && wk.end <= p.end && wk.end < ref && !look.hours.has(wk.start)) due.weeks.push(wk);
      }
    }
  }
  const np = partsOf(now), pk = look.pocket;
  due.pocket = !pk || dayOf(pk.start) < now - 7 || dayOf(pk.start) < monthStart(np.y, np.m);
  const anyDue = due.checks.length > 0 || due.weeks.length > 0 || due.pocket;

  const act = rate ? tally(activeWin, look, rate, target, ref) : null;
  const lock = rate && lockedWin ? tally(lockedWin, look, rate, target, ref) : null;

  // Pocket: what's left per day until it's topped up at month end, against what it gets per day.
  let pocket = null;
  if (pk) {
    const d = dayOf(pk.start), p = partsOf(d);
    const daysLeft = monthEnd(p.y, p.m) - d + 1;
    const budget = s.pocket / (monthEnd(p.y, p.m) - monthStart(p.y, p.m) + 1);
    const perDay = pk.value / daysLeft;
    pocket = { balance: pk.value, daysLeft, perDay, budget, fine: perDay >= budget - 0.005, asOf: d };
  }

  // Silence has to be earned: fresh data, on pace, nothing unknown, pocket fine.
  const chillin = !anyDue && !!act
    && (act.covered || act.ahead >= -0.5) && !act.unknown.length
    && (!lock || (lock.covered && !lock.unknown.length))
    && !!pocket && pocket.fine;

  // When the app next needs you: the end of this week or the next payday, whichever comes first.
  const weekEnd = ref > cur.end ? cur.end + 7 : cur.end;
  const nextPay = sch.nextPay(now);
  const next = nextPay < weekEnd ? { day: nextPay, check: true } : { day: weekEnd, check: false };

  return { now, ref, rate, target, due, anyDue, activeWin, lockedWin, act, lock, pocket, chillin, next, sch };
}

/* ---------- Screens ---------- */
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const GEAR = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065z"/><path d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0"/></svg>';
const CLOSE = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6l-12 12"/><path d="M6 6l12 12"/></svg>';
const BACK = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6l6 6"/></svg>';

const topBar = (face, dim) => '<div class="top' + (dim ? ' dim' : '') + '"><span class="mark">' + face + '</span>' +
  '<button class="icon" data-go="settings" aria-label="Settings">' + GEAR + '</button></div>';

let state = null;

function renderHome() {
  const s = getStatus(state);
  let html;
  if (s.anyDue || !s.act) html = revealHTML(s);
  else if (s.chillin) html = chillinHTML(s);
  else html = busyHTML(s);
  $('home').innerHTML = html;
  return s;
}

// A week, check or pocket balance is due: don't guess. Logging is how you find out.
function revealHTML(s) {
  const d = s.due, n = d.weeks.length;
  let title, text;
  if (n === 1) {
    const wk = d.weeks[0];
    const closed = s.lockedWin && wk.end === s.lockedWin.end;
    title = 'How’d last<br>week go?';
    text = (closed ? MONTHS[s.lockedWin.funds] + '’s window closed ' + WEEKDAYS[partsOf(wk.end).wd] + '.<br>Log it to see where ' + MONTHS[s.lockedWin.funds] + ' landed,<br>and whether you’re chillin.'
      : 'Log it to see whether you’re chillin.');
  } else if (n > 1) {
    title = 'Catch me up';
    text = plural(n, 'week') + ' to log. Put in what you’ve got.<br>A week you don’t know gets filled in<br>when its check lands.';
  } else if (d.checks.length) {
    title = 'Payday';
    text = 'Your ' + fmtDay(d.checks[d.checks.length - 1].pay) + ' check landed.<br>Put it in to see if you’re chillin.';
  } else {
    title = partsOf(s.now).date <= 7 ? 'New month' : 'Pocket check';
    text = 'What’s on your pocket card?<br>Then you’ll know if you’re chillin.';
  }
  const last = state.lastLine
    ? '<div class="card c" style="margin-top:30px"><p class="hint" style="margin:0">Last update · ' + fmtDay(dayOf(state.lastLine.day)) + '</p><p style="margin-top:4px;font-size:16px">' + esc(state.lastLine.text) + '</p></div>'
    : '';
  const one = n === 1 && !d.checks.length ? ' ' + fmtRange(d.weeks[0].start, d.weeks[0].end) : '';
  return topBar('0_0') + '<div class="spacer"></div><div class="say"><h1>' + title + '</h1><p>' + text + '</p></div>' + last +
    '<div class="spacer"></div><button class="btn" data-go="log">Log' + one + '</button>';
}

// Nothing to do. Less on screen, not more: no button, no numbers, no praise.
function chillinHTML(s) {
  const A = MONTHS[s.activeWin.funds];
  const hours = s.lock ? MONTHS[s.lockedWin.funds] + '’s covered, ' + A + '’s on track.'
    : s.act.covered ? A + '’s covered.' : A + '’s on track.';
  const p = s.pocket;
  remember('You were chillin');
  return topBar('-_-', true) + '<div class="spacer"></div><div class="say chill" data-swipe>' +
    '<h1>You’re<br>chillin</h1><p>' + hours + '<br>Pocket’s got ' + money(p.balance) + ' for ' + plural(p.daysLeft, 'day') + '.</p></div>' +
    '<div class="spacer"></div><button class="foot" data-go="log">' + fmtDay(s.now) + ' · next: ' +
    (s.next.check ? 'your check, ' + fmtDay(s.next.day) : fmtDay(s.next.day)) + '</button>';
}

// Something to do: the numbers, and the way back to on track.
function busyHTML(s) {
  const a = s.act, A = MONTHS[s.activeWin.funds];
  const red = !a.covered && a.perWeek > MAX_WEEK;
  const lastWeek = a.weeksLeft === 1;
  let hero;
  if (a.covered) {
    hero = '<div class="label">Funding ' + A + '</div><div class="big word"><b class="green">Covered</b></div>' +
      '<p class="sub">every hour now is extra</p>';
    remember(A + ' was covered');
  } else {
    const h = Math.round(a.hoursLeft);
    hero = '<div class="label">Funding ' + A + ' · ' + (lastWeek ? 'last week' : a.weeksLeft + ' weeks left') + '</div>' +
      '<div class="big"><b' + (red ? ' class="red"' : '') + '>' + h + '</b><span>hrs</span></div>' +
      '<p class="sub">' + (lastWeek ? 'this week · <b>by ' + fmtDay(s.activeWin.end) + '</b>' : 'left · <b>about ' + Math.round(a.perWeek) + ' a week</b>') + '</p>';
    remember(lastWeek ? h + ' hrs to go that week' : h + ' hrs left, about ' + Math.round(a.perWeek) + ' a week');
  }

  const pct = x => Math.max(0, Math.min(100, x / a.target * 100));
  const bar = '<div class="bar"><i class="paid" style="width:' + pct(a.paid) + '%"></i>' +
    '<i class="logged" style="left:' + pct(a.paid) + '%;width:' + (pct(a.known) - pct(a.paid)) + '%"></i>' +
    (a.done && !a.covered ? '<i class="tick" style="left:' + pct(a.pace) + '%"></i>' : '') + '</div>';
  const ahead = Math.round(a.ahead);
  const paceL = a.covered ? '<span class="green">' + money(a.known - a.target) + ' extra</span>'
    : ahead > 0 ? '<span class="green">' + money(ahead) + ' ahead of pace</span>'
    : ahead === 0 ? '<span>on pace</span>'
    : '<span class="' + (red ? 'red' : 'amber') + '">' + money(-ahead) + ' behind pace</span>';
  const legend = [a.paid ? '<span><i style="background:var(--green)"></i>paid ' + money(a.paid) + '</span>' : '',
    a.logged ? '<span><i style="background:var(--green-faint)"></i>logged ' + money(a.logged) + '</span>' : ''].join('');

  const notes = [];
  if (red) notes.push('Even at ' + MAX_WEEK + ' a week you’d be about ' + money(a.toGo - MAX_WEEK * a.weeksLeft * s.rate) + ' short. Plan to cover that at month end.');
  else if (lastWeek && !a.covered) notes.push('After ' + fmtDay(s.activeWin.end) + ', ' + A + '’s locked in.');
  if (a.unknown.length) notes.push(plural(a.unknown.length, 'week') + ' unknown until your ' + fmtDay(a.waitingOn[0]) + ' check.');
  if (s.lock) {
    const L = MONTHS[s.lockedWin.funds], l = s.lock;
    const confirmNote = l.estimate ? ' · estimate until your ' + fmtDay(l.lastPay) + ' check' : '';
    if (l.unknown.length) notes.push(L + ': ' + plural(l.unknown.length, 'week') + ' unknown until your ' + fmtDay(l.waitingOn[0]) + ' check.');
    else if (l.covered) notes.push('<span class="green">' + L + '’s covered</span>' + confirmNote);
    else notes.push('<span class="amber">' + L + ': about ' + money(l.toGo) + ' short</span>, cover it at month end' + confirmNote);
  }

  const p = s.pocket;
  const asOf = state.lastLog && dayOf(state.lastLog) !== s.now ? '<p class="asof">as of ' + fmtDay(dayOf(state.lastLog)) + '</p>' : '';
  return topBar('0_0') + '<div class="hero">' + hero + '</div>' + bar +
    '<div class="barl">' + paceL + (a.covered ? '' : '<span>' + money(a.toGo) + ' to go</span>') + '</div>' +
    (legend ? '<div class="legend">' + legend + '</div>' : '') +
    (notes.length ? '<div class="notes">' + notes.map(n => '<p>' + n + '</p>').join('') + '</div>' : '') +
    '<hr><div class="label c">Pocket</div><div class="pocket' + (p.fine ? '' : ' amber') + '">' + money(p.balance) + '</div>' +
    '<p class="sub">' + plural(p.daysLeft, 'day') + ' · <b>' + cents(p.perDay) + ' a day</b></p>' + asOf +
    '<div class="spacer"></div><button class="btn" data-go="log">Log</button>';
}

// The last thing home said, shown on the "needs an update" screen.
function remember(text) {
  const day = isoOf(today());
  if (state.lastLine && state.lastLine.text === text && state.lastLine.day === day) return;
  state.lastLine = { day, text };
  save();
}

/* ---------- Log ----------
   Only asks for what's due. Nothing is pre-filled: typing it off the stub is how you check it. */
let logMode = 'due', confirmWarn = false;

function weekRow(wk, title, saved, canSkip) {
  const v = saved ? (saved.value == null ? '' : saved.value) : '';
  const unknown = saved && saved.value == null;
  return '<div class="sec" data-week="' + isoOf(wk.start) + '"' + (unknown ? ' data-unknown="1"' : '') + '>' +
    '<span class="label">' + title + ' · ' + fmtRange(wk.start, wk.end) + '</span>' +
    '<label class="field' + (unknown ? ' unknown' : '') + '"><input data-k="hours" inputmode="decimal" autocomplete="off" value="' + v + '" placeholder="' + (unknown ? '?' : '0') + '"' + (unknown ? ' disabled' : '') + '>' +
    '<span class="r" data-est>hrs</span></label>' +
    (canSkip ? '<button class="link" data-act="unknown">' + (unknown ? 'I know it now' : 'Don’t know? Its check will fill it in') + '</button>' : '') + '</div>';
}
function checkRow(p, saved, look) {
  let logged = 0, any = false;
  for (let d = p.start; d <= p.end; d += 7) { const h = look.hours.get(d); if (h && h.value != null) { logged += h.value; any = true; } }
  return '<div class="sec" data-check="' + isoOf(p.start) + '" data-end="' + isoOf(p.end) + '" data-pay="' + isoOf(p.pay) + '" data-logged="' + (any ? logged : '') + '">' +
    '<span class="label">' + fmtDay(p.pay) + ' check · pays ' + fmtRange(p.start, p.end) + '</span>' +
    '<div class="pair"><label class="field"><span class="pre">$</span><input data-k="net" inputmode="decimal" autocomplete="off" placeholder="net" value="' + (saved ? saved.value : '') + '"></label>' +
    '<label class="field"><input data-k="hours" inputmode="decimal" autocomplete="off" placeholder="0" value="' + (saved ? saved.hours : '') + '"><span class="r">hrs</span></label></div>' +
    '<p class="hint" data-match>' + (saved ? '' : 'Off your stub. Take-home pay, not before tax.') + '</p></div>';
}

function renderLog() {
  const s = getStatus(state), look = lookup(state);
  let rows = '';
  if (logMode === 'due') {
    for (const p of s.due.checks) rows += checkRow(p, null, look);
    s.due.weeks.forEach(wk => { rows += weekRow(wk, s.due.weeks.length > 1 ? 'Week' : 'Last week', null, true); });
    const cur = s.sch.weekAt(s.now);
    if (cur.end === s.now && !look.hours.has(cur.start)) rows += weekRow(cur, 'This week', null, false);
    if (!rows) rows = '<p class="done-all">Weeks and checks are all in.</p>';
    const last = look.pocket, np = partsOf(s.now);
    rows += '<div class="sec" data-pocket><span class="label">Pocket card</span><label class="field"><span class="pre">$</span>' +
      '<input data-k="pocket" inputmode="decimal" autocomplete="off" placeholder="0">' +
      '<span class="r">' + plural(monthEnd(np.y, np.m) - s.now + 1, 'day') + ' left</span></label>' +
      (last ? '<p class="hint">Last time: ' + money(last.value) + ' on ' + fmtDay(dayOf(last.start)) + '. Read it off your bank app.</p>' : '') + '</div>' +
      '<button class="link" data-act="earlier">‹ Fix something earlier</button>';
  } else {
    // The last eight finished weeks no check covers, and the last four checks, with what's saved.
    const weeks = [];
    for (let d = s.sch.weekAt(s.ref).start - 7; weeks.length < 8 && d > s.ref - 120; d -= 7) {
      if (!look.checks.has(s.sch.periodAt(d).start)) weeks.push({ start: d, end: d + 6 });
    }
    weeks.forEach(wk => { rows += weekRow(wk, 'Week', look.hours.get(wk.start), true); });
    eventsOf(state, 'check').slice(-4).reverse().forEach(c => {
      const p = s.sch.periodAt(dayOf(c.start));
      rows += checkRow(p, c, look);
    });
    rows += '<p class="hint" style="margin-top:18px">Clear a box to delete what’s there.</p>' +
      '<button class="link" data-act="due">‹ Back to what’s due</button>';
  }
  $('log').innerHTML = '<div class="head"><button class="icon" data-go="home" aria-label="Close">' + CLOSE + '</button><h2>' + fmtLong(s.now) + '</h2></div>' +
    rows + '<p class="err" id="logMsg" hidden></p><div class="spacer"></div><button class="btn" data-act="saveLog">Done</button>';
  confirmWarn = false;
  refreshLogHints();
}

function num(v) { const n = parseFloat(String(v).replace(/[$,\s]/g, '')); return Number.isFinite(n) ? n : NaN; }

// Live feedback while typing: what the hours are worth, and whether the stub matches your log.
function refreshLogHints() {
  const rate = hourlyRate(state);
  document.querySelectorAll('#log [data-week]').forEach(row => {
    const h = num(row.querySelector('input').value), est = row.querySelector('[data-est]');
    est.textContent = row.dataset.unknown ? 'check fills it' : h > 0 && rate ? 'hrs ≈ ' + money(h * rate) : 'hrs';
  });
  document.querySelectorAll('#log [data-check]').forEach(row => {
    const hrs = num(row.querySelector('[data-k="hours"]').value), logged = row.dataset.logged, m = row.querySelector('[data-match]');
    if (!(hrs > 0) || logged === '') return;
    m.className = 'hint' + (Math.abs(hrs - +logged) < 0.01 ? ' green' : '');
    m.textContent = Math.abs(hrs - +logged) < 0.01 ? '✓ Matches the ' + logged + ' hrs you logged.' : 'You logged ' + logged + ' hrs for those weeks. The stub wins.';
  });
}

function saveLog() {
  const now = today(), errs = [], warns = [], ops = [];
  const edit = logMode === 'earlier';
  document.querySelectorAll('#log [data-week]').forEach(row => {
    const start = row.dataset.week, raw = row.querySelector('input').value.trim();
    if (row.dataset.unknown) return ops.push(() => upsertHours(start, null));
    if (raw === '') { if (edit) ops.push(() => removeWhere('hours', start)); return; }
    const h = num(raw);
    if (!(h >= 0)) return errs.push('Hours for ' + fmtRange(dayOf(start), dayOf(start) + 6) + ' should be a number.');
    if (h > 80) warns.push(h + ' hrs in one week?');
    ops.push(() => upsertHours(start, h));
  });
  document.querySelectorAll('#log [data-check]').forEach(row => {
    const rn = row.querySelector('[data-k="net"]').value.trim(), rh = row.querySelector('[data-k="hours"]').value.trim();
    const { check: start, end, pay } = row.dataset;
    if (rn === '' && rh === '') { if (edit) ops.push(() => removeWhere('check', start)); return; }
    const net = num(rn), hrs = num(rh);
    if (!(net > 0) || !(hrs > 0)) return errs.push('Put in both the take-home pay and the hours for the ' + fmtDay(dayOf(pay)) + ' check.');
    if (net / hrs < 8 || net / hrs > 80) warns.push(cents(net / hrs) + ' an hour on the ' + fmtDay(dayOf(pay)) + ' check?');
    if (hrs > 160) warns.push(hrs + ' hrs on one check?');
    ops.push(() => upsertCheck(start, end, pay, net, hrs));
  });
  const pr = document.querySelector('#log [data-pocket] input');
  if (pr && pr.value.trim() !== '') {
    const v = num(pr.value);
    if (Number.isNaN(v)) errs.push('The pocket balance should be a number.');
    else {
      if (Math.abs(v) > 5000) warns.push(money(v) + ' on the pocket card?');
      ops.push(() => upsertPocket(isoOf(now), v));
    }
  }
  if (edit) {
    const cleared = [...document.querySelectorAll('#log [data-check]')].filter(r => r.querySelector('[data-k="net"]').value.trim() === '' && r.querySelector('[data-k="hours"]').value.trim() === '').length;
    if (cleared && cleared >= eventsOf(state, 'check').length) errs.push('Keep at least one check. It’s how your $/hr gets worked out.');
  }
  const msg = $('logMsg');
  if (errs.length) { msg.className = 'err'; msg.textContent = errs.join(' '); msg.hidden = false; return; }
  if (warns.length && !confirmWarn) {
    msg.className = 'warn'; msg.textContent = warns.join(' ') + ' Tap Done again if that’s right.'; msg.hidden = false;
    confirmWarn = true;
    return;
  }
  ops.forEach(f => f());
  if (ops.length) { state.lastLog = isoOf(now); save(); keep(); }
  go('home');
  const s = getStatus(state);
  $('home').classList.remove('reveal'); void $('home').offsetWidth; $('home').classList.add('reveal');
  buzz(s.chillin ? [30, 60, 30] : 15);
}

function upsertHours(startIso, value) {
  const e = state.events.find(x => x.type === 'hours' && x.start === startIso);
  if (e) e.value = value;
  else state.events.push({ id: newId(), type: 'hours', start: startIso, end: isoOf(dayOf(startIso) + 6), label: 'Week', ref: 'job', value });
}
function upsertCheck(startIso, endIso, payIso, net, hrs) {
  const e = state.events.find(x => x.type === 'check' && x.start === startIso);
  const label = fmtDay(dayOf(payIso)) + ' check';
  if (e) Object.assign(e, { value: net, hours: hrs, label });
  else state.events.push({ id: newId(), type: 'check', start: startIso, end: endIso, label, ref: 'job', value: net, hours: hrs });
}
function upsertPocket(dayIso, value) {
  state.events = state.events.filter(x => !(x.type === 'pocket' && x.start === dayIso));
  state.events.push({ id: newId(), type: 'pocket', start: dayIso, end: dayIso, label: 'Pocket card', ref: null, value });
}
function removeWhere(type, startIso) { state.events = state.events.filter(x => !(x.type === type && x.start === startIso)); }

/* ---------- Settings: opened twice a year ---------- */
function billsHTML(bills, pocket) {
  return bills.map((b, i) => '<div class="line" data-bill="' + i + '"><input class="name" data-k="label" placeholder="' + (['Rent', 'Car payment', 'Phone'][i] || 'What') + '" value="' + esc(b.label) + '">' +
    '<input class="amt" data-k="amount" inputmode="decimal" placeholder="$0" value="' + (b.amount === '' ? '' : esc(b.amount)) + '">' +
    '<button class="x" data-act="dropBill" data-i="' + i + '" aria-label="Remove">✕</button></div>').join('') +
    (pocket === undefined ? '' : '<div class="line"><span class="fixed">Pocket money</span><input class="amt" data-k="pocket" inputmode="decimal" placeholder="$0" value="' + esc(pocket) + '"><span class="x"></span></div>') +
    '<button class="add" data-act="addBill">Add a line</button>';
}
function readBills(root) {
  return [...root.querySelectorAll('[data-bill]')].map(l => ({ label: l.querySelector('[data-k="label"]').value.trim(), amount: l.querySelector('[data-k="amount"]').value.trim() }));
}
const cleanBills = bills => bills.filter(b => b.label || b.amount !== '').map(b => ({ label: b.label || 'Other', amount: num(b.amount) || 0 }));

function payWords(src) {
  const wd = WEEKDAYS[partsOf(dayOf(src.payDate)).wd];
  return (src.every === 14 ? 'Every other ' : 'Every ') + wd;
}
function threeCheckMonths(src, from) {
  if (src.every !== 14) return [];
  const sch = schedule(src), p = partsOf(from), out = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(Date.UTC(p.y, p.m + i, 1));
    if (sch.paidIn(d.getUTCFullYear(), d.getUTCMonth()).length === 3) out.push(short(MONTHS[d.getUTCMonth()]) + ' ' + d.getUTCFullYear());
  }
  return out;
}

let editingPay = false, draftBills = [];
function renderSettings() {
  const src = state.sources[0], now = today(), rate = hourlyRate(state), cs = recentChecks(state);
  const threes = threeCheckMonths(src, now);
  const pay = editingPay ? stubForm(src.payDate, isoOf(dayOf(src.payDate) - src.lag - src.every + 1), isoOf(dayOf(src.payDate) - src.lag)) +
      '<p class="err" id="payErr" hidden></p><div class="acts" style="margin-top:12px"><button class="ghost" data-act="cancelPay">Cancel</button><button class="btn" data-act="savePay">Save</button></div>'
    : '<div class="info"><span class="label">Paydays</span><div class="v">' + payWords(src) + '</div>' +
      '<p class="hint">Pays the ' + plural(src.every / 7, 'week') + ' that ended ' + plural(src.lag, 'day') + ' before. Next: ' + fmtDay(schedule(src).nextPay(now)) + '.' +
      (threes.length ? ' Three-check months: ' + threes.join(', ') + '.' : '') + '</p>' +
      '<button class="link" data-act="editPay">Change, off a newer stub</button></div>';
  $('settings').innerHTML = '<div class="head"><button class="icon" data-go="home" aria-label="Back">' + BACK + '</button><h2>Settings</h2></div>' +
    '<div class="sec"><span class="label">A month costs</span><div class="total" id="total">' + money(monthTotal(state)) + '</div>' +
    '<div id="bills">' + billsHTML(draftBills, state.pocket) + '</div>' +
    '<p class="hint">Just an adding machine. The app only uses the total. Pocket money lands at month end and rolls over.</p></div>' +
    '<div class="info"><span class="label">You take home</span><div class="v">' + (rate ? cents(rate) + ' <small>/ hr</small>' : '—') + '</div>' +
    '<p class="hint">' + (cs.length ? (cs.length === 1 ? 'From your check: ' : 'From your last ' + cs.length + ' checks: ') + cs.map(c => short(MONTHS[partsOf(dayOf(c.end) + src.lag).m]) + ' ' + partsOf(dayOf(c.end) + src.lag).date).join(' · ') + '. Nothing to type.' : 'Worked out from your checks.') + '</p></div>' +
    pay +
    '<div class="spacer"></div>' +
    '<button class="ghost" data-act="export" style="margin-top:28px">Export everything</button>' +
    '<button class="link c" data-act="import" style="display:block;width:100%;margin-top:14px;font-size:15px;color:var(--text)">Import a backup</button>' +
    '<p class="hint c">Browser storage can vanish. Export once a month.</p>';
}

function stubForm(pay, start, end) {
  return '<div class="dates" style="margin-top:12px">' +
    '<label class="date wide"><span>Pay date</span><input type="date" data-k="pay" value="' + (pay || '') + '"></label>' +
    '<label class="date"><span>Period from</span><input type="date" data-k="start" value="' + (start || '') + '"></label>' +
    '<label class="date"><span>Period to</span><input type="date" data-k="end" value="' + (end || '') + '"></label></div>';
}
const readStub = root => ({ pay: root.querySelector('[data-k="pay"]').value, start: root.querySelector('[data-k="start"]').value, end: root.querySelector('[data-k="end"]').value });

function exportAll() {
  const blob = new Blob([JSON.stringify({ app: '0_0', kind: 'money', exported: isoOf(today()), state }, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '0_0-backup-' + isoOf(today()) + '.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function validState(s) {
  return s && s.v === 1 && Array.isArray(s.bills) && Array.isArray(s.events) && Array.isArray(s.sources) && s.sources[0] && typeof s.sources[0].payDate === 'string';
}
$('importFile') && ($('importFile').onchange = e => {
  const f = e.target.files[0];
  if (!f) return;
  f.text().then(t => {
    let data; try { data = JSON.parse(t); } catch { data = null; }
    const s = data && data.state ? data.state : data;
    if (!validState(s)) return alert('That file isn’t a 0_0 backup.');
    if (state && !confirm('Replace everything with the backup from ' + (data.exported || 'that file') + '?')) return;
    state = s; save(); keep();
    history.replaceState(null, ''); show('home'); renderHome();
  }).finally(() => { e.target.value = ''; });
});

/* ---------- Setup: first open ----------
   Long on purpose. Your numbers live on your phone, not in the code, so the code can be public. */
let setup = { step: 0, bills: [{ label: '', amount: '' }, { label: '', amount: '' }, { label: '', amount: '' }], pocket: '', balance: '', pay: '', start: '', end: '', net: '', hours: '' };
const STEPS = 4;

function renderSetup() {
  const st = setup, dots = '<div class="steps">' + [1, 2, 3].map(i => '<i class="' + (i <= st.step ? 'on' : '') + '"></i>').join('') + '</div>';
  let body;
  if (st.step === 0) {
    body = '<div class="top"><span class="mark">0_0</span></div><div class="spacer"></div>' +
      '<div class="say" style="text-align:left"><h1>Two numbers.</h1><p class="intro"><b>How many hours</b> you need to work to fund next month, and <b>how much pocket money</b> you’ve got. When both are fine it says you’re chillin and shows nothing else.</p>' +
      '<p class="intro">Setup takes about three minutes. Grab your latest pay stub.</p></div><div class="spacer"></div>' +
      '<button class="btn" data-act="next">Start</button><button class="link c" data-act="import" style="display:block;width:100%;margin-top:14px">Restore a backup</button>';
  } else if (st.step === 1) {
    const total = cleanBills(st.bills).reduce((t, b) => t + b.amount, 0);
    body = '<div class="top">' + dots + '</div><h2 style="margin-top:22px;font-size:30px">What goes out each month?</h2>' +
      '<p class="intro">Everything except pocket money: rent, car, insurance, gas, groceries, phone, what you set aside. One line each, or one line with the total.</p>' +
      '<div class="total" id="total">' + money(total) + '</div><div id="bills">' + billsHTML(st.bills) + '</div>';
  } else if (st.step === 2) {
    body = '<div class="top">' + dots + '</div><h2 style="margin-top:22px;font-size:30px">Pocket money</h2>' +
      '<p class="intro">The one number that’s up to you. It lands at month end and <b>rolls over</b>: what you don’t spend carries on.</p>' +
      '<div class="sec"><span class="label">Goes on the card each month</span><label class="field"><span class="pre">$</span><input data-k="pocket" inputmode="decimal" value="' + esc(st.pocket) + '" placeholder="0"></label></div>' +
      '<div class="sec"><span class="label">On the card right now</span><label class="field"><span class="pre">$</span><input data-k="balance" inputmode="decimal" value="' + esc(st.balance) + '" placeholder="0"></label>' +
      '<p class="hint">Read it off your bank app.</p></div>';
  } else {
    body = '<div class="top">' + dots + '</div><h2 style="margin-top:22px;font-size:30px">Your latest pay stub</h2>' +
      '<p class="intro">Your paydays and your take-home rate get worked out from this. Nothing else to set.</p>' +
      stubForm(st.pay, st.start, st.end) +
      '<p class="hint" id="payWords"></p>' +
      '<div class="pair" style="margin-top:14px"><label class="field"><span class="pre">$</span><input data-k="net" inputmode="decimal" value="' + esc(st.net) + '" placeholder="net"></label>' +
      '<label class="field"><input data-k="hours" inputmode="decimal" value="' + esc(st.hours) + '" placeholder="0"><span class="r">hrs</span></label></div>' +
      '<p class="hint">Take-home pay (net), not before tax.</p>';
  }
  const nav = st.step === 0 ? '' : '<p class="err" id="setupErr" hidden></p><div class="spacer"></div><div class="acts"><button class="ghost" data-act="back">Back</button><button class="btn" data-act="next">' + (st.step === STEPS - 1 ? 'Finish' : 'Next') + '</button></div>';
  $('setup').innerHTML = body + nav;
  if (st.step === 3) refreshPayWords();
}
function refreshPayWords() {
  const el = $('payWords'), r = readStub($('setup'));
  if (!el || !r.pay || !r.start || !r.end) return;
  const src = stubToSource(r.pay, r.start, r.end);
  el.className = 'hint' + (src.error ? ' amber' : '');
  el.textContent = src.error || payWords(src) + ', paying for the ' + plural(src.every / 7, 'week') + ' that ended ' + plural(src.lag, 'day') + ' before.';
}
function readSetup() {
  const r = $('setup'), v = k => { const el = r.querySelector('[data-k="' + k + '"]'); return el ? el.value.trim() : undefined; };
  if (setup.step === 1) setup.bills = readBills(r);
  if (setup.step === 2) { setup.pocket = v('pocket'); setup.balance = v('balance'); }
  if (setup.step === 3) Object.assign(setup, readStub(r), { net: v('net'), hours: v('hours') });
}
function setupNext() {
  readSetup();
  const err = t => { const e = $('setupErr'); e.textContent = t; e.hidden = false; };
  if (setup.step === 1 && !cleanBills(setup.bills).some(b => b.amount > 0)) return err('Add at least one line with an amount.');
  if (setup.step === 2 && !(num(setup.pocket) >= 0)) return err('How much goes on the pocket card each month? 0 is fine.');
  if (setup.step === 2 && Number.isNaN(num(setup.balance))) return err('What’s on the pocket card right now?');
  if (setup.step === 3) {
    const src = stubToSource(setup.pay, setup.start, setup.end);
    if (src.error) return err(src.error);
    if (!(num(setup.net) > 0) || !(num(setup.hours) > 0)) return err('Put in the take-home pay and the hours off the stub.');
    const start = setup.start, now = isoOf(today());
    state = {
      v: 1, bills: cleanBills(setup.bills), pocket: num(setup.pocket), sources: [src], events: [],
      lastLog: now, lastLine: null,
    };
    upsertCheck(start, setup.end, setup.pay, num(setup.net), num(setup.hours));
    upsertPocket(now, num(setup.balance));
    save(); keep();
    history.replaceState(null, '');
    const s = getStatus(state);
    show('home'); renderHome();
    if (s.due.checks.length || s.due.weeks.length) go('log');
    return;
  }
  setup.step++;
  renderSetup();
}

/* ---------- Moving between screens ----------
   Log and settings sit on top of home, so the phone's back button closes them. */
function show(name) {
  for (const id of ['home', 'log', 'settings', 'setup']) $(id).hidden = id !== name;
  window.scrollTo(0, 0);
}
function go(name) {
  if (name === 'home') {
    if (history.state && history.state.page) return history.back();
    show('home'); renderHome(); return;
  }
  if (name === 'log') logMode = 'due';
  if (name === 'settings') { editingPay = false; draftBills = state.bills.map(b => ({ label: b.label, amount: String(b.amount) })); }
  history.pushState({ page: name }, '');
  openScreen(name);
}
function openScreen(name) {
  show(name);
  if (name === 'home') renderHome();
  if (name === 'log') renderLog();
  if (name === 'settings') renderSettings();
}
function buzz(p) { try { navigator.vibrate && navigator.vibrate(p); } catch {} }
// Ask the browser not to clear this site's storage when space runs low. Export is still the real backup.
function keep() { try { navigator.storage && navigator.storage.persist && navigator.storage.persist().catch(() => {}); } catch {} }

function start() {
  state = load();
  if (state && !validState(state)) state = null;
  if (!state) { show('setup'); renderSetup(); }
  else { history.replaceState(null, ''); show('home'); renderHome(); }

  window.addEventListener('popstate', () => { if (state) openScreen(history.state && history.state.page || 'home'); });

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-go], [data-act]');
    if (!b) return;
    if (b.dataset.go) return go(b.dataset.go);
    const act = b.dataset.act;
    if (act === 'saveLog') saveLog();
    if (act === 'earlier' || act === 'due') { logMode = act; renderLog(); }
    if (act === 'unknown') {
      const row = b.closest('[data-week]');
      if (row.dataset.unknown) delete row.dataset.unknown; else row.dataset.unknown = '1';
      const input = row.querySelector('input'), unknown = !!row.dataset.unknown;
      input.disabled = unknown; input.value = ''; input.placeholder = unknown ? '?' : '0';
      row.querySelector('.field').classList.toggle('unknown', unknown);
      b.textContent = unknown ? 'I know it now' : 'Don’t know? Its check will fill it in';
      refreshLogHints();
    }
    if (act === 'addBill' || act === 'dropBill') {
      const root = $('setup').hidden ? $('settings') : $('setup');
      const bills = readBills(root);
      if (act === 'addBill') bills.push({ label: '', amount: '' }); else bills.splice(+b.dataset.i, 1);
      if (!$('setup').hidden) { setup.bills = bills; renderSetup(); }
      else { draftBills = bills; state.bills = cleanBills(bills); save(); renderSettings(); }
    }
    if (act === 'next') setupNext();
    if (act === 'back') { readSetup(); setup.step--; renderSetup(); }
    if (act === 'editPay') { editingPay = true; renderSettings(); }
    if (act === 'cancelPay') { editingPay = false; renderSettings(); }
    if (act === 'savePay') {
      const r = readStub($('settings')), src = stubToSource(r.pay, r.start, r.end);
      if (src.error) { $('payErr').textContent = src.error; $('payErr').hidden = false; return; }
      state.sources[0] = src; save(); editingPay = false; renderSettings();
    }
    if (act === 'export') exportAll();
    if (act === 'import') $('importFile').click();
  });

  document.addEventListener('input', e => {
    if (!$('log').hidden) { confirmWarn = false; refreshLogHints(); }
    if (!$('setup').hidden && setup.step === 3) refreshPayWords();
    if (!$('setup').hidden && setup.step === 1) {
      $('total').textContent = money(cleanBills(readBills($('setup'))).reduce((t, b) => t + b.amount, 0));
    }
    if (!$('settings').hidden && e.target.closest('#bills')) {
      draftBills = readBills($('settings'));
      state.bills = cleanBills(draftBills);
      const p = $('settings').querySelector('[data-k="pocket"]');
      if (p && !Number.isNaN(num(p.value))) state.pocket = num(p.value) || 0;
      save();
      $('total').textContent = money(monthTotal(state));
    }
  });

  // Chillin has no button. Swipe up if you want to log anyway.
  let y0 = null;
  document.addEventListener('touchstart', e => { y0 = e.target.closest('#home') ? e.touches[0].clientY : null; }, { passive: true });
  document.addEventListener('touchend', e => {
    if (y0 !== null && state && $('home').querySelector('[data-swipe]') && y0 - e.changedTouches[0].clientY > 70) go('log');
    y0 = null;
  }, { passive: true });

  let shown = today();
  setInterval(() => { if (state && !$('home').hidden && today() !== shown) { shown = today(); renderHome(); } }, 60000);
  document.addEventListener('visibilitychange', () => { if (state && !document.hidden && !$('home').hidden) renderHome(); });

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
}

if (typeof document !== 'undefined' && document.getElementById('app')) start();
