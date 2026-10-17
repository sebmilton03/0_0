// Money: a feeling first, then a range, then breathing room in hours. The day you can work less,
// the trade made visible, the vault in months of life, fun money per day, and Dam Day itself,
// one transfer at a time. Everyday numbers are rounded; exact cents only on Dam Day.

import { esc, openSheet, closeSheet, toast, buzz, money, hrs } from '../ui.js';
import { view, FEEL, trade, damPlan, afterDam, fromValley, amountsFor, lastBalance, POCKETS, EMPTY, engine } from '../engines/money.js';
import { weekHours, blocksOn } from '../engines/week.js';
import { addDays, weekday } from '../engines/sebdate.js';
import { monthFacts, named } from '../engines/tide.js';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const COLOR = { income: '#b9bfd9', bills: '#8fb8ff', gas: '#ffb37a', misc: '#9fe6b8', personal: '#ffd59a', vault: '#b9a8ff' };
const CAPTION = {
  income: () => 'where pay lands', bills: () => 'fills to what bills need',
  gas: j => 'tops up to ' + money(+j.cap || 0), misc: j => 'tops up to ' + money(+j.cap || 0),
  personal: j => money(+j.amount || 0) + ' a month, minus borrowing', vault: j => 'tops up to ' + money(+j.cap || 0),
};
let screen = 'home';   // 'home' or 'dam'
const M = s => s.money || EMPTY;

/** Work hours a week from Day's blocks, if any are planned. */
export function workWeek(s, day) { const w = weekHours(s, day).work; return w > 0 ? w : null; }
export function moneyView(s, day) { try { return view(s, day, workWeek(s, day)); } catch { return { ready: false }; } }

export function render(ctx) {
  const { state: s, m } = ctx, v = moneyView(s, m.day);
  if (!v.ready) return setup(ctx);
  if (screen === 'dam' && !v.dam.done) return damScreen(ctx, v);
  if (v.dam.done && !(s.months || {})[v.dam.month] && screen !== 'later') return monthClose(ctx, v);
  if (screen !== 'later') screen = 'home';
  const f = v.feeling, room = v.room;
  const lines = {
    steady: `About <b>${money(v.income.lo)}${v.income.hi - v.income.lo > 50 ? '–' + money(v.income.hi).slice(1) : ''}</b> coming in${v.range ? ' (tips move it)' : ''}. Bills are covered, with <b>${hrs(room)} hours of breathing room</b>.`,
    tight: `About <b>${money(v.income.lo)}</b> coming in. Bills are covered, with <b>${hrs(room)} hours</b> to spare. Tight, but fine.`,
    short: `About <b>${money(v.income.lo)}</b> coming in, which is <b>${hrs(-room)} hours short</b> of what life costs this month. The vault can carry it, or a shift or two.`,
    unknown: 'Log a paycheck and the hours show up here.',
  };
  const wl = v.workLess, t = v.loan ? trade(s, v, avgShift(s, m.day)) : null;
  const damLine = v.dam.done ? 'Dam Day is done. Next month starts clean.' : v.dam.open ? `Dam Day · ${v.dam.days === 0 ? 'today' : 'you can split early'}` : `Dam Day · ${dayName(v.dam.date)} · ${v.dam.days} days`;
  return {
    sky: m.sky, html:
      `<div class="top"><span><b>Money</b></span><span>this month</span></div>` +
      `<div class="say" style="font-size:30px;margin-top:24px">${FEEL[f]}</div>` +
      `<p class="fine" style="font-size:14px;margin-top:8px;color:rgba(255,255,255,.75)">${lines[f]}</p>` +
      (v.dam.open ? `<button class="done peachy" data-act="damOpen" style="margin-top:16px">The dam can open · start Dam Day</button>` : '') +
      (wl ? `<div class="next" style="margin-top:18px"><small>The day you can work less</small>
        <div style="display:flex;align-items:flex-end;gap:14px;margin-top:10px">
          <div style="flex:1"><div style="height:64px;border-radius:10px;background:linear-gradient(180deg,#ffcf9e,#e8875a)"></div><div class="fine" style="margin-top:6px">now<br><b style="font-size:15px">${hrs(wl.now)} hr/wk</b></div></div>
          ${wl.afterLoan != null ? `<div style="flex:1"><div style="height:${Math.max(16, 64 * wl.afterLoan / wl.now)}px;border-radius:10px;background:linear-gradient(180deg,#ffcf9e88,#e8875a88)"></div><div class="fine" style="margin-top:6px">after ${esc(M(s).loan.name || 'the loan')}<br><b style="font-size:15px">≈ ${hrs(wl.afterLoan)} hr/wk</b></div></div>` : ''}
          <div style="flex:1"><div style="height:44px;border-radius:10px;border:1.5px dashed rgba(255,207,158,.6)"></div><div class="fine" style="margin-top:6px">cheaper living<br><b style="font-size:15px">someday</b></div></div>
        </div>${wl.afterLoan != null ? `<p style="margin-top:10px">About ${hrs(wl.now - wl.afterLoan)} hours back every week, for school.</p>` : ''}</div>` : '') +
      (t ? `<button class="calm" data-act="trade" style="margin-top:12px"><i>⇄</i><span>Pick up a shift? ${esc(cap(M(s).loan.name || 'the loan'))} goes sooner, but study time shrinks. <span class="link">See the trade</span></span></button>` : '') +
      `<button class="calm" data-act="${v.dam.open ? 'damOpen' : 'damInfo'}"><i>◷</i>${esc(damLine)}</button>` +
      `<button class="calm" data-act="vault"><i>⛨</i>${v.vault && v.vault.months != null ? `Vault: you’re safe for ${about(v.vault.months)}` : 'Vault: type what’s in it to see your months of life'}</button>` +
      `<button class="calm" data-act="fun"><i>☺</i>${v.personal ? `Fun money: about ${money(Math.max(0, v.personal.perDay))} a day` : 'Fun money: type what’s in Personal'}</button>` +
      `<div class="lbl">The parts</div>` +
      `<button class="calm" data-act="bills"><i>☰</i>Bills<span class="go">${money(M(s).bills.reduce((t, b) => t + b.amounts.reduce((a, x) => a + x, 0), 0) / 12)}/mo ›</span></button>` +
      `<button class="calm" data-act="pockets"><i>◫</i>Your pockets<span class="go">›</span></button>` +
      `<button class="calm" data-act="paycheck"><i>$</i>Paychecks${v.rate ? ` · ${money(v.rate)}/hr` : ''}<span class="go">log one ›</span></button>`,
  };
}
const monthsWords = n => (n >= 1.75 ? Math.round(n) + ' months' : n >= 0.75 ? 'a month' : 'a few weeks');
const about = n => (n >= 0.75 ? 'about ' : '') + monthsWords(n);
const cap = x => String(x).charAt(0).toUpperCase() + String(x).slice(1);
const dayName = iso => DOW[weekday(iso)] + ' ' + MON[+iso.slice(5, 7) - 1] + ' ' + +iso.slice(8);
function avgShift(s, day) {
  const w = blocksOn(s, day).concat(...[1, 2, 3, 4, 5, 6].map(i => blocksOn(s, addDays(day, i)))).filter(b => b.kind === 'work');
  return w.length ? w.reduce((t, b) => t + b.hours, 0) / w.length : 8;
}

/* ---------- Setup: starts blank; bring in from Valley, or set it up here ---------- */
function setup(ctx) {
  const has = ctx.state.archived && ctx.state.archived.keys.includes('0_0-valley-v1');
  return { sky: ctx.m.sky, html:
    `<div class="top"><span><b>Money</b></span><span>set up</span></div>` +
    `<div class="say" style="font-size:30px;margin-top:24px">Money, in hours.</div>` +
    `<p class="fine" style="font-size:14px;margin-top:8px;color:rgba(255,255,255,.75)">How much of your week life costs, how much is breathing room, and Dam Day one transfer at a time.</p>` +
    (has ? `<button class="done warm" data-act="fromValley" style="margin-top:22px">Bring in from Valley</button><p class="fine center" style="margin-top:8px">Copies your pockets, bills, loan and paychecks. Valley keeps working as it is.</p><div class="lbl">Or set it up here</div>`
      : `<div class="empty">Nothing here yet. That’s a fine place to start.<span class="link" style="display:block">Three small steps, below.</span></div>`) +
    `<button class="calm" data-act="pockets"><i>◫</i>Your pockets<span class="go">›</span></button>` +
    `<button class="calm" data-act="bills"><i>☰</i>Your bills${M(ctx.state).bills.length ? ' · ' + M(ctx.state).bills.length : ''}<span class="go">›</span></button>` +
    `<button class="calm" data-act="paycheck"><i>$</i>A paycheck${M(ctx.state).paychecks.length ? ' · ' + M(ctx.state).paychecks.length : ''}<span class="go">›</span></button>` };
}

/* ---------- Dam Day: type the balances, then one transfer at a time ---------- */
function typedToday(s, day) {
  const out = {};
  for (const j of POCKETS) { const b = M(s).balances.filter(x => x.jar === j && x.date === day).pop(); if (b) out[j] = b.value; }
  return Object.keys(out).length === POCKETS.length ? out : null;
}
function damScreen(ctx, v) {
  const { state: s, m } = ctx, J = M(s).jars, typed = typedToday(s, m.day);
  const top = `<div class="top"><span><b>${dayName(m.day)}</b></span><span>Dam Day <button class="link" data-act="damClose" style="margin-left:8px">later</button></span></div>`;
  if (!typed) {
    return { sky: 'dusk', html: top + `<div class="say" style="font-size:30px;margin-top:24px">The dam is ready.</div>` +
      `<p class="fine" style="margin-top:6px">Open your bank app and type what each pocket holds right now. Nothing is pre-filled: typing it is checking it.</p>` +
      POCKETS.map(j => `<div class="lbl" style="margin-top:14px"><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${COLOR[j]};margin-right:6px"></span>${esc(J[j].name)}${J[j].bank ? ' · ' + esc(J[j].bank) : ''}</div><input class="field" inputmode="decimal" data-jar="${j}" placeholder="$0.00">`).join('') +
      `<button class="done peachy" data-act="damType" style="margin-top:20px">Work out the transfers</button>` };
  }
  const plan = damPlan(s, v, typed), moved = (M(s).moves[v.dam.month] || {}), i = plan.steps.findIndex(x => !(x.key in moved));
  const dots = plan.steps.map((x, k) => `<i style="display:inline-block;width:${k === i ? 22 : 10}px;height:10px;border-radius:5px;margin-right:6px;background:${x.key in moved ? '#9fe6b8' : k === i ? '#ffcf9e' : 'rgba(255,255,255,.15)'}"></i>`).join('');
  const done = plan.steps.filter(x => x.key in moved).map(x => `<div class="calm"><i>✓</i>${esc(x.from)} → ${esc(x.to)} · ${money(x.amount, true)}</div>`).join('');
  if (i < 0) {
    return { sky: 'dusk', html: top + `<div class="say" style="font-size:30px;margin-top:24px">That’s every transfer.</div>` +
      `<p class="fine" style="margin-top:6px">Close the dam and ${MONTH[+v.dam.splitMonth.slice(5) - 1]} starts clean.</p>` + done +
      `<button class="done warm" data-act="damDone" style="margin-top:20px">Close the dam</button>` };
  }
  const st = plan.steps[i], next = plan.steps.slice(i + 1).map(x => x.to + ' ' + money(x.amount));
  return { sky: 'dusk', html: top + `<div class="say" style="font-size:30px;margin-top:24px">The dam is open.</div>` +
    `<p class="fine" style="margin-top:6px">One transfer at a time, in your bank app. Take your time.</p>` +
    `<div style="margin-top:16px">${dots}<span class="fine" style="margin-left:4px">${i + 1} of ${plan.steps.length}</span></div>` +
    (plan.short > 0.5 ? `<div class="next" style="background:rgba(255,213,154,.08);border-color:rgba(255,213,154,.3)"><small style="color:#ffd59a">Gentle heads-up</small><b style="font-size:16px">${money(plan.short)} short this time.</b><p>The pockets near the end fill less. Nothing breaks.</p></div>` : '') +
    `<div style="margin-top:16px;padding:22px 20px;border-radius:24px;background:rgba(255,255,255,.07);border:1px solid rgba(255,207,158,.4)">` +
    `<small style="font-size:11px;font-weight:800;letter-spacing:1.4px;color:rgba(255,255,255,.55)">MOVE</small><div style="font-size:40px;font-weight:800;margin-top:4px">${money(st.amount, true)}</div>` +
    `<div style="font-size:15px;font-weight:700;color:rgba(255,255,255,.8);margin-top:4px">${esc(st.from)} → ${esc(st.to)}</div>` +
    `<button class="done peachy" data-act="damMove" data-key="${st.key}" data-amount="${st.amount}" style="margin-top:16px">Done</button></div>` +
    (done ? `<div class="lbl">Done</div>${done}` : '') +
    (next.length ? `<p class="fine center" style="margin-top:12px">Next: ${esc(next.slice(0, 2).join(', then '))}${next.length > 2 ? ', and the rest' : ''}.</p>` : '') };
}

/* ---------- The month close: four facts and one sentence to name it. Nothing scored. ---------- */
function monthClose(ctx, v) {
  const s = ctx.state, f = monthFacts(s, v.dam.month), mi = +v.dam.month.slice(5) - 1, past = named(s).slice(0, 4);
  const loanName = M(s).loan ? M(s).loan.name || 'the loan' : null;
  return { sky: 'dusk', html:
    `<div class="top"><span><b>${dayName(ctx.m.day)}</b></span><span>month end · Dam Day</span></div>` +
    `<div style="font-family:var(--serif);font-size:52px;line-height:1;margin-top:20px">${MONTH[mi]},<br>closed.</div>` +
    `<div class="facts"><div><b>${f.hours ? Math.round(f.hours) + ' hr' : '—'}</b><span>worked (from your checks)</span></div>` +
    `<div><b>${f.loanMoved ? '−' + money(f.loanMoved) : '—'}</b><span>${loanName ? esc(loanName) + ' moved' : 'extra to the loan'}</span></div>` +
    `<div><b>${f.habitDays}</b><span>days a habit happened</span></div><div><b>${f.grateful}</b><span>grateful lines</span></div></div>` +
    `<div class="grat" style="border-style:dashed;margin-top:18px"><small>Name this month</small><input id="mname" maxlength="80" placeholder="the month I…"></div>` +
    (past.length ? `<div class="lbl" style="margin-top:20px">Months behind you</div>` + past.map(([mo, x]) => `<div style="display:flex;justify-content:space-between;padding:9px 2px;border-bottom:1px solid rgba(255,255,255,.07);font-size:13.5px"><span style="color:rgba(255,255,255,.5);font-weight:700">${MON[+mo.slice(5) - 1]}</span><em style="font-family:var(--serif);color:rgba(255,255,255,.85)">${esc(x.name)}</em></div>`).join('') : '') +
    `<button class="done warm" data-act="closeMonth" style="margin-top:18px">Close ${MONTH[mi]}</button>` +
    `<button class="calm" data-act="export"><i>⇩</i>Save a backup while you’re here</button>` +
    `<p class="fine center" style="margin-top:10px">${MONTH[(mi + 1) % 12]} starts clean. <button class="link" data-act="closeLater">later</button></p>` };
}

/* ---------- Sheets ---------- */
function billsSheet(ctx) {
  const s = ctx.state, m = M(s), v = moneyView(s, ctx.m.day), rows = m.bills.map(b => {
    const months = b.amounts.map((a, i) => (a > 0 ? i : -1)).filter(i => i >= 0), flat = months.length === 12 && b.amounts.every(a => a === b.amounts[0]);
    const amt = flat ? b.amounts[0] : Math.max(...b.amounts), when = b.loan ? 'the loan payment' : flat ? 'monthly' : months.map(i => MON[i]).join(' · ');
    return `<button class="pk" style="width:100%;text-align:left" data-act="bill" data-id="${esc(b.id)}"><span class="d"><b>${esc(b.name)}</b><br><span class="fine">${esc(when)}${b.bareMin ? ' · bare minimum' : ''}</span></span><b>${b.loan && m.loan ? money(+m.loan.payment || 0) : money(amt)}</b></button>`;
  }).join('');
  const perMonth = m.bills.length ? engine().billPlan(m.bills, m.loan, +m.jars.bills.cushion || 0).perMonth : 0;
  openSheet(`<div class="lbl">Bills</div><div class="say">${m.bills.length ? 'Bills run in the background.' : 'No bills yet.'}</div>` +
    (m.bills.length && v.rate ? `<p class="fine" style="margin-top:6px">About ${Math.round(perMonth / v.rate)} hours of work a month, big bills saved ahead.</p>` : '') +
    rows + `<button class="pbtn" style="margin-top:14px" data-act="bill">+ add a bill</button>` +
    `<p class="fine" style="margin-top:10px">Any rhythm: monthly, every six months, yearly. A change is kept as history, so past months stay true.</p>`);
}
function billSheet(ctx, id) {
  const m = M(ctx.state), b = m.bills.find(x => x.id === id) || { name: '', amounts: Array(12).fill(0) };
  const months = b.amounts.map((a, i) => (a > 0 ? i : -1)).filter(i => i >= 0);
  const rhythm = !months.length || months.length === 12 ? 'monthly' : months.length === 2 ? 'six' : 'yearly';
  const amt = months.length ? b.amounts[months[0]] : '';
  openSheet(`<div class="lbl">${id ? 'Change a bill' : 'Add a bill'}</div><input class="field serif" id="bname" value="${esc(b.name)}" placeholder="what it is" style="font-size:22px">` +
    (b.loan ? `<p class="fine">This is the loan payment; its amount comes from the loan.</p>` :
      `<div class="lbl">Amount</div><input class="field" id="bamt" inputmode="decimal" value="${esc(amt)}" placeholder="$0" style="font-size:22px;font-weight:800;text-align:center">` +
      `<div class="lbl">How often</div><div class="opts" id="brh" style="margin-top:0">${[['monthly', 'monthly'], ['six', 'every 6 months'], ['yearly', 'yearly']].map(([k, l]) => `<button class="opt${rhythm === k ? ' on' : ''}" data-act="pick" data-v="${k}">${l}</button>`).join('')}</div>` +
      `<div class="lbl">First month it’s due</div><select class="field" id="bstart">${MONTH.map((n, i) => `<option value="${i}"${(months[0] ?? +ctx.m.day.slice(5, 7) % 12) === i ? ' selected' : ''}>${n}</option>`).join('')}</select>`) +
    `<label class="calm" style="margin-top:14px"><input type="checkbox" id="bbare"${b.bareMin ? ' checked' : ''} style="width:20px;height:20px"> Part of the bare minimum</label>` +
    `<button class="pbtn" style="margin-top:16px" data-act="saveBill" data-id="${esc(id || '')}">Keep it</button>` +
    (id && !b.loan ? `<p class="fine center" style="margin-top:12px"><button data-act="dropBill" data-id="${esc(id)}">remove this bill</button></p>` : ''));
}
function pocketsSheet(ctx) {
  const m = M(ctx.state), J = m.jars;
  openSheet(`<div class="lbl">Your pockets</div><div class="say">Where money lives.</div><p class="fine" style="margin-top:6px">Same pockets as your bank, in the order Dam Day fills them.</p>` +
    POCKETS.map(k => `<button class="pk" style="width:100%;text-align:left;align-items:center" data-act="pocket" data-k="${k}"><span style="width:12px;height:12px;border-radius:50%;background:${COLOR[k]}"></span><span class="d"><b>${esc(J[k].name)}</b>${J[k].bank ? ' · ' + esc(J[k].bank) : ''}<br><span class="fine">${esc(CAPTION[k](J[k]))}</span></span><span class="w">edit</span></button>`).join('') +
    `<button class="pk" style="width:100%;text-align:left" data-act="loan"><span class="d"><b>${m.loan ? esc(m.loan.name || 'Loan') : 'A loan to beat?'}</b><br><span class="fine">${m.loan ? money(+m.loan.owed) + ' owed · ' + money(+m.loan.payment) + '/mo' : 'Add one, and the leftover can attack it.'}</span></span><span class="w">${m.loan ? 'edit' : 'add'}</span></button>` +
    `<button class="next" data-act="extra" style="text-align:left;width:100%"><small>Whatever’s left</small><b style="font-size:16px">${m.extra.first === 'roth' ? 'The Roth first, then ' + esc(m.loan ? m.loan.name || 'the loan' : 'the loan') : esc(m.loan ? m.loan.name || 'The loan' : 'The loan') + ' first, then the Roth'}, then ${Math.round(m.extra.investShare * 100)}% invest · ${100 - Math.round(m.extra.investShare * 100)}% fun</b><p>Tap to change the order or the split.</p></button>`);
}
const FIELDS = { bills: [['cushion', 'Cushion (what it keeps at its lowest)']], gas: [['cap', 'Tops up to'], ['spend', 'Spends a month']], misc: [['cap', 'Tops up to'], ['spend', 'Spends a month']], personal: [['amount', 'Refill every month']], vault: [['cap', 'Full at (your safety net)']], income: [] };
function pocketSheet(ctx, k) {
  const j = M(ctx.state).jars[k];
  openSheet(`<div class="lbl">Pocket</div><div class="grid2"><input class="field serif" id="pname" value="${esc(j.name)}" placeholder="name"><input class="field" id="pbank" value="${esc(j.bank || '')}" placeholder="bank’s label, like S01"></div>` +
    FIELDS[k].map(([f, l]) => `<div class="lbl">${l}</div><input class="field" inputmode="decimal" data-f="${f}" value="${esc(j[f] ?? '')}" placeholder="$0">`).join('') +
    `<button class="pbtn" style="margin-top:16px" data-act="savePocket" data-k="${k}">Keep it</button>`);
}
function loanSheet(ctx) {
  const l = M(ctx.state).loan || {};
  openSheet(`<div class="lbl">The loan</div><input class="field serif" id="lname" value="${esc(l.name || '')}" placeholder="name it (the car, say)" style="font-size:20px">` +
    `<div class="grid2"><div><div class="lbl">Owed now</div><input class="field" inputmode="decimal" id="lowed" value="${esc(l.owed ?? '')}" placeholder="$0"></div><div><div class="lbl">Payment a month</div><input class="field" inputmode="decimal" id="lpay" value="${esc(l.payment ?? '')}" placeholder="$0"></div></div>` +
    `<div class="lbl">Rate (APR %)</div><input class="field" inputmode="decimal" id="lapr" value="${esc(l.apr != null ? +(l.apr * 100).toFixed(3) : '')}" placeholder="6.5">` +
    `<p class="fine">Its payment comes out of Bills on its own.</p><button class="pbtn" style="margin-top:10px" data-act="saveLoan">Keep it</button>` +
    (M(ctx.state).loan ? `<p class="fine center" style="margin-top:12px"><button data-act="dropLoan">it’s paid off · remove it</button></p>` : ''));
}
function extraSheet(ctx) {
  const x = M(ctx.state).extra;
  openSheet(`<div class="lbl">Whatever’s left</div><div class="say">Where the leftover goes.</div>` +
    `<div class="lbl">First</div><div class="opts" id="xfirst" style="margin-top:0"><button class="opt${x.first !== 'roth' ? ' on' : ''}" data-act="pick" data-v="loan">the loan</button><button class="opt${x.first === 'roth' ? ' on' : ''}" data-act="pick" data-v="roth">the Roth</button></div>` +
    `<div class="grid2"><div><div class="lbl">Roth limit a year</div><input class="field" inputmode="decimal" id="xroth" value="${esc(x.rothLimit)}"></div><div><div class="lbl">Invest share %</div><input class="field" inputmode="decimal" id="xinv" value="${esc(Math.round(x.investShare * 100))}"></div></div>` +
    `<p class="fine">After the loan and the Roth, the rest splits into investing and fun money.</p><button class="pbtn" style="margin-top:10px" data-act="saveExtra">Keep it</button>`);
}
function paycheckSheet(ctx) {
  const m = M(ctx.state), last = m.paychecks.slice().sort((a, b) => (a.date < b.date ? -1 : 1)).slice(-3).reverse();
  const usual = [...new Set(last.map(c => c.hours))].slice(0, 2);
  openSheet(`<div class="lbl">A paycheck</div><div class="say">Two numbers off the stub.</div>` +
    `<div class="lbl">Pay date</div><input class="field" type="date" id="cdate" value="${esc(ctx.m.day)}">` +
    `<div class="lbl">Take-home</div><input class="field" inputmode="decimal" id="cnet" placeholder="$0.00" style="font-size:22px;font-weight:800;text-align:center">` +
    `<div class="lbl">Hours</div><div style="display:flex;gap:10px;align-items:center"><input class="field" inputmode="decimal" id="chrs" value="${esc(usual[0] ?? '')}" placeholder="0" style="font-size:22px;font-weight:800;text-align:center;flex:1">` +
    `<div class="opts" style="margin:0">${['−1', '+1', ...usual.map(String)].map(x => `<button class="opt" data-act="step" data-v="${x}">${x}</button>`).join('')}</div></div>` +
    `<button class="pbtn" style="margin-top:16px" data-act="savePaycheck">Keep it</button>` +
    (last.length ? `<div class="lbl">The last ${last.length}</div>` + last.map(c => `<div class="calm"><i>$</i>${dayName(c.date)} · ${money(c.net)} for ${c.hours} hr<span class="go">${money(c.net / c.hours, true)}/hr</span></div>`).join('') + `<p class="fine" style="margin-top:8px">$/hr is the average of the last three, so a raise shows up fast.</p>` : ''));
}
function funSheet(ctx) {
  const v = moneyView(ctx.state, ctx.m.day), p = v.personal, J = M(ctx.state).jars;
  const strip = p ? Array.from({ length: Math.min(31, p.days) }, (_, i) => `<i style="flex:1;height:30px;border-radius:6px;background:${i < 1 ? '#ffd59a' : 'rgba(255,213,154,.22)'}"></i>`).join('') : '';
  openSheet(`<div class="lbl">${esc(J.personal.name)} · your fun money</div>` +
    (p ? `<div class="say">About ${money(Math.max(0, p.perDay))} a day.</div><p class="fine" style="margin-top:6px">${money(Math.max(0, p.balance))} left until the dam opens on ${dayName(p.until)}.</p><div style="display:flex;gap:4px;margin-top:14px">${strip}</div>`
      : `<div class="say">What’s in ${esc(J.personal.name)} right now?</div>`) +
    (v.iou > 0 ? `<div class="next" style="background:rgba(143,184,255,.08);border-color:rgba(143,184,255,.3)"><small style="color:#bcd2ff">Borrowed</small><b style="font-size:16px">${money(v.iou)} from another pocket</b><p>That’s okay. It comes out of next month’s refill, so the pocket is whole again.</p></div>` : '') +
    `<div class="lbl">${p ? 'Type a fresh balance' : 'Type it from your bank app'}</div><div style="display:flex;gap:8px"><input class="field" inputmode="decimal" id="fbal" placeholder="$0"><button class="pbtn" data-act="saveFunBal">Keep</button></div>` +
    `<div class="lbl">Log something you bought</div><div style="display:flex;gap:8px"><input class="field" inputmode="decimal" id="fspent" placeholder="$0" style="flex:1"><input class="field" id="fnote" placeholder="what (optional)" style="flex:2"></div><button class="pbtn" style="margin-top:8px" data-act="saveSpent">Log it</button>` +
    `<div class="lbl">Borrowed from another pocket?</div><div style="display:flex;gap:8px"><input class="field" inputmode="decimal" id="bamtb" placeholder="$0" style="flex:1"><select class="field" id="bfrom" style="flex:1">${['gas', 'misc', 'vault'].map(k => `<option value="${k}">${esc(J[k].name)}</option>`).join('')}</select></div><button class="pbtn" style="margin-top:8px" data-act="saveBorrow">Note it</button>` +
    `<p class="fine center" style="margin-top:14px">No judgment. The card in your wallet is the real limit; this just keeps you aware.</p>`);
}
function vaultSheet(ctx) {
  const v = moneyView(ctx.state, ctx.m.day), x = v.vault, m = M(ctx.state);
  const bare = m.bills.filter(b => b.bareMin).map(b => b.name);
  openSheet(`<div class="lbl">${esc(m.jars.vault.name)} · your safety net</div>` +
    (x && x.months != null ? `<div class="say" style="font-size:34px">You’re safe.</div><div class="facts"><div><b>${monthsWords(x.months)}</b><span>of normal life</span></div><div><b>${x.bareMonths ? monthsWords(x.bareMonths) : '—'}</b><span>if you go bare</span></div></div>` +
      (x.cap ? `<div class="lbl">Toward full</div><div style="position:relative;height:16px;border-radius:8px;background:rgba(255,255,255,.07)"><i style="position:absolute;left:0;top:0;bottom:0;width:${Math.min(100, x.balance / x.cap * 100)}%;border-radius:8px;background:linear-gradient(90deg,#8fb8ff,#b9a8ff)"></i></div><p class="fine" style="margin-top:6px">Full at ${money(x.cap)}.${x.balance >= x.cap ? ' Nothing to do here.' : ''}</p>` : '')
      : `<div class="say">What’s in the vault?</div>`) +
    `<div class="calm" style="margin-top:14px"><i>✎</i>${bare.length ? 'Bare minimum: ' + esc(bare.join(', ')) + ', plus gas and misc.' : 'Mark bills as “bare minimum” in Bills to see the bare months.'}</div>` +
    `<div class="lbl">Type a fresh balance</div><div style="display:flex;gap:8px"><input class="field" inputmode="decimal" id="vbal" placeholder="$0"><button class="pbtn" data-act="saveVault">Keep</button></div>`);
}
function tradeSheet(ctx) {
  const s = ctx.state, v = moneyView(s, ctx.m.day), sh = avgShift(s, ctx.m.day), t = trade(s, v, sh);
  if (!t) return;
  openSheet(`<div class="lbl">The trade, made visible</div><div class="say">One more shift a week.</div>` +
    `<div class="facts"><div><b>${t.sooner} month${t.sooner === 1 ? '' : 's'}</b><span>sooner, ${esc(M(s).loan.name || 'the loan')} gone</span></div><div><b>−${hrs(t.studyLost)} hr</b><span>a week for study and rest</span></div></div>` +
    `<p class="fine" style="margin-top:14px">About ${money(t.extra)} more a month goes to the loan. Both are fine choices; this just shows what each one costs.</p>`);
}

/* ---------- Taps ---------- */
const num = id => { const v = String(document.getElementById(id)?.value || '').replace(/[$,\s]/g, ''); return v === '' ? NaN : +v; };
const pick = el => el.parentElement.querySelectorAll('.opt').forEach(o => o.classList.toggle('on', o === el));
export const actions = {
  pick: (ctx, el) => pick(el),
  bills: ctx => billsSheet(ctx),
  bill: (ctx, el) => billSheet(ctx, el.dataset.id),
  pockets: ctx => pocketsSheet(ctx),
  pocket: (ctx, el) => pocketSheet(ctx, el.dataset.k),
  loan: ctx => loanSheet(ctx),
  extra: ctx => extraSheet(ctx),
  paycheck: ctx => paycheckSheet(ctx),
  fun: ctx => funSheet(ctx),
  vault: ctx => vaultSheet(ctx),
  trade: ctx => tradeSheet(ctx),
  damInfo: ctx => { const v = moneyView(ctx.state, ctx.m.day); openSheet(`<div class="lbl">Dam Day</div><div class="say">The dam opens in ${v.dam.days} days.</div><p class="fine" style="margin-top:6px">${dayName(v.dam.date)}, the last day of the month. It can open up to a week early, once the last check of the month has landed.</p><div class="lbl">What it will do</div><div class="calm"><i>✓</i>Bills ready for ${MONTH[+v.dam.splitMonth.slice(5) - 1]}</div><div class="calm"><i>✓</i>${esc(M(ctx.state).jars.gas.name)} and ${esc(M(ctx.state).jars.misc.name)} filled back up</div><div class="calm"><i>☺</i>Fun money for the month</div><div class="calm"><i>→</i>The rest to ${esc(M(ctx.state).loan ? M(ctx.state).loan.name || 'the loan' : 'the Roth')}</div><p class="fine center" style="margin-top:12px">On the day, it shows each transfer, one at a time.</p>`); },
  damOpen: ctx => { closeSheet(true); screen = 'dam'; ctx.render(); window.scrollTo(0, 0); },
  damClose: ctx => { screen = 'home'; ctx.render(); },
  damType: async ctx => {
    const vals = {};
    for (const el of document.querySelectorAll('[data-jar]')) { const v = String(el.value).replace(/[$,\s]/g, ''); if (v === '' || isNaN(+v)) return toast('Type every pocket. 0 is fine.'); vals[el.dataset.jar] = +v; }
    for (const [jar, value] of Object.entries(vals)) await ctx.log.append('balance', { date: ctx.m.day, jar, value }, 'money');
    await ctx.refresh();
  },
  damMove: async (ctx, el) => { const v = moneyView(ctx.state, ctx.m.day); await ctx.write('dam.move', { month: v.dam.month, key: el.dataset.key, amount: +el.dataset.amount }, 'Done', 'tick'); window.scrollTo(0, 0); },
  damDone: async ctx => {
    const v = moneyView(ctx.state, ctx.m.day), typed = typedToday(ctx.state, ctx.m.day), plan = damPlan(ctx.state, v, typed);
    screen = 'home';
    await ctx.write('dam.done', { month: v.dam.month, date: ctx.m.day, after: afterDam(typed, plan) }, 'The dam is closed', 'three');
  },
  closeMonth: async ctx => {
    const v = moneyView(ctx.state, ctx.m.day), name = document.getElementById('mname')?.value.trim() || '';
    await ctx.log.append('month.close', { month: v.dam.month, name }, 'money');
    // (The month's checkpoint is saved once the month has really ended; see start() in app.js.)
    screen = 'home'; await ctx.refresh(); toast(name ? '“' + name + '”' : 'Closed. A new month.');
  },
  closeLater: ctx => { screen = 'later'; ctx.render(); },
  fromValley: async ctx => {
    const arc = (await ctx.log.all()).filter(e => e.kind === 'v1-archive').pop();
    const keys = arc ? arc.data.keys : {}, data = fromValley(keys['0_0-valley-v1']);
    if (!data) return toast('Couldn’t read Valley’s data.');
    // Money v1's checks join the same list (one paycheck list), matched by pay date.
    try {
      const mv = JSON.parse(keys['0_0-money-v1'] || 'null'), lag = mv && mv.sources && mv.sources[0] ? mv.sources[0].lag : null, have = new Set(data.paychecks.map(c => c.date));
      if (mv && lag != null) for (const e of mv.events || []) if (e.type === 'check' && e.value > 0 && e.hours > 0) { const d = addDays(e.end, lag); if (!have.has(d)) { data.paychecks.push({ id: e.id, date: d, net: +e.value, hours: +e.hours }); have.add(d); } }
    } catch {}
    await ctx.write('money.import', data, 'Brought in from Valley', 'tick');
  },
  saveBill: async (ctx, el) => {
    const m = M(ctx.state), id = el.dataset.id || 'bill' + Date.now().toString(36), old = m.bills.find(b => b.id === id), name = document.getElementById('bname').value.trim() || 'Bill';
    let amounts = old ? old.amounts : Array(12).fill(0);
    if (!old || !old.loan) {
      const a = num('bamt'); if (!(a >= 0)) return toast('Type the amount.');
      amounts = amountsFor(a, document.querySelector('#brh .opt.on')?.dataset.v || 'monthly', +document.getElementById('bstart').value);
    }
    const v0 = moneyView(ctx.state, ctx.m.day);
    closeSheet(); await ctx.write('bill.set', { id, name, amounts, loan: old ? old.loan : false, bareMin: document.getElementById('bbare')?.checked || false });
    const v1 = moneyView(ctx.state, ctx.m.day);
    if (v0.ready && v1.ready && v0.lifeHours != null) { const d = v1.lifeHours - v0.lifeHours; toast(Math.abs(d) < 0.5 ? 'Kept' : `About ${hrs(Math.abs(d))} ${d > 0 ? 'more' : 'fewer'} hours of work a month`); } else toast('Kept');
  },
  dropBill: async (ctx, el) => { closeSheet(); await ctx.write('bill.remove', { id: el.dataset.id }, 'Bill removed'); },
  savePocket: async (ctx, el) => {
    const set = { name: document.getElementById('pname').value.trim() || EMPTY.jars[el.dataset.k].name, bank: document.getElementById('pbank').value.trim() };
    for (const i of document.querySelectorAll('[data-f]')) { const v = String(i.value).replace(/[$,\s]/g, ''); set[i.dataset.f] = v === '' ? 0 : +v; if (isNaN(set[i.dataset.f])) return toast('Numbers only, please.'); }
    closeSheet(); await ctx.write('pocket.set', { key: el.dataset.k, set }, 'Kept');
  },
  saveLoan: async ctx => {
    const owed = num('lowed'), pay = num('lpay'), apr = num('lapr');
    if (!(owed >= 0) || !(pay >= 0) || !(apr >= 0) || apr > 40) return toast('Check the numbers. Type 6.5 for 6.5%.');
    const name = document.getElementById('lname').value.trim() || 'Loan', m = M(ctx.state);
    closeSheet(); await ctx.write('loan.set', { loan: { name, owed, payment: pay, apr: apr / 100, asOf: ctx.m.day } }, 'Kept');
    if (!m.bills.some(b => b.loan)) await ctx.write('bill.set', { id: 'loan', name: name + ' payment', amounts: Array(12).fill(0), loan: true, bareMin: true });
  },
  dropLoan: async ctx => { closeSheet(); await ctx.write('loan.set', { loan: null }); await ctx.write('bill.remove', { id: (M(ctx.state).bills.find(b => b.loan) || {}).id }, 'Paid off. That’s huge.', 'three'); },
  saveExtra: async ctx => {
    const roth = num('xroth'), inv = num('xinv');
    if (!(roth >= 0) || !(inv >= 0 && inv <= 100)) return toast('Check the numbers.');
    closeSheet(); await ctx.write('extra.set', { first: document.querySelector('#xfirst .opt.on')?.dataset.v || 'loan', rothLimit: roth, investShare: inv / 100 }, 'Kept');
  },
  step: (ctx, el) => { const i = document.getElementById('chrs'), v = el.dataset.v; i.value = v === '−1' ? Math.max(0, (+i.value || 0) - 1) : v === '+1' ? (+i.value || 0) + 1 : v; },
  savePaycheck: async ctx => {
    const date = document.getElementById('cdate').value, net = num('cnet'), hours = num('chrs');
    if (!date || !(net > 0) || !(hours > 0)) return toast('The date, take-home and hours.');
    closeSheet(); await ctx.write('paycheck', { date, net, hours }, 'Paycheck kept', 'tick');
  },
  saveFunBal: async ctx => { const v = num('fbal'); if (!(v >= 0)) return; closeSheet(); await ctx.write('balance', { date: ctx.m.day, jar: 'personal', value: v }, 'Kept'); },
  saveSpent: async ctx => { const v = num('fspent'); if (!(v > 0)) return; const note = document.getElementById('fnote').value.trim(); closeSheet(); await ctx.write('spent', { date: ctx.m.day, amount: v, note }, 'Logged'); },
  saveBorrow: async ctx => { const v = num('bamtb'); if (!(v > 0)) return; closeSheet(); await ctx.write('borrow', { date: ctx.m.day, from: document.getElementById('bfrom').value, amount: v }, 'Noted. Dam Day pays it back.'); },
  saveVault: async ctx => { const v = num('vbal'); if (!(v >= 0)) return; closeSheet(); await ctx.write('balance', { date: ctx.m.day, jar: 'vault', value: v }, 'Kept'); },
};
