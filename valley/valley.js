// 0_0 — valley. Where the money goes once a month, and where that's heading.
// The math lives in engine.js (VE). This file is the screens, the saving and the taps.
// Nothing personal is in here: setup collects your numbers on the phone.
'use strict';

const KEY = '0_0-valley-v1';      // Money, Study and +1 share this site, so keys must not collide
const LINE = '0_0-line-valley';   // the start screen reads this
const TIMER_CAP = 16;             // a shift longer than this is a forgotten timer: capped, and said so
const JAR_KEYS = ['bills', 'gas', 'misc', 'personal', 'vault'];
const COL = { income: 'var(--water)', bills: 'var(--bills)', gas: 'var(--gas)', misc: 'var(--misc)', personal: 'var(--personal)', vault: 'var(--vault)', roth: 'var(--roth)', loan: 'var(--loan)', invest: 'var(--free)', fun: 'var(--personal)' };

/* ---------- Small helpers ---------- */
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const sum = a => a.reduce((t, x) => t + x, 0);
const pad2 = n => String(n).padStart(2, '0');
function todayIso() { const n = new Date(); return n.getFullYear() + '-' + pad2(n.getMonth() + 1) + '-' + pad2(n.getDate()); }
// Typed numbers: $, commas, % and spaces are fine; anything else (a letter O for a zero, say) is not a number.
const num = v => { const t = String(v == null ? '' : v).replace(/[$,%\s]/g, '').replace(/[\u2212\u2013]/g, '-'); return /^[-+]?(\d+\.?\d*|\.\d+)$/.test(t) ? +t : NaN; };
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const clone = o => JSON.parse(JSON.stringify(o));
function money(n) { if (n == null || !isFinite(n)) return '—'; return (n < -0.5 ? '−$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US'); }
function cents(n) { if (n == null || !isFinite(n)) return '—'; return (n < -0.005 ? '−$' : '$') + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function kmoney(n) {
  if (n == null || !isFinite(n)) return '—';
  const a = Math.abs(n), sign = n < -0.5 ? '−' : '';
  if (a >= 999950) return sign + '$' + (a / 1e6).toFixed(2) + 'M';
  if (a >= 9999.5) return sign + '$' + (a / 1000).toFixed(a >= 99999.5 ? 0 : 1) + 'k';
  return sign + '$' + Math.round(a).toLocaleString('en-US');
}
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MON = m => MONTHS[m].slice(0, 3);
const fmtMonth = mo => MONTHS[VE.monthOfYear(mo)] + ' ' + VE.yearOf(mo);          // November 2026
const fmtMon = mo => MON(VE.monthOfYear(mo)) + ' ' + VE.yearOf(mo);                // Nov 2026
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const dObj = iso => new Date(iso + 'T00:00:00Z');
const fmtDay = iso => { const d = dObj(iso); return WEEKDAYS[d.getUTCDay()] + ' ' + MON(d.getUTCMonth()) + ' ' + d.getUTCDate(); };   // Mon Oct 26
const fmtMD = iso => { const d = dObj(iso); return MON(d.getUTCMonth()) + ' ' + d.getUTCDate(); };                                   // Oct 26
const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
const h1 = h => (Math.round(h * 10) / 10).toFixed(1);
function buzz(p) { try { navigator.vibrate && navigator.vibrate(p); } catch {} }
function keep() { try { navigator.storage && navigator.storage.persist && navigator.storage.persist().catch(() => {}); } catch {} }
let toastTimer = null;
function toast(text) {
  let el = $('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; document.body.appendChild(el); }
  el.textContent = text; el.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
}

/* ---------- Saved data ----------
   One object, saved whole. Shapes are written out in docs/valley-data.md. */
let state = null;
function load() { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } }
function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} writeLine(); }
function validState(s) {
  return !!(s && s.v === 1 && s.jars && s.jars.bills && s.jars.gas && s.jars.misc && s.jars.personal && s.jars.vault &&
    Array.isArray(s.bills) && s.extra && s.income && Array.isArray(s.balances) && Array.isArray(s.months) && typeof s.firstMonth === 'string');
}
// Fill anything an older backup might not have, so a restore never breaks a screen.
function normalize(s) {
  for (const k of ['paychecks', 'shifts', 'wishes', 'ious', 'events', 'subs', 'balances', 'months']) if (!Array.isArray(s[k])) s[k] = [];
  if (!s.roth) s.roth = {}; if (!s.roth.seed) s.roth.seed = {}; if (s.roth.balance === undefined) s.roth.balance = null;
  if (!s.invest) s.invest = { balance: null };
  if (s.timer === undefined) s.timer = null;
  if (s.damDraft === undefined) s.damDraft = null;
  if (s.income.other == null) s.income.other = 0;
  if (!s.jars.income) s.jars.income = { name: 'Income', bank: '' };
  s.extra.first = s.extra.first === 'roth' ? 'roth' : 'loan';
  for (const b of s.bills) if (!Array.isArray(b.amounts) || b.amounts.length !== 12) b.amounts = Array(12).fill(+b.amount || 0);
  return s;
}

/* ---------- What the screens need, worked out fresh each time ---------- */
function latest(s, jar) {
  let best = null;
  for (const b of s.balances) if (b.jar === jar && (!best || b.date > best.date || (b.date === best.date && (b.t || 0) >= (best.t || 0)))) best = b;
  return best;
}
// The next month to split: the first one from your first month that hasn't been closed.
function nextSplit(s, today) {
  const closed = new Set(s.months.map(m => m.month));
  let mo = s.firstMonth;
  while (closed.has(mo)) mo = VE.addMonths(mo, 1);
  const date = VE.firstOf(mo), days = VE.dayOf(date) - VE.dayOf(today);
  return { month: mo, date, days, due: days <= 0, early: days > 0 && days <= 3 };
}
function rothUsedMap(s) {
  const m = {};
  for (const [y, v] of Object.entries(s.roth.seed || {})) m[y] = (m[y] || 0) + (+v || 0);
  for (const r of s.months) { const y = VE.yearOf(r.month); m[y] = (m[y] || 0) + (r.plan.roth || 0); }
  return m;
}
const rothPutIn = s => sum(Object.values(s.roth.seed || {}).map(v => +v || 0)) + sum(s.months.map(r => r.plan.roth || 0));
const investPutIn = s => sum(s.months.map(r => r.plan.invest || 0));
function rateOf(s) {
  const r = VE.payRate(s.paychecks);
  if (r) return { rate: r.rate, learned: true, checks: r.checks };
  const hpw = +s.income.hoursPerWeek || 0, m = +s.income.monthly || 0;
  return { rate: hpw > 0 && m > 0 ? m / (hpw * VE.WEEKS_PER_MONTH) : null, learned: false, checks: [] };
}
const timerHours = (s, now = Date.now()) => s.timer ? Math.min(TIMER_CAP, Math.max(0, (now - s.timer.start) / 36e5)) : 0;
const openIous = s => s.ious.filter(i => !i.paidIn);
const iouTotal = s => sum(openIous(s).map(i => +i.amount || 0));

// The lake: what the income account held at the last check-in, plus the paychecks that land after
// that check-in and by Dam Day, plus other money if the check-in was before Dam Day.
function lakeOf(s, d) {
  const inc = d.bal.income;
  const now = inc ? inc.value : 0, asOf = inc ? inc.date : d.today;
  const end = d.today > d.next.date ? d.today : d.next.date;   // a late Dam Day has more pay in it
  const before = asOf < d.next.date;
  let checks = [];
  if (s.pay && d.rate.rate) {
    const each = d.rate.rate * (+s.income.hoursPerWeek || 0) * s.pay.every / 7;
    if (each >= 0.5) checks = VE.paydaysBetween(s.pay, asOf, end).map(p => ({ date: p, amount: each }));
  }
  const other = before ? (+s.income.other || 0) : 0;
  return { now, asOf, known: !!inc, checks, other, est: now + sum(checks.map(c => c.amount)) + other };
}
// What each jar should hold on the next Dam Day. Right after a split nothing has come out yet, so
// Valley assumes the month plays out as planned: Bills pays the month's bills, Gas and Misc spend
// their usual amount, Personal spends its refill. A check-in since then is used as typed.
function atSplit(s, d) {
  const last = d.last, bal = {}, used = {};
  for (const j of JAR_KEYS) {
    const b = d.bal[j];
    let v = b ? b.value : 0;
    if (b && last && b.ref === last.month && last.month < d.next.month) {
      const u = j === 'bills' ? last.plan.billsDue : j === 'gas' ? +s.jars.gas.spend || 0 : j === 'misc' ? +s.jars.misc.spend || 0
        : j === 'personal' ? (+s.jars.personal.amount || 0) + (last.plan.fun || 0) : 0;
      if (u > 0.005) { used[j] = u; v = j === 'bills' ? v - u : Math.max(0, v - u); }
    }
    bal[j] = v;
  }
  return { bal, used };
}

function derive(s, today = todayIso()) {
  const d = { today, s };
  d.bal = {}; for (const j of ['income', ...JAR_KEYS]) d.bal[j] = latest(s, j);
  d.balv = {}; for (const j of JAR_KEYS) d.balv[j] = d.bal[j] ? d.bal[j].value : 0;
  d.missing = JAR_KEYS.filter(j => !d.bal[j]);
  d.next = nextSplit(s, today);
  d.last = s.months.slice().sort((a, b) => (a.month < b.month ? -1 : 1)).pop() || null;
  d.rate = rateOf(s);
  d.plan = VE.billPlan(s.bills, s.loan, s.jars.bills.cushion);
  d.owed = s.loan ? +s.loan.owed || 0 : 0;
  d.rothUsed = rothUsedMap(s);
  d.iou = iouTotal(s);
  d.lake = lakeOf(s, d);
  d.at = atSplit(s, d);
  d.preview = VE.split({ month: d.next.month, income: d.lake.est, bal: d.at.bal, owed: d.owed, rothUsed: d.rothUsed[VE.yearOf(d.next.month)] || 0, iou: d.iou }, s, d.plan);
  d.events = s.events.filter(e => e.on !== false);
  d.start = { month: d.next.month, income: d.lake.est, bal: d.at.bal, owed: d.owed, rothUsed: d.rothUsed,
    roth: s.roth.balance != null ? +s.roth.balance : rothPutIn(s), invest: s.invest.balance != null ? +s.invest.balance : investPutIn(s), iou: d.iou };
  d.proj = VE.project(d.start, s, { months: 120, events: d.events });
  d.sum = VE.summarize(d.proj);
  d.freedom = VE.freedom(s, d.rate.rate, d.owed);
  const pb = d.bal.personal;
  d.personal = { known: !!pb, balance: pb ? pb.value : 0, asOf: pb ? pb.date : null, ...VE.perDay(pb ? pb.value : 0, today, d.next.due ? VE.firstOf(VE.addMonths(d.next.month, 1)) : d.next.date),
    refill: VE.refill(s, s.wishes, d.next.month) };
  d.check = s.pay && d.rate.rate ? VE.nextCheck(s.pay, s.shifts, d.rate.rate, +s.income.hoursPerWeek || 0, today, timerHours(s)) : null;
  d.status = statusOf(s, d);
  return d;
}

// One word for the ribbon. Green needs: the split done or not due, nothing borrowed, the next split covered.
function statusOf(s, d) {
  if (d.next.due) return { kind: 'dam', word: 'DAM DAY', sub: 'Time to split ' + (d.lake.known ? '≈' + money(d.lake.est) : 'the income account'), short: 'Dam Day: time to split', c: 'var(--orange)' };
  const issues = [];
  if (d.iou > 0.5) issues.push('borrowed ' + money(d.iou));
  if (d.preview.short > 0.5) issues.push(MON(VE.monthOfYear(d.next.month)) + ' looks ' + money(d.preview.short) + ' short');
  if (d.last && d.last.mismatch) issues.push('last split didn’t match the bank');
  if (d.missing.length) issues.push('check in your balances');
  if (issues.length) return { kind: 'check', word: 'HEADS UP', sub: issues.join(' · '), short: issues[0][0].toUpperCase() + issues[0].slice(1), c: 'var(--amber)' };
  return { kind: 'ok', word: 'ON TRACK', sub: 'Bills covered · nothing borrowed', short: 'On track', c: 'var(--green)' };
}

function writeLine() {
  try {
    if (!state) return;
    const d = derive(state);
    localStorage.setItem(LINE, JSON.stringify({ split: d.next.date, kind: d.status.kind, note: d.status.short, day: d.today }));
  } catch {}
}

/* ---------- Pictures ---------- */
const ICON = {
  back: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  close: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>',
  gear: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 4.3c.4-1.8 2.9-1.8 3.4 0a1.7 1.7 0 0 0 2.6 1.1c1.5-.9 3.3.8 2.4 2.4a1.7 1.7 0 0 0 1 2.5c1.8.4 1.8 3 0 3.4a1.7 1.7 0 0 0-1 2.6c.9 1.5-.9 3.3-2.4 2.4a1.7 1.7 0 0 0-2.6 1c-.4 1.8-3 1.8-3.4 0a1.7 1.7 0 0 0-2.5-1c-1.6.9-3.3-.9-2.4-2.4a1.7 1.7 0 0 0-1.1-2.6c-1.8-.4-1.8-3 0-3.4a1.7 1.7 0 0 0 1.1-2.5c-.9-1.6.8-3.3 2.4-2.4a1.7 1.7 0 0 0 2.5-1.1z"/><circle cx="12" cy="12" r="3"/></svg>',
  pencil: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16v4z"/></svg>',
  chev: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
  check: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7"/></svg>',
};
const coinSVG = (s = 28) => `<svg width="${s}" height="${s}" viewBox="0 0 40 40"><circle cx="20" cy="20" r="17" fill="#ffcf33" stroke="#070b18" stroke-width="3.5"/><circle cx="20" cy="20" r="12" fill="none" stroke="#e0a800" stroke-width="3"/><text x="20" y="27" font-size="19" font-weight="900" fill="#a86f00" text-anchor="middle" font-family="system-ui">$</text></svg>`;
const gaugeSVG = (s = 28) => `<svg width="${s}" height="${s}" viewBox="0 0 40 40"><circle cx="20" cy="20" r="17" fill="#2ed3c6" stroke="#070b18" stroke-width="3.5"/><path d="M10 24a10 10 0 0 1 20 0" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/><path d="M20 24l6-8" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/></svg>`;
const clockSVG = (s = 28, c = '#ff9f1c') => `<svg width="${s}" height="${s}" viewBox="0 0 40 40"><circle cx="20" cy="20" r="17" fill="${c}" stroke="#070b18" stroke-width="3.5"/><path d="M20 10v11l7 5" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const dropSVG = (s = 22) => `<svg width="${s}" height="${s * 1.2}" viewBox="0 0 30 36"><path d="M15 2C18 10 27 16 27 24A12 12 0 1 1 3 24C3 16 12 10 15 2Z" fill="#39a7f0" stroke="#070b18" stroke-width="3"/><circle cx="10.5" cy="24" r="2.8" fill="#fff" opacity=".7"/></svg>`;
const lockSVG = (s = 18) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24"><path d="M7 11V8a5 5 0 0 1 10 0v3" fill="none" stroke="#070b18" stroke-width="4"/><path d="M7 11V8a5 5 0 0 1 10 0v3" fill="none" stroke="#c9d2e3" stroke-width="2"/><rect x="4" y="10.5" width="16" height="11" rx="3" fill="#ffcf33" stroke="#070b18" stroke-width="2.5"/></svg>`;
const checkCircle = (s = 26, c = '#1f8f2f') => `<svg width="${s}" height="${s}" viewBox="0 0 40 40"><circle cx="20" cy="20" r="17" fill="${c}" stroke="#070b18" stroke-width="3.5"/><path d="M12 20.5l5.5 5.5L28.5 14" fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const rockSVG = (w = 58) => `<svg width="${w}" height="${w * .8}" viewBox="0 0 150 120"><path d="M8 112 L18 54 L50 14 L104 8 L140 46 L146 112 Z" fill="#9aa1ab" stroke="#070b18" stroke-width="8" stroke-linejoin="round"/><path d="M38 30 L68 22" stroke="#c4cad2" stroke-width="9" stroke-linecap="round"/><path d="M44 62 L68 70 M114 62 L90 70" stroke="#070b18" stroke-width="9" stroke-linecap="round"/><circle cx="58" cy="80" r="7" fill="#070b18"/><circle cx="98" cy="80" r="7" fill="#070b18"/><path d="M62 102 Q78 92 94 102" fill="none" stroke="#070b18" stroke-width="7" stroke-linecap="round"/></svg>`;
const defeatedSVG = (w = 58) => `<svg width="${w}" height="${w * .8}" viewBox="0 0 150 120"><path d="M10 112 L30 84 L60 96 L80 74 L112 90 L142 112 Z" fill="#9aa1ab" stroke="#070b18" stroke-width="8" stroke-linejoin="round"/><path d="M50 50 l12 12 M62 50 l-12 12 M92 50 l12 12 M104 50 l-12 12" stroke="#070b18" stroke-width="7" stroke-linecap="round"/></svg>`;
const treeSVG = (w = 56, grown = 1) => {
  const k = 0.55 + 0.45 * Math.max(0, Math.min(1, grown));
  return `<svg width="${w}" height="${w}" viewBox="0 0 120 120"><rect x="52" y="64" width="16" height="52" rx="5" fill="#9a6a3c" stroke="#070b18" stroke-width="5"/>` +
    `<g transform="translate(60 52) scale(${k.toFixed(2)}) translate(-60 -52)"><circle cx="60" cy="40" r="34" fill="#070b18"/><circle cx="32" cy="62" r="25" fill="#070b18"/><circle cx="88" cy="62" r="25" fill="#070b18"/>` +
    `<circle cx="60" cy="40" r="29" fill="#3ccf4e"/><circle cx="32" cy="62" r="20" fill="#3ccf4e"/><circle cx="88" cy="62" r="20" fill="#3ccf4e"/><circle cx="50" cy="30" r="8" fill="#fff" opacity=".35"/><circle cx="76" cy="58" r="6" fill="#ffcf33" stroke="#070b18" stroke-width="3"/></g></svg>`;
};
const safeSVG = (w = 52) => `<svg width="${w}" height="${w * .9}" viewBox="0 0 120 108"><rect x="8" y="6" width="104" height="92" rx="14" fill="#5d6b8a" stroke="#070b18" stroke-width="7"/><rect x="20" y="18" width="80" height="68" rx="10" fill="#7a89aa" stroke="#070b18" stroke-width="4"/><circle cx="60" cy="52" r="20" fill="#c9d2e3" stroke="#070b18" stroke-width="5"/><path d="M60 34v36M42 52h36M47 39l26 26M73 39L47 65" stroke="#070b18" stroke-width="4" stroke-linecap="round"/><circle cx="60" cy="52" r="7" fill="#070b18"/><rect x="18" y="98" width="16" height="8" rx="2" fill="#070b18"/><rect x="86" y="98" width="16" height="8" rx="2" fill="#070b18"/></svg>`;
// A jar with a plant: solid = in it now, dashed = what Dam Day adds, line = its cap.
function jarSVG(col, nowFrac, addFrac, capLine = true) {
  const nf = Math.max(0, Math.min(1, nowFrac || 0)), af = Math.max(0, Math.min(1 - nf, addFrac || 0));
  const top = 33, bot = 82, ih = bot - top, nh = nf * ih, ah = af * ih;
  return `<svg width="64" height="88" viewBox="0 0 64 88">` +
    `<path d="M40 24 C38 16 42 10 40 3" fill="none" stroke="#2f8f3a" stroke-width="3.5" stroke-linecap="round"/>` +
    `<ellipse cx="33" cy="14" rx="8" ry="4.5" fill="#4cc75a" stroke="#070b18" stroke-width="2" transform="rotate(-30 33 14)"/><ellipse cx="47" cy="8" rx="8" ry="4.5" fill="#4cc75a" stroke="#070b18" stroke-width="2" transform="rotate(30 47 8)"/>` +
    `<rect x="8" y="24" width="48" height="62" rx="10" fill="#0f1733" stroke="#070b18" stroke-width="3"/>` +
    (nh > 0.5 ? `<rect x="12" y="${(bot - nh).toFixed(1)}" width="40" height="${nh.toFixed(1)}" rx="${Math.min(6, nh / 2).toFixed(1)}" style="fill:${col}"/>` : '') +
    (ah > 2 ? `<rect x="13" y="${(bot - nh - ah + 1).toFixed(1)}" width="38" height="${(ah - 2).toFixed(1)}" rx="4" style="fill:${col};stroke:${col}" fill-opacity=".3" stroke-width="2" stroke-dasharray="4 3"/>` : '') +
    (capLine ? `<line x1="4" y1="${top}" x2="60" y2="${top}" stroke="#fff" stroke-width="2"/>` : '') +
    `<rect x="14" y="30" width="5" height="44" rx="2.5" fill="#fff" opacity=".35"/></svg>`;
}
function bar(frac, col, opts = {}) {
  const f = Math.max(0, Math.min(1, frac || 0));
  const add = Math.max(0, Math.min(1 - f, opts.add || 0));
  return `<div class="bar${opts.lg ? ' lg' : ''}" style="--c:${col}">` + (f > 0 ? `<i style="width:${(f * 100).toFixed(1)}%"></i>` : '') +
    (add > 0.005 ? `<s style="left:${(f * 100).toFixed(1)}%;width:${(add * 100).toFixed(1)}%"></s>` : '') +
    (opts.mark != null ? `<b style="left:${(Math.max(0, Math.min(1, opts.mark)) * 100).toFixed(1)}%"></b>` : '') + '</div>';
}
const STARS = [[24, 22, 1.4], [62, 60, 1.1], [96, 18, 1.6], [140, 40, 1.2], [214, 18, 1.3], [250, 70, 1.1], [300, 30, 1.7], [330, 92, 1.2], [384, 76, 1.4], [176, 150, 1.1], [120, 158, 1.3], [18, 136, 1.2], [390, 132, 1.2], [282, 120, 1.6], [208, 104, 1.1]];
function sceneSVG(d) {
  const other = (+state.income.other || 0) > 0;
  return `<svg class="bg" viewBox="0 0 400 320" preserveAspectRatio="none">
  <defs><linearGradient id="vsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0a1230"/><stop offset=".6" stop-color="#1a2a63"/><stop offset="1" stop-color="#2d4185"/></linearGradient>
  <linearGradient id="vgr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#22704f"/><stop offset="1" stop-color="#143f33"/></linearGradient>
  <linearGradient id="vwa" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3f97de"/><stop offset="1" stop-color="#1a4f8f"/></linearGradient></defs>
  <rect width="400" height="320" fill="url(#vsky)"/>
  ${STARS.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity=".75"/>`).join('')}
  <circle cx="362" cy="34" r="27" fill="#fff6c8" opacity=".08"/><circle cx="362" cy="34" r="17" fill="#f6e7a8" stroke="#070b18" stroke-width="3"/><circle cx="357" cy="31" r="3" fill="#e3cf85"/><circle cx="366" cy="39" r="2" fill="#e3cf85"/>
  <path d="M0 182 C70 150 130 166 190 176 C260 160 330 148 400 170 L400 320 L0 320 Z" fill="#1d4f5c" stroke="#070b18" stroke-width="3"/>
  <path d="M0 230 C90 218 190 230 280 224 C330 221 370 224 400 222 L400 320 L0 320 Z" fill="url(#vgr)" stroke="#070b18" stroke-width="3"/>
  <path d="M120 212 C124 188 186 184 246 185 C316 186 372 192 373 213 C374 238 316 252 246 253 C176 254 117 242 120 212 Z" fill="#8a7a5a" stroke="#070b18" stroke-width="3"/>
  <path d="M130 214 C134 194 192 191 246 192 C310 193 362 198 363 215 C364 236 310 246 246 247 C182 248 127 238 130 214 Z" fill="url(#vwa)"/>
  <rect x="150" y="206" width="22" height="3.5" rx="1.7" fill="#cfe6ff" opacity=".55"/><rect x="330" y="226" width="16" height="3" rx="1.5" fill="#cfe6ff" opacity=".55"/>
  ${other ? '<path d="M405 168 C394 186 386 196 370 204" fill="none" stroke="#070b18" stroke-width="11" stroke-linecap="round"/><path d="M405 168 C394 186 386 196 370 204" fill="none" stroke="#4fb6f5" stroke-width="6" stroke-linecap="round"/>' : ''}
  <rect x="34" y="176" width="38" height="76" rx="5" fill="#8f7f66" stroke="#070b18" stroke-width="3"/>
  <path d="M35 191h36M35 206h36M35 221h36M35 236h36M53 176v15M43 191v15M63 191v15M53 206v15M43 221v15M63 221v15" stroke="#6b5d48" stroke-width="1.6"/>
  <rect x="44" y="238" width="18" height="14" rx="3" fill="#2c3550" stroke="#070b18" stroke-width="2.5"/>
  <path d="M53 252 V276 M20 276 H392 M59 276 V322 M153 276 V322 M247 276 V322 M341 276 V322" fill="none" stroke="#070b18" stroke-width="15" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M53 252 V276 M20 276 H392 M59 276 V322 M153 276 V322 M247 276 V322 M341 276 V322" fill="none" stroke="#3f9be0" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M70 276 H392" fill="none" stroke="#a9d8ff" stroke-width="2" stroke-dasharray="8 12" stroke-linecap="round"/>
  ${[[140, 158], [162, 168], [184, 154], [120, 170]].map(([x, y]) => `<path d="M${x} ${y - 7}C${x + 1.5} ${y - 3} ${x + 4.5} ${y} ${x + 4.5} ${y + 2.5}A4.5 4.5 0 1 1 ${x - 4.5} ${y + 2.5}C${x - 4.5} ${y} ${x - 1.5} ${y - 3} ${x} ${y - 7}Z" fill="#39a7f0" stroke="#070b18" stroke-width="1.6"/>`).join('')}
</svg>`;
}
const cloudSVG = () => `<svg viewBox="0 -10 216 146" preserveAspectRatio="none"><g fill="#070b18">${[[52, 74, 40], [96, 46, 50], [150, 56, 42], [180, 82, 28], [76, 92, 32], [132, 92, 32], [104, 96, 34]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r + 4}"/>`).join('')}</g><g fill="#e6ecfa">${[[52, 74, 40], [96, 46, 50], [150, 56, 42], [180, 82, 28], [76, 92, 32], [132, 92, 32], [104, 96, 34]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')}</g><circle cx="84" cy="30" r="9" fill="#fff"/></svg>`;

/* ---------- Building blocks ---------- */
const topBar = () => `<div class="top"><a class="face" href="../" aria-label="All apps">0_0</a><button class="ic" data-go="settings" aria-label="Settings">${ICON.gear}</button></div>`;
const head = (title, sub, back = true) => `<div class="head">${back ? `<button class="back" data-back aria-label="Back">${ICON.back}</button>` : ''}<div><h1 class="gt">${esc(title)}</h1>${sub ? `<p>${sub}</p>` : ''}</div></div>`;
const cardHd = (title, col, opts = {}) => `<div class="hd${opts.left ? ' left' : ''}" style="--c:${col}">${esc(title)}${opts.rt ? `<span class="rt">${opts.rt}</span>` : ''}${opts.info ? '<span class="info">i</span>' : ''}</div>`;
const jarName = j => state.jars[j] ? state.jars[j].name || j : j;
const jarBank = j => state.jars[j] && state.jars[j].bank ? state.jars[j].bank : '';
const jarLabel = j => jarName(j) + (jarBank(j) ? ' · ' + jarBank(j) : '');
const loanName = () => state.loan ? state.loan.name || 'Loan' : 'Loan';
function deltaChip(a, b, kind, betterLower = false) {
  // kind: 'money' | 'month' | 'hours' | 'k'
  if (a == null || b == null) return '<span class="delta same">—</span>';
  let diff, txt;
  if (kind === 'month') { diff = VE.monthsBetween(a, b); txt = diff ? (diff > 0 ? '+' : '−') + plural(Math.abs(diff), 'mo') : 'same'; }
  else { diff = b - a; const f = kind === 'hours' ? h1(Math.abs(diff)) + ' hr' : kind === 'k' ? kmoney(Math.abs(diff)) : money(Math.abs(diff)); txt = Math.abs(diff) < (kind === 'hours' ? 0.05 : 0.5) ? 'same' : (diff > 0 ? '+' : '−') + f; }
  if (txt === 'same') return '<span class="delta same">same</span>';
  const good = betterLower ? diff < 0 : diff > 0;
  return `<span class="delta ${good ? 'good' : 'bad'}">${txt}</span>`;
}

/* ---------- Home: the valley ---------- */
function homeHTML(d) {
  const s = state, p = d.preview, st = d.status, fr = d.freedom, fun = d.personal;
  const days = d.next.days, nextMon = MON(VE.monthOfYear(d.next.month));
  let html = topBar();
  html += '<div class="hud">' +
    `<button class="hudp" data-go="personal">${coinSVG(28)}<div><small>FUN MONEY</small><b>${fun.known ? money(fun.balance) : '—'}</b>${fun.known ? `<em>${cents(fun.perDay)}/d</em>` : ''}</div></button>` +
    `<button class="hudp" data-go="freedom">${gaugeSVG(28)}<div><small>FREEDOM</small><b>${fr.hours != null ? Math.round(fr.hours) + '/' + Math.round(fr.hoursPerWeek) + ' hr' : '—'}</b></div></button>` +
    `<button class="hudp" data-tab="dam">${clockSVG(28)}<div><small>DAM DAY</small><b>${days <= 0 ? 'Today' : plural(days, 'day')}</b></div></button></div>`;
  html += `<div class="ribwrap" style="--c:${st.c}"><div>${st.kind === 'ok' ? checkCircle(26) : ''}<b class="gt">${st.word}</b></div></div><p class="ribsub">${esc(st.sub)}</p>`;

  // The scene
  const running = !!s.timer;
  const chk = d.check;
  const payFrac = chk ? Math.min(1, Math.max(0, (VE.dayOf(d.today) - (VE.dayOf(chk.pay) - chk.every)) / chk.every)) : 0;
  const payDays = chk ? VE.dayOf(chk.pay) - VE.dayOf(d.today) : null;
  html += '<div class="scene">' + sceneSVG(d) +
    `<div class="ov cloudbox" data-go="cloud">${cloudSVG()}` +
    (running ? `<div class="timer"><small>ON SHIFT</small><b data-tick="clock">${clockText(s)}</b><em data-tick="earned">${earnedText(s, d)}</em></div>`
      : `<button class="gb work" data-act="timerStart"><svg width="14" height="16" viewBox="0 0 14 16"><path d="M1 1v14l12-7z" fill="#fff" stroke="#070b18" stroke-width="2" stroke-linejoin="round"/></svg>WORK</button>`) + '</div>' +
    (chk ? `<button class="ov bubble" data-go="cloud">${dropSVG(16)} <b>+${money(chk.estimate)}</b><small>est. check · ${fmtMD(chk.pay)}</small></button>`
      : `<button class="ov bubble" data-go="cloud"><b style="font-size:14px">Log a paycheck</b><small>to learn your $/hr</small></button>`) +
    (chk ? `<div class="ov payday"><b class="gt" style="font-size:12px">PAYDAY</b>${bar(payFrac, 'var(--water)')}<b class="gt" style="font-size:12px">${payDays}d</b></div>` : '') +
    (d.next.due ? `<button class="ov gb orange dambtn" data-tab="dam">OPEN DAM</button>`
      : `<button class="ov gb greyb dambtn" data-tab="dam">${lockSVG(16)} ${MON(VE.monthOfYear(d.next.month))} 1</button>`) +
    `<button class="ov lakecard" data-why="income"><small>${esc((jarName('income') + (jarBank('income') ? ' · ' + jarBank('income') : '')).toUpperCase())}</small><b>${d.lake.known ? money(d.lake.now) : '—'}</b>${bar(d.lake.est > 0 ? d.lake.now / d.lake.est : 0, 'var(--water)')}</button>` +
    `<p class="ov fills gt">${d.next.due ? 'split it today' : 'fills to ≈' + money(d.lake.est) + ' by ' + nextMon + ' 1'}</p>` +
    ((+s.income.other || 0) > 0 && !d.next.due ? `<span class="ov kin">+${money(s.income.other)} other</span>` : '') +
    '</div>';

  // The four jars
  html += '<div class="jars">' + ['bills', 'gas', 'misc', 'personal'].map(j => {
    // The jar shows what it should hold on Dam Day (solid) and what Dam Day adds (dashed).
    const now = d.balv[j], at = d.at.bal[j], planned = d.at.used[j] != null;
    const give = j === 'personal' ? p.toPersonal : p.give[j], shortBy = p.need[j] - p.give[j];
    const cap = j === 'bills' ? p.billsTarget : j === 'personal' ? null : s.jars[j].cap;
    const scale = cap || Math.max(400, (Math.max(0, at) + give) * 1.6);
    const known = !!d.bal[j];
    return `<button class="card jarc" data-why="${j}">${cardHd(jarName(j).toUpperCase(), COL[j])}` +
      jarSVG(COL[j], known ? at / scale : 0, give / scale, !!cap) +
      `<div class="v">${!known ? 'check in' : planned ? nextMon + ' 1 ≈' + money(at) : 'now ' + money(now)}</div><div class="v">${cap ? 'to ' + money(cap) : 'no cap'}</div>` +
      `<span class="pill" style="--c:${shortBy > 0.5 ? 'var(--amber)' : give > 0.5 ? '#2fb34a' : 'var(--grey)'}">${give > 0.5 ? '+' + money(give) : shortBy > 0.5 ? 'short' : 'full'}</span></button>`;
  }).join('') + '</div>';

  // Boss, tree, vault
  const loanOn = !!s.loan;
  const owed = d.owed, orig = loanOn ? Math.max(+s.loan.start || owed, owed) : 0;
  const yr = VE.yearOf(d.next.month), used = d.rothUsed[yr] || 0;
  html += '<div class="row3">';
  if (loanOn) {
    html += `<button class="card boss" data-why="loan">${cardHd(owed > 0 ? 'BOSS · ' + loanName().toUpperCase() : loanName().toUpperCase(), 'var(--loan)')}` +
      (owed > 0 ? rockSVG(54) : defeatedSVG(54)) +
      `<div class="big">${owed > 0 ? 'HP ' + money(owed) : 'DEFEATED'}</div>${bar(orig ? owed / orig : 0, 'var(--loan)')}` +
      `<div class="v">${owed > 0 ? (d.sum.payoff ? 'gone ≈ ' + fmtMon(d.sum.payoff) : 'not on track to finish') : 'paid off ✓'}</div></button>`;
  } else html += `<button class="card boss" data-go="rules">${cardHd('NO LOAN', 'var(--grey)')}<div class="v" style="margin-top:20px">add one in Rules</div></button>`;
  const rothThis = p.roth;
  html += `<button class="card boss" data-why="roth">${cardHd('ROTH TREE', 'var(--roth)')}${treeSVG(50, used / (s.extra.rothLimit || 1))}` +
    `<div class="big">${rothThis > 0.5 ? '+' + money(rothThis) : money(used)}</div>${bar(used / (s.extra.rothLimit || 1), 'var(--roth)', { add: rothThis / (s.extra.rothLimit || 1) })}` +
    `<div class="v">${s.extra.first === 'loan' && owed > 0 ? 'after ' + esc(loanName()) : 'of ' + money(s.extra.rothLimit) + ' · ' + yr}</div></button>`;
  const vcap = s.jars.vault.cap, vnow = d.balv.vault;
  html += `<button class="card boss" data-why="vault">${cardHd(jarName('vault').toUpperCase(), 'var(--vault)')}${safeSVG(46)}` +
    `<div class="big">${d.bal.vault ? money(vnow) : '—'}</div>` +
    (vnow >= vcap - 0.5 && d.bal.vault ? `<span class="pill flat" style="--c:var(--gold);height:24px;font-size:12px;margin-top:4px">★ FULL</span>` : bar(vcap ? vnow / vcap : 0, 'var(--vault)', { add: vcap ? p.give.vault / vcap : 0 })) +
    `<div class="v">locked · tap</div></button></div>`;

  // Freedom meter
  if (fr.hours != null) {
    const hpw = fr.hoursPerWeek || 40, top = Math.max(hpw, fr.hours) || 1;
    html += `<button class="card fm" data-go="freedom" style="display:block;width:100%">${cardHd('FREEDOM METER', 'var(--free)', { info: true })}<div class="pad">` +
      `<div><div class="n">${h1(fr.hours)}<small> hr/wk</small></div><div class="cap">needed to cover everything</div></div>` +
      `<div>${bar(fr.hours / top, 'var(--free)', { lg: true, mark: loanOn && owed > 0 && fr.afterLoan != null ? fr.afterLoan / top : null })}` +
      `<div class="sc"><span>${loanOn && owed > 0 && fr.afterLoan != null ? 'after ' + esc(loanName()) + ': ' + h1(fr.afterLoan) : '0'}</span><span>you work ${Math.round(hpw)}</span></div></div></div></button>`;
  }

  // Next up
  html += '<div class="nextup"><h3>NEXT UP</h3>' + nextUp(d).map(n =>
    `<button class="row" ${n.go ? `data-go="${n.go}"` : n.tab ? `data-tab="${n.tab}"` : n.act ? `data-act="${n.act}"` : ''} style="width:100%"><div class="grow"><b>${n.text}</b>${n.sub ? `<small>${n.sub}</small>` : ''}</div>${n.right || ''}</button>`).join('') + '</div>';
  return html;
}
function nextUp(d) {
  const s = state, out = [];
  const n = transferList(d.preview).length;
  if (d.next.due) out.push({ tab: 'dam', text: 'Open the dam · ' + plural(n, 'transfer'), sub: 'Type what your bank shows, then move the money.', right: `<span class="pill" style="--c:var(--orange)">TODAY</span>` });
  else out.push({ tab: 'dam', text: 'Dam Day · ' + fmtDay(d.next.date), sub: n ? 'About ' + plural(n, 'transfer') + ', ≈' + money(d.lake.est) + ' to split.' : 'Nothing to split yet. Check in when pay lands.', right: `<span class="pill" style="--c:var(--orange)">${d.next.days}d</span>` });
  if (d.missing.length) out.push({ act: 'checkin', text: 'Check in your balances', sub: 'Valley needs ' + esc(d.missing.map(jarName).join(', ')) + ' to plan the split.', right: `<span class="pill" style="--c:var(--amber)">GO</span>` });
  if (s.pay) {
    const lastCheck = s.paychecks.slice().sort((a, b) => (a.date < b.date ? -1 : 1)).pop();
    const lastPay = VE.isoOf(VE.dayOf(VE.nextPayday(s.pay, d.today)) - s.pay.every);
    if (!lastCheck || lastCheck.date < lastPay) out.push({ go: 'cloud', text: 'Payday ' + fmtMD(lastPay) + ': log the check', sub: 'Take-home and hours off the stub teach Valley your real $/hr.', right: `<span class="pill" style="--c:var(--blue)">LOG</span>` });
  }
  const w = d.personal.refill.wishes.find(x => !x.done);
  if (w) out.push({ go: 'personal', text: esc(w.name) + ' fund · ' + money(w.monthly) + '/mo', sub: money(+w.saved || 0) + ' of ' + money(+w.price || 0) + ' · by ' + fmtMon(w.by), right: `<div style="width:84px">${bar((+w.saved || 0) / (+w.price || 1), 'var(--personal)')}</div>` });
  out.push({ go: 'personal', text: 'Borrowed from other jars', sub: d.iou > 0.5 ? 'Comes out of Personal’s next refill.' : 'Nothing owed. Keep it that way.', right: `<span class="pill" style="--c:${d.iou > 0.5 ? 'var(--amber)' : '#2fb34a'}">${money(d.iou)}${d.iou > 0.5 ? '' : ' ✓'}</span>` });
  return out;
}

/* ---------- Why sheets: the math behind each number ---------- */
function whyHTML(d, key) {
  const s = state, p = d.preview;
  const eq = (a, b, c, labels) => `<div class="grid3" style="margin-top:12px">${[a, b, c].map((v, i) => `<div class="card" style="padding:10px 6px;text-align:center;${i === 2 ? 'background:#1d4a2b' : ''}"><div class="lbl" style="font-size:10px">${labels[i]}</div><div style="font-size:21px;font-weight:900;margin-top:4px;${i === 2 ? 'color:#7dff95' : ''}">${v}</div></div>`).join('')}</div>`;
  const sec = (title, amt, col) => `<div class="sechd" style="--c:${col}"><span class="bar2"></span><h3>${title}</h3><span class="amt">${amt}</span></div>`;
  const line = (name, amt, sub) => `<div class="row"><div class="grow"><b>${esc(name)}</b>${sub ? `<small>${sub}</small>` : ''}</div><span class="amt">${amt}</span></div>`;
  const mo = d.next.month, m = VE.monthOfYear(mo), monName = MONTHS[m];
  const est = d.next.due ? '' : '<p class="note">Before Dam Day this uses your latest check-in and ≈' + money(d.lake.est) + ' coming in. On Dam Day you type the real balances.</p>';
  let body = '', title = '', chip = '';
  if (key === 'bills') {
    const why = VE.billsWhy(d.plan, m);
    const loanAdj = p.billsTarget - why.target;
    chip = jarLabel('bills'); title = 'Why +' + money(p.give.bills) + '?';
    body = `<p class="note">Dam Day tops ${esc(jarName('bills'))} up to this month’s target.</p>` +
      eq(money(p.billsTarget), d.bal.bills ? money(d.at.bal.bills) : '—', '+' + money(p.give.bills), ['TARGET', d.at.used.bills != null ? 'BY ' + MON(m).toUpperCase() + ' 1' : 'HAVE NOW', 'MOVE']) +
      (d.at.used.bills != null ? `<p class="note">It has ${money(d.balv.bills)} now, but ${MONTHS[VE.monthOfYear(d.last.month)]}’s ${money(d.at.used.bills)} of bills come out before then. Check in and Valley uses the real balance.</p>` : '') +
      sec('Due in ' + monName, money(p.billsDue), 'var(--bills)') +
      why.dueItems.map(b => line(b.name, money(b.loan ? p.carDue : b.amount), b.loan && p.carDue < b.amount - 0.5 ? 'last payment' : '')).join('') +
      (why.ahead.length ? sec('Saving ahead', money(why.aheadTotal), 'var(--personal)') + why.ahead.map(a =>
        `<div class="row" style="display:block"><div style="display:flex;justify-content:space-between"><b>${esc(a.name)} <span class="muted" style="font-weight:700;font-size:12px">${money(a.nextAmount)} due ${MON(a.nextMonth)}</span></b><span class="amt">${money(a.saved)}</span></div>` +
        `<div style="display:flex;gap:10px;align-items:center;margin-top:6px"><div style="flex:1">${bar(a.saved / (a.nextAmount || 1), 'var(--personal)')}</div><small style="margin:0">${money(a.perMonth)}/mo · ${a.months} of ${Math.round(a.of)} mo</small></div></div>`).join('') +
        (Math.abs(why.shared) > 0.5 ? `<p class="note">Big bills share ${money(-why.shared)} of their saving, because they don’t all land at once.</p>` : '') : '') +
      sec('Cushion', money(why.cushion), 'var(--free)') + line('Keeps ' + jarName('bills') + ' above $0 if a bill posts early', '') +
      (Math.abs(loanAdj) > 0.5 ? `<p class="note">${esc(loanName())}’s last payment is smaller, so the target drops ${money(-loanAdj)}.</p>` : '') +
      `<div class="card" style="margin-top:14px;padding:12px 14px;background:#0d1e3d;display:flex;justify-content:space-between;align-items:center"><span class="t2" style="font-weight:800">${money(p.billsDue)} + ${money(why.aheadTotal)} + ${money(why.cushion)} =</span><b style="font-size:18px">${money(p.billsTarget)}</b></div>` + est +
      `<div class="acts"><button class="gb blue" data-go="bills">EDIT BILLS</button></div>`;
  } else if (key === 'gas' || key === 'misc' || key === 'vault') {
    const cap = s.jars[key].cap, have = d.at.bal[key], planned = d.at.used[key] != null;
    chip = jarLabel(key); title = p.give[key] > 0.5 ? 'Why +' + money(p.give[key]) + '?' : 'Why nothing?';
    const spent = spentSince(d, key);
    body = `<p class="note">${esc(jarName(key))} tops up to its cap. What you don’t spend stays, so a cheap month means a smaller top-up.</p>` +
      eq(money(cap), d.bal[key] ? money(have) : '—', '+' + money(p.give[key]), ['CAP', planned ? 'BY ' + MON(m).toUpperCase() + ' 1' : 'HAVE NOW', 'MOVE']) +
      (planned ? `<p class="note">It had ${money(d.balv[key])} after the split. Valley expects the usual ${money(d.at.used[key])} to be spent by ${MON(m)} 1. Check in and it uses the real balance.</p>` : '') +
      (key !== 'vault' ? sec('Usually spends', money(s.jars[key].spend) + '/mo', COL[key]) : sec('Your emergency fund', have >= cap - 0.5 ? 'full' : money(cap - have) + ' to go', COL[key])) +
      (spent != null ? line('Spent since the last split', money(spent), 'From ' + fmtMon(d.last.month) + '’s balance to your latest check-in.') : '') +
      (key === 'vault' ? `<p class="note">Locked on purpose: it only gets topped up, never spent from in the plan. ${have >= cap - 0.5 ? 'It’s full, so Dam Day skips it.' : ''}</p>` : '') +
      (p.short > 0.5 && p.give[key] < p.need[key] - 0.5 ? `<div class="warnbox">Income runs out before this jar fills: it gets ${money(p.give[key])} of ${money(p.need[key])}.</div>` : '') + est +
      `<div class="acts"><button class="gb blue" data-act="editRule" data-rule="${key}.cap">CHANGE CAP</button></div>`;
  } else if (key === 'personal') {
    const P = +s.jars.personal.amount || 0;
    chip = jarLabel('personal'); title = 'Why +' + money(p.toPersonal) + '?';
    body = `<p class="note">Personal gets the same refill every month. Borrowed money comes out of it first, so a leak never quietly drains another jar.</p>` +
      eq(money(P), p.iouCharged > 0.5 ? '−' + money(p.iouCharged) : '$0', '+' + money(p.give.personal), ['REFILL', 'IOUs', 'MOVE']) +
      (p.fun > 0.5 ? line('Plus your fun share of the leftover', '+' + money(p.fun), Math.round((1 - s.extra.investShare) * 100) + '% of what’s left after ' + esc(loanName()) + ' and the Roth') : '') +
      sec('Each refill goes to', money(P), COL.personal) +
      line('Subscriptions', money(d.personal.refill.subs)) + line('Wishlist saving', money(d.personal.refill.toWishes)) + line('Free to spend', money(d.personal.refill.free)) + est +
      `<div class="acts"><button class="gb blue" data-go="personal">OPEN PERSONAL</button></div>`;
  } else if (key === 'income') {
    chip = jarLabel('income'); title = 'The lake';
    body = `<p class="note">Everything lands here, then splits on Dam Day.</p>` +
      line('In it now', d.lake.known ? money(d.lake.now) : '—', d.lake.known ? 'checked in ' + fmtDay(d.lake.asOf) : 'check in to see it') +
      d.lake.checks.map(c => line('Paycheck ' + fmtDay(c.date), '+' + money(c.amount), 'estimate: ' + cents(d.rate.rate) + '/hr × ' + (+s.income.hoursPerWeek || 0) * s.pay.every / 7 + ' hr')).join('') +
      (d.lake.other ? line('Other money', '+' + money(d.lake.other), 'set in Rules') : '') +
      `<div class="card" style="margin-top:14px;padding:12px 14px;background:#0d1e3d;display:flex;justify-content:space-between"><span class="t2" style="font-weight:800">By ${fmtMD(d.next.date)}, about</span><b style="font-size:18px">${money(d.lake.est)}</b></div>` +
      `<div class="acts"><button class="gb blue" data-act="checkin">CHECK IN</button></div>`;
  } else if (key === 'roth') {
    const yr = VE.yearOf(mo), used = d.rothUsed[yr] || 0;
    chip = 'ROTH IRA'; title = p.roth > 0.5 ? 'Why +' + money(p.roth) + '?' : 'Roth';
    const loanFirst = s.extra.first === 'loan' && d.owed > 0;
    body = `<p class="note">${loanFirst ? 'Your switch says ' + esc(loanName()) + ' first. The Roth starts getting the leftover once ' + esc(loanName()) + ' is gone' + (d.sum.payoff ? ' (≈ ' + fmtMon(d.sum.payoff) + ')' : '') + '.' : 'Leftover goes here first, up to the yearly limit.'}</p>` +
      eq(money(s.extra.rothLimit), money(used), money(Math.max(0, s.extra.rothLimit - used)), ['LIMIT ' + yr, 'PUT IN', 'ROOM LEFT']) +
      line('This Dam Day', '+' + money(p.roth)) +
      `<p class="note">Valley counts the Roth by calendar year. The IRS also lets you add to last year’s Roth until April 15, and Valley doesn’t count that.</p>` +
      `<div class="acts"><button class="gb blue" data-act="editRule" data-rule="first">FLIP THE SWITCH</button></div>`;
  } else if (key === 'loan') {
    const L = s.loan;
    chip = loanName().toUpperCase(); title = d.owed > 0 ? 'HP ' + money(d.owed) : 'Defeated';
    const po = d.sum.payoff;
    body = `<p class="note">The ${money(L.payment)} payment comes out of ${esc(jarName('bills'))}. ${s.extra.first === 'loan' ? 'Your switch sends every leftover dollar here first.' : 'Leftover goes to the Roth first, then here.'}</p>` +
      eq(money(d.owed), money(p.carDue + p.extraLoan), money(Math.max(0, d.owed * (1 + L.apr / 12) - p.carDue - p.extraLoan)), ['OWED NOW', 'THIS DAM DAY', 'OWED AFTER']) +
      line('Payment (from ' + jarName('bills') + ')', money(p.carDue)) + line('Extra from the leftover', money(p.extraLoan)) +
      line('Interest rate', (L.apr * 100).toFixed(2) + '% a year', '≈ ' + money(d.owed * L.apr / 12) + ' this month') +
      (po && po !== 'none' ? `<div class="okbox">Gone in ${fmtMonth(po)} · about ${money(d.sum.interest)} more interest.</div>` : d.owed > 0 ? `<div class="badbox">At this pace it doesn’t finish in 10 years.</div>` :
        `<div class="okbox">Paid off ✓ Its payment no longer comes out of ${esc(jarName('bills'))}. Remove it in Rules to tidy up.</div>`) +
      `<div class="acts"><button class="gb blue" data-act="editRule" data-rule="loan">EDIT LOAN</button><button class="gb greyb" data-act="editRule" data-rule="first">SWITCH</button></div>`;
  }
  return `<div class="grab"></div><button class="x" data-close aria-label="Close">${ICON.close}</button>` +
    `<span class="pill" style="--c:${COL[key] || 'var(--blue)'}">${esc(chip.toUpperCase())}</span><h2 class="gt" style="font-size:30px;margin-top:12px">${title}</h2>` + body;
}
function spentSince(d, j) {
  if (!d.last || !d.last.after || !d.bal[j]) return null;
  if (d.bal[j].date < d.last.closed || d.bal[j].ref === d.last.month) return null;
  return d.last.after[j] - d.bal[j].value;
}

/* ---------- Dam Day ---------- */
// The transfers, in the order to make them. Zeros are left out.
function transferList(sp) {
  const L = [];
  for (const j of JAR_KEYS) {
    const amt = j === 'personal' ? sp.toPersonal : sp.give[j];
    if (amt > 0.005) L.push({ key: j, to: jarLabel(j), amount: amt, col: COL[j] });
  }
  if (sp.extraLoan > 0.005) L.push({ key: 'loan', to: 'Extra to ' + loanName(), amount: sp.extraLoan, col: COL.loan });
  if (sp.roth > 0.005) L.push({ key: 'roth', to: 'Roth IRA', amount: sp.roth, col: COL.roth });
  if (sp.invest > 0.005) L.push({ key: 'invest', to: 'Investing', amount: sp.invest, col: COL.invest });
  return L;
}
function damHTML(d) {
  const s = state, dr = s.damDraft && s.damDraft.month === d.next.month ? s.damDraft : null;
  let html = head('DAM DAY', d.next.due ? fmtDay(d.next.date) + ' · time to split' : fmtDay(d.next.date) + ' · opens in ' + plural(d.next.days, 'day'), false);
  const last = d.last;
  if (last && !dr && last.closed && VE.dayOf(d.today) - VE.dayOf(last.closed) <= 20) html += closedCard(last, d);
  if (!dr) {
    html += `<div class="card"><div class="pad" style="display:flex;gap:12px;align-items:center">${dropSVG(26)}<div style="flex:1"><div class="lbl">TO SPLIT ON ${fmtMD(d.next.date).toUpperCase()}</div><div style="font-size:30px;font-weight:900">≈${money(d.lake.est)}</div></div>` +
      `<div style="text-align:right;font-size:12px;color:var(--text2);font-weight:700">${d.lake.known ? money(d.lake.now) + ' in now' : 'check in'}${d.lake.checks.map(c => '<br>+ ' + money(c.amount) + ' ' + fmtMD(c.date)).join('')}${d.lake.other ? '<br>+ ' + money(d.lake.other) + ' other' : ''}</div></div></div>`;
    html += '<div class="step"><span class="n">≈</span><h3>The plan, if balances don’t change</h3></div>';
    html += transferList(d.preview).map(t => `<div class="row"><span class="sw" style="--c:${t.col}"></span><div class="grow"><b>${esc(t.to)}</b></div><span class="amt">${money(t.amount)}</span></div>`).join('') || '<p class="note">Nothing to move.</p>';
    if (d.preview.short > 0.5) html += `<div class="warnbox">At this estimate the jars come up ${money(d.preview.short)} short. ${esc(jarName('personal'))} is the first to feel it.</div>`;
    // Early is fine in the last week (pay is in); further out it's almost always a mistake, except the very first time.
    html += `<div style="margin-top:18px">` + (d.next.due || d.next.early ? `<button class="gb orange wide" data-act="damStart">OPEN THE DAM</button>` :
      canSplitEarly(d) ? `<button class="gb greyb wide" data-act="damStart">SPLIT EARLY</button><p class="note" style="text-align:center">Opens ${fmtDay(d.next.date)}. Split early only if all the month’s pay is already in.</p>` :
      `<p class="note" style="text-align:center">Opens ${fmtDay(d.next.date)}. You can split early from ${fmtDay(VE.isoOf(VE.dayOf(d.next.date) - 7))}.</p>`) + '</div>';
    return html;
  }
  if (dr.step === 1) {
    html += '<div class="step"><span class="n">1</span><h3>Type what your bank shows now</h3></div><p class="note" style="margin-top:-4px">Before moving anything. Nothing is filled in for you: typing it is checking it.</p>';
    const exp = { income: d.lake.est, ...d.at.bal };
    html += ['income', ...JAR_KEYS].map(j => `<label class="lab"><span class="sw" style="--c:${COL[j]};display:inline-block;vertical-align:-2px;margin-right:6px"></span>${esc(jarLabel(j))}</label>` +
      `<div class="field"><span class="pre">$</span><input data-dam="${j}" inputmode="decimal" autocomplete="off" value="${esc(dr.inputs[j])}" placeholder="${d.bal[j] || j === 'income' ? '≈' + Math.round(exp[j]).toLocaleString('en-US') : '0'}"></div>`).join('') +
      (s.loan ? `<label class="lab"><span class="sw" style="--c:${COL.loan};display:inline-block;vertical-align:-2px;margin-right:6px"></span>${esc(loanName())} owed <span class="muted">· optional, from the lender’s app</span></label><div class="field"><span class="pre">$</span><input data-dam="loan" inputmode="decimal" autocomplete="off" value="${esc(dr.inputs.loan)}" placeholder="${Math.round(d.owed).toLocaleString('en-US')}"></div>` : '') +
      `<p class="err" id="damErr" hidden></p><div class="acts"><button class="gb greyb" data-act="damCancel">CANCEL</button><button class="gb orange" data-act="damPlan">SEE THE SPLIT</button></div>`;
    return html;
  }
  // Step 2: the checklist
  const sp = dr.plan, list = transferList(sp);
  const doneN = list.filter(t => dr.done[t.key]).length;
  html += `<div class="step"><span class="n">2</span><h3>Move the water</h3><span class="pill flat" style="--c:var(--blue);margin-left:auto;color:#fff;-webkit-text-stroke:0">${doneN} of ${list.length}</span></div>`;
  html += '<p class="note" style="margin-top:-4px">From ' + esc(jarLabel('income')) + '. Tick each one as you move it in your bank app.</p>';
  html += list.map(t => `<div class="row${dr.done[t.key] ? ' done-row' : ''}"><button class="tick${dr.done[t.key] ? ' on' : ''}" data-act="damTick" data-k="${t.key}" aria-label="Done">${dr.done[t.key] ? ICON.check : ''}</button>` +
    `<span class="sw" style="--c:${t.col}"></span><div class="grow"><b>${esc(t.to)}</b></div><span class="amt">${cents(t.amount)}</span>${JAR_KEYS.includes(t.key) ? `<button class="ic" data-act="damWhy" data-k="${t.key}" aria-label="Why" style="width:30px">${ICON.chev}</button>` : ''}</div>`).join('');
  html += `<div class="card" style="margin-top:12px;padding:10px 14px;display:flex;justify-content:space-between;align-items:center"><span class="t2" style="font-weight:800;font-size:13px">${list.map(t => Math.round(t.amount).toLocaleString('en-US')).join(' + ')}</span><b class="green">= ${money(sp.income)} ✓</b></div>`;
  if (sp.short > 0.5) html += `<div class="warnbox">Income ran out ${money(sp.short)} short. ${esc(jarName('personal'))} gets less this month. Bills, Gas and Misc come first.</div>`;
  html += spentBlock(dr, d);
  html += `<div style="margin-top:16px"><button class="gb ${doneN === list.length ? 'green' : 'greyb'} wide" data-act="damClose" ${doneN === list.length ? '' : 'disabled'}>3 · CLOSE THE DAM</button></div>`;
  html += `<div class="linkrow"><button class="link" data-act="damBack">‹ Fix a balance</button><button class="link" data-act="damCancel" style="color:var(--muted)">Cancel</button></div>`;
  return html;
}
// Since the last split: what each jar spent, and whether Bills is where the plan said it would be.
function spentBlock(dr, d) {
  const last = d.last;
  if (!last || !last.after || VE.monthsBetween(last.month, dr.month) !== 1) return '';
  const b = dr.before, rows = [];
  for (const j of ['gas', 'misc', 'personal']) rows.push(`<div class="row"><span class="sw" style="--c:${COL[j]}"></span><div class="grow"><b>${esc(jarName(j))}</b><small>${money(last.after[j])} → ${money(b[j])}</small></div><span class="amt">${money(last.after[j] - b[j])}</span></div>`);
  const expBills = last.after.bills - last.plan.billsDue, off = b.bills - expBills;
  return '<div class="step" style="margin-top:22px"><span class="n" style="--c:var(--vault)">$</span><h3>Spent since ' + fmtMon(last.month) + '’s split</h3></div>' + rows.join('') +
    (Math.abs(off) >= 1 ? `<div class="warnbox">${esc(jarName('bills'))} has ${money(Math.abs(off))} ${off > 0 ? 'more' : 'less'} than the plan expected (${money(expBills)}). ${off > 0 ? 'A bill may not have posted yet.' : 'A bill may have cost more, or something else came out.'}</div>` : `<div class="okbox">${esc(jarName('bills'))} is right where the plan expected.</div>`);
}
function closedCard(last, d) {
  const list = transferList(last.plan);
  const mm = last.check ? JAR_KEYS.filter(j => last.check[j] != null && Math.abs(last.check[j] - last.after[j]) >= 1) : [];
  return `<div class="card" style="margin-bottom:14px">${cardHd(fmtMon(last.month).toUpperCase() + ' · SPLIT', 'var(--green)', { left: true, rt: 'closed ' + fmtMD(last.closed) })}<div class="pad">` +
    list.map(t => `<div style="display:flex;justify-content:space-between;font-size:14px;font-weight:700;padding:3px 0"><span><span class="sw" style="--c:${t.col};display:inline-block;vertical-align:-2px;margin-right:8px"></span>${esc(t.to)}</span><span>${money(t.amount)}</span></div>`).join('') +
    (last.check && !mm.length ? `<div class="okbox">Bank matched the plan ✓${Object.keys(last.check).length < JAR_KEYS.length ? ' (' + Object.keys(last.check).length + ' of ' + JAR_KEYS.length + ' jars checked)' : ''}</div><div class="linkrow"><button class="link" data-act="damReopen" style="color:var(--muted)">Reopen</button></div>` :
      (last.check ? `<div class="warnbox">Bank didn’t match on ${esc(mm.map(jarName).join(', '))}. A transfer may still be on its way, or a balance was typed wrong: reopen to fix it.</div>` : '') +
      `<div class="acts"><button class="gb blue sm" data-act="damCheck">${last.check ? 'CHECK AGAIN' : 'DOUBLE-CHECK'}</button><button class="gb greyb sm" data-act="damReopen">REOPEN</button></div>`) + '</div></div>';
}
const canSplitEarly = d => d.next.due || d.next.days <= 7 || !state.months.length;
function damStart(d) {
  if (!canSplitEarly(d)) return;
  state.damDraft = { month: d.next.month, step: 1, inputs: { income: '', bills: '', gas: '', misc: '', personal: '', vault: '', loan: '' }, plan: null, done: {} };
  save(); render();
}
function readDamInputs() {
  document.querySelectorAll('[data-dam]').forEach(el => { state.damDraft.inputs[el.dataset.dam] = el.value.trim(); });
}
function damPlan() {
  readDamInputs();
  const dr = state.damDraft, errs = [], v = {};
  for (const j of ['income', ...JAR_KEYS]) {
    const x = num(dr.inputs[j]);
    if (dr.inputs[j] === '' || Number.isNaN(x)) errs.push(jarName(j));
    else v[j] = x;
  }
  const err = $('damErr');
  if (errs.length) { err.textContent = 'Type what your bank shows for ' + errs.join(', ') + '.'; err.hidden = false; return; }
  if (v.income < 0) { err.textContent = 'The income account can’t be split if it’s below $0.'; err.hidden = false; return; }
  const owedIn = num(dr.inputs.loan), owed = state.loan ? (dr.inputs.loan !== '' && owedIn >= 0 ? owedIn : +state.loan.owed || 0) : 0;
  const d = derive(state);
  const bal = { bills: v.bills, gas: v.gas, misc: v.misc, personal: v.personal, vault: v.vault };
  dr.before = { income: v.income, ...bal };
  dr.owed = owed;
  dr.rothUsed = d.rothUsed[VE.yearOf(dr.month)] || 0;
  dr.iou = d.iou;
  dr.plan = VE.split({ month: dr.month, income: v.income, bal, owed, rothUsed: dr.rothUsed, iou: d.iou }, state, d.plan);
  dr.step = 2; dr.done = {};
  save(); render(); window.scrollTo(0, 0); buzz(12);
}
function damClose() {
  const dr = state.damDraft, sp = dr.plan, today = todayIso(), t = Date.now();
  const after = {};
  for (const j of JAR_KEYS) after[j] = dr.before[j] + (j === 'personal' ? sp.toPersonal : sp.give[j]);
  const rec = {
    month: dr.month, closed: today, income: sp.income, before: dr.before, owed: dr.owed, rothUsed: dr.rothUsed, iou: sp.iouCharged,
    plan: { give: sp.give, toPersonal: sp.toPersonal, billsDue: sp.billsDue, billsTarget: sp.billsTarget, carDue: sp.carDue, extraLoan: sp.extraLoan, roth: sp.roth, invest: sp.invest, fun: sp.fun, short: sp.short, income: sp.income },
    done: dr.done, after, check: null, mismatch: false,
    undo: { loan: state.loan ? { owed: state.loan.owed, asOf: state.loan.asOf } : null, ious: [] },
  };
  // Balances after moving (the income account empties into the jars)
  for (const j of JAR_KEYS) state.balances.push({ date: today, jar: j, value: VE.round2(after[j]), t, ref: dr.month });
  state.balances.push({ date: today, jar: 'income', value: VE.round2(dr.before.income - sp.total), t, ref: dr.month });
  // The loan moves one month on
  if (state.loan) { state.loan.owed = VE.round2(VE.loanStep(dr.owed, state.loan.apr, sp.carDue + sp.extraLoan).owed); state.loan.asOf = VE.addMonths(dr.month, 1); }
  // IOUs get paid out of Personal's refill, oldest first
  let charge = sp.iouCharged;
  for (const i of openIous(state).sort((a, b) => (a.date < b.date ? -1 : 1))) {
    if (charge <= 0.005) break;
    const pay = Math.min(charge, +i.amount);
    rec.undo.ious.push({ id: i.id, amount: +i.amount });
    if (pay >= +i.amount - 0.005) i.paidIn = dr.month; else i.amount = VE.round2(+i.amount - pay);
    charge -= pay;
  }
  state.months = state.months.filter(m => m.month !== dr.month).concat(rec);
  state.damDraft = null;
  save(); render(); window.scrollTo(0, 0);
  buzz([30, 60, 30]); toast('Dam closed. Next one ' + fmtMD(VE.firstOf(VE.addMonths(dr.month, 1))) + '.');
}
function damReopen() {
  const last = derive(state).last;
  if (!last) return;
  if (last.undo && last.undo.loan && state.loan) Object.assign(state.loan, last.undo.loan);
  if (last.undo) for (const u of last.undo.ious) { const i = state.ious.find(x => x.id === u.id); if (i) { i.amount = u.amount; i.paidIn = null; } }
  state.balances = state.balances.filter(b => b.ref !== last.month);
  state.months = state.months.filter(m => m.month !== last.month);
  const inputs = { loan: last.owed != null ? String(VE.round2(last.owed)) : '' };
  for (const j of ['income', ...JAR_KEYS]) inputs[j] = String(VE.round2(last.before[j]));
  state.damDraft = { month: last.month, step: 1, inputs, plan: null, done: {} };
  save(); render(); toast('Reopened. Fix what you need and close it again.');
}

/* ---------- Path ---------- */
let pathWin = 60, pathPreview = null;
function horizonMonths(d, win) {
  if (win === 'fifty') { const by = +state.birthYear; return by ? Math.max(12, VE.monthsBetween(d.start.month, (by + 50) + '-12') + 1) : 60; }
  return win;
}
function eventsWithPreview(d, id) {
  if (!id || id === 'flip') return d.events;
  const e = state.events.find(x => x.id === id);
  if (!e) return d.events;
  return e.on !== false ? d.events.filter(x => x.id !== id) : d.events.concat({ ...e, on: true });
}
function whatIfRows(d, id, n) {
  if (id === 'flip') return VE.project(d.start, state, { months: n, events: d.events, first: state.extra.first === 'loan' ? 'roth' : 'loan' });
  const lever = LEVERS.find(l => l.id === id);
  if (lever) return VE.project(d.start, lever.apply(clone(state)), { months: n, events: d.events });
  return VE.project(d.start, state, { months: n, events: eventsWithPreview(d, id) });
}
function whatIfName(id) {
  if (id === 'flip') return state.extra.first === 'loan' ? 'Roth first' : loanName() + ' first';
  const lever = LEVERS.find(l => l.id === id); if (lever) return lever.name;
  const e = state.events.find(x => x.id === id);
  return e ? (e.on !== false ? 'without ' : 'with ') + e.label : '';
}
// Axis labels: $20k, $2.5k, −$5k, $1.2M
function axisMoney(v) {
  const a = Math.abs(v), sg = v < -0.5 ? '−' : '';
  if (a >= 1e6) return sg + '$' + +(a / 1e6).toFixed(1) + 'M';
  if (a >= 1000) return sg + '$' + +(a / 1000).toFixed(1) + 'k';
  return sg + '$' + Math.round(a);
}
function chartSVG(series, opts = {}) {
  // series: [{ rows, col, dash }]; opts.pins: [{ i, rows, label, sub, col, side }]
  const W = 380, H = 236, X0 = 46, X1 = 318, Y0 = 16, Y1 = 198;
  const all = series.flatMap(s => s.rows.map(r => r.mmd));
  const minV = Math.min(0, ...all), maxV = Math.max(1000, ...all);
  const stepRaw = (maxV - minV) / 4, mag = Math.pow(10, Math.floor(Math.log10(stepRaw || 1)));
  const step = [1, 2, 2.5, 5, 10].map(k => k * mag).find(k => k >= stepRaw) || stepRaw;
  // The top snaps to a gridline; below $0 only goes as deep as it needs (half a step at a time).
  const hi = Math.ceil(maxV / step) * step, lo = minV < 0 ? -Math.ceil(-minV / (step / 2)) * (step / 2) : 0;
  const n = series[0].rows.length;
  const X = i => X0 + (n > 1 ? i * (X1 - X0) / (n - 1) : 0), Y = v => Y1 - (v - lo) / (hi - lo || 1) * (Y1 - Y0);
  let g = '';
  for (let v = Math.ceil(lo / step) * step; v <= hi + 0.5; v += step) {
    g += `<line x1="${X0}" y1="${Y(v).toFixed(1)}" x2="${X1}" y2="${Y(v).toFixed(1)}" stroke="${Math.abs(v) < 0.5 ? '#55618f' : '#2b3762'}" stroke-width="${Math.abs(v) < 0.5 ? 1.6 : 1}"/>` +
      `<text x="${X0 - 6}" y="${(Y(v) + 4).toFixed(1)}" font-size="10" fill="#8490b5" text-anchor="end" font-weight="700">${axisMoney(v)}</text>`;
  }
  const years = n > 84 ? 5 : n > 36 ? 1 : 1;
  series[0].rows.forEach((r, i) => {
    if (VE.monthOfYear(r.month) === 0 && (VE.yearOf(r.month) % years === 0)) {
      g += `<line x1="${X(i).toFixed(1)}" y1="${Y1}" x2="${X(i).toFixed(1)}" y2="${Y1 + 5}" stroke="#55618f" stroke-width="1.4"/><text x="${X(i).toFixed(1)}" y="${Y1 + 18}" font-size="10" fill="#8490b5" text-anchor="middle" font-weight="700">${n > 36 ? VE.yearOf(r.month) : "'" + String(VE.yearOf(r.month)).slice(2)}</text>`;
    }
  });
  if (n <= 36) series[0].rows.forEach((r, i) => { if (i === 0 || VE.monthOfYear(r.month) % 3 === 0 && VE.monthOfYear(r.month)) g += `<text x="${X(i).toFixed(1)}" y="${Y1 + 18}" font-size="9.5" fill="#5f6a90" text-anchor="middle" font-weight="700">${MON(VE.monthOfYear(r.month))[0]}</text>`; });
  for (const s of series.slice().reverse()) {
    const pts = s.rows.map((r, i) => X(i).toFixed(1) + ',' + Y(r.mmd).toFixed(1)).join(' ');
    g += `<polyline points="${pts}" fill="none" stroke="#070b18" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/><polyline points="${pts}" fill="none" style="stroke:${s.col}" stroke-width="3.4" stroke-linejoin="round" stroke-linecap="round"${s.dash ? ' stroke-dasharray="8 5"' : ''}/>`;
  }
  for (const p of opts.pins || []) {
    if (p.i < 0 || p.i >= n) continue;
    const px = X(p.i), py = Y(p.rows[p.i].mmd), right = px < (X0 + X1) / 2;
    g += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="5.5" fill="#fff" stroke="#070b18" stroke-width="2.5"/>` +
      `<text x="${(px + (right ? 8 : -8)).toFixed(1)}" y="${(py + (p.below ? 18 : -10)).toFixed(1)}" font-size="10.5" font-weight="900" fill="#fff" text-anchor="${right ? 'start' : 'end'}">${esc(p.label)}</text>`;
  }
  // End labels, pushed apart when two lines finish close together
  const ends = series.map(s => ({ v: s.rows[n - 1].mmd, y: Y(s.rows[n - 1].mmd) + 4, col: s.dash ? s.col : '#fff' })).sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 14) ends[i].y = ends[i - 1].y + 14;
  for (const e of ends) g += `<text x="${X1 + 6}" y="${e.y.toFixed(1)}" font-size="12" font-weight="900" style="fill:${e.col}">${kmoney(e.v)}</text>`;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}">${g}</svg>`;
}
function pathHTML(d) {
  const s = state;
  let html = head('PATH', 'Money minus debt, month by month', false);
  const wins = [[12, '1Y'], [60, '5Y'], [120, '10Y']].concat(s.birthYear ? [['fifty', 'TO 50']] : []);
  html += '<div class="chips" style="margin-bottom:12px">' + wins.map(([w, l]) => `<button class="chip${pathWin === w ? ' on' : ''}" data-act="pathWin" data-w="${w}">${l}</button>`).join('') +
    `<button class="chip" data-go="compare" style="margin-left:auto">COMPARE ›</button></div>`;
  const n = horizonMonths(d, pathWin);
  const base = n <= d.proj.length ? d.proj.slice(0, n) : VE.project(d.start, s, { months: n, events: d.events });
  const wi = pathPreview ? whatIfRows(d, pathPreview, n) : null;
  const end = base[base.length - 1], wend = wi ? wi[wi.length - 1] : null;
  html += `<div class="card"><div class="pad" style="display:grid;grid-template-columns:${wi ? '1fr 1fr' : '1fr'};gap:12px"><div><div class="lbl">${fmtMon(end.month).toUpperCase()}</div><div style="font-size:30px;font-weight:900">${kmoney(end.mmd)}</div><div class="t2" style="font-size:12px;font-weight:700">your plan now</div></div>` +
    (wi ? `<div><div class="lbl" style="color:var(--bills)">WHAT-IF</div><div style="font-size:30px;font-weight:900">${kmoney(wend.mmd)}</div><div class="t2" style="font-size:12px;font-weight:700">${esc(whatIfName(pathPreview))} (${wend.mmd >= end.mmd ? '+' : '−'}${kmoney(Math.abs(wend.mmd - end.mmd))})</div></div>` : '') + '</div></div>';
  const sm = VE.summarize(base), pins = [];
  const pi = base.findIndex(r => r.owedStart > 0 && r.owed <= 0.005);
  if (pi >= 0) pins.push({ i: pi, rows: base, label: loanName() + ' gone ' + MON(VE.monthOfYear(base[pi].month)) + " '" + String(VE.yearOf(base[pi].month)).slice(2), below: true });
  if (wi) { const wpi = wi.findIndex(r => r.owedStart > 0 && r.owed <= 0.005); if (wpi >= 0 && wpi !== pi) pins.push({ i: wpi, rows: wi, label: MON(VE.monthOfYear(wi[wpi].month)) + " '" + String(VE.yearOf(wi[wpi].month)).slice(2) }); }
  html += `<div class="card" style="padding:10px 6px 8px">${chartSVG([{ rows: base, col: 'var(--green)' }].concat(wi ? [{ rows: wi, col: 'var(--bills)', dash: true }] : []), { pins })}` +
    `<div class="legend" style="padding:0 10px"><span><i style="--c:var(--green)"></i>your plan</span>${wi ? `<span><i class="dash" style="--c:var(--bills)"></i>${esc(whatIfName(pathPreview))}</span>` : ''}</div></div>`;
  // Life events
  html += `<div class="card">${cardHd('LIFE EVENTS', 'var(--personal)', { left: true, rt: 'tap to preview' })}<div class="pad">` +
    (s.events.length ? s.events.map(e => {
      const on = e.on !== false, prev = pathPreview === e.id;
      return `<div class="row"><button class="tick${on ? ' on' : ''}" data-act="evToggle" data-id="${e.id}" aria-label="Include">${on ? ICON.check : ''}</button>` +
        `<button class="grow" data-act="evPreview" data-id="${e.id}" style="text-align:left"><b>${esc(e.label)}</b><small>${evText(e)}${prev ? ' · <span class="gold">previewing</span>' : ''}</small></button>` +
        `<button class="ic" data-act="evEdit" data-id="${e.id}" aria-label="Edit">${ICON.pencil}</button></div>`;
    }).join('') : '<p class="note" style="margin-top:0">Add what might happen: a new job, time off, a bill that changes. Tick to count it in your plan, tap to preview it.</p>') +
    `<div class="chips" style="margin-top:10px"><button class="chip dash" data-act="evNew">+ Add event</button><button class="chip${pathPreview === 'flip' ? ' on' : ''}" data-act="evPreview" data-id="flip">Preview: ${esc(whatIfName('flip'))}</button>${pathPreview ? '<button class="chip" data-act="evPreview" data-id="">Clear preview</button>' : ''}</div></div></div>`;
  // Assumptions
  const as = [['income', 'Income ' + money(s.income.monthly) + '/mo'], ['growth', 'Growth ' + (s.extra.growth * 100).toFixed(1).replace('.0', '') + '%/yr'], ['rothLimit', 'Roth ' + money(s.extra.rothLimit) + '/yr'],
    ['loan', loanName() + ' ' + (s.loan ? (s.loan.apr * 100).toFixed(2) + '%' : '—')], ['investShare', 'Leftover ' + Math.round(s.extra.investShare * 100) + '/' + Math.round(100 - s.extra.investShare * 100)]];
  html += `<div class="card">${cardHd('ASSUMPTIONS · TAP TO CHANGE', 'var(--card2)', { left: true })}<div class="pad"><div class="chips">` +
    as.map(([k, l]) => `<button class="chip" data-act="editRule" data-rule="${k}">${esc(l)}</button>`).join('') +
    '<span class="chip dash">Fun share gets spent</span><span class="chip dash">Car value not counted</span></div></div></div>';
  // Milestones
  const ms = [];
  if (sm.positive) ms.push([sm.positive === base[0].month ? 'now' : fmtMon(sm.positive), 'money minus debt is positive']);
  if (sm.passOwed && s.loan && d.owed > 0) ms.push([fmtMon(sm.passOwed), 'what you’ve invested passes what you owe']);
  if (pi >= 0) ms.push([fmtMon(base[pi].month), loanName() + ' defeated · the ' + money(s.loan.payment) + ' bill ends']);
  const firstFull = rothFullMonths(base, s);
  if (firstFull) ms.push([firstFull, 'first full Roth year']);
  if (sm.short.length) ms.push([fmtMon(sm.short[0].month), 'first month that comes up short (' + money(sm.short[0].amount) + ')']);
  html += `<div class="card">${cardHd('MILESTONES', 'var(--green)', { left: true })}<div class="pad">` +
    (ms.length ? ms.map(([a, b]) => `<div style="display:flex;gap:12px;padding:5px 0;font-size:14px"><b style="min-width:84px">${esc(a)}</b><span class="t2" style="font-weight:700">${esc(b)}</span></div>`).join('') : '<p class="note" style="margin:0">None in this window.</p>') + '</div></div>';
  return html;
}
function rothFullMonths(rows, s) {
  const by = {};
  for (const r of rows) by[VE.yearOf(r.month)] = (by[VE.yearOf(r.month)] || 0) + r.split.roth;
  const first = rows.length ? VE.yearOf(rows[0].month) : 0;
  const y = Object.keys(by).map(Number).filter(y => y > first || VE.monthOfYear(rows[0].month) === 0).find(y => by[y] >= s.extra.rothLimit - 0.5);
  return y ? String(y) : null;
}
const evText = e => e.kind === 'income' ? 'take-home ' + money(e.amount) + '/mo from ' + fmtMon(e.start) + (e.bills ? ' · bills ' + (e.bills > 0 ? '+' : '−') + money(Math.abs(e.bills)) : '') + (e.end ? ' to ' + fmtMon(e.end) : '')
  : e.kind === 'bills' ? 'bills ' + (e.amount > 0 ? '+' : '−') + money(Math.abs(e.amount)) + '/mo from ' + fmtMon(e.start) + (e.end ? ' to ' + fmtMon(e.end) : '')
  : (e.amount < 0 ? '−' : '+') + money(Math.abs(e.amount)) + ' in ' + fmtMon(e.start) + (e.hours ? ' (' + e.hours + ' hr off)' : '');

/* ---------- Compare ---------- */
const LEVERS = [
  { id: 'p+100', name: 'Personal +$100', apply: s => { s.jars.personal.amount = (+s.jars.personal.amount || 0) + 100; return s; } },
  { id: 'misc-50', name: 'Misc −$50 spend', apply: s => { s.jars.misc.spend = Math.max(0, (+s.jars.misc.spend || 0) - 50); return s; } },
  { id: 'inc+300', name: 'Income +$300', apply: s => { s.income.monthly = (+s.income.monthly || 0) + 300; return s; } },
];
let cmpPick = null;
function compareHTML(d) {
  const s = state, n = horizonMonths(d, pathWin);
  const loanOn = !!s.loan && d.owed > 0;   // with no loan, "the other order" changes nothing, so it isn't shown
  let html = head('COMPARE', (loanOn ? 'Your plan, the other order, and a what-if' : 'Your plan and a what-if') + ' · ' + (n >= 12 ? Math.round(n / 12) + ' years' : n + ' months'));
  const options = s.events.map(e => e.id).concat(LEVERS.map(l => l.id));
  const pick = cmpPick && options.includes(cmpPick) ? cmpPick : options[0];
  const A = n <= d.proj.length ? d.proj.slice(0, n) : VE.project(d.start, s, { months: n, events: d.events });
  const C = whatIfRows(d, pick, n);
  const sA = VE.summarize(A), sC = VE.summarize(C), sB = loanOn ? VE.summarize(whatIfRows(d, 'flip', n)) : null;
  const lever = LEVERS.find(l => l.id === pick), cs = lever ? lever.apply(clone(s)) : s;
  const ev = s.events.find(e => e.id === pick);
  const rate = d.rate.rate;
  const hrsOf = (ss, extraBills = 0, inc = null) => {
    const r = inc && rate ? rate * inc / (+s.income.monthly || inc) : rate;
    const nn = VE.needs(ss, 1, extraBills), na = VE.needs(ss, 0, extraBills);
    return [VE.hoursFor(nn.total, r), VE.hoursFor(na.total, r)];
  };
  const hA = hrsOf(s), hC = ev && ev.kind !== 'once' ? hrsOf(s, ev.kind === 'bills' ? +ev.amount : +ev.bills || 0, ev.kind === 'income' ? +ev.amount : null) : hrsOf(cs);
  const cols = [{ t: 'YOUR PLAN', sub: loanOn ? (s.extra.first === 'loan' ? loanName() + ' first' : 'Roth first') : 'as it is', c: 'var(--green)', sm: sA, h: hA }]
    .concat(loanOn ? [{ t: 'FLIPPED', sub: whatIfName('flip'), c: 'var(--vault)', sm: sB, h: hA }] : [])
    .concat([{ t: 'WHAT-IF', sub: whatIfName(pick).replace(/^with /, ''), c: 'var(--bills)', sm: sC, h: hC }]);
  const gcols = `grid-template-columns:repeat(${cols.length},1fr)`;
  html += `<div class="cols" style="${gcols}">` + cols.map(c => `<div class="card" style="text-align:center">${cardHd(c.t, c.c)}<div style="padding:6px 4px 8px;font-size:11.5px;font-weight:800;color:var(--text2);min-height:40px">${esc(c.sub)}</div></div>`).join('') + '</div>';
  html += `<div class="chips" style="margin:10px 0 4px"><span class="lbl" style="align-self:center">What-if:</span>${options.map(o => `<button class="chip${o === pick ? ' on' : ''}" data-act="cmpPick" data-id="${o}">${esc(whatIfName(o).replace(/^with(out)? /, ''))}</button>`).join('')}</div>`;
  // The crown goes to the best column, unless they're all the same.
  const best = (vals, lower) => { const f = vals.filter(v => v != null); if (!f.length) return -1; const b = lower ? Math.min(...f) : Math.max(...f); return vals.filter(v => v != null && Math.abs(v - b) < 0.5).length === vals.length ? -1 : vals.findIndex(v => v != null && Math.abs(v - b) < 0.5); };
  const monthVal = m => m === 'none' ? -1 : m ? VE.monthsBetween('2000-01', m) : null;
  const row = (lab, f, val, lower) => [lab, cols.map(c => f(c)), best(cols.map(c => val(c)), lower)];
  const rows = [];
  if (loanOn) {
    rows.push(row(loanName() + ' gone', c => c.sm.payoff === 'none' ? 'no loan' : c.sm.payoff ? fmtMon(c.sm.payoff) : 'later', c => monthVal(c.sm.payoff), true));
    rows.push(row('Months with the ' + money(s.loan.payment) + ' bill', c => String(c.sm.loanMonths), c => c.sm.loanMonths, true));
    rows.push(row('Interest paid', c => money(c.sm.interest), c => c.sm.interest, true));
  }
  rows.push(row('Put into the Roth', c => kmoney(c.sm.roth), c => c.sm.roth, false));
  rows.push(row('Invested, worth', c => kmoney(c.sm.value), c => c.sm.value, false));
  rows.push(row('Money minus debt', c => kmoney(c.sm.mmd), c => c.sm.mmd, false));
  if (loanOn) rows.push(row('Hours/wk: now → after ' + loanName(), c => c.h[0] != null ? h1(c.h[0]) + ' → ' + h1(c.h[1]) : '—', c => c.h[1], true));
  else rows.push(row('Hours/wk needed', c => c.h[0] != null ? h1(c.h[0]) : '—', c => c.h[0], true));
  html += rows.map(([lab, vals, b]) => `<div class="card cmp" style="margin-top:8px;padding:8px 6px 10px"><div class="lbl" style="padding:0 6px 6px;font-size:10.5px">${esc(lab)} · ${fmtMon(A[A.length - 1].month)}</div><div class="cols" style="${gcols}">${vals.map((v, i) => `<div class="v${i === b ? ' best' : ''}">${esc(v)}</div>`).join('')}</div></div>`).join('');
  const dWhat = sC.mmd - sA.mmd;
  html += `<div class="card" style="margin-top:14px">${cardHd('THE TAKEAWAY', 'var(--personal)', { left: true })}<div class="pad" style="font-size:14.5px;font-weight:800;line-height:1.55">`;
  if (loanOn) {
    const dOrder = sA.mmd - sB.mmd, mDiff = sA.payoff && sB.payoff && sA.payoff !== 'none' ? VE.monthsBetween(sA.payoff, sB.payoff) : 0;
    html += `<p>Your order vs the flip: ${kmoney(Math.abs(dOrder))} apart by ${fmtMon(A[A.length - 1].month)} (${Math.abs(dOrder) < 0.5 ? 'the same' : dOrder > 0 ? 'yours ahead' : 'flip ahead'}).</p>` +
      (mDiff ? `<p class="t2">${mDiff > 0 ? 'Yours' : 'The flip'} kills the ${money(s.loan.payment)} bill ${plural(Math.abs(mDiff), 'month')} sooner.</p>` : '') +
      `<p class="${dWhat >= 0 ? 'green' : 'amber'}">${esc(whatIfName(pick).replace(/^with /, ''))}: ${dWhat >= 0 ? '+' : '−'}${kmoney(Math.abs(dWhat))}${Math.abs(dOrder) > 1 ? ', ' + (Math.abs(dWhat) / Math.abs(dOrder)).toFixed(1) + '× the order choice' : ''}.</p>`;
  } else {
    html += `<p class="${dWhat >= 0 ? 'green' : 'amber'}">${esc(whatIfName(pick).replace(/^with /, ''))}: ${dWhat >= 0 ? '+' : '−'}${kmoney(Math.abs(dWhat))} by ${fmtMon(A[A.length - 1].month)}.</p>`;
  }
  return html + '</div></div>';
}

/* ---------- Rules ---------- */
function rulesHTML(d) {
  const s = state;
  let html = head('RULES', 'Money flows top to bottom. Tap a rule to change it.', false);
  const R = [
    ['bills', jarLabel('bills'), 'tops up to this month’s target', money(d.preview.billsTarget) + ' ' + MON(VE.monthOfYear(d.next.month)), COL.bills, 'go:bills'],
    ['gas.cap', jarLabel('gas'), 'tops up to cap · spends ' + money(s.jars.gas.spend) + '/mo', money(s.jars.gas.cap), COL.gas],
    ['misc.cap', jarLabel('misc'), 'tops up to cap · spends ' + money(s.jars.misc.spend) + '/mo', money(s.jars.misc.cap), COL.misc],
    ['personal', jarLabel('personal'), 'same refill every month', money(s.jars.personal.amount), COL.personal],
    ['vault.cap', jarLabel('vault'), 'tops up to cap, never spent', money(s.jars.vault.cap), COL.vault],
    ['first', 'Leftover goes first to', s.extra.first === 'loan' ? loanName() + ', then the Roth' : 'the Roth, then ' + loanName(), s.extra.first === 'loan' ? loanName() : 'Roth', s.extra.first === 'loan' ? COL.loan : COL.roth],
    ['rothLimit', 'Roth IRA', 'up to the yearly limit', money(s.extra.rothLimit) + '/yr', COL.roth],
    ['investShare', 'After both', 'invest / fun', Math.round(s.extra.investShare * 100) + ' / ' + Math.round(100 - s.extra.investShare * 100), COL.invest],
  ];
  html += R.map(([k, name, sub, val, col, go], i) => `<button class="row" style="width:100%;border-left:6px solid ${col}" ${go ? `data-go="${go.slice(3)}"` : `data-act="editRule" data-rule="${k}"`}>` +
    `<span class="pill flat" style="--c:${col};width:30px;height:30px;padding:0;border-radius:50%">${i + 1}</span><div class="grow"><b>${esc(name)}</b><small>${esc(sub)}</small></div><span class="amt">${esc(val)}</span><span class="muted">${ICON.pencil}</span></button>`).join('');
  html += '<div class="sechd" style="--c:var(--blue)"><span class="bar2"></span><h3>The numbers behind it</h3></div>';
  const M = [
    ['go:bills', 'Bills', plural(s.bills.length, 'bill') + ' · ' + money(d.plan.perMonth) + '/mo set aside · cushion ' + money(s.jars.bills.cushion)],
    ['loan', loanName(), s.loan ? money(s.loan.owed) + ' owed · ' + (s.loan.apr * 100).toFixed(2) + '% · ' + money(s.loan.payment) + '/mo' : 'no loan'],
    ['income', 'Income and hours', money(s.income.monthly) + '/mo expected · ' + (+s.income.hoursPerWeek || 0) + ' hr/wk' + ((+s.income.other || 0) ? ' · +' + money(s.income.other) + ' other' : '')],
    ['spend', 'What jars spend', jarName('gas') + ' ' + money(s.jars.gas.spend) + ' · ' + jarName('misc') + ' ' + money(s.jars.misc.spend) + ' a month'],
    ['cushion', 'Bills cushion', money(s.jars.bills.cushion)],
    ['growth', 'Growth (assumption)', (s.extra.growth * 100).toFixed(1).replace('.0', '') + '% a year on the Roth and investing'],
    ['go:personal', 'Subscriptions and wishlist', plural(s.subs.length, 'subscription') + ' · ' + plural(s.wishes.length, 'wish')],
    ['go:cloud', 'Paychecks and pay schedule', plural(s.paychecks.length, 'check') + ' logged' + (s.pay ? ' · paid every ' + s.pay.every + ' days' : '')],
    ['go:settings', 'Jar names, backup, reset', 'export everything once a month'],
  ];
  html += M.map(([k, name, sub]) => `<button class="row" style="width:100%" ${k.startsWith('go:') ? `data-go="${k.slice(3)}"` : `data-act="editRule" data-rule="${k}"`}><div class="grow"><b>${esc(name)}</b><small>${esc(sub)}</small></div><span class="muted">${ICON.chev}</span></button>`).join('');
  return html;
}
// What a change does, before you make it.
function ripple(before, after) {
  const today = todayIso();
  const a = derive(before, today), b = derive(after, today);
  const yA = a.proj.slice(0, 60), yB = b.proj.slice(0, 60);
  const lastA = yA[yA.length - 1], lastB = yB[yB.length - 1];
  const rows = [];
  const mon = MON(VE.monthOfYear(a.next.month));
  for (const [k, lab] of [['bills', jarName('bills')], ['gas', jarName('gas')], ['misc', jarName('misc')], ['personal', jarName('personal')], ['vault', jarName('vault')]]) {
    const va = k === 'personal' ? a.preview.toPersonal : a.preview.give[k], vb = k === 'personal' ? b.preview.toPersonal : b.preview.give[k];
    if (Math.abs(va - vb) >= 0.5) rows.push([mon + ' 1 to ' + lab, money(va), money(vb), deltaChip(va, vb, 'money', k === 'bills')]);
  }
  for (const [k, lab] of [['extraLoan', 'extra to ' + ((after.loan || before.loan || {}).name || 'the loan')], ['roth', 'to the Roth'], ['invest', 'to investing']]) {
    if (Math.abs(a.preview[k] - b.preview[k]) >= 0.5) rows.push([mon + ' 1 ' + lab, money(a.preview[k]), money(b.preview[k]), deltaChip(a.preview[k], b.preview[k], 'money')]);
  }
  if (a.preview.short > 0.5 || b.preview.short > 0.5) rows.push(['Short on ' + mon + ' 1', money(a.preview.short), money(b.preview.short), deltaChip(a.preview.short, b.preview.short, 'money', true)]);
  if (before.loan || after.loan) {
    const pa = a.sum.payoff, pb = b.sum.payoff, ln = (after.loan || before.loan).name || 'Loan';
    const pt = p => p === 'none' ? 'no loan' : p ? fmtMon(p) : 'later';
    if (pa !== pb) rows.push([ln + ' gone', pt(pa), pt(pb), pa && pb && pa !== 'none' && pb !== 'none' ? deltaChip(pa, pb, 'month', true) : '<span class="delta same">—</span>']);
  }
  if (Math.abs(lastA.mmd - lastB.mmd) >= 1) rows.push(['Money minus debt, ' + fmtMon(lastA.month), kmoney(lastA.mmd), kmoney(lastB.mmd), deltaChip(lastA.mmd, lastB.mmd, 'k')]);
  if (a.freedom.hours != null && b.freedom.hours != null && Math.abs(a.freedom.hours - b.freedom.hours) >= 0.05) rows.push(['Freedom meter', h1(a.freedom.hours) + ' hr', h1(b.freedom.hours) + ' hr', deltaChip(a.freedom.hours, b.freedom.hours, 'hours', true)]);
  return rows;
}
function rippleHTML(rows) {
  if (!rows.length) return '<p class="note">No change to the plan.</p>';
  return '<div class="lbl" style="margin:16px 0 8px;display:flex;justify-content:space-between"><span>RIPPLE PREVIEW</span><span>before → after</span></div>' +
    rows.map(([lab, a, b, dl]) => `<div class="row" style="min-height:46px"><div class="grow"><b style="font-size:13.5px">${esc(lab)}</b></div><span class="muted" style="font-size:12.5px;font-weight:800">${esc(a)}</span><span class="t2">→</span><b style="font-size:14px">${esc(b)}</b>${dl}</div>`).join('');
}
// The rule editor: one sheet, many kinds of field.
const EDITORS = {
  'gas.cap': { title: () => jarName('gas') + ' cap', fields: [['$', 'cap', s => s.jars.gas.cap, (s, v) => { s.jars.gas.cap = v; }]], chips: [500, 750, 1000, 1500] },
  'misc.cap': { title: () => jarName('misc') + ' cap', fields: [['$', 'cap', s => s.jars.misc.cap, (s, v) => { s.jars.misc.cap = v; }]], chips: [500, 750, 1000, 1500] },
  'vault.cap': { title: () => jarName('vault') + ' cap', fields: [['$', 'cap', s => s.jars.vault.cap, (s, v) => { s.jars.vault.cap = v; }]], chips: [5000, 10000, 15000] },
  personal: { title: () => jarName('personal') + ' refill', fields: [['$', 'a month', s => s.jars.personal.amount, (s, v) => { s.jars.personal.amount = v; }]], chips: [150, 200, 250, 300] },
  rothLimit: { title: () => 'Roth limit per year', fields: [['$', 'a year', s => s.extra.rothLimit, (s, v) => { s.extra.rothLimit = v; }]], note: 'The 2026 limit under 50 is $7,500 (Kiplinger). Change it when the IRS does.' },
  investShare: { title: () => 'Leftover split', fields: [['%', 'to investing', s => Math.round(s.extra.investShare * 100), (s, v) => { s.extra.investShare = Math.max(0, Math.min(100, v)) / 100; }]], chips: [50, 75, 90, 100], note: 'The rest is fun money, and it goes to Personal.' },
  growth: { title: () => 'Growth per year', fields: [['%', 'a year', s => +(s.extra.growth * 100).toFixed(2), (s, v) => { s.extra.growth = v / 100; }]], chips: [4, 6, 8], note: 'An assumption for the Roth and investing. Only Path and Compare use it.' },
  cushion: { title: () => 'Bills cushion', fields: [['$', 'cushion', s => s.jars.bills.cushion, (s, v) => { s.jars.bills.cushion = v; }]], chips: [0, 100, 200], note: 'What Bills keeps at its lowest point of the year, in case a bill posts before your transfer.' },
  spend: { title: () => 'What jars spend', fields: [['$', () => jarName('gas') + ' a month', s => s.jars.gas.spend, (s, v) => { s.jars.gas.spend = v; }], ['$', () => jarName('misc') + ' a month', s => s.jars.misc.spend, (s, v) => { s.jars.misc.spend = v; }]], note: 'Only used to look ahead (Path, Freedom). Dam Day uses real balances.' },
  income: { title: () => 'Income and hours', fields: [['$', 'expected a month', s => s.income.monthly, (s, v) => { s.income.monthly = v; }], ['hr', 'usual hours a week', s => s.income.hoursPerWeek, (s, v) => { s.income.hoursPerWeek = v; }], ['$', 'other money a month', s => s.income.other || 0, (s, v) => { s.income.other = v; }]],
    note: 'Expected income is what Path and Compare assume. Dam Day always splits what’s really there.' },
  loan: { title: () => loanName(), text: [['name', 'Name', s => s.loan ? s.loan.name : '', (s, v) => { if (s.loan) s.loan.name = v || 'Loan'; }]],
    fields: [['$', 'owed now', s => s.loan ? s.loan.owed : 0, (s, v) => { if (s.loan) s.loan.owed = v; }], ['%', 'interest a year', s => s.loan ? +(s.loan.apr * 100).toFixed(3) : 0, (s, v) => { if (s.loan) s.loan.apr = v / 100; }], ['$', 'payment a month', s => s.loan ? s.loan.payment : 0, (s, v) => { if (s.loan) s.loan.payment = v; }]],
    note: 'Owed now = what the lender’s app says. The payment comes out of Bills.', extra: 'loanRemove' },
};
let editing = null;
const labOf = lab => typeof lab === 'function' ? lab() : lab;
const cap1 = t => t.charAt(0).toUpperCase() + t.slice(1);   // some labels use jar names, so they're worked out when shown
function openEditor(key) {
  // The editor works on a copy. Adding a loan only sticks if you press Apply.
  const base = clone(state);
  if (key === 'loan' && !base.loan) {
    base.loan = { name: 'Loan', owed: 0, apr: 0.06, payment: 0, asOf: derive(state).next.month, start: 0 };
    if (!base.bills.some(b => b.loan)) base.bills.push({ id: newId(), name: 'Loan payment', loan: true, amounts: Array(12).fill(0) });
  }
  editing = { key, base, draft: clone(base) };
  if (key === 'first') return openSheet(switchHTML());
  const E = EDITORS[key];
  if (!E) return;
  openSheet(editorHTML(E));
  refreshEditor();
}
function editorHTML(E) {
  const s = editing.draft;
  return `<div class="grab"></div><button class="x" data-close aria-label="Close">${ICON.close}</button><h2 class="gt" style="font-size:26px;margin-top:6px">${esc(E.title())}</h2>` +
    (E.text || []).map(([k, lab, get]) => `<label class="lab">${esc(lab)}</label><div class="field sm"><input data-ed-text="${k}" value="${esc(get(s))}" autocomplete="off"></div>`).join('') +
    E.fields.map(([u, lab, get], i) => `<label class="lab">${esc(cap1(labOf(lab)))}</label><div class="field">${u === '$' ? '<span class="pre">$</span>' : ''}<input data-ed="${i}" inputmode="decimal" autocomplete="off" value="${esc(get(s))}">${u !== '$' ? `<span class="suf">${u}</span>` : ''}</div>`).join('') +
    (E.chips ? `<div class="chips" style="margin-top:10px">${E.chips.map(c => `<button class="chip" data-act="edChip" data-v="${c}">${E.fields[0][0] === '$' ? money(c) : c + (E.fields[0][0] === '%' ? '%' : '')}</button>`).join('')}</div>` : '') +
    (E.note ? `<p class="note">${esc(E.note)}</p>` : '') +
    `<div id="edRipple"></div><p class="err" id="edErr" hidden></p>` +
    `<div class="acts"><button class="gb greyb" data-close>CANCEL</button><button class="gb green" data-act="edApply">APPLY</button></div>` +
    (E.extra === 'loanRemove' ? '<div class="linkrow"><button class="link" data-act="loanRemove" style="color:var(--red)">It’s paid off · remove the loan</button></div>' : '');
}
function readEditor() {
  const E = EDITORS[editing.key], s = clone(editing.base), errs = [];
  (E.text || []).forEach(([k, lab, get, set]) => { const el = document.querySelector(`[data-ed-text="${k}"]`); if (el) set(s, el.value.trim()); });
  E.fields.forEach(([u, lab, get, set], i) => {
    const el = document.querySelector(`[data-ed="${i}"]`); if (!el) return;
    const v = num(el.value);
    if (Number.isNaN(v) || v < 0) errs.push(labOf(lab));
    else if (u === '%' && v > 100) errs.push(labOf(lab) + ' (0–100)');
    else set(s, v);
  });
  return { s, errs };
}
function refreshEditor() {
  if (!editing || editing.key === 'first') return;
  const { s, errs } = readEditor();
  const err = $('edErr');
  if (errs.length) { err.textContent = 'Check: ' + errs.join(', ') + '.'; err.hidden = false; $('edRipple').innerHTML = ''; return; }
  err.hidden = true;
  editing.draft = s;
  $('edRipple').innerHTML = rippleHTML(ripple(state, s));
}
function switchHTML() {
  const s = editing.draft;
  return `<div class="grab"></div><button class="x" data-close aria-label="Close">${ICON.close}</button><h2 class="gt" style="font-size:26px;margin-top:6px">Leftover goes first to</h2>` +
    `<div class="switch2" style="margin-top:14px"><button class="${s.extra.first === 'loan' ? 'on' : ''}" style="--c:var(--loan)" data-act="swPick" data-v="loan">${esc(loanName())}</button><button class="${s.extra.first === 'roth' ? 'on' : ''}" style="--c:var(--roth)" data-act="swPick" data-v="roth">Roth IRA</button></div>` +
    `<p class="note">Whichever you pick gets the leftover until it’s full (${esc(loanName())} paid off, or the Roth limit for the year). Then the other one, then ${Math.round(s.extra.investShare * 100)}/${Math.round(100 - s.extra.investShare * 100)} invest/fun.</p>` +
    `<div id="edRipple">${rippleHTML(ripple(state, s))}</div><div class="acts"><button class="gb greyb" data-close>CANCEL</button><button class="gb green" data-act="edApply">APPLY</button></div>`;
}
function applyEditor() {
  if (editing.key !== 'first') { const { s, errs } = readEditor(); if (errs.length) return refreshEditor(); editing.draft = s; }
  const d = editing.draft;
  if (d.loan && editing.key === 'loan' && !(+d.loan.start > +d.loan.owed)) d.loan.start = +d.loan.owed;
  state = d; editing = null; save(); closeSheet(); render(); buzz(12); toast('Saved.');
}

/* ---------- Bills editor ----------
   Each bill in the editor carries the months it lands in (_lit) and its amount as typed (_amt).
   A bill you don't touch is saved exactly as it was. */
let billDraft = null;
function draftBills(bills) {
  return clone(bills).map(b => {
    if (b.loan) return b;
    const lit = b.amounts.map(a => a > 0), amt = Math.max(0, ...b.amounts);
    return { ...b, _lit: lit.some(Boolean) ? lit : Array(12).fill(true), _amt: amt ? String(VE.round2(amt)) : '', _touched: false };
  });
}
function cleanBills(draft) {
  return draft.map(b => {
    if (b.loan) return { id: b.id, name: b.name, loan: true, amounts: b.amounts.slice() };
    if (!b._touched) return { id: b.id, name: b.name, amounts: b.amounts.slice() };
    const v = num(b._amt), amt = Number.isNaN(v) ? 0 : Math.max(0, v);
    return { id: b.id, name: b.name, amounts: b._lit.map(l => l ? amt : 0) };
  });
}
function billsPreview() { const tmp = clone(state); tmp.bills = cleanBills(billDraft); const cu = document.querySelector('[data-act-input="cushion"]'), cv = cu ? num(cu.value) : NaN; if (cv >= 0) tmp.jars.bills.cushion = cv; return tmp; }
function billsHTML(d) {
  if (!billDraft) billDraft = draftBills(state.bills);
  const tmp = clone(state); tmp.bills = cleanBills(billDraft);
  const plan = VE.billPlan(tmp.bills, tmp.loan, tmp.jars.bills.cushion);
  let html = head('BILLS', 'Everything that comes out of ' + esc(jarLabel('bills')));
  html += `<div class="card"><div class="pad" style="display:flex;justify-content:space-between;align-items:center"><div><div class="lbl">SET ASIDE EACH MONTH</div><div style="font-size:28px;font-weight:900">${money(plan.perMonth)}</div></div><div style="text-align:right"><div class="lbl">A YEAR</div><div style="font-size:18px;font-weight:900">${money(plan.perMonth * 12)}</div></div></div>` +
    `<div style="padding:0 10px 10px">${monthBars(plan.target, VE.monthOfYear(d.next.month))}<p class="note" style="text-align:center;margin-top:4px">${esc(jarName('bills'))} target on the 1st of each month</p></div></div>`;
  html += billDraft.map((b, i) => {
    if (b.loan) {
      const amt = state.loan ? state.loan.payment : 0;
      return `<div class="billrow" data-bill="${i}"><div class="top2"><input class="nm" data-bk="name" value="${esc(b.name)}" placeholder="What"><span class="tag" style="padding:6px 8px">${esc(loanName())} ${money(amt)}</span>` +
        `<button class="del" data-act="billDel" data-i="${i}" aria-label="Remove">✕</button></div><p class="note" style="margin-top:6px">Comes from the loan. Change it under Rules → ${esc(loanName())}.</p></div>`;
    }
    const every = b._lit.every(Boolean), nz = b.amounts.filter(a => a > 0);
    const varying = !b._touched && nz.some(a => Math.abs(a - nz[0]) > 0.005);
    return `<div class="billrow" data-bill="${i}"><div class="top2"><input class="nm" data-bk="name" value="${esc(b.name)}" placeholder="What">` +
      `<input class="am" data-bk="amount" inputmode="decimal" value="${esc(b._amt)}" placeholder="$0"><button class="del" data-act="billDel" data-i="${i}" aria-label="Remove">✕</button></div>` +
      `<div class="months">${MONTHS.map((m, k) => `<button class="${b._lit[k] ? 'on' : ''}" data-act="billMonth" data-i="${i}" data-m="${k}">${m[0]}</button>`).join('')}</div>` +
      `<p class="note" style="margin-top:6px">${every ? 'Every month' : 'Only in the lit months: ' + b._lit.map((x, k) => x ? MON(k) : null).filter(Boolean).join(', ')}${varying ? '. The amount differs by month; typing one sets them all.' : ''}</p></div>`;
  }).join('');
  html += `<button class="addrow" data-act="billAdd">+ Add a bill</button>`;
  html += `<label class="lab" style="margin-top:16px">Cushion</label><div class="field sm"><span class="pre">$</span><input data-act-input="cushion" inputmode="decimal" value="${esc(state.jars.bills.cushion)}"></div>`;
  html += `<div id="billRipple">${rippleHTML(ripple(state, tmp))}</div>`;
  html += `<p class="err" id="billErr" hidden></p><div class="acts"><button class="gb greyb" data-act="billCancel">CANCEL</button><button class="gb green" data-act="billSave">SAVE</button></div>`;
  return html;
}
function monthBars(vals, hi) {
  const max = Math.max(...vals, 1), W = 360, H = 90, bw = W / 12;
  return `<svg viewBox="0 0 ${W} ${H + 18}" style="width:100%;height:auto">${vals.map((v, i) => { const h = Math.max(2, v / max * H); return `<rect x="${(i * bw + 3).toFixed(1)}" y="${(H - h).toFixed(1)}" width="${(bw - 6).toFixed(1)}" height="${h.toFixed(1)}" rx="4" fill="${i === hi ? '#4c8dff' : '#3a4878'}"/><text x="${(i * bw + bw / 2).toFixed(1)}" y="${H + 14}" font-size="10" text-anchor="middle" fill="${i === hi ? '#fff' : '#8490b5'}" font-weight="800">${MONTHS[i][0]}</text>`; }).join('')}</svg>`;
}
function readBills() {
  document.querySelectorAll('[data-bill]').forEach(row => {
    const b = billDraft[+row.dataset.bill]; if (!b) return;
    b.name = row.querySelector('[data-bk="name"]').value;
    const am = row.querySelector('[data-bk="amount"]');
    if (am && !b.loan && am.value !== b._amt) { b._amt = am.value; b._touched = true; }
  });
}

/* ---------- Pay Cloud ---------- */
function clockText(s) {
  const h = timerHours(s), hh = Math.floor(h), mm = Math.floor((h - hh) * 60), ss = Math.floor(((h - hh) * 60 - mm) * 60);
  return hh + ':' + pad2(mm) + ':' + pad2(ss);
}
function earnedText(s, d) { const r = d ? d.rate.rate : rateOf(s).rate; return r ? '+' + cents(timerHours(s) * r) + ' this shift' : 'log a check for $'; }
function cloudHTML(d) {
  const s = state, r = d.rate;
  let html = head('PAY CLOUD', 'Hours you work turn into your next paycheck');
  const running = !!s.timer;
  html += `<div style="position:relative;width:100%;aspect-ratio:1.75;margin-top:4px">${cloudSVG()}` +
    `<div style="position:absolute;left:0;right:0;top:${running ? '30%' : '38%'};text-align:center;color:#1b2546">` +
    (running ? `<div style="font-size:11px;font-weight:900;letter-spacing:2px;color:#56607f">ON SHIFT · SINCE ${new Date(s.timer.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</div><div style="font-size:46px;font-weight:900" data-tick="clock">${clockText(s)}</div><div style="font-size:15px;font-weight:900;color:#1f8f2f" data-tick="earned">${earnedText(s, d)}</div>`
      : `<div style="font-size:12px;font-weight:900;letter-spacing:2px;color:#56607f">NOT ON SHIFT</div><div style="font-size:15px;font-weight:800;color:#3b4569;margin-top:6px">Start the timer when you clock in,<br>or add a shift by hand below.</div>`) + '</div></div>';
  html += `<div style="text-align:center;margin-top:6px">${running ? '<button class="gb redb wide" data-act="timerStop">END SHIFT</button><div class="linkrow"><button class="link" data-act="timerCancel" style="color:var(--muted)">Started by mistake · throw it away</button></div>' : '<button class="gb green wide" data-act="timerStart">START SHIFT</button>'}</div>`;
  // This pay period
  if (d.check) {
    const c = d.check, days = [];
    for (let k = VE.dayOf(c.from); k <= VE.dayOf(c.to); k++) days.push(VE.isoOf(k));
    const byDay = {}; for (const x of s.shifts) byDay[x.date] = (byDay[x.date] || 0) + (+x.hours || 0);
    html += `<div class="card" style="margin-top:16px">${cardHd('HOURS FOR THE ' + fmtMD(c.pay).toUpperCase() + ' CHECK', 'var(--water)', { left: true })}<div class="pad">` +
      `<div style="display:grid;grid-template-columns:repeat(${Math.min(days.length, 7)},1fr);gap:4px">${days.map(day => {
        const hv = byDay[day] || 0, isT = day === d.today, wd = WEEKDAYS[dObj(day).getUTCDay()][0];
        return `<div style="text-align:center"><div style="height:38px;border-radius:9px;border:2.5px solid ${isT ? 'var(--gold)' : 'var(--out)'};background:${hv ? 'var(--water)' : 'var(--track)'};display:grid;place-items:center;font-size:11px;font-weight:900">${hv ? h1(hv).replace('.0', '') : ''}</div><div style="font-size:10px;font-weight:800;color:${isT ? 'var(--gold)' : 'var(--muted)'};margin-top:2px">${wd}${dObj(day).getUTCDate()}</div></div>`;
      }).join('')}</div>` +
      `<div style="display:flex;align-items:center;gap:10px;margin-top:12px"><div style="flex:1">${bar(c.logged / (c.full || 1), 'var(--water)', { lg: true })}</div><b>${h1(c.logged).replace('.0', '')} of ${c.full} hr</b></div>` +
      `<p class="note">≈ ${money(c.soFar)} so far · full period ≈ ${money(c.full * r.rate)} at ${cents(r.rate)}/hr. Work ${fmtMD(c.from)} – ${fmtMD(c.to)}, paid ${fmtDay(c.pay)}.</p></div></div>`;
  } else if (!s.pay) html += `<div class="warnbox">Add your pay schedule (dates off one stub) so Valley knows which hours go on which check. <button class="link" data-act="editPay">Add it</button></div>`;
  // Add a shift
  const recent = []; for (let k = 0; k < 14; k++) recent.push(VE.isoOf(VE.dayOf(d.today) - k));
  html += `<div class="card" style="margin-top:14px">${cardHd('ADD A SHIFT', 'var(--card2)', { left: true })}<div class="pad"><div class="grid2"><div><label class="lab" style="margin-top:0">Day</label><div class="field sm"><select id="shDay">${recent.map(x => `<option value="${x}">${x === d.today ? 'Today' : fmtDay(x)}</option>`).join('')}</select></div></div>` +
    `<div><label class="lab" style="margin-top:0">Hours</label><div class="field sm"><input id="shHours" inputmode="decimal" placeholder="0" autocomplete="off"><span class="suf">hr</span></div></div></div>` +
    `<p class="err" id="shErr" hidden></p><div class="acts" style="margin-top:12px"><button class="gb blue" data-act="shiftAdd">ADD</button></div>` +
    (s.shifts.length ? '<div class="lbl" style="margin:14px 0 6px">RECENT SHIFTS</div>' + s.shifts.slice().sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 6).map(x => `<div class="row"><div class="grow"><b>${fmtDay(x.date)}</b><small>${h1(x.hours).replace('.0', '')} hr${x.timer ? ' · timer' : ''}</small></div><span class="amt">${r.rate ? money(x.hours * r.rate) : ''}</span><button class="ic" data-act="shiftDel" data-id="${x.id}" aria-label="Delete">✕</button></div>`).join('') : '') + '</div></div>';
  // Paychecks and rate
  html += `<div class="card" style="margin-top:14px">${cardHd('YOUR REAL $/HR', 'var(--personal)', { left: true })}<div class="pad">` +
    `<div style="display:flex;align-items:baseline;gap:8px"><div style="font-size:40px;font-weight:900">${r.rate ? cents(r.rate) : '—'}</div><div class="t2" style="font-weight:800">/hr</div>${r.learned ? '' : '<span class="chip gold" style="margin-left:auto;height:28px">ESTIMATE</span>'}</div>` +
    `<p class="note" style="margin-top:4px">${r.learned ? 'Take-home ÷ hours, from your last ' + plural(r.checks.length, 'check') + ': ' + money(sum(r.checks.map(c => c.net))) + ' ÷ ' + h1(sum(r.checks.map(c => c.hours))).replace('.0', '') + ' hr.' : (r.rate ? 'Take-home ÷ hours, guessed for now: ' + money(s.income.monthly) + ' a month ÷ ' + h1((+s.income.hoursPerWeek || 0) * VE.WEEKS_PER_MONTH) + ' hr. Log a check below and the real number replaces this.' : 'Log a check below.')}</p>` +
    `<div class="lbl" style="margin:16px 0 0">LOG A PAYCHECK</div><label class="lab">Pay date</label><div class="field sm"><input id="pcDate" type="date" value="${d.today}"></div>` +
    `<div class="grid2"><div><label class="lab">Take-home</label><div class="field sm"><span class="pre">$</span><input id="pcNet" inputmode="decimal" placeholder="0" autocomplete="off"></div></div><div><label class="lab">Hours</label><div class="field sm"><input id="pcHours" inputmode="decimal" placeholder="0" autocomplete="off"><span class="suf">hr</span></div></div></div>` +
    `<p class="note" style="margin-top:4px">Copy take-home and hours off the stub.</p><p class="err" id="pcErr" hidden></p><div class="acts" style="margin-top:8px"><button class="gb blue" data-act="checkAdd">LOG CHECK</button></div>` +
    (s.paychecks.length ? s.paychecks.slice().sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 6).map(c => `<div class="row"><div class="grow"><b>${fmtDay(c.date)}</b><small>${money(c.net)} for ${h1(c.hours).replace('.0', '')} hr</small></div><span class="amt">${cents(c.net / c.hours)}</span><button class="ic" data-act="checkDel" data-id="${c.id}" aria-label="Delete">✕</button></div>`).join('') : '') + '</div></div>';
  if (r.rate) {
    // Run the split again with one shift more and one less, and say where the difference lands.
    const one = r.rate * 10;
    const up = moneyMoves(d.preview, splitWith(d, d.lake.est + one)), down = moneyMoves(d.preview, splitWith(d, Math.max(0, d.lake.est - one)));
    const skips = up.every(([k]) => !JAR_KEYS.includes(k)), jarsSafe = down.every(([k]) => !JAR_KEYS.includes(k) || k === 'personal');
    const say = (list, word) => list.map(([k, v]) => '<b>' + money(Math.abs(v)) + '</b> ' + word + ' ' + esc(moveName(k))).join(', ');
    html += `<div class="card" style="margin-top:14px">${cardHd('ONE 10-HR SHIFT ≈ ' + money(one), 'var(--roth)', { left: true })}<div class="pad">` +
      `<p class="note" style="margin-top:0">${skips ? 'Your jars are full for ' + fmtMD(d.next.date) + ', so extra hours skip straight past them.' : 'Some jars aren’t full for ' + fmtMD(d.next.date) + ' yet, so extra hours fill them first.'}</p>` +
      `<div class="okbox"><b>+1 shift →</b> ${say(up, 'to') || 'no change'}.</div>` +
      `<div class="badbox"><b>−1 shift →</b> ${say(down, 'less for') || 'no change'}.${jarsSafe && d.preview.left > 0.5 ? ' ' + esc(jarName('bills')) + ', ' + esc(jarName('gas')) + ' and ' + esc(jarName('misc')) + ' stay covered while the leftover lasts (≈' + money(d.preview.left) + ' this month).' : ''}</div></div></div>`;
  }
  return html;
}

// The split again with different income, and what moved between the two (biggest first).
function splitWith(d, income) {
  return VE.split({ month: d.next.month, income, bal: d.at.bal, owed: d.owed, rothUsed: d.rothUsed[VE.yearOf(d.next.month)] || 0, iou: d.iou }, state, d.plan);
}
function moneyMoves(a, b) {
  const parts = JAR_KEYS.map(j => [j, j === 'personal' ? b.toPersonal - a.toPersonal : b.give[j] - a.give[j]])
    .concat([['loan', b.extraLoan - a.extraLoan], ['roth', b.roth - a.roth], ['invest', b.invest - a.invest]]);
  return parts.filter(([, v]) => Math.abs(v) >= 0.5).sort((x, y) => Math.abs(y[1]) - Math.abs(x[1]));
}
const moveName = k => k === 'loan' ? loanName() : k === 'roth' ? 'the Roth' : k === 'invest' ? 'investing' : jarName(k);

/* ---------- Personal ---------- */
function personalHTML(d) {
  const s = state, P = d.personal, rf = P.refill;
  let html = head(jarLabel('personal').toUpperCase(), 'Your fun money. The only jar you get to play with.');
  const days = P.days;
  html += `<div class="card" style="background:#2a2410"><div class="pad"><div style="display:flex;gap:12px;align-items:center">${coinSVG(52)}<div><div class="lbl" style="color:#d9c27a">LEFT UNTIL ${fmtMD(VE.addMonths(d.next.month, d.next.due ? 1 : 0) + '-01').toUpperCase()}</div><div style="font-size:40px;font-weight:900;line-height:1">${P.known ? money(P.balance) : '—'}</div></div>` +
    `<div style="margin-left:auto;text-align:right;color:#ffe08a;font-weight:900">${P.known ? cents(P.perDay) + '<br><small style="font-size:11px">a day · ' + plural(days, 'day') + '</small>' : ''}</div></div>` +
    `<div style="display:grid;grid-template-columns:repeat(${Math.min(days, 31)},1fr);gap:3px;margin-top:12px">${Array.from({ length: Math.min(days, 31) }, (_, i) => `<i style="display:block;aspect-ratio:1;border-radius:50%;border:2px solid var(--out);background:${i === 0 ? '#ffcf33' : '#4a3e17'}"></i>`).join('')}</div>` +
    `<div class="grid2" style="margin-top:12px;grid-template-columns:1fr auto"><div class="field sm"><span class="pre">$</span><input id="pBal" inputmode="decimal" placeholder="balance now" autocomplete="off"></div><button class="gb sm blue" data-act="pBalSave" style="height:44px">UPDATE</button></div>` +
    `${P.asOf ? `<p class="note" style="color:#d9c27a">Last checked ${fmtDay(P.asOf)}.</p>` : ''}</div></div>`;
  // Refill split
  const parts = [['Subscriptions', rf.subs, '#8b93ad'], ['Wishlist', rf.toWishes, 'var(--water)'], ['Free to spend', rf.free, 'var(--personal)']];
  const tot = Math.max(rf.amount, 1);
  html += `<div class="card">${cardHd('EACH ' + money(rf.amount) + ' REFILL', 'var(--personal)', { left: true })}<div class="pad">` +
    `<div style="display:flex;gap:4px;height:40px;padding:3px;border-radius:12px;background:var(--out)">${parts.filter(x => x[1] > 0.5).map(([n, v, c]) => `<div style="flex:${(Math.max(0, v) / tot).toFixed(3)};min-width:34px;border-radius:9px;background:${c};display:grid;place-items:center" class="gt"><span style="font-size:13px">${money(v)}</span></div>`).join('')}</div>` +
    `<div class="grid3" style="margin-top:10px">${parts.map(([n, v, c]) => `<div><div style="display:flex;gap:6px;align-items:center"><span class="sw" style="--c:${c}"></span><b style="font-size:13px">${n}</b></div><div class="t2" style="font-size:12px;font-weight:700;margin-top:2px">${money(v)}</div></div>`).join('')}</div>` +
    (rf.free < -0.5 ? `<div class="badbox">Subscriptions and wishes need ${money(-rf.free)} more than the refill. Push a wish date out or raise the refill.</div>` : '') + '</div></div>';
  // Subscriptions
  html += `<div class="card">${cardHd('SUBSCRIPTIONS', 'var(--card2)', { left: true, rt: money(rf.subs) + '/mo' })}<div class="pad">` +
    s.subs.map(x => `<div class="row"><div class="grow"><b>${esc(x.name)}</b></div><span class="amt">${money(x.amount)}</span><button class="ic" data-act="subDel" data-id="${x.id}" aria-label="Delete">✕</button></div>`).join('') +
    `<div class="grid2" style="margin-top:10px;grid-template-columns:1fr 100px auto"><div class="field sm"><input id="subName" placeholder="Name" autocomplete="off"></div><div class="field sm"><span class="pre">$</span><input id="subAmt" inputmode="decimal" placeholder="0" autocomplete="off"></div><button class="gb sm blue" data-act="subAdd" style="height:44px">ADD</button></div></div></div>`;
  // Wishlist
  html += `<div class="card">${cardHd('WISHLIST', 'var(--water)', { left: true, rt: 'top one gets funded first' })}<div class="pad">` +
    rf.wishes.map((w, i) => `<div class="row" style="display:block"><div style="display:flex;align-items:center;gap:8px"><b style="font-size:20px;color:var(--gold);width:18px">${i + 1}</b><div class="grow"><b>${esc(w.name)}</b><small>${money(+w.price || 0)} by ${fmtMon(w.by)} · ${w.done ? 'funded ✓' : money(w.monthly) + '/mo for ' + plural(w.months, 'month')}</small></div>` +
      `<button class="ic" data-act="wishUp" data-id="${w.id}" aria-label="Move up" ${i === 0 ? 'disabled style="opacity:.3"' : ''}>▲</button><button class="ic" data-act="wishDel" data-id="${w.id}" aria-label="Delete">✕</button></div>` +
      `<div style="display:flex;gap:8px;align-items:center;margin-top:8px"><div style="flex:1">${bar((+w.saved || 0) / (+w.price || 1), 'var(--water)')}</div><div class="field sm" style="width:118px;height:36px"><span class="pre" style="font-size:14px">$</span><input data-wish-saved="${w.id}" inputmode="decimal" value="${+w.saved || ''}" placeholder="saved" style="font-size:14px"></div></div></div>`).join('') +
    `<div class="lbl" style="margin:14px 0 6px">ADD A WANT</div><div class="field sm"><input id="wName" placeholder="What is it?" autocomplete="off"></div>` +
    `<div class="grid2" style="margin-top:8px"><div class="field sm"><span class="pre">$</span><input id="wPrice" inputmode="decimal" placeholder="price" autocomplete="off"></div><div class="field sm"><input id="wBy" type="month" value="${VE.addMonths(d.next.month, 6)}"></div></div>` +
    `<p class="err" id="wErr" hidden></p><div class="acts" style="margin-top:10px"><button class="gb blue" data-act="wishAdd">ADD</button></div></div></div>`;
  // IOUs
  const open = openIous(s);
  html += `<div class="card">${cardHd('LEAK GUARD', 'var(--green)', { left: true })}<div class="pad">` +
    `<div style="display:flex;justify-content:space-between;align-items:center"><b>Borrowed from other jars</b><span class="pill" style="--c:${d.iou > 0.5 ? 'var(--amber)' : '#2fb34a'}">${money(d.iou)}${d.iou > 0.5 ? '' : ' ✓'}</span></div>` +
    open.map(i => `<div class="row" style="margin-top:8px"><span class="sw" style="--c:${COL[i.from] || 'var(--grey)'}"></span><div class="grow"><b>${esc(jarName(i.from))} → ${esc(jarName('personal'))}</b><small>${fmtDay(i.date)} · paid back from the next refill</small></div><span class="amt">${money(i.amount)}</span><button class="ic" data-act="iouDel" data-id="${i.id}" aria-label="Delete">✕</button></div>`).join('') +
    `<p class="note">Moved money from another jar to cover fun? Log it here. Dam Day pays it back out of ${esc(jarName('personal'))}’s refill, so ${esc(jarName('gas'))} and the rest never quietly come up short.</p>` +
    `<div class="grid2" style="margin-top:10px;grid-template-columns:1fr 1fr auto"><div class="field sm"><select id="iouFrom">${['gas', 'misc', 'bills', 'vault'].map(j => `<option value="${j}">${esc(jarName(j))}</option>`).join('')}</select></div><div class="field sm"><span class="pre">$</span><input id="iouAmt" inputmode="decimal" placeholder="0" autocomplete="off"></div><button class="gb sm blue" data-act="iouAdd" style="height:44px">LOG</button></div></div></div>`;
  // Later
  const pi = d.proj.findIndex(r => r.owedStart > 0 && r.owed <= 0.005);
  if (pi >= 0 && s.extra.investShare < 1) {
    const after = d.proj.slice(pi + 1, pi + 13), avg = after.length ? sum(after.map(r => r.split.fun)) / after.length : 0;
    html += `<div class="card">${cardHd('LATER: MORE FUN MONEY', 'var(--free)', { left: true })}<div class="pad"><p style="font-weight:800">After ${esc(loanName())} (≈ ${fmtMon(d.proj[pi].month)}), ${Math.round((1 - s.extra.investShare) * 100)}% of the leftover comes here.</p>` +
      `<div style="font-size:34px;font-weight:900;margin-top:6px">≈ +${money(avg)}<small style="font-size:14px;color:var(--text2)"> /mo on average</small></div><p class="note">The first year after: the Roth fills first each year, then the split starts.</p></div></div>`;
  }
  return html;
}

/* ---------- Freedom ---------- */
function freedomHTML(d) {
  const s = state, fr = d.freedom, r = d.rate.rate;
  let html = head('FREEDOM METER', 'How many hours a week your life costs');
  if (!r) return html + '<div class="warnbox">Log a paycheck (Pay Cloud) or set your expected income and hours (Rules) to see this.</div>';
  const hpw = fr.hoursPerWeek || 40, max = Math.max(40, Math.ceil(hpw / 10) * 10, Math.ceil(fr.hours / 10) * 10);
  const cx = 190, cy = 168, R = 128;
  const pt = (f, rr) => { const a = Math.PI * (1 - f); return [cx + rr * Math.cos(a), cy - rr * Math.sin(a)]; };
  const arc = (f0, f1, rr, col, w) => { const [x0, y0] = pt(f0, rr), [x1, y1] = pt(f1, rr); return `<path d="M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${rr} ${rr} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>`; };
  const f = Math.min(1, fr.hours / max);
  let g = arc(0, 1, R, '#070b18', 34) + arc(0, 1, R, '#0d1430', 26) + arc(0, f, R, '#2ed3c6', 26) + (f < 1 ? arc(f, 1, R, '#2d3a66', 26) : '');
  for (let v = 0; v <= max; v += 10) { const [x, y] = pt(v / max, R + 30); g += `<text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" font-size="12" fill="#8490b5" text-anchor="middle" font-weight="800">${v}</text>`; }
  if (fr.afterLoan != null && d.owed > 0) { const [x0, y0] = pt(fr.afterLoan / max, R - 18), [x1, y1] = pt(fr.afterLoan / max, R + 18); g += `<line x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}" stroke="#fff" stroke-width="3" stroke-dasharray="4 3"/>`; }
  const [nx, ny] = pt(f, R - 40);
  g += `<line x1="${cx}" y1="${cy}" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}" stroke="#070b18" stroke-width="10" stroke-linecap="round"/><line x1="${cx}" y1="${cy}" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}" stroke="#fff" stroke-width="5" stroke-linecap="round"/><circle cx="${cx}" cy="${cy}" r="12" fill="#fff" stroke="#070b18" stroke-width="4"/>`;
  html += `<div class="card"><div class="pad" style="text-align:center"><svg viewBox="0 0 380 190" style="width:100%;height:auto">${g}</svg>` +
    `<div style="font-size:42px;font-weight:900;line-height:1">${h1(fr.hours)} <small style="font-size:16px;color:var(--text2)">hr/wk</small></div>` +
    `<p class="t2" style="font-weight:800;margin-top:6px">needed · you work ${Math.round(hpw)} · ${fr.spare >= 0 ? h1(fr.spare) + ' to spare' : '<span class="amber">' + h1(-fr.spare) + ' short</span>'}</p>` +
    (fr.afterLoan != null && d.owed > 0 ? `<p class="note">Dashed tick: ${h1(fr.afterLoan)} hr/wk once ${esc(loanName())} is gone.</p>` : '') + '</div></div>';
  html += `<div class="card">${cardHd('HOW IT’S FIGURED', 'var(--free)', { left: true })}<div class="pad">` +
    [['Bills (set aside a month)', fr.parts.bills, COL.bills, 'go:bills'], [jarName('gas') + ' spend', fr.parts.gas, COL.gas, 'spend'], [jarName('misc') + ' spend', fr.parts.misc, COL.misc, 'spend'], [jarName('personal') + ' refill', fr.parts.personal, COL.personal, 'personal']].map(([n, v, c, k]) =>
      `<button class="row" style="width:100%" ${k.startsWith('go:') ? `data-go="${k.slice(3)}"` : `data-act="editRule" data-rule="${k}"`}><span class="sw" style="--c:${c}"></span><div class="grow"><b>${esc(n)}</b></div><span class="amt">${money(v)}</span><span class="muted">${ICON.pencil}</span></button>`).join('') +
    `<div class="card" style="margin-top:10px;padding:12px;background:#0d1e3d;font-weight:800;display:flex;flex-wrap:wrap;gap:4px 8px;align-items:baseline"><span class="t2">${money(fr.needs)} ÷ ${cents(r)}/hr ÷ 4.33 wk =</span><b style="margin-left:auto;font-size:17px">${h1(fr.hours)} hr/wk</b></div>` +
    `<p class="note">${d.rate.learned ? '$/hr is the average of your last ' + plural(d.rate.checks.length, 'check') + '.' : '$/hr is an estimate until you log a paycheck.'}</p></div></div>`;
  // Levers
  const lev = [];
  if (s.loan && d.owed > 0) lev.push([loanName() + ' gone', (d.sum.payoff ? fmtMon(d.sum.payoff) : 'later') + ' · −' + money(fr.loanPay) + ' bill', VE.hoursFor(fr.needs - fr.loanPay, r)]);
  for (const e of s.events) {
    if (e.kind === 'income') { const r2 = r * (+e.amount || 0) / (+s.income.monthly || 1); lev.push([e.label, money(e.amount) + '/mo take-home' + (e.bills ? ' · bills ' + money(e.bills) : ''), VE.hoursFor(fr.needs + (+e.bills || 0), r2)]); }
    if (e.kind === 'bills') lev.push([e.label, 'bills ' + (e.amount > 0 ? '+' : '−') + money(Math.abs(e.amount)) + '/mo', VE.hoursFor(fr.needs + (+e.amount || 0), r)]);
  }
  lev.push([jarName('misc') + ' −$50', 'spend $50 less a month', VE.hoursFor(fr.needs - 50, r)]);
  lev.push([jarName('personal') + ' +$100', money((+s.jars.personal.amount || 0) + 100) + ' a month', VE.hoursFor(fr.needs + 100, r)]);
  html += `<div class="card">${cardHd('LEVERS', 'var(--green)', { left: true })}<div class="pad">` + lev.map(([n, sub, v]) => {
    const dd = Math.round(v * 10) / 10 - Math.round(fr.hours * 10) / 10;
    return `<div class="row"><div class="grow"><b>${esc(n)}</b><small>${esc(sub)}</small></div><div style="width:70px">${bar(v / max, dd <= 0 ? 'var(--free)' : 'var(--red)')}</div><b style="width:38px;text-align:right">${h1(v)}</b><span class="delta ${dd < -0.05 ? 'good' : dd > 0.05 ? 'bad' : 'same'}" style="min-width:52px">${dd > 0 ? '+' : dd < 0 ? '−' : ''}${h1(Math.abs(dd))}</span></div>`;
  }).join('') + '</div></div>';
  // Over time
  const rows = d.proj.slice(0, 72);
  const series = rows.map(row => VE.hoursFor(VE.needs(s, row.owedStart, VE.billsChange(row.month, d.events)).total, r));
  const W = 360, Hh = 120, X0 = 30, X1 = 350, lo = Math.max(0, Math.floor(Math.min(...series) / 5) * 5 - 5), hi = Math.ceil(Math.max(...series, hpw) / 5) * 5 + 5;
  const X = i => X0 + i * (X1 - X0) / (rows.length - 1), Y = v => 10 + (hi - v) / (hi - lo || 1) * (Hh - 20);
  let gg = '';
  for (let v = lo; v <= hi; v += 5) gg += `<line x1="${X0}" y1="${Y(v).toFixed(1)}" x2="${X1}" y2="${Y(v).toFixed(1)}" stroke="#2b3762"/><text x="${X0 - 4}" y="${(Y(v) + 4).toFixed(1)}" font-size="9.5" fill="#8490b5" text-anchor="end" font-weight="700">${v}h</text>`;
  rows.forEach((row, i) => { if (VE.monthOfYear(row.month) === 0) gg += `<text x="${X(i).toFixed(1)}" y="${Hh + 12}" font-size="9.5" fill="#8490b5" text-anchor="middle" font-weight="700">${VE.yearOf(row.month)}</text>`; });
  if (hpw > 0) gg += `<line x1="${X0}" y1="${Y(hpw).toFixed(1)}" x2="${X1}" y2="${Y(hpw).toFixed(1)}" stroke="#fff" stroke-width="1.5" stroke-dasharray="5 4" opacity=".7"/><text x="${X1}" y="${(Y(hpw) - 5).toFixed(1)}" font-size="10" fill="#fff" text-anchor="end" font-weight="800">you work ${Math.round(hpw)}</text>`;
  gg += `<polyline points="${series.map((v, i) => X(i).toFixed(1) + ',' + Y(v).toFixed(1)).join(' ')}" fill="none" stroke="#2ed3c6" stroke-width="3.4" stroke-linejoin="round"/>`;
  html += `<div class="card">${cardHd('OVER TIME', 'var(--card2)', { left: true })}<div class="pad"><svg viewBox="0 0 ${W} ${Hh + 16}" style="width:100%;height:auto">${gg}</svg><p class="note">Hours a week needed each month of your plan, at today’s $/hr.</p></div></div>`;
  return html;
}

/* ---------- Check-in ---------- */
function checkinHTML(d) {
  return `<div class="grab"></div><button class="x" data-close aria-label="Close">${ICON.close}</button><h2 class="gt" style="font-size:26px;margin-top:6px">Check in</h2>` +
    `<p class="note">Type what your bank shows now. Leave a box empty to skip it.</p>` +
    ['income', ...JAR_KEYS].map(j => `<label class="lab"><span class="sw" style="--c:${COL[j]};display:inline-block;vertical-align:-2px;margin-right:6px"></span>${esc(jarLabel(j))}${d.bal[j] ? ` <span class="muted">· last ${money(d.bal[j].value)}, ${fmtMD(d.bal[j].date)}</span>` : ''}</label><div class="field sm"><span class="pre">$</span><input data-ci="${j}" inputmode="decimal" autocomplete="off" placeholder="—"></div>`).join('') +
    (state.loan ? `<label class="lab"><span class="sw" style="--c:${COL.loan};display:inline-block;vertical-align:-2px;margin-right:6px"></span>${esc(loanName())} owed <span class="muted">· now ${money(d.owed)}</span></label><div class="field sm"><span class="pre">$</span><input data-ci="loan" inputmode="decimal" autocomplete="off" placeholder="—"></div>` : '') +
    `<p class="err" id="ciErr" hidden></p><div class="acts"><button class="gb greyb" data-close>CANCEL</button><button class="gb green" data-act="ciSave">SAVE</button></div>`;
}
function saveCheckin() {
  const today = todayIso(), t = Date.now(), vals = {}, errs = [];
  document.querySelectorAll('[data-ci]').forEach(el => { if (el.value.trim() === '') return; const v = num(el.value); if (Number.isNaN(v)) errs.push(el.dataset.ci === 'loan' ? loanName() : jarName(el.dataset.ci)); else vals[el.dataset.ci] = v; });
  if (errs.length) { $('ciErr').textContent = 'Not a number: ' + errs.join(', ') + '.'; $('ciErr').hidden = false; return; }
  const d = derive(state);
  const prevP = d.bal.personal;
  for (const [j, v] of Object.entries(vals)) {
    if (j === 'loan') { if (state.loan) { state.loan.owed = Math.max(0, v); state.loan.asOf = d.next.month; if (!(+state.loan.start >= v)) state.loan.start = v; } }
    else state.balances.push({ date: today, jar: j, value: v, t, checkin: true });
  }
  save(); closeSheet(); render(); buzz(12);
  if (vals.personal != null) leakCheck(prevP, vals.personal, d);
  else toast('Checked in.');
}
// Personal only goes up on Dam Day. If it went up since the last check, money came from somewhere.
function leakCheck(prev, now, d) {
  if (!prev || now <= prev.value + 0.5) return toast('Checked in.');
  if (d.last && d.last.closed >= prev.date) return toast('Checked in.');
  const up = now - prev.value;
  openSheet(`<div class="grab"></div><h2 class="gt" style="font-size:24px">${esc(jarName('personal'))} went up ${money(up)}</h2><p class="note">It only gets money on Dam Day. Did this come from another jar?</p>` +
    `<div class="chips" style="margin-top:12px">${['gas', 'misc', 'bills', 'vault'].map(j => `<button class="chip" data-act="leakFrom" data-j="${j}" data-v="${up.toFixed(2)}">From ${esc(jarName(j))}</button>`).join('')}</div>` +
    `<div class="acts"><button class="gb greyb" data-close>NO, IT WAS A GIFT/REFUND</button></div>`);
}

/* ---------- Settings ---------- */
function settingsHTML(d) {
  const s = state;
  let html = head('SETTINGS', 'Jar names, backup, and starting over');
  html += `<div class="card">${cardHd('JARS', 'var(--card2)', { left: true })}<div class="pad">` +
    ['income', ...JAR_KEYS].map(j => `<div class="grid2" style="grid-template-columns:1fr 90px;margin-top:8px"><div class="field sm"><input data-jn="${j}" value="${esc(s.jars[j].name)}" placeholder="Name"></div><div class="field sm"><input data-jb="${j}" value="${esc(s.jars[j].bank || '')}" placeholder="S00"></div></div>`).join('') +
    `<div class="acts"><button class="gb blue" data-act="jarsSave">SAVE NAMES</button></div></div></div>`;
  html += `<div class="card">${cardHd('PAY SCHEDULE', 'var(--card2)', { left: true })}<div class="pad"><p class="note" style="margin-top:0">${s.pay ? 'Paid every ' + s.pay.every + ' days, for the period that ended ' + plural(s.pay.lag, 'day') + ' before. Next payday ' + fmtDay(VE.nextPayday(s.pay, d.today)) + '.' : 'Not set yet.'}</p><div class="acts" style="margin-top:8px"><button class="gb blue" data-act="editPay">${s.pay ? 'CHANGE, OFF A NEWER STUB' : 'ADD FROM A STUB'}</button></div></div></div>`;
  html += `<div class="card">${cardHd('LOOKING AHEAD', 'var(--card2)', { left: true })}<div class="pad"><label class="lab" style="margin-top:0">Birth year (for Path’s “to 50” view)</label><div class="grid2" style="grid-template-columns:1fr auto"><div class="field sm"><input id="byIn" inputmode="numeric" value="${esc(s.birthYear || '')}" placeholder="optional"></div><button class="gb sm blue" data-act="bySave" style="height:44px">SAVE</button></div>` +
    `<label class="lab">Roth put in for ${VE.yearOf(d.next.month)} outside Valley</label><div class="grid2" style="grid-template-columns:1fr auto"><div class="field sm"><span class="pre">$</span><input id="rsIn" inputmode="decimal" value="${esc((s.roth.seed || {})[VE.yearOf(d.next.month)] || '')}" placeholder="0"></div><button class="gb sm blue" data-act="rsSave" style="height:44px">SAVE</button></div></div></div>`;
  html += `<div class="card">${cardHd('BACKUP', 'var(--card2)', { left: true })}<div class="pad"><p class="note" style="margin-top:0">Everything lives on this phone. Browser storage can vanish, so export once a month. The start screen’s “Back up everything” includes Valley too.</p>` +
    `<div class="acts"><button class="gb blue" data-act="export">EXPORT</button><button class="gb greyb" data-act="import">IMPORT</button></div></div></div>`;
  html += `<div class="card">${cardHd('START OVER', 'var(--red)', { left: true })}<div class="pad"><p class="note" style="margin-top:0">Wipes Valley on this phone (not Money, Study or +1). Export first.</p><div class="acts"><button class="gb redb" data-act="reset">RESET VALLEY</button></div></div></div>`;
  html += `<p class="note" style="text-align:center;margin-top:18px">Valley · <a class="link" href="test.html">the math checks</a></p>`;
  return html;
}
function payEditorHTML() {
  const s = state;
  const f = s.pay ? { pay: s.pay.payDate, from: VE.isoOf(VE.dayOf(s.pay.payDate) - s.pay.lag - s.pay.every + 1), to: VE.isoOf(VE.dayOf(s.pay.payDate) - s.pay.lag) } : { pay: '', from: '', to: '' };
  return `<div class="grab"></div><button class="x" data-close aria-label="Close">${ICON.close}</button><h2 class="gt" style="font-size:26px;margin-top:6px">Pay schedule</h2><p class="note">Three dates off any one stub.</p>` +
    `<label class="lab">Pay date</label><div class="field sm"><input id="psPay" type="date" value="${f.pay}"></div><div class="grid2"><div><label class="lab">Period from</label><div class="field sm"><input id="psFrom" type="date" value="${f.from}"></div></div><div><label class="lab">Period to</label><div class="field sm"><input id="psTo" type="date" value="${f.to}"></div></div></div>` +
    `<p class="err" id="psErr" hidden></p><div class="acts"><button class="gb greyb" data-close>CANCEL</button><button class="gb green" data-act="paySave">SAVE</button></div>`;
}
const sgnBtn = id => `<button class="sgn" data-act="flipSign" data-for="${id}" aria-label="Make it negative or positive">±</button>`;
function eventEditorHTML(e) {
  const isNew = !e.id;
  return `<div class="grab"></div><button class="x" data-close aria-label="Close">${ICON.close}</button><h2 class="gt" style="font-size:26px;margin-top:6px">${isNew ? 'Add an event' : 'Edit event'}</h2>` +
    `<div class="switch2" style="grid-template-columns:1fr 1fr 1fr;margin-top:12px">${[['income', 'New income'], ['bills', 'Bills change'], ['once', 'One month']].map(([k, l]) => `<button class="${e.kind === k ? 'on' : ''}" data-act="evKind" data-k="${k}" style="font-size:13px">${l}</button>`).join('')}</div>` +
    `<label class="lab">Name</label><div class="field sm"><input id="evLabel" value="${esc(e.label || '')}" placeholder="${e.kind === 'income' ? 'New job' : e.kind === 'bills' ? 'Health plan covered' : 'Week off'}"></div>` +
    `<div class="grid2"><div><label class="lab">${e.kind === 'once' ? 'Month' : 'From'}</label><div class="field sm"><input id="evStart" type="month" value="${e.start || ''}"></div></div>` +
    (e.kind === 'once' ? '<div></div>' : `<div><label class="lab">Until (optional)</label><div class="field sm"><input id="evEnd" type="month" value="${e.end || ''}"></div></div>`) + '</div>' +
    (e.kind === 'income' ? `<label class="lab">Take-home a month</label><div class="field sm"><span class="pre">$</span><input id="evAmt" inputmode="decimal" value="${e.amount != null ? esc(e.amount) : ''}"></div><label class="lab">Bills change a month (optional, −300 = health plan covered)</label><div class="field sm"><span class="pre">$</span><input id="evBills" inputmode="decimal" value="${e.bills ? esc(e.bills) : ''}" placeholder="0">${sgnBtn('evBills')}</div>`
      : e.kind === 'bills' ? `<label class="lab">Change a month (− for less)</label><div class="field sm"><span class="pre">$</span><input id="evAmt" inputmode="decimal" value="${e.amount != null ? esc(e.amount) : ''}" placeholder="-300">${sgnBtn('evAmt')}</div>`
      : `<label class="lab">Hours off (fills the amount from your $/hr)</label><div class="field sm"><input id="evHours" inputmode="decimal" value="${e.hours || ''}" placeholder="40"><span class="suf">hr</span></div><label class="lab">Or an amount (− for less income)</label><div class="field sm"><span class="pre">$</span><input id="evAmt" inputmode="decimal" value="${e.amount != null ? esc(e.amount) : ''}" placeholder="-800">${sgnBtn('evAmt')}</div>`) +
    `<p class="err" id="evErr" hidden></p><div class="acts">${isNew ? '<button class="gb greyb" data-close>CANCEL</button>' : '<button class="gb redb" data-act="evDel">DELETE</button>'}<button class="gb green" data-act="evSave">SAVE</button></div>`;
}

/* ---------- Setup: first open ----------
   Long on purpose, like Money's. Your numbers live on your phone, not in the code. */
let setup = null;
function freshSetup() {
  return { step: 0, jars: { income: { name: 'Income', bank: '' }, bills: { name: 'Bills', bank: '', cushion: '100' }, gas: { name: 'Gas', bank: '', cap: '', spend: '' }, misc: { name: 'Misc', bank: '', cap: '', spend: '' }, personal: { name: 'Personal', bank: '', amount: '' }, vault: { name: 'Vault', bank: '', cap: '' } },
    hasLoan: true, loan: { name: '', owed: '', apr: '', payment: '' }, first: 'loan', rothLimit: '7500', investShare: '75', growth: '6',
    bills: [{ id: newId(), name: 'Rent', amounts: Array(12).fill(0), _amt: '' }, { id: newId(), name: 'Insurance', amounts: Array(12).fill(0), _amt: '' }],
    income: { monthly: '', hoursPerWeek: '', other: '' }, stub: { pay: '', from: '', to: '', net: '', hours: '' }, bal: { income: '', bills: '', gas: '', misc: '', personal: '', vault: '' } };
}
const STEPS = ['Welcome', 'Jars', 'Loan', 'Bills', 'Income', 'Balances'];
function setupHTML() {
  const st = setup, dots = `<div class="dots">${STEPS.slice(1).map((_, i) => `<i class="${i < st.step ? 'on' : ''}"></i>`).join('')}</div>`;
  let body = '';
  if (st.step === 0) {
    return `<div class="top"><a class="face" href="../">0_0</a></div><div style="min-height:70vh;display:flex;flex-direction:column;justify-content:center">` +
      `<h1 class="gt" style="font-size:48px;line-height:1">MONEY<br>VALLEY</h1><p class="intro">Once a month your income account splits into jars: <b>Bills</b> fills to what this month needs, <b>Gas</b> and <b>Misc</b> top up to a cap, <b>Personal</b> gets its refill, the <b>Vault</b> tops up. The leftover goes to your loan or Roth first, your choice.</p>` +
      `<p class="intro">Setup takes about five minutes. Have your bank app open. Everything stays on this phone.</p></div>` +
      `<button class="gb green wide" data-act="suNext">START</button><div class="linkrow"><button class="link" data-act="import">Restore a backup or setup file</button></div>`;
  }
  if (st.step === 1) {
    body = '<h2 class="gt" style="font-size:28px">Your jars</h2><p class="intro">Name each account the way your bank does. Caps are where each jar tops up to.</p>' +
      ['income', ...JAR_KEYS].map(j => `<div class="card" style="margin-top:12px">${cardHd(j === 'income' ? 'WHERE PAY LANDS' : j.toUpperCase(), COL[j], { left: true })}<div class="pad">` +
        `<div class="grid2" style="grid-template-columns:1fr 96px"><div class="field sm"><input data-su="jars.${j}.name" value="${esc(st.jars[j].name)}" placeholder="Name"></div><div class="field sm"><input data-su="jars.${j}.bank" value="${esc(st.jars[j].bank)}" placeholder="S00"></div></div>` +
        (j === 'bills' ? `<label class="lab">Cushion (what it keeps at its lowest point)</label><div class="field sm"><span class="pre">$</span><input data-su="jars.bills.cushion" inputmode="decimal" value="${esc(st.jars.bills.cushion)}"></div>` : '') +
        (j === 'gas' || j === 'misc' ? `<div class="grid2"><div><label class="lab">Cap</label><div class="field sm"><span class="pre">$</span><input data-su="jars.${j}.cap" inputmode="decimal" value="${esc(st.jars[j].cap)}" placeholder="0"></div></div><div><label class="lab">Spends a month</label><div class="field sm"><span class="pre">$</span><input data-su="jars.${j}.spend" inputmode="decimal" value="${esc(st.jars[j].spend)}" placeholder="0"></div></div></div>` : '') +
        (j === 'vault' ? `<label class="lab">Cap (your emergency fund goal)</label><div class="field sm"><span class="pre">$</span><input data-su="jars.vault.cap" inputmode="decimal" value="${esc(st.jars.vault.cap)}" placeholder="0"></div>` : '') +
        (j === 'personal' ? `<label class="lab">Refill every month</label><div class="field sm"><span class="pre">$</span><input data-su="jars.personal.amount" inputmode="decimal" value="${esc(st.jars.personal.amount)}" placeholder="0"></div>` : '') + '</div></div>').join('');
  } else if (st.step === 2) {
    body = '<h2 class="gt" style="font-size:28px">A loan to beat?</h2><p class="intro">If you have one, its payment comes out of Bills and the leftover can attack it.</p>' +
      `<div class="switch2" style="margin-top:14px"><button class="${st.hasLoan ? 'on' : ''}" data-act="suLoan" data-v="1" style="--c:var(--loan)">Yes, a loan</button><button class="${!st.hasLoan ? 'on' : ''}" data-act="suLoan" data-v="0">No loan</button></div>` +
      (st.hasLoan ? `<label class="lab">Name it</label><div class="field sm"><input data-su="loan.name" value="${esc(st.loan.name)}" placeholder="e.g. the car"></div>` +
        `<div class="grid3"><div><label class="lab">Owed now</label><div class="field sm"><span class="pre">$</span><input data-su="loan.owed" inputmode="decimal" value="${esc(st.loan.owed)}" placeholder="0"></div></div><div><label class="lab">Rate</label><div class="field sm"><input data-su="loan.apr" inputmode="decimal" value="${esc(st.loan.apr)}" placeholder="0"><span class="suf">%</span></div></div><div><label class="lab">Payment</label><div class="field sm"><span class="pre">$</span><input data-su="loan.payment" inputmode="decimal" value="${esc(st.loan.payment)}" placeholder="0"></div></div></div>` +
        `<label class="lab" style="margin-top:18px">Leftover goes first to</label><div class="switch2"><button class="${st.first === 'loan' ? 'on' : ''}" data-act="suFirst" data-v="loan" style="--c:var(--loan)">The loan</button><button class="${st.first === 'roth' ? 'on' : ''}" data-act="suFirst" data-v="roth" style="--c:var(--roth)">Roth IRA</button></div>` : '') +
      `<div class="grid3" style="margin-top:4px"><div><label class="lab">Roth limit</label><div class="field sm"><span class="pre">$</span><input data-su="rothLimit" inputmode="decimal" value="${esc(st.rothLimit)}"></div></div><div><label class="lab">Invest share</label><div class="field sm"><input data-su="investShare" inputmode="decimal" value="${esc(st.investShare)}"><span class="suf">%</span></div></div><div><label class="lab">Growth</label><div class="field sm"><input data-su="growth" inputmode="decimal" value="${esc(st.growth)}"><span class="suf">%</span></div></div></div>` +
      '<p class="note">After the loan and the Roth, the rest splits into investing and fun money. Growth is just an assumption for looking ahead.</p>';
  } else if (st.step === 3) {
    body = '<h2 class="gt" style="font-size:28px">Bills</h2><p class="intro">Everything that comes out of the Bills jar. Tap months for bills that don’t come every month (car insurance twice a year, say).' + (st.hasLoan ? ' The loan payment is added for you.' : '') + '</p>' +
      st.bills.map((b, i) => `<div class="billrow" data-subill="${i}"><div class="top2"><input class="nm" data-sbk="name" value="${esc(b.name)}" placeholder="What"><input class="am" data-sbk="amount" inputmode="decimal" value="${esc(b._amt)}" placeholder="$0"><button class="del" data-act="suBillDel" data-i="${i}" aria-label="Remove">✕</button></div>` +
        `<div class="months">${MONTHS.map((m, k) => `<button class="${b._lit && b._lit[k] ? 'on' : ''}" data-act="suBillMonth" data-i="${i}" data-m="${k}">${m[0]}</button>`).join('')}</div><p class="note" style="margin-top:6px">${b._lit && b._lit.some(Boolean) ? 'Only in: ' + b._lit.map((x, k) => x ? MON(k) : null).filter(Boolean).join(', ') : 'Every month'}</p></div>`).join('') +
      `<button class="addrow" data-act="suBillAdd">+ Add a bill</button>`;
  } else if (st.step === 4) {
    body = '<h2 class="gt" style="font-size:28px">Income</h2><p class="intro">What you expect to take home. Valley uses it to look ahead. Dam Day always splits what’s really there.</p>' +
      `<div class="grid2"><div><label class="lab">Take-home a month</label><div class="field sm"><span class="pre">$</span><input data-su="income.monthly" inputmode="decimal" value="${esc(st.income.monthly)}" placeholder="0"></div></div><div><label class="lab">Usual hours a week</label><div class="field sm"><input data-su="income.hoursPerWeek" inputmode="decimal" value="${esc(st.income.hoursPerWeek)}" placeholder="0"><span class="suf">hr</span></div></div></div>` +
      `<label class="lab">Other money a month (optional)</label><div class="field sm"><span class="pre">$</span><input data-su="income.other" inputmode="decimal" value="${esc(st.income.other)}" placeholder="0"></div>` +
      `<h3 style="margin-top:20px;font-size:17px">Your latest pay stub <span class="muted" style="font-size:13px">· optional, but it teaches Valley your real $/hr</span></h3>` +
      `<label class="lab">Pay date</label><div class="field sm"><input data-su="stub.pay" type="date" value="${esc(st.stub.pay)}"></div><div class="grid2"><div><label class="lab">Period from</label><div class="field sm"><input data-su="stub.from" type="date" value="${esc(st.stub.from)}"></div></div><div><label class="lab">Period to</label><div class="field sm"><input data-su="stub.to" type="date" value="${esc(st.stub.to)}"></div></div></div>` +
      `<div class="grid2"><div><label class="lab">Take-home</label><div class="field sm"><span class="pre">$</span><input data-su="stub.net" inputmode="decimal" value="${esc(st.stub.net)}" placeholder="0"></div></div><div><label class="lab">Hours</label><div class="field sm"><input data-su="stub.hours" inputmode="decimal" value="${esc(st.stub.hours)}" placeholder="0"></div></div></div>`;
  } else {
    body = '<h2 class="gt" style="font-size:28px">What’s in each jar now?</h2><p class="intro">Read them off your bank app. This is where your first Dam Day starts from.</p>' +
      ['income', ...JAR_KEYS].map(j => `<label class="lab"><span class="sw" style="--c:${COL[j]};display:inline-block;vertical-align:-2px;margin-right:6px"></span>${esc(st.jars[j].name)}${st.jars[j].bank ? ' · ' + esc(st.jars[j].bank) : ''}</label><div class="field sm"><span class="pre">$</span><input data-su="bal.${j}" inputmode="decimal" value="${esc(st.bal[j])}" placeholder="0"></div>`).join('');
  }
  return `<div class="top">${dots}<span class="muted" style="font-weight:800;font-size:13px">${st.step} of ${STEPS.length - 1}</span></div>` + body +
    `<p class="err" id="suErr" hidden></p><div class="acts" style="margin-top:22px"><button class="gb greyb" data-act="suBack">BACK</button><button class="gb green" data-act="suNext">${st.step === STEPS.length - 1 ? 'FINISH' : 'NEXT'}</button></div>`;
}
function readSetup() {
  document.querySelectorAll('[data-su]').forEach(el => {
    const path = el.dataset.su.split('.'); let o = setup;
    for (let i = 0; i < path.length - 1; i++) o = o[path[i]];
    o[path[path.length - 1]] = el.value.trim();
  });
  document.querySelectorAll('[data-subill]').forEach(row => {
    const b = setup.bills[+row.dataset.subill]; if (!b) return;
    b.name = row.querySelector('[data-sbk="name"]').value.trim();
    b._amt = row.querySelector('[data-sbk="amount"]').value.trim();
  });
}
function setupNext() {
  readSetup();
  const st = setup, err = t => { const e = $('suErr'); e.textContent = t; e.hidden = false; };
  const N = v => num(v);
  if (st.step === 1) {
    for (const [j, k, lab] of [['gas', 'cap', 'Gas cap'], ['misc', 'cap', 'Misc cap'], ['vault', 'cap', 'Vault cap'], ['personal', 'amount', 'Personal refill'], ['gas', 'spend', 'Gas spend'], ['misc', 'spend', 'Misc spend'], ['bills', 'cushion', 'Bills cushion']]) {
      if (!(N(st.jars[j][k]) >= 0)) return err(lab + ' should be a number (0 is fine).');
    }
  }
  if (st.step === 2) {
    if (st.hasLoan && (!(N(st.loan.owed) >= 0) || !(N(st.loan.apr) >= 0) || !(N(st.loan.payment) >= 0))) return err('Fill in what’s owed, the rate and the payment.');
    if (st.hasLoan && N(st.loan.apr) > 40) return err('The rate looks off. Type 6.5 for 6.5%.');
    if (!(N(st.rothLimit) >= 0) || !(N(st.investShare) >= 0 && N(st.investShare) <= 100) || !(N(st.growth) > -50 && N(st.growth) < 50)) return err('Check the Roth limit, invest share (0–100) and growth.');
  }
  if (st.step === 3) {
    const real = st.bills.filter(b => b.name || b._amt);
    if (real.some(b => b._amt !== '' && !(N(b._amt) >= 0))) return err('Bill amounts should be numbers.');
  }
  if (st.step === 4) {
    if (!(N(st.income.monthly) > 0)) return err('About how much do you take home a month?');
    if (!(N(st.income.hoursPerWeek) > 0)) return err('About how many hours a week do you work?');
    const any = st.stub.pay || st.stub.from || st.stub.to;
    if (any) { const sc = VE.stub(st.stub.pay, st.stub.from, st.stub.to); if (sc.error) return err(sc.error); }
    if ((st.stub.net || st.stub.hours) && (!(N(st.stub.net) > 0) || !(N(st.stub.hours) > 0))) return err('Put in both take-home and hours from the stub, or leave both empty.');
  }
  if (st.step === STEPS.length - 1) {
    for (const j of ['income', ...JAR_KEYS]) if (st.bal[j] === '' || Number.isNaN(N(st.bal[j]))) return err('Type what ' + st.jars[j].name + ' has now (0 is fine).');
    return finishSetup();
  }
  st.step++; render(); window.scrollTo(0, 0);
}
function finishSetup() {
  const st = setup, N = v => +num(v) || 0, today = todayIso(), t = Date.now();
  const day = +today.slice(8, 10), thisMonth = today.slice(0, 7);
  const firstMonth = day <= 3 ? thisMonth : VE.addMonths(thisMonth, 1);
  const bills = st.bills.filter(b => b.name || N(b._amt)).map(b => {
    const amt = N(b._amt), lit = b._lit && b._lit.some(Boolean) ? b._lit : null;
    return { id: b.id || newId(), name: b.name || 'Bill', amounts: Array.from({ length: 12 }, (_, k) => (lit ? lit[k] : true) ? amt : 0) };
  });
  if (st.hasLoan) bills.splice(1, 0, { id: newId(), name: (st.loan.name || 'Loan') + ' payment', loan: true, amounts: Array(12).fill(0) });
  const sc = st.stub.pay ? VE.stub(st.stub.pay, st.stub.from, st.stub.to) : null;
  state = normalize({
    v: 1, created: today, firstMonth,
    jars: {
      income: { name: st.jars.income.name || 'Income', bank: st.jars.income.bank },
      bills: { name: st.jars.bills.name || 'Bills', bank: st.jars.bills.bank, cushion: N(st.jars.bills.cushion) },
      gas: { name: st.jars.gas.name || 'Gas', bank: st.jars.gas.bank, cap: N(st.jars.gas.cap), spend: N(st.jars.gas.spend) },
      misc: { name: st.jars.misc.name || 'Misc', bank: st.jars.misc.bank, cap: N(st.jars.misc.cap), spend: N(st.jars.misc.spend) },
      personal: { name: st.jars.personal.name || 'Personal', bank: st.jars.personal.bank, amount: N(st.jars.personal.amount) },
      vault: { name: st.jars.vault.name || 'Vault', bank: st.jars.vault.bank, cap: N(st.jars.vault.cap) },
    },
    bills,
    loan: st.hasLoan ? { name: st.loan.name || 'Loan', owed: N(st.loan.owed), start: N(st.loan.owed), apr: N(st.loan.apr) / 100, payment: N(st.loan.payment), asOf: firstMonth } : null,
    extra: { first: st.hasLoan ? st.first : 'roth', rothLimit: N(st.rothLimit), investShare: Math.min(100, N(st.investShare)) / 100, growth: N(st.growth) / 100 },
    income: { monthly: N(st.income.monthly), hoursPerWeek: N(st.income.hoursPerWeek), other: N(st.income.other) },
    pay: sc && !sc.error ? sc : null,
    paychecks: sc && !sc.error && N(st.stub.net) > 0 ? [{ id: newId(), date: st.stub.pay, net: N(st.stub.net), hours: N(st.stub.hours) }] : [],
    balances: ['income', ...JAR_KEYS].map(j => ({ date: today, jar: j, value: N(st.bal[j]), t, checkin: true })),
    months: [], shifts: [], wishes: [], ious: [], events: [], subs: [], roth: { seed: {}, balance: null }, invest: { balance: null }, timer: null, damDraft: null, birthYear: null,
  });
  setup = null; save(); keep(); screen = 'home'; history.replaceState({ screen: 'home' }, ''); render(); buzz([20, 40, 20]);
}

/* ---------- Moving between screens ----------
   Tabs swap in place. Everything else stacks on top, so the phone's back button closes it. */
let screen = 'home';
const SCREENS = { home: homeHTML, dam: damHTML, path: pathHTML, compare: compareHTML, rules: rulesHTML, bills: billsHTML, cloud: cloudHTML, personal: personalHTML, freedom: freedomHTML, settings: settingsHTML };
const TAB_OF = { home: 0, cloud: 0, personal: 0, freedom: 0, dam: 1, path: 2, compare: 2, rules: 3, bills: 3, settings: 3 };
const TABS = [['home', 'VALLEY'], ['dam', 'DAM DAY'], ['path', 'PATH'], ['rules', 'RULES']];
function render() {
  if (!state) {
    if (!setup) setup = freshSetup();
    $('view').innerHTML = setupHTML(); $('view').className = 'noNav'; $('nav').hidden = true; return;
  }
  const d = derive(state);
  $('view').innerHTML = (SCREENS[screen] || homeHTML)(d);
  $('view').className = '';
  $('nav').hidden = false;
  $('nav').innerHTML = '<div class="in">' + TABS.map(([k, l], i) => `<button class="${TAB_OF[screen] === i ? 'on' : ''}" data-tab="${k}">${l}</button>`).join('') + '</div>';
}
function go(name) {
  if (name === 'bills') billDraft = null;
  history.pushState({ screen: name }, '');
  screen = name; closeSheet(true); render(); window.scrollTo(0, 0);
}
function tab(name) {
  history.replaceState({ screen: name }, '');
  screen = name; closeSheet(true); render(); window.scrollTo(0, 0);
}
function back() { if (history.state && history.state.screen && history.length > 1 && screen !== 'home') history.back(); else tab('home'); }
let sheetOpen = false;
function openSheet(html) {
  closeSheet(true);
  const el = document.createElement('div');
  el.className = 'sheet'; el.id = 'sheet';
  el.innerHTML = `<div class="panel">${html}</div>`;
  document.body.appendChild(el);
  if (!sheetOpen) { history.pushState({ screen, sheet: true }, ''); sheetOpen = true; }
}
function closeSheet(silent) {
  const el = $('sheet');
  if (el) el.remove();
  if (sheetOpen && !silent) { sheetOpen = false; if (history.state && history.state.sheet) history.back(); }
  else if (silent) sheetOpen = false;
}

/* ---------- Taps ---------- */
function onClick(e) {
  const t = e.target;
  if (t.id === 'sheet') return closeSheet();
  const b = t.closest('[data-go],[data-tab],[data-act],[data-why],[data-back],[data-close]');
  if (!b || b.disabled) return;
  if (b.hasAttribute('data-close')) { editing = null; return closeSheet(); }
  if (b.hasAttribute('data-back')) return back();
  if (b.dataset.go) return go(b.dataset.go);
  if (b.dataset.tab) return tab(b.dataset.tab);
  if (b.dataset.why) { const d = derive(state); return openSheet(whyHTML(d, b.dataset.why)); }
  act(b.dataset.act, b);
}
function act(a, b) {
  const s = state;
  const ds = b.dataset;
  switch (a) {
    // Setup
    case 'suNext': if (!setup) setup = freshSetup(); if (setup.step === 0) { setup.step = 1; render(); window.scrollTo(0, 0); } else setupNext(); return;
    case 'suBack': readSetup(); setup.step = Math.max(0, setup.step - 1); render(); window.scrollTo(0, 0); return;
    case 'suLoan': readSetup(); setup.hasLoan = ds.v === '1'; render(); return;
    case 'suFirst': readSetup(); setup.first = ds.v; render(); return;
    case 'suBillAdd': readSetup(); setup.bills.push({ id: newId(), name: '', amounts: Array(12).fill(0), _amt: '' }); render(); return;
    case 'suBillDel': readSetup(); setup.bills.splice(+ds.i, 1); render(); return;
    case 'suBillMonth': { readSetup(); const bb = setup.bills[+ds.i]; bb._lit = bb._lit || Array(12).fill(false); bb._lit[+ds.m] = !bb._lit[+ds.m]; render(); return; }
    // Timer and shifts
    case 'timerStart': if (!s.timer) { s.timer = { start: Date.now() }; save(); render(); buzz(20); toast('Shift started. Valley keeps counting even if the phone sleeps.'); } return;
    case 'timerStop': {
      if (!s.timer) return;
      const hrs = timerHours(s), capped = (Date.now() - s.timer.start) / 36e5 > TIMER_CAP;
      const day = (() => { const d0 = new Date(s.timer.start); return d0.getFullYear() + '-' + pad2(d0.getMonth() + 1) + '-' + pad2(d0.getDate()); })();
      s.timer = null;
      if (hrs >= 0.01) s.shifts.push({ id: newId(), date: day, hours: Math.round(hrs * 100) / 100, timer: true });
      save(); render(); buzz([20, 40, 20]);
      toast(capped ? 'Over ' + TIMER_CAP + ' hours looks like a forgotten timer, so it’s capped. Fix it below if needed.' : 'Logged ' + h1(hrs) + ' hr.');
      return;
    }
    case 'timerCancel': s.timer = null; save(); render(); toast('Thrown away.'); return;
    case 'shiftAdd': {
      const day = $('shDay').value, h = num($('shHours').value), err = $('shErr');
      if (!(h > 0 && h <= 24)) { err.textContent = 'Hours should be between 0 and 24.'; err.hidden = false; return; }
      s.shifts.push({ id: newId(), date: day, hours: h }); save(); render(); buzz(12); toast('Added ' + h1(h) + ' hr on ' + fmtMD(day) + '.'); return;
    }
    case 'shiftDel': s.shifts = s.shifts.filter(x => x.id !== ds.id); save(); render(); return;
    case 'checkAdd': {
      const date = $('pcDate').value, net = num($('pcNet').value), hours = num($('pcHours').value), err = $('pcErr');
      if (!date) { err.textContent = 'Pick the pay date.'; err.hidden = false; return; }
      if (!(net > 0) || !(hours > 0)) { err.textContent = 'Put in take-home and hours off the stub.'; err.hidden = false; return; }
      if (net / hours < 5 || net / hours > 200) { err.textContent = cents(net / hours) + ' an hour looks off. Check the numbers.'; err.hidden = false; return; }
      s.paychecks = s.paychecks.filter(c => c.date !== date).concat({ id: newId(), date, net, hours }); save(); render(); buzz(12); toast('Check logged: ' + cents(net / hours) + '/hr.'); return;
    }
    case 'checkDel': s.paychecks = s.paychecks.filter(x => x.id !== ds.id); save(); render(); return;
    case 'editPay': return openSheet(payEditorHTML());
    case 'paySave': {
      const sc = VE.stub($('psPay').value, $('psFrom').value, $('psTo').value);
      if (sc.error) { $('psErr').textContent = sc.error; $('psErr').hidden = false; return; }
      s.pay = sc; save(); closeSheet(); render(); toast('Pay schedule saved.'); return;
    }
    // Dam Day
    case 'damStart': return damStart(derive(s));
    case 'damPlan': return damPlan();
    case 'damBack': readDamInputsIfAny(); s.damDraft.step = 1; save(); render(); return;
    case 'damCancel': s.damDraft = null; save(); render(); return;
    case 'damTick': s.damDraft.done[ds.k] = !s.damDraft.done[ds.k]; save(); render(); buzz(s.damDraft.done[ds.k] ? 15 : 5); return;
    case 'damWhy': { const d = derive(s); return openSheet(whyHTML(d, ds.k)); }
    case 'damClose': return damClose();
    case 'damReopen': return damReopen();
    case 'damCheck': {
      const last = derive(s).last;
      if (!last || !last.after) return;
      return openSheet(`<div class="grab"></div><button class="x" data-close aria-label="Close">${ICON.close}</button><h2 class="gt" style="font-size:24px;margin-top:6px">Double-check</h2><p class="note">Type what your bank shows after moving.</p>` +
        JAR_KEYS.map(j => `<label class="lab">${esc(jarLabel(j))} <span class="muted">· plan ${money(last.after[j])}</span></label><div class="field sm"><span class="pre">$</span><input data-ck="${j}" inputmode="decimal" placeholder="${Math.round(last.after[j]).toLocaleString('en-US')}"></div>`).join('') +
        `<p class="err" id="ckErr" hidden></p><div class="acts"><button class="gb greyb" data-close>CANCEL</button><button class="gb green" data-act="damCheckSave">CHECK</button></div>`);
    }
    case 'damCheckSave': {
      const dl = derive(s).last, last = dl && s.months.find(m => m.month === dl.month), chk = {}, today = todayIso(), t = Date.now();
      if (!last) return closeSheet();
      const bad = [];
      document.querySelectorAll('[data-ck]').forEach(el => { if (el.value.trim() === '') return; const v = num(el.value); if (Number.isNaN(v)) bad.push(jarName(el.dataset.ck)); else chk[el.dataset.ck] = v; });
      if (bad.length || !Object.keys(chk).length) { $('ckErr').textContent = bad.length ? 'Not a number: ' + bad.join(', ') + '.' : 'Type at least one balance.'; $('ckErr').hidden = false; return; }
      last.check = chk;
      last.mismatch = JAR_KEYS.some(j => chk[j] != null && Math.abs(chk[j] - last.after[j]) >= 1);
      for (const [j, v] of Object.entries(chk)) s.balances.push({ date: today, jar: j, value: v, t, checkin: true, ref: last.month });
      save(); closeSheet(); render(); toast(last.mismatch ? 'Some balances don’t match the plan.' : 'Everything matches ✓'); buzz(last.mismatch ? 40 : [20, 40, 20]); return;
    }
    // Check-ins and leaks
    case 'checkin': return openSheet(checkinHTML(derive(s)));
    case 'ciSave': return saveCheckin();
    case 'leakFrom': s.ious.push({ id: newId(), from: ds.j, amount: +ds.v, date: todayIso(), paidIn: null }); save(); closeSheet(); render(); toast('Logged as borrowed from ' + jarName(ds.j) + '.'); return;
    // Rules
    case 'editRule': return openEditor(ds.rule);
    case 'edChip': { const el = document.querySelector('[data-ed="0"]'); if (el) { el.value = ds.v; refreshEditor(); } return; }
    case 'edApply': return applyEditor();
    case 'swPick': editing.draft.extra.first = ds.v; $('sheet').querySelector('.panel').innerHTML = switchHTML(); return;
    case 'loanRemove': {
      if (!confirm('Remove ' + loanName() + '? Its payment leaves Bills and the leftover goes to the Roth.')) return;
      s.loan = null; s.bills = s.bills.filter(x => !x.loan); s.extra.first = 'roth'; editing = null; save(); closeSheet(); render(); toast('Loan removed. Nice.'); return;
    }
    // Bills editor
    case 'billAdd': readBills(); billDraft.push({ id: newId(), name: '', amounts: Array(12).fill(0), _lit: Array(12).fill(true), _amt: '', _touched: true }); render(); return;
    case 'billDel': readBills(); billDraft.splice(+ds.i, 1); render(); return;
    case 'billMonth': {
      // All lit means every month: tapping one month then means "only this month".
      readBills();
      const bb = billDraft[+ds.i], k = +ds.m;
      if (bb._lit.every(Boolean)) { bb._lit = Array(12).fill(false); bb._lit[k] = true; } else bb._lit[k] = !bb._lit[k];
      if (!bb._lit.some(Boolean)) bb._lit = Array(12).fill(true);
      bb._touched = true; render(); return;
    }
    case 'billCancel': billDraft = null; return back();
    case 'billSave': {
      readBills();
      const err = t => { $('billErr').textContent = t; $('billErr').hidden = false; };
      if (billDraft.some(x => !x.loan && x._touched && String(x._amt).trim() !== '' && Number.isNaN(num(x._amt)))) return err('Amounts should be numbers.');
      const bills = cleanBills(billDraft);
      if (bills.some(x => !x.loan && !x.name.trim() && x.amounts.some(v => v > 0))) return err('Give every bill a name.');
      const cu = document.querySelector('[data-act-input="cushion"]'), cv = cu ? num(cu.value) : NaN;
      if (cu && cu.value.trim() !== '' && !(cv >= 0)) return err('The cushion should be a number (0 is fine).');
      s.bills = bills.filter(x => x.loan || x.name.trim() || x.amounts.some(v => v > 0)).map(x => ({ id: x.id, name: x.name.trim() || 'Bill', amounts: x.amounts.map(v => +v || 0), ...(x.loan ? { loan: true } : {}) }));
      if (cv >= 0) s.jars.bills.cushion = cv;
      billDraft = null; save(); back(); toast('Bills saved.'); return;
    }
    // Path and compare
    case 'pathWin': pathWin = ds.w === 'fifty' ? 'fifty' : +ds.w; render(); return;
    case 'evPreview': pathPreview = ds.id ? (pathPreview === ds.id ? null : ds.id) : null; render(); return;
    case 'evToggle': { const ev = s.events.find(x => x.id === ds.id); if (ev) { ev.on = ev.on === false; if (pathPreview === ds.id) pathPreview = null; save(); render(); } return; }
    case 'evNew': evDraft = { kind: 'income', label: '', start: VE.addMonths(derive(s).next.month, 6), on: false }; return openSheet(eventEditorHTML(evDraft));
    case 'evEdit': evDraft = clone(s.events.find(x => x.id === ds.id)); return openSheet(eventEditorHTML(evDraft));
    case 'evKind': readEvent(); evDraft.kind = ds.k; $('sheet').querySelector('.panel').innerHTML = eventEditorHTML(evDraft); return;
    case 'evSave': return saveEvent();
    case 'evDel': s.events = s.events.filter(x => x.id !== evDraft.id); if (pathPreview === evDraft.id) pathPreview = null; evDraft = null; save(); closeSheet(); render(); return;
    case 'cmpPick': cmpPick = ds.id; render(); return;
    case 'flipSign': { const el = $(ds.for); if (!el) return; const v = el.value.trim(); el.value = /^[-\u2212]/.test(v) ? v.slice(1) : '-' + v; el.focus(); return; }
    // Personal
    case 'pBalSave': {
      const v = num($('pBal').value); if (Number.isNaN(v)) return toast('Type the balance.');
      const d = derive(s), prev = d.bal.personal;
      s.balances.push({ date: todayIso(), jar: 'personal', value: v, t: Date.now(), checkin: true }); save(); render(); buzz(12);
      return leakCheck(prev, v, d);
    }
    case 'subAdd': { const n = $('subName').value.trim(), v = num($('subAmt').value); if (!n || !(v >= 0)) return toast('Name and amount, please.'); s.subs.push({ id: newId(), name: n, amount: v }); save(); render(); return; }
    case 'subDel': s.subs = s.subs.filter(x => x.id !== ds.id); save(); render(); return;
    case 'wishAdd': {
      const n = $('wName').value.trim(), p = num($('wPrice').value), by = $('wBy').value, err = $('wErr');
      if (!n || !(p > 0) || !/^\d{4}-\d{2}$/.test(by)) { err.textContent = 'Name, price and a month, please.'; err.hidden = false; return; }
      s.wishes.push({ id: newId(), name: n, price: p, by, saved: 0 }); save(); render(); buzz(12); return;
    }
    case 'wishDel': s.wishes = s.wishes.filter(x => x.id !== ds.id); save(); render(); return;
    case 'wishUp': { const i = s.wishes.findIndex(x => x.id === ds.id); if (i > 0) { [s.wishes[i - 1], s.wishes[i]] = [s.wishes[i], s.wishes[i - 1]]; save(); render(); } return; }
    case 'iouAdd': { const v = num($('iouAmt').value); if (!(v > 0)) return toast('How much?'); s.ious.push({ id: newId(), from: $('iouFrom').value, amount: v, date: todayIso(), paidIn: null }); save(); render(); buzz(12); return; }
    case 'iouDel': s.ious = s.ious.filter(x => x.id !== ds.id); save(); render(); return;
    // Settings
    case 'jarsSave':
      document.querySelectorAll('[data-jn]').forEach(el => { s.jars[el.dataset.jn].name = el.value.trim() || s.jars[el.dataset.jn].name; });
      document.querySelectorAll('[data-jb]').forEach(el => { s.jars[el.dataset.jb].bank = el.value.trim(); });
      save(); render(); toast('Saved.'); return;
    case 'bySave': { const v = num($('byIn').value); s.birthYear = v >= 1900 && v <= 2100 ? Math.round(v) : null; save(); render(); toast('Saved.'); return; }
    case 'rsSave': { const v = num($('rsIn').value), y = VE.yearOf(derive(s).next.month); s.roth.seed[y] = v >= 0 ? v : 0; save(); render(); toast('Saved.'); return; }
    case 'export': return exportAll();
    case 'import': return $('importFile').click();
    case 'reset':
      if (!confirm('Wipe Valley on this phone? Money, Study and +1 are not touched.')) return;
      if (!confirm('Really? Export first if you want to keep anything.')) return;
      try { localStorage.removeItem(KEY); localStorage.removeItem(LINE); } catch {}
      state = null; setup = null; screen = 'home'; render(); return;
  }
}
function readDamInputsIfAny() { if (document.querySelector('[data-dam]')) readDamInputs(); }
let evDraft = null;
function readEvent() {
  const v = id => { const el = $(id); return el ? el.value.trim() : undefined; };
  if (v('evLabel') !== undefined) evDraft.label = v('evLabel');
  if (v('evStart') !== undefined) evDraft.start = v('evStart');
  if (v('evEnd') !== undefined) evDraft.end = v('evEnd') || null;
  if (v('evAmt') !== undefined) evDraft.amount = v('evAmt') === '' ? null : num(v('evAmt'));
  if (v('evBills') !== undefined) evDraft.bills = v('evBills') === '' ? 0 : num(v('evBills'));
  if (v('evHours') !== undefined) evDraft.hours = v('evHours') === '' ? null : num(v('evHours'));
}
function saveEvent() {
  readEvent();
  const e = evDraft, err = t => { $('evErr').textContent = t; $('evErr').hidden = false; };
  if (!e.label) return err('Give it a name.');
  if (!/^\d{4}-\d{2}$/.test(e.start || '')) return err('Pick a month.');
  if (e.end && e.end < e.start) return err('“Until” is before “from”.');
  if (e.kind === 'once' && (e.amount == null || Number.isNaN(e.amount)) && e.hours > 0) {
    const r = derive(state).rate.rate;
    if (!r) return err('Log a paycheck first so hours can turn into dollars, or type an amount.');
    e.amount = -Math.round(e.hours * r);
  }
  if (e.amount == null || Number.isNaN(e.amount)) return err('Fill in the amount.');
  if (e.kind === 'income' && !(e.amount > 0)) return err('Take-home should be more than $0.');
  if (Number.isNaN(e.bills)) return err('Bills change should be a number.');
  if (e.kind !== 'income') delete e.bills;
  if (e.kind !== 'once') delete e.hours;
  if (e.kind === 'once') e.end = null;
  if (!e.id) { e.id = newId(); e.on = false; state.events.push(e); pathPreview = e.id; }
  else state.events = state.events.map(x => x.id === e.id ? e : x);
  evDraft = null; save(); closeSheet(); render(); buzz(12); toast('Saved. Tick it to count it in your plan.');
}
function onInput(e) {
  const t = e.target;
  if (t.matches('[data-ed], [data-ed-text]')) return refreshEditor();
  if (t.matches('[data-wish-saved]')) {
    const w = state.wishes.find(x => x.id === t.dataset.wishSaved), v = num(t.value);
    if (w) { w.saved = Number.isNaN(v) ? 0 : Math.max(0, v); save(); }
    return;
  }
  if (t.matches('[data-dam]') && state && state.damDraft) { state.damDraft.inputs[t.dataset.dam] = t.value.trim(); save(); return; }
  if (t.matches('[data-bk], [data-act-input="cushion"]') && billDraft) {
    readBills();
    const r = $('billRipple'); if (r) r.innerHTML = rippleHTML(ripple(state, billsPreview()));
  }
}
function onChange(e) {
  if (e.target.matches('[data-wish-saved]')) render();
}

/* ---------- Backup ---------- */
function exportAll() {
  const today = todayIso();
  const blob = new Blob([JSON.stringify({ app: '0_0', kind: 'valley', exported: today, state }, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = '0_0-valley-' + today + '.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function importFile(file) {
  return file.text().then(text => {
    let data; try { data = JSON.parse(text); } catch { data = null; }
    let s = data && data.state ? data.state : data;
    if (data && data.keys && data.keys[KEY]) { try { s = JSON.parse(data.keys[KEY]); } catch { s = null; } }
    if (!validState(s)) { alert('That file isn’t a Valley backup.'); return false; }
    if (state && !confirm('Replace Valley on this phone with the file from ' + (data.exported || 'that file') + '?')) return false;
    state = normalize(s); setup = null; save(); keep(); screen = 'home'; history.replaceState({ screen: 'home' }, ''); render(); toast('Restored.');
    return true;
  });
}

/* ---------- Start ---------- */
function start() {
  const s = load();
  state = s && validState(s) ? normalize(s) : null;
  history.replaceState({ screen: 'home' }, '');
  render();
  writeLine();   // opening Valley refreshes the start screen's line
  document.addEventListener('click', onClick);
  document.addEventListener('input', onInput);
  document.addEventListener('change', onChange);
  window.addEventListener('popstate', e => {
    const st = e.state || {};
    if ($('sheet')) { editing = null; const el = $('sheet'); el.remove(); sheetOpen = false; if (st.sheet) return; }
    sheetOpen = false;
    if (!state) return render();
    screen = st.screen || 'home'; render();
  });
  $('importFile').onchange = e => { const f = e.target.files[0]; if (f) importFile(f).finally(() => { e.target.value = ''; }); };
  // The timer keeps ticking on screen; a new day redraws everything.
  let shown = todayIso();
  setInterval(() => {
    if (state && state.timer) document.querySelectorAll('[data-tick]').forEach(el => { el.textContent = el.dataset.tick === 'clock' ? clockText(state) : earnedText(state); });
    if (state && todayIso() !== shown) { shown = todayIso(); if (!$('sheet')) render(); }
  }, 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && state && !$('sheet') && !document.activeElement.matches('input,select')) render(); });
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('../sw.js').catch(() => {});
}

if (typeof document !== 'undefined' && document.getElementById('app')) start();
