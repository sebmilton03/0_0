// Low tide: for the days you can't. The tab bar hides, habits pause, money keeps running,
// and your person is one tap away. The basics are never saved. Coming back in is kind and true.
// Also: welcome back after time away, and the one soft question after three quiet days.

import { esc, openSheet, closeSheet, toast, money } from '../ui.js';
import { tideOf, whileOut, missedWords } from '../engines/tide.js';
import { focusOf, progress } from '../engines/steps.js';
import { moneyView } from './money.js';
import { dateTop } from './home.js';
import { parked } from '../engines/week.js';
import { daysBetween } from '../engines/sebdate.js';

const basics = new Set();   // ate something, some water, rest: in memory only, never written anywhere
const waves = () => `<svg style="position:fixed;left:0;right:0;bottom:0;width:100%;height:240px;z-index:-1" viewBox="0 0 390 240" preserveAspectRatio="none">${[0, 1, 2].map(k => `<path d="M0 ${90 + k * 42} C 65 ${66 + k * 42}, 130 ${112 + k * 42}, 195 ${90 + k * 42} S 325 ${66 + k * 42}, 390 ${90 + k * 42} L390 240 L0 240Z" fill="rgba(150,180,255,${(0.05 + k * 0.03).toFixed(2)})"/>`).join('')}</svg>`;
const MESSAGES = ['hey, rough few days. can you call me?', 'want to get food this week?', 'no reason, just saying hi'];

/** Which screen Home should be, if any of these: 'tide' | 'back' | 'welcome' | 'ask' | null. */
export function which(ctx) {
  const t = tideOf(ctx.state), m = ctx.m;
  if (t.on) return 'tide';
  if (t.last && !t.welcomed && daysBetween(t.last.to, m.day) <= 2) return 'back';
  if (ctx.away() >= 5) return 'welcome';
  return null;
}

export function lowTide(ctx) {
  const { state: s, m } = ctx, v = moneyView(s, m.day);
  const safe = v.ready && v.vault && v.vault.months != null ? `You’re safe. About ${v.vault.months >= 1.5 ? Math.round(v.vault.months) + ' months' : v.vault.months >= 0.75 ? 'a month' : 'a few weeks'}, even if work stops.` : 'You’re safe. The bills are set up to keep going.';
  const minDam = v.ready && !v.dam.done && v.dam.days <= 3 ? minimum(s, v) : null;
  const B = [['ate something', 'ate'], ['some water', 'water'], ['rest', 'rest']];
  return { sky: 'tide', bare: true, html: waves() +
    `<div class="top">${dateTop(m.day)}<span class="r">low tide</span></div>` +
    `<div style="margin-top:36px" class="face"><button data-act="tideMenu" style="font:inherit;color:inherit;text-shadow:0 0 28px rgba(170,190,255,.35)">u_u</button></div>` +
    `<div class="say center" style="font-size:32px;margin-top:16px">Low tide.</div>` +
    `<p class="fine center" style="font-size:15px;margin-top:6px;color:rgba(255,255,255,.78)">It goes out. It comes back in on its own.</p>` +
    `<div class="lbl" style="text-align:center">Just the basics · only if you can</div>` +
    `<div style="display:flex;justify-content:center;gap:14px">${B.map(([t, k]) => `<button data-act="basic" data-k="${k}" style="width:94px;height:94px;border-radius:50%;display:grid;place-items:center;text-align:center;font-size:13px;font-weight:700;padding:10px;${basics.has(k) ? 'background:rgba(159,230,184,.2);border:1.5px solid rgba(159,230,184,.6)' : 'background:rgba(255,255,255,.05);border:1.5px solid rgba(255,255,255,.16)'}">${t}</button>`).join('')}</div>` +
    (minDam ? `<div class="next" style="margin-top:18px;background:rgba(255,213,154,.08);border-color:rgba(255,213,154,.3)"><small style="color:#ffd59a">One small thing</small><b style="font-size:16px">Move about ${money(minDam)} from Income to Bills.</b><p>So rent is covered on the 1st. The rest of Dam Day can wait.</p></div>` : '') +
    (v.ready ? `<div class="calm" style="margin-top:18px"><i>✓</i>Bills are paying themselves.</div>` : '') +
    `<div class="calm"><i>⛨</i>${esc(safe)}</div>` +
    `<div class="calm"><i>☾</i>Habits are paused. Nothing breaks.</div>` +
    `<button class="calm" data-act="apartment"><i>⌂</i>The apartment can wait.<span class="go">›</span></button>` +
    `<button class="calm" data-act="person" style="background:rgba(255,214,170,.1);border:1px solid rgba(255,214,170,.3)"><i>♡</i>Text your person<span class="go" style="color:#ffd59a">›</span></button>` +
    `<p class="fine center" style="margin-top:12px">If it ever gets really heavy, call or text 988.</p>` +
    `<p class="fine center" style="margin-top:14px">How’s the tide today? <button class="link" data-act="tideOff">it’s coming back in</button></p>` };
}

/** Roughly what Bills needs before the 1st: next month's bills target, minus what Bills last held. */
function minimum(s, v) {
  try {
    const m = s.money, plan = VE.billPlan(m.bills, m.loan, +m.jars.bills.cushion || 0), mi = +v.dam.splitMonth.slice(5) - 1;
    const last = (m.balances || []).filter(b => b.jar === 'bills').pop();
    return Math.max(0, Math.round(plan.target[mi] - (last ? last.value : 0)));
  } catch { return null; }
}

export function comingBack(ctx) {
  const { state: s, m } = ctx, t = tideOf(s), w = whileOut(s, t.last.from, t.last.to), v = moneyView(s, m.day), f = focusOf(s), p = f ? progress(s, f, m.day) : null;
  const missed = ctx.memo.missed ?? null;
  return { sky: 'dawn', bare: true, html:
    `<div class="top">${dateTop(m.day)}<span class="r">welcome back</span></div>` +
    `<div style="margin-top:32px" class="face" >o_o</div>` +
    `<div class="say center" style="font-size:30px;margin-top:14px">The tide’s coming back in.</div>` +
    `<p class="fine center" style="font-size:15px;margin-top:6px;color:rgba(255,255,255,.82)">${w.days} day${w.days === 1 ? '' : 's'} of low tide. Nothing broke.</p>` +
    `<div class="lbl">While the tide was out</div>` +
    (v.ready ? `<div class="calm"><i>$</i><span>${missed == null ? 'Shifts missed while it was out?' : esc(missedWords(missed, w.shiftHours, v.room))}<span class="opts" style="margin-top:6px">${[0, 1, 2, 3, 4].map(n => `<button class="opt${missed === n ? ' on' : ''}" data-act="missed" data-v="${n}" style="padding:5px 11px">${n}</button>`).join('')}</span></span></div>` : '') +
    (p ? `<div class="calm"><i>☾</i>${esc(f.name)} habit still at ${p.count} of ${p.n}. It waited for you.</div>` : '') +
    `<div class="calm"><i>⌂</i>Home can be small today. One five-minute reset counts.</div>` +
    `<div class="next" style="margin-top:14px"><small>The smallest way back in</small><b>${esc(smallest(s))}</b><p>That’s the whole plan. Everything else can follow.</p></div>` +
    `<button class="done warm" data-act="welcomed" style="margin-top:14px">Just that, for now</button>` +
    `<p class="fine center" style="margin-top:8px"><button class="link" data-act="welcomed">show me everything</button></p>` };
}
function smallest(s) {
  const along = Object.values(s.habits || {}).find(h => h.status === 'along' || (h.status === 'focus' && h.cue === 'morning'));
  return along ? along.steps[along.step || 0].text.replace(/\.$/, '') + ' tomorrow.' : 'Write “good morning” tomorrow.';
}

export function welcome(ctx) {
  const { state: s, m } = ctx, n = ctx.away(), v = moneyView(s, m.day), p = parked(s, m.day);
  let checks = 0;
  try { if (s.money && s.money.pay) checks = VE.paydaysBetween(s.money.pay, ctx.lastOpen(), m.day).length; } catch {}
  return { sky: 'dawn', bare: true, html:
    `<div class="top">${dateTop(m.day)}<span class="r">welcome back</span></div>` +
    `<div style="margin-top:30px" class="face">o_o</div>` +
    `<div class="say" style="font-size:34px;margin-top:20px">Welcome back.</div>` +
    `<p class="fine" style="font-size:15px;margin-top:8px;color:rgba(255,255,255,.8)">It’s been ${n} days. Nothing broke while you were gone.</p>` +
    `<div class="lbl">What happened, gently</div>` +
    (checks ? `<div class="calm"><i>$</i>Probably ${checks} paycheck${checks === 1 ? '' : 's'} landed · log ${checks === 1 ? 'it' : 'them'} when you can</div>` : '') +
    (focusOf(s) ? `<div class="calm"><i>☾</i>Habits rested. They pick up where you left off.</div>` : '') +
    (p.due.length ? `<div class="calm"><i>✎</i>${p.due.length} parked thought${p.due.length === 1 ? ' is' : 's are'} waiting</div>` : '') +
    (v.ready ? `<div class="calm"><i>◷</i>${v.dam.done ? 'Dam Day is done for this month.' : 'Dam Day is in ' + v.dam.days + ' days. Still on.'}</div>` : '') +
    `<button class="done warm" data-act="startHere" style="margin-top:20px">Start where I am</button>` +
    `<p class="fine center" style="margin-top:10px">No catching up required. Pick one thing, or none.</p>` };
}

/** The one soft question after three quiet days. */
export const askCard = n => `<div class="next" style="margin-top:22px;background:rgba(185,168,255,.08);border-color:rgba(185,168,255,.3)"><small style="color:#c8c2ff">Just checking</small><b style="font-size:16px">It’s been quiet for ${n} days. Busy, or heavy?</b><p>Either is okay. This is the only time it asks.</p><div class="opts"><button class="opt" data-act="justBusy">just busy</button><button class="opt" data-act="heavy">it’s been heavy</button></div></div>`;

/* ---------- Sheets ---------- */
function apartmentSheet(ctx) {
  const R = [['◌', 'dishes', 'just the sink'], ['⌂', 'trash out', 'one bag'], ['▭', 'one surface', 'desk or counter'], ['≋', 'open a window', 'fresh air counts']];
  openSheet(`<div class="lbl">Home</div><div class="say">The apartment can wait.</div><p class="fine" style="margin-top:6px">When you’re ready, pick one. Five minutes counts as a reset.</p>` +
    `<div class="grid2" style="margin-top:16px">${R.map(([i, t, s]) => `<button data-act="smallReset" data-v="${t}" style="padding:18px 16px;border-radius:20px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);text-align:left"><div style="font-size:22px">${i}</div><b style="display:block;font-size:16px;margin-top:10px">${t}</b><span class="fine">${s}</span></button>`).join('')}</div>` +
    `<p class="fine" style="margin-top:12px">The big Monday reset still waits for you, and it won’t pile up.</p>`);
}
export function personSheet(ctx) {
  const p = ctx.state.person, to = p && p.phone ? encodeURIComponent(p.phone.replace(/[^\d+]/g, '')) : '';
  openSheet(`<div class="lbl">Low tide</div><div class="say">Text your person.</div><p class="fine" style="margin-top:6px">Pick one. It opens in Messages, ready to send. Change the words if you want.</p>` +
    MESSAGES.map((msg, i) => `<a href="sms:${to}?body=${encodeURIComponent(msg)}" style="display:block;margin-top:10px;padding:14px 16px;border-radius:18px 18px 18px 6px;background:${i === 0 ? '#2f6fdb' : 'rgba(255,255,255,.07)'};font-size:15px;font-weight:600">${esc(msg)}</a>`).join('') +
    `<div class="calm" style="margin-top:14px"><i>☺</i>${p && p.name ? 'Your person: ' + esc(p.name) + ' · chosen on a good day' : 'Choose your person on a good day, in settings.'}</div>` +
    `<p class="fine center" style="margin-top:10px">Reaching out isn’t failing at this. It’s part of it.</p>`);
}
export function tideMenu(ctx) {
  const on = tideOf(ctx.state).on;
  openSheet(`<div class="lbl">Low tide</div><div class="say">${on ? 'The tide is out.' : 'For the days you can’t.'}</div>` +
    `<p class="fine" style="margin-top:6px">${on ? 'It ends when you say it’s coming back in.' : 'Almost everything hides. Habits pause, money keeps running, your person is one tap away. Nothing counts against you, ever.'}</p>` +
    `<button class="done ${on ? 'warm' : ''}" data-act="${on ? 'tideOff' : 'tideOn'}" style="margin-top:18px">${on ? 'It’s coming back in' : 'Low tide, for now'}</button>`);
}

/* ---------- Taps ---------- */
export const actions = {
  basic: (ctx, el) => { const k = el.dataset.k; basics.has(k) ? basics.delete(k) : basics.add(k); ctx.render(); },   // never saved
  apartment: ctx => apartmentSheet(ctx),
  smallReset: async (ctx, el) => { closeSheet(); await ctx.write('tick', { pillar: 'home', date: ctx.m.day, small: el.dataset.v }, 'That’s a reset.', 'tick'); },
  person: ctx => personSheet(ctx),
  tideMenu: ctx => tideMenu(ctx),
  tideOn: async ctx => { closeSheet(); basics.clear(); await ctx.write('tide.on', { date: ctx.m.day }, null); },
  tideOff: async ctx => { closeSheet(); await ctx.write('tide.off', { date: ctx.m.day }, null, 'double'); },
  missed: (ctx, el) => { ctx.memo.missed = +el.dataset.v; ctx.render(); },   // shown, not saved
  welcomed: async ctx => { await ctx.write('tide.welcomed', { date: ctx.m.day }); },
  startHere: ctx => { ctx.welcomeDone(); },
  justBusy: async ctx => { await ctx.write('tide.asked', { date: ctx.m.day }, 'Good. Carry on.'); },
  heavy: async ctx => { await ctx.write('tide.asked', { date: ctx.m.day }); await ctx.write('tide.on', { date: ctx.m.day }); },
};
