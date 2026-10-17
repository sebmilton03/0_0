// Home: the saying, where I am, and the one next thing. It changes with the day:
// morning and daytime show the saying and pillars, chillin hands you the afternoon,
// evening says "Today happened", and after wind-down it goes warm and dim.

import { esc, openSheet, closeSheet, buzz, stars } from '../ui.js';
import { PILLARS, ORDER, SLEEP, where, nextLine, lastWeek } from '../engines/pillars.js';
import { seb, checkSettings, weekday } from '../engines/sebdate.js';
import { atWork, tomorrowLine, parked, span } from '../engines/week.js';

export const PINNED = 'Who are you, where are you going, and breathe.';
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const AFTERNOON = ['♪ make a beat', 'guitar', 'a long walk', 'nothing at all'];
const ICON = { home: ['⌂', 'rgba(159,230,184,.25)'], food: ['◌', 'rgba(159,230,184,.25)'], sleep: ['☾', 'rgba(185,168,255,.3)'], people: ['♡', 'rgba(255,179,220,.25)'] };

export const dateTop = iso => `<span><b>${DAYS[weekday(iso)]}</b> · ${MONTHS[+iso.slice(5, 7) - 1]} ${+iso.slice(8)}</span>`;
export function sebChip(s, iso) {
  const p = s.settings.payday;
  if (!p || checkSettings({ payday: p }) || s.settings.lens === false) return '';
  const x = seb(iso, { payday: p });
  return `<span class="chip">month ${x.month} · day ${x.day}</span>`;
}
const hello = s => (s.settings.name ? ', ' + esc(s.settings.name) : '');
const faceBtn = f => `<button class="facebtn" data-act="settings" aria-label="Settings">${f}</button>`;

/** Your sayings, the pinned one first. A different one each day, so none repeats within two weeks. */
export function sayingsOf(s) { return [PINNED, ...s.sayings.map(x => x.text).filter(t => t !== PINNED)]; }
let extra = 0;
function sayingFor(s, day) {
  const all = sayingsOf(s), n = all.length, d = Math.round(Date.parse(day) / 864e5);
  return all[(d + extra) % n];
}

/** The screen: { sky, stars, html, bare (no bottom bar) } */
export function render(ctx) {
  const { state: s, m } = ctx, w = where(s, m.day, m.hour, ctx.extra);
  ctx.face(w.chillin && w.pillars.length ? '-_-' : '0_0');
  if (m.phase === 'night') return night(ctx);
  if (m.phase === 'evening') return evening(ctx, w);
  const work = atWork(s, m.day, m.now);
  if (work) return working(ctx, work);
  const due = parked(s, m.day).due;
  if (w.pillars.length && w.chillin && !due.length) return chillin(ctx, w);
  return morning(ctx, w, due);
}

// At work, Home shrinks to one line, a soft bar for the shift and a place to park a thought.
function working(ctx, b) {
  const { m } = ctx, left = b.left, h = Math.floor(left), q = Math.round((left - h) * 4);
  const words = (h ? h : '') + (q === 1 ? '¼' : q === 2 ? '½' : q === 3 ? '¾' : q === 4 ? '1' : '') || 'less than a quarter';
  return { sky: m.sky, html:
    `<div class="top">${dateTop(m.day).replace(/ · .*<\/span>/, ' · ' + esc(clock(m.now)) + '</span>')}<span class="r">at work ${faceBtn(ctx.faceNow())}</span></div>` +
    `<div class="say" style="font-size:34px;margin-top:40px">At work.</div>` +
    `<p class="fine" style="font-size:15px;margin-top:8px;color:rgba(255,255,255,.75)">About ${words} hour${left > 1.1 ? 's' : ''} to go.</p>` +
    `<div style="position:relative;height:12px;border-radius:6px;background:rgba(255,255,255,.08);margin-top:26px"><i style="position:absolute;left:0;top:0;bottom:0;width:${b.done * 100}%;border-radius:6px;background:linear-gradient(90deg,#e8875a,#ffcf9e)"></i><b style="position:absolute;top:-5px;left:${b.done * 100}%;width:4px;height:22px;margin-left:-2px;border-radius:2px;background:#fff"></b></div>` +
    `<div class="fine" style="display:flex;justify-content:space-between;margin-top:6px"><span>${esc(span(b).split(' to ')[0])}</span><span>${esc(span(b).split(' to ')[1])}</span></div>` +
    `<div class="clear" style="margin-top:40px">Nothing else needs you right now.</div>` +
    `<button class="calm" data-act="park" style="margin-top:60px"><i>✎</i>Something on your mind? Park it for later.</button>` };
}

function wia(w) {
  const tiles = w.pillars.map(p => `<button class="${p.needs ? 'needs' : ''}${p.quiet ? ' quiet' : ''}" data-act="pillar" data-k="${p.key}"><b>${p.name}</b><span>${esc(p.word)}</span><i></i></button>`);
  if (w.pillars.length < ORDER.length) tiles.push('<button class="add" data-act="add" aria-label="Add a place">+</button>');
  const n = tiles.length, cols = n <= 5 ? n : Math.ceil(n / 2);
  return `<div class="lbl">Where I am</div><div class="wia" style="--n:${cols}">${tiles.join('')}</div>`;
}

function nextCard(p) {
  const l = nextLine(p);
  let acts = '';
  if (p.key === 'sleep') acts = SLEEP.map(h => `<button class="opt" data-act="sleep" data-v="${h}">${h}</button>`).join('');
  else if (p.key === 'home' || p.key === 'food') acts = `<button class="opt" data-act="tick" data-k="${p.key}">done ✓</button>`;
  else if (p.key === 'people') acts = `<button class="opt" data-act="people" data-v="yes">yes</button><button class="opt" data-act="people" data-v="no">not this week</button>`;
  else if (p.key === 'money') acts = `<button class="opt" data-act="tab" data-k="money">open Money</button>`;
  return `<div class="next"><small>Next thing that needs you</small><b>${esc(l.title)}</b><p>${esc(l.sub)}</p>${acts ? `<div class="opts">${acts}</div>` : ''}</div>`;
}

function morning(ctx, w, due = []) {
  const { state: s, m } = ctx;
  let body;
  if (!w.pillars.length) {
    body = `<div class="empty">Nothing here yet. That’s a fine place to start.<button class="link" data-act="add">+ add your first place</button></div>`;
  } else {
    body = wia(w) + (w.next ? nextCard(w.next) : due.length ? parkedCard(due) : '');
  }
  if (!w.pillars.length && due.length) body += parkedCard(due);
  return {
    sky: m.sky, html:
      `<div class="top">${dateTop(m.day)}<span class="r">${sebChip(s, m.day)}${faceBtn(ctx.faceNow())}</span></div>` +
      `<div class="say" data-act="saying">${esc(sayingFor(s, m.day))}<small>hold the light to breathe · tap the words for another</small></div>` +
      `<div class="bdot" id="light" role="button" aria-label="Hold to breathe"><i></i><u></u></div>` + body +
      (w.pillars.length ? `<div class="clear">${w.next ? 'Everything else is fine.' : 'All is well.'}<div class="fine"><button data-act="all">checked everything · tap to see it all</button></div></div>` : ''),
  };
}

function parkedCard(due) {
  return `<div class="next"><small>Waiting for today</small><b>${due.length === 1 ? esc(due[0].text) : due.length + ' parked thoughts are back'}</b>` +
    `<p>You parked ${due.length === 1 ? 'it' : 'them'} for today.</p><div class="opts">${due.length === 1 ? `<button class="opt" data-act="unpark" data-id="${due[0].id}">done</button>` : ''}<button class="opt" data-act="tab" data-k="day">see in Day</button></div></div>`;
}

function chillin(ctx, w) {
  const { state: s, m } = ctx;
  const all = w.allGood ? `<p class="center" style="margin-top:12px;font-size:11.5px;font-weight:800;letter-spacing:1.4px;color:rgba(255,236,200,.8)">ALL ${['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX'][w.pillars.length]} · MEGA CHILLIN BRUH</p>` : '';
  return {
    sky: 'golden', html:
      `<div class="top">${dateTop(m.day)}<span class="r">${sebChip(s, m.day)}${faceBtn('-_-')}</span></div>` +
      `<div style="margin-top:44px" class="face">-_-</div>` +
      `<div class="say center" style="font-size:32px;margin-top:20px">You’re chillin${hello(s)}.</div>` +
      `<p class="fine center" style="font-size:15px;margin-top:8px;color:rgba(255,255,255,.82)">Nothing needs you today.</p>` +
      `<div style="margin-top:26px">${wia(w).replace('<div class="lbl">Where I am</div>', '')}</div>` + all +
      `<div class="next" style="margin-top:18px;background:rgba(40,24,40,.35)"><small>The afternoon is yours</small><div class="opts">${AFTERNOON.map(t => `<span class="opt">${t}</span>`).join('')}</div></div>` +
      `<div class="bdot" id="light" role="button" aria-label="Hold to breathe" style="margin:26px auto 0"><i></i><u></u></div><p class="fine center" style="margin-top:2px">hold the light to breathe</p>`,
  };
}

function evening(ctx, w) {
  const { state: s, m } = ctx, d = s.days[m.day] || {}, rows = [];
  const how = s.sleep[m.day];
  if (s.places.includes('sleep')) rows.push(how ? ['sleep', 'Slept: ' + how] : [null, 'Didn’t say how you slept. That’s okay.']);
  for (const k of ['home', 'food']) if ((s.ticks[k] || []).includes(m.day)) rows.push([k, k === 'home' ? 'The weekly reset' : 'Meal prep']);
  const pc = ((s.checkins || {}).people || []).find(c => c.date === m.day && c.answer === 'yes');
  if (pc) rows.push(['people', 'Real time with someone']);
  for (const p of w.pillars) if (p.needs && p.key !== 'sleep') rows.push([null, p.name + ' can wait until tomorrow.']);
  const held = rows.map(([k, t]) => k ? `<div><i style="background:${ICON[k][1]}">${ICON[k][0]}</i>${esc(t)}</div>` : `<div class="no"><i style="background:rgba(255,255,255,.08)">·</i>${esc(t)}</div>`).join('');
  const top = `<div class="top">${dateTop(m.day).replace(/ · .*<\/span>/, ' · ' + esc(clock(m.now)) + '</span>')}<span class="r">closing the day ${faceBtn(ctx.faceNow())}</span></div>`;
  if (d.done) {
    return { sky: 'night', html: top + `<div class="moon"></div><div class="h1">Today happened.</div>` +
      (d.grateful ? `<div class="grat"><small>Today I’m grateful for</small>${esc(d.grateful)}</div>` : '') +
      `<p class="fine center" style="margin-top:22px">Nothing will ask for you until morning.</p>` };
  }
  return { sky: 'night', html: top + `<div class="moon"></div><div class="h1">Today happened.</div>` +
    (held ? `<div class="held">${held}</div>` : `<p class="fine" style="margin-top:10px">A quiet one. That counts too.</p>`) +
    `<label class="grat" style="display:block"><small>Today I’m grateful for</small>` +
    (d.grateful ? esc(d.grateful) : `<input id="grateful" maxlength="140" placeholder="one line, in your words" enterkeyhint="done">`) + `</label>` +
    tomorrow(s, m.day) +
    `<button class="done" data-act="done">Done for today</button>` +
    `<p class="fine center" style="margin-top:12px">Nothing will ask for you until morning.</p>` };
}
function tomorrow(s, day) {
  const t = tomorrowLine(s, day);
  return t ? `<div class="tmr">Tomorrow starts with <b>${t.map(esc).join('</b>, then <b>')}</b>.</div>` : '';
}

function night(ctx) {
  const { state: s, m } = ctx;
  ctx.face('-_-ᶻ');
  const f = ctx.focus(m.day);
  const one = f ? f.text.replace(/\.$/, '') + ' tonight.' : s.places.includes('sleep') ? 'Phone sleeps outside the bedroom tonight.' : 'Put the day down. It’ll keep.';
  return { sky: 'winddown', bare: true, html:
    `<div class="wd"><div class="when">${esc(clock(m.now))} · wind down</div><div class="one">${one}</div>` +
    (() => { const t = tomorrowLine(s, m.day); return t ? `<div class="tom">Tomorrow starts with<br><span>${t.map(esc).join('</span>, then <span>')}</span>.</div>` : ''; })() +
    `<div class="bye">Goodnight${hello(s)}.<button class="peek" data-act="awake">not yet · open 0_0</button></div></div>` };
}
const clock = d => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase();

/* ---------- Sheets ---------- */
const FEEL = {
  home: p => (p.needs ? 'The reset is still ahead.' : 'Home feels tidy.'),
  food: p => (p.needs ? 'Prep is still ahead.' : 'You’re fed this week.'),
  people: p => (p.word === 'connected' ? 'Connected this week.' : p.needs ? 'Sunday asks once.' : 'Sunday asks once.'),
  money: p => (p.quiet ? 'Money isn’t set up yet.' : p.needs ? 'Money needs a look.' : 'Money feels steady.'),
  school: p => (p.quiet ? 'Study isn’t set up yet.' : p.needs ? 'Catching up this week.' : 'On path this week.'),
};
function sleepFeel(s, days) {
  const v = days.filter(d => d.v).map(d => d.v);
  if (!v.length) return 'No mornings logged yet.';
  const avg = v.reduce((a, b) => a + b, 0) / v.length;
  return avg >= 2.6 ? 'Rested this week.' : avg >= 1.8 ? 'Okay this week.' : 'A bit short this week.';
}

export function pillarSheet(ctx, key) {
  const { state: s, m } = ctx, w = where(s, m.day, m.hour, ctx.extra), p = w.pillars.find(x => x.key === key), P = PILLARS[key];
  const days = lastWeek(s, key, m.day), words = (s.settings.words || {})[key] || {};
  let acts = '';
  if (key === 'home' || key === 'food') acts = p.needs ? `<button class="opt" data-act="tick" data-k="${key}">done this week ✓</button>` : '';
  else if (key === 'sleep') acts = SLEEP.map(h => `<button class="opt${s.sleep[m.day] === h ? ' on' : ''}" data-act="sleep" data-v="${h}">${h}</button>`).join('');
  else if (key === 'people') acts = `<button class="opt" data-act="people" data-v="yes">yes, this week</button><button class="opt" data-act="people" data-v="no">not this week</button>`;
  else if (key === 'money') acts = `<button class="opt" data-act="tab" data-k="money">open Money</button>`;
  else if (key === 'school') acts = `<button class="opt" data-act="tab" data-k="study">open Study</button>`;
  const bars = key === 'money' ? '' : `<div class="bars">${days.map(d => `<div><i class="${d.v >= 3 ? 'full' : ''}" style="height:${6 + d.v * 20}px"></i><span>${'MTWTFSS'[weekday(d.date)]}</span></div>`).join('')}</div>`;
  openSheet(`<div class="lbl">${P.name}</div><div class="say">${esc(key === 'sleep' ? sleepFeel(s, days) : FEEL[key](p))}</div>` +
    `<p class="fine" style="margin-top:6px">${esc(p.detail)}</p>${bars}` +
    (acts ? `<div class="opts" style="margin-top:14px">${acts}</div>` : '') +
    (key === 'sleep' && ctx.focus(m.day) ? (f => `<div class="next" style="margin-top:14px"><small>Tonight’s one thing</small><b style="font-size:16px">${esc(f.text)}</b><p>Your sleep habit${f.right ? ' · ' + esc(f.right) + ' nights' : ''}</p></div>`)(ctx.focus(m.day)) : '') +
    `<div class="calm" style="margin-top:14px"><i>♡</i>${esc(P.why)}</div>` +
    `<p class="fine" style="margin-top:12px">${esc(P.question)} ${esc(P.feed)}</p>` +
    (key === 'sleep' ? '' : `<details style="margin-top:6px"><summary class="fine center link" style="list-style:none;cursor:pointer">what “${esc(words.good || P.good)}” means to me · edit</summary>` +
      `<div class="grid2" style="margin-top:10px"><input class="field serif" data-word="good" value="${esc(words.good || '')}" placeholder="${esc(P.good)}"><input class="field serif" data-word="needs" value="${esc(words.needs || '')}" placeholder="${esc(P.needs)}"></div>` +
      `<p class="fine">Your word when it’s good, and when it needs you.</p><button class="pbtn" data-act="words" data-k="${key}">Keep my words</button></details>`) +
    `<p class="fine center" style="margin-top:16px"><button data-act="remove" data-k="${key}">take ${P.name} off Home</button></p>`);
}

const TAB_WORDS = { day: 'Today as a few cues, the week in hours, park it.', money: 'A feeling, then hours, then Dam Day.', grow: 'One habit at a time. Sleep first.', study: 'A weekly target that fits, and the list.' };
export function addSheet(ctx) {
  const left = ORDER.filter(k => !ctx.state.places.includes(k));
  const tabs = ctx.places.filter(t => t !== 'home' && !(ctx.state.tabs || []).includes(t));
  openSheet(`<div class="lbl">Add a place</div><div class="say">One at a time is plenty.</div><p class="fine" style="margin-top:6px">Each one costs a tap or two, never more.</p>` +
    (left.length ? `<div class="lbl">On Home</div>` : '') +
    left.map(k => `<div class="pk"><div class="d"><b style="font-size:15px">${PILLARS[k].name}</b><br><span class="fine">${esc(PILLARS[k].question)} ${esc(PILLARS[k].feed)}</span></div><button class="pbtn" style="padding:8px 14px;font-size:13px" data-act="place" data-k="${k}">add</button></div>`).join('') +
    (tabs.length ? `<div class="lbl">In the bar</div>` + tabs.map(t => `<div class="pk"><div class="d"><b style="font-size:15px">${t[0].toUpperCase() + t.slice(1)}</b><br><span class="fine">${esc(TAB_WORDS[t] || '')}</span></div><button class="pbtn" style="padding:8px 14px;font-size:13px" data-act="tabAdd" data-k="${t}">add</button></div>`).join('') : ''));
}

export function allSheet(ctx) {
  const { state: s, m } = ctx, w = where(s, m.day, m.hour, ctx.extra);
  openSheet(`<div class="lbl">Checked everything</div><div class="say">${w.next ? 'One thing needs you.' : 'All is well.'}</div>` +
    w.pillars.map(p => `<button class="calm" data-act="pillar" data-k="${p.key}"><i style="background:${p.needs ? 'rgba(255,213,154,.25)' : p.quiet ? 'rgba(255,255,255,.08)' : 'rgba(159,230,184,.22)'}">${p.needs ? '!' : p.quiet ? '·' : '✓'}</i><span><b>${p.name} · ${esc(p.word)}</b><br><span class="fine">${esc(p.detail)}</span></span><span class="go">›</span></button>`).join(''));
}

/* ---------- Taps ---------- */
export const actions = {
  saying: ctx => { extra++; ctx.render(); },
  awake: ctx => { ctx.wake(); },
  pillar: (ctx, el) => pillarSheet(ctx, el.dataset.k),
  add: ctx => addSheet(ctx),
  all: ctx => allSheet(ctx),
  place: async (ctx, el) => { closeSheet(); await ctx.write('place.add', { key: el.dataset.k }, PILLARS[el.dataset.k].name + ' added', 'tick'); },
  remove: async (ctx, el) => { closeSheet(); await ctx.write('place.remove', { key: el.dataset.k }, PILLARS[el.dataset.k].name + ' taken off Home'); },
  tick: async (ctx, el) => { closeSheet(); await ctx.write('tick', { pillar: el.dataset.k, date: ctx.m.day }, (el.dataset.k === 'home' ? 'Reset' : 'Meal prep') + ' done', 'tick'); },
  sleep: async (ctx, el) => { closeSheet(); await ctx.write('sleep', { date: ctx.m.day, how: el.dataset.v }, 'Slept: ' + el.dataset.v, 'tick'); },
  people: async (ctx, el) => { closeSheet(); await ctx.write('checkin', { pillar: 'people', date: ctx.m.day, answer: el.dataset.v }, el.dataset.v === 'yes' ? 'Connected' : 'A quiet week. That’s okay.', 'tick'); },
  words: async (ctx, el) => {
    const k = el.dataset.k, words = { ...(ctx.state.settings.words || {}) }, cur = {};
    el.closest('.sheet').querySelectorAll('[data-word]').forEach(i => { if (i.value.trim()) cur[i.dataset.word] = i.value.trim(); });
    words[k] = cur; closeSheet(); await ctx.write('settings', { words }, 'Your words are kept');
  },
  grateful: async ctx => { const v = document.getElementById('grateful')?.value.trim(); if (v) await ctx.write('gratitude', { date: ctx.m.day, text: v }, 'Kept'); },
  done: async ctx => {
    const v = document.getElementById('grateful')?.value.trim();
    if (v) await ctx.write('gratitude', { date: ctx.m.day, text: v });
    await ctx.write('day.done', { date: ctx.m.day }, 'Done for today', 'double');
  },
};
