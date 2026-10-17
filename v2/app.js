// 0_0 v2: the shell. It opens the log, rebuilds the state, picks the sky and the screen,
// and hands taps to the place that owns them. Screens never own data: every tap writes an event.

import { openLog } from './core/log.js';
import { createStore } from './core/store.js';
import { exportLog, importLog, download, persist } from './core/backup.js';
import { today as todayOf, checkSettings } from './engines/sebdate.js';
import { sky, SKIES } from './engines/sky.js';
import { APP, V1_KEYS, parseSayings } from './state.js';
import { $, esc, buzz, stars, openSheet, closeSheet, sheetOpen, toast, hideToast } from './ui.js';
import * as home from './places/home.js';

export const PLACES = { home };
export const TABS = ['home', 'day', 'money', 'grow', 'study'];

let log, store, state, awake = false, face = '0_0', current = 'home';

/* ---------- Time of day ---------- */
const hm = t => { const [h, m] = (t || '0:0').split(':').map(Number); return h * 60 + m; };
// ?at=09:30 pretends it's that time today, for trying the morning, evening and night screens.
const AT = /^\d{1,2}:\d{2}$/.test(new URLSearchParams(location.search).get('at') || '') ? new URLSearchParams(location.search).get('at') : null;
function clock() { const d = new Date(); if (AT) d.setHours(...AT.split(':').map(Number), 0, 0); return d; }
function moment(now = clock()) {
  const set = state.settings, mins = now.getHours() * 60 + now.getMinutes();
  const wake = hm(set.wake || '07:00'), wind = hm(set.windDown || '22:30'), evening = hm(set.evening || '18:00');
  // The date rolls over at midnight; the night screen runs from wind-down until morning.
  let phase = mins >= wind || mins < wake ? 'night' : mins >= evening ? 'evening' : 'day';
  if (phase === 'night' && awake) phase = 'day';   // "not yet": the full app until you leave it
  const sk = sky(now, set.place || null, false);
  return { now, mins, day: todayOf(now), phase, hour: now.getHours(), sky: sk.phase };
}

/* ---------- Drawing ---------- */
function ctx() {
  return {
    state, m: moment(), log, store,
    write, render, go,
    face: f => { face = f; }, faceNow: () => face,
    wake: () => { awake = true; render(); },
  };
}
function paint(skyName) {
  const el = $('sky');
  if (el.dataset.sky !== skyName) { el.className = 'sky ' + skyName; el.dataset.sky = skyName; }
  const st = SKIES[skyName] && SKIES[skyName].stars;
  $('starfield').innerHTML = st ? stars(st[0], st[1], 3) : '';
  document.querySelector('meta[name=theme-color]').content = (SKIES[skyName] || SKIES.night).top;
}
function nav(c) {
  const tabs = TABS.filter(t => t === 'home' || (c.state.tabs || []).includes(t));
  if (tabs.length < 2) return '';
  return `<nav class="links">${tabs.map(t => `<button class="${t === current ? 'on' : ''}" data-act="tab" data-k="${t}">${t}</button>`).join('')}</nav>`;
}
function render() {
  const c = ctx(), place = PLACES[current] || home;
  if (!PLACES[current]) current = 'home';
  const out = place.render(c);
  paint(out.sky || c.m.sky);
  $('app').innerHTML = `<main class="scr${out.bare ? ' bare' : ''}">${out.html}</main>` + (out.bare || c.m.phase === 'night' ? '' : nav(c));
  remember();
}
function go(tab) {
  if (!PLACES[tab]) return;
  current = tab; closeSheet(true); render(); window.scrollTo(0, 0);
}
// Remembers where you were for 30 minutes, then opens fresh to Home.
function remember() { try { localStorage.setItem('0_0-v2-where', JSON.stringify({ tab: current, at: Date.now() })); } catch {} }
function recall() {
  try { const r = JSON.parse(localStorage.getItem('0_0-v2-where')); if (r && Date.now() - r.at < 30 * 60e3 && PLACES[r.tab]) current = r.tab; } catch {}
}

/* ---------- Writing ---------- */
async function write(kind, data, msg, haptic) {
  const e = await log.append(kind, data, current);
  state = await store.state();
  render();
  if (haptic) buzz(haptic);
  if (msg) toast(msg, e && e.id);
  return e;
}

/* ---------- Settings ---------- */
function settingsSheet() {
  const s = state.settings;
  openSheet(`<div class="lbl">Settings</div><div class="say">Everything stays on this phone.</div>` +
    `<div class="lbl">What should I call you?</div><input class="field" id="setName" value="${esc(s.name || '')}" placeholder="your name">` +
    `<div class="grid2"><div><div class="lbl">Morning starts</div><input class="field" type="time" id="setWake" value="${esc(s.wake || '07:00')}"></div>` +
    `<div><div class="lbl">Wind-down</div><input class="field" type="time" id="setWind" value="${esc(s.windDown || '22:30')}"></div></div>` +
    `<div class="lbl">A recent payday (a Monday)</div><input class="field" type="date" id="setPay" value="${esc(s.payday || '')}">` +
    `<p class="fine">Turns on the Seb-month lens next to the real date. Leave empty to keep it off.</p>` +
    `<button class="pbtn" data-act="saveSettings" style="margin-top:6px">Keep these</button>` +
    `<div class="lbl">The sky</div><p class="fine" style="margin:0">${s.place ? 'It follows the real sun where you are.' : 'A plain day for now: sunrise at 7, sunset at 6:30.'}</p>` +
    `<div class="opts"><button class="opt" data-act="locate">${s.place ? 'update my place' : 'follow my real sun'}</button>${s.place ? '<button class="opt" data-act="unlocate">forget my place</button>' : ''}</div>` +
    `<div class="lbl">Your sayings</div><p class="fine" style="margin:0">${state.sayings.length ? state.sayings.length + ' of your own, plus the pinned one.' : 'Only the pinned one so far.'}</p>` +
    `<div class="opts"><button class="opt" data-act="sayingsFile">bring in my sayings file</button></div>` +
    `<input class="field serif" id="newSaying" maxlength="160" placeholder="or type one" style="margin-top:10px">` +
    `<div class="lbl">Backup</div><div class="opts" style="margin-top:0"><button class="opt" data-act="export">save a backup file</button><button class="opt" data-act="import">restore from a file</button></div>` +
    `<p class="fine">A backup holds everything v2 has written. Restoring merges; it never wipes.${state.archived ? ' Your old apps’ data was kept on ' + esc(state.archived.at.slice(0, 10)) + ', so it’s in there too.' : ''}</p>` +
    `<input type="file" id="file" hidden>`);
}
function pickFile(accept, then) {
  const f = $('file'); f.accept = accept;
  f.onchange = async () => { const file = f.files[0]; f.value = ''; if (file) then(await file.text()); };
  f.click();
}

/* ---------- Breathe: one minute of box breathing. Nothing is saved or counted. ---------- */
function breathe() {
  const own = state.sayings.map(x => x.text), line = own.length ? own[Math.floor(Math.random() * own.length)] : home.PINNED;
  const el = document.createElement('div');
  el.className = 'breathe night';
  el.innerHTML = stars(60, 844, 9) + `<div class="scr bare"><div class="top"><span>breathe</span><span>1 minute</span></div>` +
    `<div class="orb"><i class="r1"></i><i class="r2" id="r2"></i><i class="r3" id="r3"></i><div class="lab" id="blab">in</div></div>` +
    `<div class="ticks" id="bticks"><span class="on">in · 4</span><span>hold · 4</span><span>out · 4</span><span>hold · 4</span></div>` +
    `<div class="say center" style="font-size:22px;margin-top:40px">${esc(line)}</div>` +
    `<p class="fine center" style="margin-top:30px">Nothing is saved. Nothing is counted.<br>Tap anywhere to stop.</p></div>`;
  document.body.append(el);
  const steps = [['in', 1.12], ['hold', 1.12], ['out', 0.82], ['hold', 0.82]];
  let i = 0, timer;
  const step = () => {
    if (i >= 16) return end();
    const [w, sc] = steps[i % 4];
    $('blab').textContent = w; $('r3').style.transform = $('r2').style.transform = `scale(${sc})`;
    [...$('bticks').children].forEach((t, k) => t.classList.toggle('on', k === i % 4));
    i++; timer = setTimeout(step, 4000);
  };
  const end = () => { clearTimeout(timer); el.classList.add('off'); setTimeout(() => el.remove(), 650); };
  el.onclick = end;
  setTimeout(step, 300);
}

/* ---------- Taps ---------- */
const shell = {
  close: () => closeSheet(),
  tab: (c, el) => go(el.dataset.k),
  settings: () => settingsSheet(),
  saveSettings: async () => {
    const d = {}, s = state.settings;
    const name = $('setName').value.trim(), wake = $('setWake').value, wind = $('setWind').value, pay = $('setPay').value, say = $('newSaying').value.trim();
    if (pay && checkSettings({ payday: pay })) return toast('The payday has to be a Monday.');
    if (name !== (s.name || '')) d.name = name;
    if (wake && wake !== (s.wake || '07:00')) d.wake = wake;
    if (wind && wind !== (s.windDown || '22:30')) d.windDown = wind;
    if (pay !== (s.payday || '')) d.payday = pay || null;
    closeSheet();
    if (Object.keys(d).length) await write('settings', d, 'Kept');
    if (say) await write('saying.add', { text: say, kind: 'saying' }, 'Saying kept');
  },
  locate: () => {
    if (!navigator.geolocation) return toast('This phone can’t share its location.');
    navigator.geolocation.getCurrentPosition(async pos => {
      // Rounded to about 1 km: plenty for sunrise, and no more precise than that.
      const lat = Math.round(pos.coords.latitude * 100) / 100, lon = Math.round(pos.coords.longitude * 100) / 100;
      closeSheet(); await write('settings', { place: { lat, lon } }, 'The sky follows your sun now');
    }, () => toast('No location. The sky stays plain.'), { maximumAge: 864e5, timeout: 15000 });
  },
  unlocate: async () => { closeSheet(); await write('settings', { place: null }, 'Place forgotten'); },
  sayingsFile: () => pickFile('.md,.txt,text/markdown,text/plain', async text => {
    const found = parseSayings(text), have = new Set(state.sayings.map(x => x.text));
    const fresh = found.filter(x => !have.has(x.text) && x.text !== home.PINNED);
    for (const x of fresh) await log.append('saying.add', x, 'import');
    state = await store.state(); closeSheet(); render();
    toast(fresh.length ? fresh.length + ' sayings brought in' : 'Nothing new in that file');
  }),
  export: async () => { download(await exportLog(log)); toast('Backup saved'); },
  import: () => pickFile('application/json,.json', async text => {
    const r = await importLog(log, text);
    if (r.error) return toast(r.error);
    state = await store.state(); closeSheet(); render();
    toast(r.added ? 'Restored ' + r.added + ' new' : 'Nothing new in that file');
  }),
};

document.addEventListener('click', async ev => {
  const u = ev.target.closest('[data-undo]');
  if (u) { await log.undo(u.dataset.undo, current); state = await store.state(); hideToast(); closeSheet(true); render(); return; }
  const a = ev.target.closest('[data-act]');
  if (!a) return;
  const act = a.dataset.act, place = PLACES[current] || home;
  const fn = (place.actions && place.actions[act]) || home.actions[act] || shell[act];
  if (fn) await fn(ctx(), a);
});

// Hold the light to breathe. A quick tap just says how.
let holdTimer = null;
document.addEventListener('pointerdown', e => {
  const l = e.target.closest('#light'); if (!l) return;
  l.classList.add('holding');
  holdTimer = setTimeout(() => { holdTimer = null; l.classList.remove('holding'); buzz('tick'); breathe(); }, 650);
});
document.addEventListener('pointerup', () => {
  $('light')?.classList.remove('holding');
  if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; toast('Hold the light to breathe'); }
});
document.addEventListener('pointercancel', () => { if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; } $('light')?.classList.remove('holding'); });
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'grateful') home.actions.grateful(ctx()); });

/* ---------- Start ---------- */
async function start() {
  log = await openLog();
  store = createStore(log, APP);
  state = await store.state();
  persist();
  // Old data, archived quietly, once: kept, not shown, not used. Places bring in what they need from it.
  if (!state.archived) {
    const keys = {};
    for (const k of V1_KEYS) { const v = localStorage.getItem(k); if (v != null) keys[k] = v; }
    if (Object.keys(keys).length) { await log.append('v1-archive', { keys }, 'v1'); state = await store.state(); }
  }
  recall();
  render();
  setInterval(() => { if (!sheetOpen()) render(); }, 60000);
  document.addEventListener('visibilitychange', async () => {
    if (document.hidden) { awake = false; return; }   // next time it opens at night, it says goodnight again
    state = await store.state();
    if (!sheetOpen()) render();
  });
}
start().catch(e => { $('app').innerHTML = `<main class="scr"><div class="say">Something went wrong opening 0_0.</div><p class="fine">${esc(e.message)}</p></main>`; });
