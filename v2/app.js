// 0_0 v2: Home.
// Screens never own data: they read the state rebuilt from the log, and every tap writes an event.
// Home changes with the day: morning and daytime show where you are and the one next thing,
// evening says "Today happened", and after wind-down it turns warm and dim and says goodnight.

import { openLog } from './core/log.js';
import { createStore } from './core/store.js';
import { exportLog, importLog, download, persist } from './core/backup.js';
import { today as todayOf, seb, checkSettings, weekday } from './engines/sebdate.js';
import { sky } from './engines/sky.js';
import { PILLARS, ORDER, SLEEP, where, nextLine } from './engines/pillars.js';
import { APP, V1_KEYS } from './state.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const buzz = p => { try { navigator.vibrate && navigator.vibrate(p); } catch {} };
const readV1 = k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };

// Gentle defaults. Your own sayings join these from settings and stay on this phone.
const SAYINGS = [
  'Who are you, where are you going, and breathe.',
  'Slow, steady, permanent.',
  'Nothing is behind. You’re here now.',
  'One thing at a time is still moving.',
  'Rest is part of the work.',
  'You don’t have to hold it all in your head.',
];
const AFTERNOON = ['make a beat', 'guitar', 'a long walk', 'nothing at all'];

let log, store, state, sayingAt = 0, sheet = null, awake = false;

/* ---------- Time of day ---------- */
const hm = s => { const [h, m] = (s || '0:0').split(':').map(Number); return h * 60 + m; };
// ?at=09:30 pretends it's that time today, for trying the morning, evening and night screens.
const AT = /^\d{1,2}:\d{2}$/.test(new URLSearchParams(location.search).get('at') || '') ? new URLSearchParams(location.search).get('at') : null;
function clock() { const d = new Date(); if (AT) d.setHours(...AT.split(':').map(Number), 0, 0); return d; }
function moment(now = clock()) {
  const set = state.settings, mins = now.getHours() * 60 + now.getMinutes();
  const wake = hm(set.wake || '07:00'), wind = hm(set.windDown || '22:30'), evening = hm('18:00');
  // The day runs from 4 AM to 4 AM, so a late night still belongs to the day it started.
  const shifted = new Date(now.getTime() - 4 * 36e5), day = todayOf(shifted);
  let phase = mins >= wind || mins < wake ? 'night' : mins >= evening ? 'evening' : 'day';
  if (phase === 'night' && awake) phase = 'day';   // "not yet": the full Home until you leave the app
  return { now, mins, day, phase, hour: now.getHours() };
}
function dateLine(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][weekday(iso)] + ' · ' +
    ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][m - 1] + ' ' + d;
}
function sebChip(iso) {
  const p = state.settings.payday;
  if (!p || checkSettings({ payday: p })) return '';
  const s = seb(iso, { payday: p });
  return `<span class="chip">month ${s.month} · day ${s.day}</span>`;
}
const hello = () => (state.settings.name ? ', ' + esc(state.settings.name) : '');

/* ---------- The sky ---------- */
function paintSky(m) {
  const sk = sky(m.now, state.settings.place || null, m.phase === 'night');
  document.documentElement.style.setProperty('--sky-top', sk.top);
  document.documentElement.style.setProperty('--sky-bottom', sk.bottom);
  document.querySelector('meta[name=theme-color]').content = sk.top;
  const c = $('stars');
  c.classList.toggle('on', !!sk.stars);
  if (sk.stars && !c.dataset.drawn) {
    const r = devicePixelRatio || 1; c.width = innerWidth * r; c.height = innerHeight * r;
    const g = c.getContext('2d');
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(255,255,255,${0.15 + rnd() * 0.5})`; g.beginPath(); g.arc(rnd() * c.width, rnd() * c.height * 0.7, (0.4 + rnd()) * r, 0, 7); g.fill(); }
    c.dataset.drawn = '1';
  }
}

/* ---------- Home ---------- */
function v1() { return { valleyLine: readV1('0_0-line-valley'), studyState: readV1('0_0-study-v1') }; }
function sayings() { return [...SAYINGS, ...state.sayings.map(s => s.text)]; }

function render() {
  const m = moment();
  paintSky(m);
  const w = where(state, v1(), m.day, m.hour);
  $('app').className = m.phase;
  $('app').innerHTML = m.phase === 'night' ? nightHTML(m, w) : m.phase === 'evening' ? eveningHTML(m, w) : dayHTML(m, w);
}

function topHTML(m) {
  return `<div class="top"><button class="face" data-act="settings" aria-label="Settings">${faceOf()}</button>` +
    `<span><b>${dateLine(m.day).split(' · ')[0]}</b> · ${dateLine(m.day).split(' · ')[1]}</span>${sebChip(m.day) || '<span></span>'}</div>`;
}
let lastFace = '0_0';
function faceOf(w) { return lastFace; }

function pillarsHTML(w) {
  const n = w.pillars.length + (w.pillars.length < 5 ? 1 : 0);
  return `<div class="label">Where I am</div><div class="pillars n${Math.min(n, 5)}">` +
    w.pillars.map(p => `<button class="pillar${p.needs ? ' needs' : ''}${p.quiet ? ' quiet' : ''}" data-act="pillar" data-k="${p.key}"><span class="nm">${p.name}</span><span class="wd">${esc(p.word)}</span><span class="dot"></span></button>`).join('') +
    (w.pillars.length < 5 ? `<button class="pillar add" data-act="add" aria-label="Add a place">+</button>` : '') + '</div>';
}

function nextHTML(p) {
  const l = nextLine(p);
  let acts = '';
  if (p.key === 'sleep') acts = SLEEP.map(h => `<button class="btn" data-act="sleep" data-v="${h}">${h}</button>`).join('');
  else if (p.key === 'home' || p.key === 'food') acts = `<button class="btn main" data-act="tick" data-k="${p.key}">Done ✓</button>`;
  else if (p.key === 'money') acts = `<a class="btn" href="../valley/">Open Valley</a>`;
  return `<div class="card"><div class="k">Next thing that needs you</div><div class="t">${esc(l.title)}</div><div class="s">${esc(l.sub)}</div>${acts ? `<div class="row">${acts}</div>` : ''}</div>`;
}

function dayHTML(m, w) {
  const all = sayings(), say = all[sayingAt % all.length];
  lastFace = w.pillars.length && w.chillin ? '-_-' : '0_0';
  let body;
  if (!w.pillars.length) {
    body = `<div class="card"><div class="k">When you’re ready</div><div class="t">Add a place</div>` +
      `<div class="s">It starts blank on purpose. Add Sleep, Home, Food, Money or School one at a time, whenever it feels right.</div>` +
      `<div class="row"><button class="btn main" data-act="add">+ Add a place</button></div></div>`;
  } else if (w.next) {
    body = pillarsHTML(w) + nextHTML(w.next);
  } else {
    body = pillarsHTML(w) + `<div class="chill"><div class="big">-_-</div><div class="t">You’re chillin${hello()}.</div><div class="s">Nothing needs you today.</div>` +
      `<div class="label" style="margin-top:18px">The afternoon is yours</div><div class="chips">${AFTERNOON.map(a => `<span>${a}</span>`).join('')}</div></div>`;
  }
  return topHTML(m) +
    `<h1 class="saying" data-act="saying">${esc(say)}</h1><p class="hint">Hold the light to breathe · tap the words for another</p>` +
    `<div class="light" id="light" role="button" aria-label="Hold to breathe"></div>` + body +
    `<div class="fine"><div class="a">${w.next ? 'Everything else is fine.' : 'All is well.'}</div><div class="b">${w.pillars.length ? 'Tap a word to see what’s behind it.' : 'Nothing here can break while you’re away.'}</div></div>`;
}

function eveningHTML(m, w) {
  lastFace = w.chillin ? '-_-' : '0_0';
  const d = state.days[m.day] || {}, items = [];
  const how = state.sleep[m.day];
  if (state.places.includes('sleep')) items.push(how ? [true, 'Slept: ' + how] : [false, 'Didn’t say how you slept. That’s okay.']);
  for (const k of ['home', 'food']) if ((state.ticks[k] || []).includes(m.day)) items.push([true, k === 'home' ? 'Weekly reset' : 'Meal prep']);
  const open = w.pillars.filter(p => p.needs && p.key !== 'sleep');
  for (const p of open) items.push([false, p.name + ': ' + p.word + '. It can wait.']);
  if (d.done) {
    return topHTML(m) + `<div class="evening"><h1>Today happened.</h1><p class="hint">${d.grateful ? 'Grateful for: ' + esc(d.grateful) : 'Done for today.'}</p></div>` +
      `<div class="fine"><div class="a">Nothing will ask for you until morning.</div><div class="b">Wind-down at ${esc(state.settings.windDown || '22:30')}.</div></div>`;
  }
  return topHTML(m) + `<div class="evening"><h1>Today happened.</h1><p class="hint">${items.length ? 'Here’s what it held.' : 'A quiet one. That counts too.'}</p>` +
    (items.length ? `<ul class="list">${items.map(([ok, t]) => `<li class="${ok ? '' : 'no'}"><i>${ok ? '✓' : '·'}</i>${esc(t)}</li>`).join('')}</ul>` : '') +
    `<div class="card"><div class="k">Today I’m grateful for</div>` +
    (d.grateful ? `<div class="t" style="font-family:var(--serif);font-weight:400">${esc(d.grateful)}</div>`
      : `<input class="field" id="grateful" maxlength="140" placeholder="one line" enterkeyhint="done"><div class="row"><button class="btn" data-act="grateful">Keep it</button></div>`) + `</div>` +
    `<button class="btn peach wide" style="margin-top:16px" data-act="done">Done for today</button></div>` +
    `<div class="fine"><div class="b">Nothing will ask for you after this until morning.</div></div>`;
}

function nightHTML(m) {
  lastFace = '-_-';
  const time = m.now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const one = state.places.includes('sleep') ? 'Phone sleeps outside the bedroom tonight.' : 'Put the day down. It’ll keep.';
  return `<div class="night" style="display:flex;flex-direction:column;flex:1"><div class="when">${esc(time)} · wind-down</div>` +
    `<h1>${one}</h1><p class="hint" style="color:#a7896b">Tomorrow starts slow.</p><div class="bye">Goodnight${hello()}.` +
    `<div style="margin-top:14px"><button class="link" style="color:#8a7058" data-act="awake">not yet · open 0_0</button></div></div></div>`;
}

/* ---------- Sheets ---------- */
function openSheet(html) {
  closeSheet(true);
  $('layer').innerHTML = `<div class="scrim" data-act="close"></div><div class="sheet" role="dialog"><div class="grab"></div>${html}</div>`;
  sheet = $('layer').querySelector('.sheet');
  const s = sheet, scrim = $('layer').querySelector('.scrim');
  setTimeout(() => { scrim.classList.add('on'); s.classList.add('on'); }, 20);   // after the first paint, so it slides
  // Swipe down to close
  let y0 = null;
  sheet.addEventListener('touchstart', e => { if (sheet.scrollTop <= 0) y0 = e.touches[0].clientY; }, { passive: true });
  sheet.addEventListener('touchmove', e => { if (y0 !== null) { const dy = Math.max(0, e.touches[0].clientY - y0); sheet.style.transform = `translateY(${dy}px)`; } }, { passive: true });
  sheet.addEventListener('touchend', e => { if (y0 === null) return; const dy = e.changedTouches[0].clientY - y0; y0 = null; sheet.style.transform = ''; if (dy > 90) closeSheet(); });
}
function closeSheet(now) {
  if (!sheet) return;
  const layer = $('layer'), s = sheet; sheet = null;
  if (now) { layer.innerHTML = ''; return; }
  s.classList.remove('on'); layer.querySelector('.scrim')?.classList.remove('on');
  setTimeout(() => { if (!sheet) layer.innerHTML = ''; }, 300);
}

function pillarSheet(key) {
  const m = moment(), w = where(state, v1(), m.day, m.hour), p = w.pillars.find(x => x.key === key), P = PILLARS[key];
  const words = (state.settings.words || {})[key] || {};
  let acts = '';
  if (key === 'home' || key === 'food') {
    acts = p.needs ? `<button class="btn main" data-act="tick" data-k="${key}">Done this week ✓</button>` : '';
  } else if (key === 'sleep') {
    acts = SLEEP.map(h => `<button class="btn${state.sleep[m.day] === h ? ' main' : ''}" data-act="sleep" data-v="${h}">${h}</button>`).join('');
  } else if (key === 'money') acts = `<a class="btn" href="../valley/">Open Valley</a><a class="btn" href="../money/">Open Money</a>`;
  else if (key === 'school') acts = `<a class="btn" href="../study/">Open Study</a>`;
  const wordEdit = key === 'sleep' ? '' : `<div class="grid2"><div><label>Your word when it’s good</label><input class="field" data-word="good" value="${esc(words.good || '')}" placeholder="${esc(P.good)}"></div>` +
    `<div><label>…and when it needs you</label><input class="field" data-word="needs" value="${esc(words.needs || '')}" placeholder="${esc(P.needs)}"></div></div>`;
  openSheet(`<div class="k label" style="margin:0">${P.name}</div><div class="word">${esc(p.word)}</div><p class="q">${esc(p.detail)}</p>` +
    (acts ? `<div class="row">${acts}</div>` : '') +
    `<div class="label">The question</div><p class="q" style="margin:0">${esc(P.question)} <span style="color:var(--faint)">${esc(P.feed)}</span></p>` + wordEdit +
    `<div class="row" style="justify-content:space-between;margin-top:18px">${wordEdit ? `<button class="btn" data-act="words" data-k="${key}">Save words</button>` : '<span></span>'}<button class="link" data-act="remove" data-k="${key}">Remove this place</button></div>`);
}

function addSheet() {
  const left = ORDER.filter(k => !state.places.includes(k));
  openSheet(`<h2>Add a place</h2><p class="q">One at a time is plenty. Each one costs a tap or two, never more.</p>` +
    left.map(k => `<div class="opt"><div><div class="nm">${PILLARS[k].name}</div><div class="d">${esc(PILLARS[k].question)} ${esc(PILLARS[k].feed)}</div></div><button class="btn main" data-act="place" data-k="${k}">Add</button></div>`).join(''));
}

function settingsSheet() {
  const s = state.settings;
  openSheet(`<h2>Settings</h2><p class="q">Everything stays on this phone.</p>` +
    `<label>What should I call you?</label><input class="field" id="setName" value="${esc(s.name || '')}" placeholder="your name">` +
    `<div class="grid2"><div><label>Morning starts</label><input class="field" type="time" id="setWake" value="${esc(s.wake || '07:00')}"></div>` +
    `<div><label>Wind-down</label><input class="field" type="time" id="setWind" value="${esc(s.windDown || '22:30')}"></div></div>` +
    `<label>A recent payday (a Monday), for Seb months. Leave empty to hide them.</label><input class="field" type="date" id="setPay" value="${esc(s.payday || '')}">` +
    `<label>Sky: ${s.place ? 'follows the sun where you are (' + esc(s.place.label) + ')' : 'a plain day, 7:00 to 6:30'}</label>` +
    `<div class="row" style="margin-top:6px"><button class="btn" data-act="locate">${s.place ? 'Update my place' : 'Use my location'}</button>${s.place ? '<button class="link" data-act="unlocate">forget it</button>' : ''}</div>` +
    `<label>Add a saying of your own</label><input class="field" id="newSaying" maxlength="120" placeholder="your words">` +
    `<div class="row"><button class="btn main" data-act="saveSettings">Save</button></div>` +
    `<div class="label">Backup</div><div class="row" style="margin-top:0"><button class="btn" data-act="export">Save a backup file</button><button class="btn" data-act="import">Restore from a file</button></div>` +
    `<p class="hint" style="margin-top:10px">The backup holds everything v2 has ever written. Restoring merges; it never wipes.${state.archived ? ' Your old apps’ data was copied in on ' + esc(state.archived.at.slice(0, 10)) + ', so it’s in the backup too.' : ''}</p>` +
    `<input type="file" id="file" accept="application/json,.json" hidden>`);
}

/* ---------- Breathe: one minute of box breathing. Nothing is saved or counted. ---------- */
function breathe() {
  const el = document.createElement('div');
  el.className = 'breathe';
  el.innerHTML = `<div class="orb" id="orb">in</div><div class="say" id="bsay">Breathe in for four.</div><div class="note">Nothing is saved or counted. Tap to stop.</div>`;
  document.body.append(el);
  const steps = [['in', 'Breathe in for four.', 1], ['hold', 'Hold for four.', 1], ['out', 'Breathe out for four.', .55], ['hold', 'Hold for four.', .55]];
  let i = 0, timer;
  const step = () => {
    if (i >= 16) return end('That’s a minute. Welcome back.');
    const [w, say, scale] = steps[i % 4];
    $('orb').textContent = w; $('bsay').textContent = say; $('orb').style.transform = `scale(${scale})`;
    if (i % 4 === 0) buzz(8);
    i++; timer = setTimeout(step, 4000);
  };
  const end = msg => { clearTimeout(timer); if (msg) $('bsay').textContent = msg; el.classList.add('off'); setTimeout(() => el.remove(), msg ? 900 : 600); };
  el.onclick = () => end();
  setTimeout(step, 400);
}

/* ---------- Toast with a quiet undo ---------- */
let toastTimer;
function toast(text, undoId) {
  let t = document.querySelector('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.append(t); }
  t.innerHTML = esc(text) + (undoId ? ` <button data-undo="${undoId}">undo</button>` : '');
  requestAnimationFrame(() => t.classList.add('on'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('on'), 6000);
}

/* ---------- Writing ---------- */
async function write(kind, data, msg) {
  const e = await log.append(kind, data, 'home');
  state = await store.state();
  render();
  if (msg && e) toast(msg, e.id);
  return e;
}

document.addEventListener('click', async ev => {
  const u = ev.target.closest('[data-undo]');
  if (u) { await log.undo(u.dataset.undo, 'home'); state = await store.state(); document.querySelector('.toast')?.classList.remove('on'); render(); if (sheet) closeSheet(); buzz(6); return; }
  const a = ev.target.closest('[data-act]');
  if (!a) return;
  const act = a.dataset.act, k = a.dataset.k, m = moment();
  if (act === 'saying') { sayingAt++; render(); }
  else if (act === 'awake') { awake = true; render(); }
  else if (act === 'pillar') pillarSheet(k);
  else if (act === 'add') addSheet();
  else if (act === 'settings') settingsSheet();
  else if (act === 'close') closeSheet();
  else if (act === 'place') { closeSheet(); await write('place.add', { key: k }, PILLARS[k].name + ' added'); buzz(10); }
  else if (act === 'remove') { closeSheet(); await write('place.remove', { key: k }, PILLARS[k].name + ' removed'); }
  else if (act === 'tick') { closeSheet(); await write('tick', { pillar: k, date: m.day }, (k === 'home' ? 'Reset' : 'Meal prep') + ' done'); buzz(10); }
  else if (act === 'sleep') { closeSheet(); await write('sleep', { date: m.day, how: a.dataset.v }, 'Slept: ' + a.dataset.v); buzz(10); }
  else if (act === 'grateful') { const v = $('grateful').value.trim(); if (v) await write('gratitude', { date: m.day, text: v }, 'Kept'); }
  else if (act === 'done') {
    const v = $('grateful') && $('grateful').value.trim();
    if (v) await log.append('gratitude', { date: m.day, text: v }, 'home');
    await write('day.done', { date: m.day }, 'Done for today'); buzz([10, 70, 10]);
  }
  else if (act === 'words') {
    const words = { ...(state.settings.words || {}) }, cur = {};
    sheet.querySelectorAll('[data-word]').forEach(i => { if (i.value.trim()) cur[i.dataset.word] = i.value.trim(); });
    words[k] = cur; closeSheet(); await write('settings', { words }, 'Words saved');
  }
  else if (act === 'saveSettings') {
    const d = {}, s = state.settings;
    const name = $('setName').value.trim(), wake = $('setWake').value, wind = $('setWind').value, pay = $('setPay').value, say = $('newSaying').value.trim();
    if (pay && checkSettings({ payday: pay })) { toast('The payday has to be a Monday.'); return; }
    if (name !== (s.name || '')) d.name = name;
    if (wake && wake !== (s.wake || '07:00')) d.wake = wake;
    if (wind && wind !== (s.windDown || '22:30')) d.windDown = wind;
    if (pay !== (s.payday || '')) d.payday = pay || null;
    closeSheet();
    if (Object.keys(d).length) await write('settings', d, 'Saved');
    if (say) await write('saying.add', { text: say }, 'Saying kept');
  }
  else if (act === 'locate') {
    if (!navigator.geolocation) return toast('This phone can’t share its location.');
    navigator.geolocation.getCurrentPosition(async pos => {
      // Rounded to about 1 km: plenty for sunrise, and no more precise than that.
      const lat = Math.round(pos.coords.latitude * 100) / 100, lon = Math.round(pos.coords.longitude * 100) / 100;
      closeSheet(); await write('settings', { place: { lat, lon, label: lat + ', ' + lon } }, 'The sky follows your sun now');
    }, () => toast('No location. The sky stays plain.'), { maximumAge: 864e5, timeout: 15000 });
  }
  else if (act === 'unlocate') { closeSheet(); await write('settings', { place: null }, 'Place forgotten'); }
  else if (act === 'export') { download(await exportLog(log)); toast('Backup saved'); }
  else if (act === 'import') {
    const f = $('file'); f.onchange = async () => {
      const file = f.files[0]; if (!file) return;
      const r = await importLog(log, await file.text());
      if (r.error) return toast(r.error);
      state = await store.state(); closeSheet(); render();
      toast(r.added ? 'Restored ' + r.added + ' new' : 'Nothing new in that file');
    };
    f.click();
  }
});

// Hold the light to breathe. A quick tap just reminds you how.
let holdTimer = null;
document.addEventListener('pointerdown', e => {
  const l = e.target.closest('#light'); if (!l) return;
  l.classList.add('holding');
  holdTimer = setTimeout(() => { holdTimer = null; l.classList.remove('holding'); buzz(12); breathe(); }, 650);
});
const release = () => {
  const l = $('light'); if (l) l.classList.remove('holding');
  if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; toast('Hold the light to breathe'); }
};
document.addEventListener('pointerup', release);
document.addEventListener('pointercancel', () => { if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; } $('light')?.classList.remove('holding'); });
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'grateful') document.querySelector('[data-act=grateful]')?.click(); });

/* ---------- Start ---------- */
async function start() {
  log = await openLog();
  store = createStore(log, APP);
  state = await store.state();
  persist();
  // Step 1's last piece: copy what the old apps saved into the log, once, quietly. The old apps never notice.
  if (!state.archived) {
    const keys = {};
    for (const k of V1_KEYS) { const v = localStorage.getItem(k); if (v != null) keys[k] = v; }
    if (Object.keys(keys).length) { await log.append('v1-archive', { keys }, 'v1'); state = await store.state(); }
  }
  render();
  setInterval(() => { if (!sheet) render(); }, 60000);
  document.addEventListener('visibilitychange', async () => {
    if (document.hidden) { awake = false; return; }   // next time you open it at night, it says goodnight again
    state = await store.state();
    if (!sheet) render();
  });
}
start().catch(e => { $('app').innerHTML = `<p style="padding:30px">Something went wrong opening 0_0: ${esc(e.message)}</p>`; });
